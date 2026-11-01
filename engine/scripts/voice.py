#!/usr/bin/env python3
"""Makes voice.mp3 (and, with ElevenLabs, voice.alignment.json) from script.txt.

usage: voice.py <slug>                              the full take, using the voice set in reel.json
       voice.py <slug> --audition id:label,id:label the first two sentences in each voice -> reels/<slug>/voices/ (you choose)

Two providers, picked by "provider" in reel.json:
  elevenlabs (default)  "with timestamps": exact character times, no recogniser
    "voice": { "id": "...", "name": "...", "model": "eleven_multilingual_v2", "speed": 1.12,
               "stability": 0.5, "similarity": 0.8, "style": 0.0 }
  sarvam                Sarvam Bulbul, Indian voices; SARVAM_API_KEY. It gives no word times, so align.py times the
                        take with whisper.cpp. Each paragraph is its own request, joined by a real pause, so every
                        scene change has silence to land in.
    "voice": { "provider": "sarvam", "id": "shubh", "model": "bulbul:v3", "language": "en-IN", "pace": 1.0,
               "temperature": 0.6, "pause": 0.45 }
  say                   a placeholder from the Mac's own voices (free, offline), to build and check a reel before the
                        real voice; scenes follow the words, so re-voicing later needs only align.py again
    "voice": { "provider": "say", "id": "Aman", "rate": 175, "pause": 0.45 }

Takes are never patched or spliced: edit the script or the voice, run this again, then run align.py again.
The model occasionally skips the final line, so the end is transcribed and checked against the script before the take is kept.
Keys come from the environment or from .env.local at the top of this repo, and are never saved anywhere.
"""
import base64, difflib, json, os, re, subprocess, sys, tempfile, urllib.error, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API = "https://api.elevenlabs.io/v1"
from where import WHISPER, whisper_cli   # whisper model and program kept in this folder, on any OS
DEFAULTS = {"model": "eleven_multilingual_v2", "speed": 1.12, "stability": 0.5, "similarity": 0.8, "style": 0.0}
norm = lambda s: re.sub(r"[^a-z0-9 ]", "", s.lower()).split()


def api_key(name="ELEVENLABS_API_KEY"):
    key = os.environ.get(name, "")
    env = ROOT.parent / ".env.local"
    if not key and env.exists():
        key = next((l.split("=", 1)[1].strip().strip("\"'") for l in env.read_text().splitlines() if l.startswith(name + "=")), "")
    return key or sys.exit(f"no {name} in the environment or in .env.local")


SARVAM = {"id": "shubh", "model": "bulbul:v3", "language": "en-IN", "pace": 1.0, "temperature": 0.6, "pause": 0.45}


def sarvam(text, v):
    """One Sarvam Bulbul request: text (at most 2500 characters) to WAV bytes at 44.1 kHz."""
    body = {"text": text, "language_code": v["language"], "speaker": v["id"], "model": v["model"], "pace": v["pace"],
            "speech_sample_rate": 44100, "output_audio_codec": "wav"}
    if v["model"] != "bulbul:v2":
        body["temperature"] = v["temperature"]
    req = urllib.request.Request("https://api.sarvam.ai/text-to-speech", data=json.dumps(body).encode(),
                                 headers={"api-subscription-key": api_key("SARVAM_API_KEY"), "Content-Type": "application/json"})
    try:
        out = json.load(urllib.request.urlopen(req, timeout=180))
    except urllib.error.HTTPError as e:
        sys.exit(f"Sarvam refused ({e.code}): {e.read().decode()[:300]}")
    return base64.b64decode("".join(out["audios"]))


def say(text, v):
    """The Mac's own text to speech, as WAV bytes: a placeholder voice, never delivered."""
    out = Path(tempfile.mkdtemp()) / "say.wav"
    subprocess.run(["say", "-v", v["id"], "-r", str(v["rate"]), "--file-format=WAVE", "--data-format=LEI16@44100", "-o", str(out), text], check=True)
    return out.read_bytes()


