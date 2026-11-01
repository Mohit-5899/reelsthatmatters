#!/usr/bin/env python3
"""An optional music bed under the voice. Either composes one with ElevenLabs Music, as long as the reel, or takes a
file you already have the rights to, and writes it into reel.json so the next render mixes it in.

usage: music.py <slug> --prompt "calm, curious, soft piano and light pulse"    compose (your key in .env.local)
       music.py <slug> --file path/to/track.mp3                              use your own file
       music.py <slug> --volume 0.1                                          change the level under the voice
       music.py <slug> --off                                                 no music

The track is always instrumental: the prompt is sent with "instrumental, no vocals". ElevenLabs allows commercial use
of composed music on its paid plans; check its music terms for your plan. Run render, then loud.py levels the mix.
"""
import json, os, shutil, sys, urllib.error, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def key():
    k = os.environ.get("ELEVENLABS_API_KEY", "")
    env = ROOT.parent / ".env.local"
    if not k and env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("ELEVENLABS_API_KEY="):
                k = line.split("=", 1)[1].strip()
    return k or sys.exit("no ELEVENLABS_API_KEY in the environment or in .env.local")


def opt(name):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else None


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    reel = ROOT / "reels" / sys.argv[1]
    if not (reel / "reel.json").exists():
        sys.exit(f"no reel {sys.argv[1]}")
    cfg = json.loads((reel / "reel.json").read_text())
    music = cfg.get("music", {})

    if "--off" in sys.argv:
        cfg.pop("music", None)
    elif opt("--file"):
        src = Path(opt("--file")).expanduser()
        dest = reel / f"music{src.suffix.lower()}"
        shutil.copyfile(src, dest)
        music["file"] = dest.name
    elif opt("--prompt"):
        words = reel / "words.json"
        if not words.exists():
            sys.exit("voice and align the reel first: the music is made as long as the voice")
        ms = int((json.loads(words.read_text())["duration"] + 1.5) * 1000)
        body = json.dumps({"prompt": f"{opt('--prompt')}. Instrumental, no vocals, a bed under a spoken voice.", "music_length_ms": max(3000, ms)}).encode()
        req = urllib.request.Request("https://api.elevenlabs.io/v1/music", data=body, method="POST",
                                     headers={"xi-api-key": key(), "Content-Type": "application/json", "Accept": "audio/mpeg"})
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                (reel / "music.mp3").write_bytes(r.read())
        except urllib.error.HTTPError as e:
            sys.exit(f"FAIL  ElevenLabs music: {e.code} {e.read().decode(errors='replace')[:400]}")
        music["file"] = "music.mp3"
        music["prompt"] = opt("--prompt")
    if opt("--volume"):
        music["volume"] = float(opt("--volume"))
    if "--off" not in sys.argv:
        if not music.get("file"):
            sys.exit(__doc__)
        cfg["music"] = music
    (reel / "reel.json").write_text(json.dumps(cfg, indent=2) + "\n")
    print(f"music: {json.dumps(cfg.get('music', 'off'))}")


if __name__ == "__main__":
    main()