def paragraph_take(text, v, mp3, synth):
    """The whole script, one paragraph per request, joined by `pause` seconds of silence, as one mp3."""
    tmp = Path(tempfile.mkdtemp())
    paras = [p.strip() for p in text.split("\n\n") if p.strip()]
    if any(len(p) > 2500 for p in paras):
        sys.exit("a paragraph is over Sarvam's 2500 characters: split it")
    parts = []
    for i, para in enumerate(paras):
        (tmp / f"{i:02d}.wav").write_bytes(synth(para, v))
        parts.append(tmp / f"{i:02d}.wav")
    ins = sum([["-i", str(p)] for p in parts], [])
    gap = f"aevalsrc=0:d={v['pause']}:s=44100"
    graph = "".join(f"[{i}:a]aresample=44100,aformat=channel_layouts=mono[a{i}];" for i in range(len(parts)))
    graph += "".join(f"{gap}[g{i}];" for i in range(len(parts) - 1))
    seq = "".join(f"[a{i}]" + (f"[g{i}]" if i < len(parts) - 1 else "") for i in range(len(parts)))
    graph += f"{seq}concat=n={2 * len(parts) - 1}:v=0:a=1[out]"
    subprocess.run(["ffmpeg", "-y", "-v", "error", *ins, "-filter_complex", graph, "-map", "[out]", "-c:a", "libmp3lame", "-b:a", "192k", str(mp3)], check=True)


def split_sentences(text):
    return [[s for s in re.split(r"(?<=[.?!।])\s+", p.strip()) if s] for p in text.split("\n\n") if p.strip()]


def sentence_take(spoken, caption, v, mp3, synth, out_json):
    """One request per sentence, for a voice the English recogniser cannot time (Hindi, Hinglish). Each sentence's edge
    silence is trimmed, then sentences are joined by `gap` seconds and paragraphs by `pause`, so every sentence's start
    and end are known exactly. `spoken` is what the voice reads (it may be in Devanagari); `caption` is script.txt, the
    same sentences in the caption's own words. Writes out_json: {"sentences": [{"text", "t", "e"}]}."""
    said, shown = split_sentences(spoken), split_sentences(caption)
    if [len(p) for p in said] != [len(p) for p in shown]:
        sys.exit(f"script.tts.txt and script.txt need the same paragraphs and sentences: {[len(p) for p in said]} against {[len(p) for p in shown]}")
    tmp, parts, spans, t = Path(tempfile.mkdtemp()), [], [], 0.0
    trim = "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse"
    for pi, (ps, pc) in enumerate(zip(said, shown)):
        for si, (s, c) in enumerate(zip(ps, pc)):
            raw, wav = tmp / f"{pi:02d}{si:02d}.raw.wav", tmp / f"{pi:02d}{si:02d}.wav"
            raw.write_bytes(synth(s, v))
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(raw), "-af", f"{trim},aresample=44100,aformat=channel_layouts=mono", str(wav)], check=True)
            d = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(wav)],
                                     capture_output=True, text=True, check=True).stdout)
            if parts:
                gap = v["gap"] if si else v["pause"]
                parts.append(f"aevalsrc=0:d={gap}:s=44100")
                t += gap
            parts.append(wav)
            spans.append({"text": c, "t": round(t, 3), "e": round(t + d, 3), "syllables": len(re.findall(r"[aeiouy]+", c.lower()))})
            t += d
    ins = sum([["-i", str(p)] if isinstance(p, Path) else ["-f", "lavfi", "-i", p] for p in parts], [])
    graph = "".join(f"[{i}:a]" for i in range(len(parts))) + f"concat=n={len(parts)}:v=0:a=1[out]"
    subprocess.run(["ffmpeg", "-y", "-v", "error", *ins, "-filter_complex", graph, "-map", "[out]", "-c:a", "libmp3lame", "-b:a", "192k", str(mp3)], check=True)
    out_json.write_text(json.dumps({"sentences": spans}, ensure_ascii=False, indent=1))
    # a dropped tail shows as a sentence spoken far faster than the rest: check every sentence, not only the last
    rates = sorted(s["syllables"] / (s["e"] - s["t"]) for s in spans)
    median = rates[len(rates) // 2]
    fast = [s["text"][:50] for s in spans if s["syllables"] / (s["e"] - s["t"]) > 1.6 * median]
    return t, median, fast


def call(path, body=None):
    req = urllib.request.Request(f"{API}{path}", data=json.dumps(body).encode() if body else None,
                                 headers={"xi-api-key": api_key(), "Content-Type": "application/json"})
    try:
        return json.load(urllib.request.urlopen(req, timeout=180))
    except urllib.error.HTTPError as e:
        sys.exit(f"ElevenLabs refused ({e.code}): {e.read().decode()[:300]}")


def speak(text, v):
    body = {"text": text, "model_id": v["model"], "voice_settings": {
        "speed": v["speed"], "stability": v["stability"], "similarity_boost": v["similarity"], "style": v["style"], "use_speaker_boost": True}}
    out = call(f"/text-to-speech/{v['id']}/with-timestamps?output_format=mp3_44100_192", body)
    return base64.b64decode(out["audio_base64"]), out["alignment"]


def force_align(mp3, text):
    """Forced alignment through ElevenLabs: the known script is timed against the audio. eleven_v3 reports character
    times that run straight across pauses, so v3 takes are timed this way. Returns the shape of the "with timestamps" alignment."""
    import uuid
    b = uuid.uuid4().hex
    body = (f'--{b}\r\nContent-Disposition: form-data; name="text"\r\n\r\n{text}\r\n'
            f'--{b}\r\nContent-Disposition: form-data; name="file"; filename="voice.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n').encode()
    body += Path(mp3).read_bytes() + f"\r\n--{b}--\r\n".encode()
    req = urllib.request.Request(f"{API}/forced-alignment", data=body, headers={"xi-api-key": api_key(), "Content-Type": f"multipart/form-data; boundary={b}"})
    try:
        chars = json.load(urllib.request.urlopen(req, timeout=300))["characters"]
    except urllib.error.HTTPError as e:
        sys.exit(f"ElevenLabs forced alignment refused ({e.code}): {e.read().decode()[:300]}")
    return {"characters": [c["text"] for c in chars], "character_start_times_seconds": [c["start"] for c in chars],
            "character_end_times_seconds": [c["end"] for c in chars]}


def pad(mp3, seconds=0.7):
    """Adds silence at the end so the reel's final frame stays up long enough to read before it loops.
    The speech is left untouched; only a tail is added."""
    tmp = mp3.with_suffix(".pad.mp3")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(mp3), "-af", f"apad=pad_dur={seconds}",
                    "-c:a", "libmp3lame", "-b:a", "192k", str(tmp)], check=True)
    tmp.replace(mp3)


def heard(mp3, start):
    """Transcribes the audio from `start` to the end, to confirm the final line was actually spoken."""
    wav = Path(tempfile.mkdtemp()) / "tail.wav"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{start:.2f}", "-i", str(mp3), "-ac", "1", "-ar", "16000", str(wav)], check=True)
    subprocess.run([whisper_cli(), "-m", str(WHISPER), "-f", str(wav), "-otxt", "-of", str(wav.with_suffix("")), "-np"], check=True, capture_output=True)
    return wav.with_suffix(".txt").read_text()


if __name__ == "__main__":
    reel = ROOT / "reels" / sys.argv[1]
    text = re.sub(r"\n{2,}", "\n\n", (reel / "script.txt").read_text().strip())
    cfg = json.loads((reel / "reel.json").read_text()).get("voice", {}) if (reel / "reel.json").exists() else {}
    sentences = re.split(r"(?<=[.?!])\s+", text)

    if cfg.get("provider") in ("sarvam", "say"):
        synth = sarvam if cfg["provider"] == "sarvam" else say
        v = {**(SARVAM if synth is sarvam else {"id": "Aman", "rate": 175, "pause": 0.45}), **cfg}
        if "--audition" in sys.argv:
            (reel / "voices").mkdir(exist_ok=True)
            for spec in sys.argv[sys.argv.index("--audition") + 1].split(","):
                vid = spec.partition(":")[0]
                wav = reel / "voices" / f"{vid}.wav"
                wav.write_bytes(synth(" ".join(sentences[:2]), {**v, "id": vid}))
                print(wav)
            sys.exit(0)
        mp3 = reel / "voice.mp3"
        # no character times from Sarvam: drop any old ones, so align.py and tighten.py time this take afresh
        for old in ("voice.alignment.json", "voice.raw.mp3", "voice.alignment.raw.json", "voice.sentences.json"):
            (reel / old).unlink(missing_ok=True)
        if v.get("timing") == "sentence":
            tts = reel / "script.tts.txt"
            spoken = re.sub(r"\n{2,}", "\n\n", tts.read_text().strip()) if tts.exists() else text
            end, median, fast = sentence_take(spoken, text, {"gap": 0.2, **v}, mp3, synth, reel / "voice.sentences.json")
            pad(mp3)
            words = len(text.split())
            print(f"{mp3}: {end:.2f} s, {words} words, {words / end:.2f} words a second, {median:.1f} syllables a second "
                  f"({cfg['provider']} {v.get('model', '')} {v['id']} {v.get('language', '')}, one request per sentence)")
            if fast:
                sys.exit(f"spoken too fast for their length, so probably cut short: {fast}. Run the take again, never patch it")
            sys.exit(0)
        paragraph_take(text, v, mp3, synth)
        pad(mp3)
        end = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(mp3)],
                                   capture_output=True, text=True, check=True).stdout) - 0.7
        last = sentences[-1]
        said = heard(mp3, max(0, end - 0.5 - len(last.split()) / 2.0))
        ratio = difflib.SequenceMatcher(None, norm(last), norm(said)[-len(norm(last)):]).ratio()
        words = len(text.split())
        print(f"{mp3}: {end:.2f} s, {words} words, {words / end:.2f} words a second ({cfg['provider']} {v.get('model', '')} {v['id']})")
        print(f"last line heard: \"{said.strip()}\" ({ratio:.0%} of the script's words)")
        if ratio < 0.8:
            sys.exit("the last line is missing or garbled: run the take again, never patch it")
        sys.exit(0)

    if "--audition" in sys.argv:
        (reel / "voices").mkdir(exist_ok=True)
        names = {x["voice_id"]: x["name"] for x in call("/voices")["voices"]}
        for spec in sys.argv[sys.argv.index("--audition") + 1].split(","):  # each entry is an id, or id:label for a voice from the library
            vid, _, label = spec.partition(":")
            audio, _ = speak(" ".join(sentences[:2]), {**DEFAULTS, **cfg, "id": vid})
            name = re.sub(r"[^a-z0-9]+", "-", (label or names.get(vid, vid)).lower()).strip("-")[:40]
            (reel / "voices" / f"{name}.mp3").write_bytes(audio)
            print(reel / "voices" / f"{name}.mp3")
        sys.exit(0)

    v = {**DEFAULTS, **cfg}
    if "id" not in v:
        sys.exit('reel.json has no "voice": {"id": ...}. Audition first, then pick the voice.')
    # when script.v3.txt exists, eleven_v3 reads from it: the same words plus [audio tags] where the tone shifts.
    # The tags are not spoken, and v3's character times run across pauses, so the take is then retimed by
    # aligning it to the plain, untagged script.
    tagged = reel / "script.v3.txt"
    v3 = v["model"] in ("eleven_v3", "eleven_v4")  # v4 understands the same tags
    audio, al = speak(re.sub(r"\n{2,}", "\n\n", tagged.read_text().strip()) if v3 and tagged.exists() else text, v)
    mp3 = reel / "voice.mp3"
    mp3.write_bytes(audio)
    if v3:
        al = force_align(mp3, text)
    pad(mp3)
    (reel / "voice.alignment.json").write_text(json.dumps({"voice": v, "alignment": al}, ensure_ascii=False))

    # check the final sentence: first by its character times, then by listening
    chars, t0s = "".join(al["characters"]), al["character_start_times_seconds"]
    last = sentences[-1]
    at = chars.rfind(last[:20])
    start, end = t0s[at], al["character_end_times_seconds"][-1]
    said = heard(mp3, max(0, start - 0.15))
    ratio = difflib.SequenceMatcher(None, norm(last), norm(said)).ratio()
    words = len(text.split())
    print(f"{mp3}: {end:.2f} s, {words} words, {words / end:.2f} words a second")
    print(f"last line {start:.2f}-{end:.2f} s, heard: \"{said.strip()}\" ({ratio:.0%} of the script's words)")
    if ratio < 0.8 or (end - start) < 0.03 * len(last):
        sys.exit("the last line is missing or rushed: run the take again, never patch it")
