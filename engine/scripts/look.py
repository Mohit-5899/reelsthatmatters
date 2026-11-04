#!/usr/bin/env python3
"""The look checks: colour and light measured on a finished render, so a reel never ships garish, washed out, flooded
with its accent colour, flashing between grounds, or with its detail pushed to the edges.

usage: look.py <slug> <mp4>

  colour strength   mean saturation, and the share of pixels near full saturation (garish)        FAIL / WARN
  accent flood      the accent colour filling a big share of the frame for over a second           FAIL
  blown light       a big share of the frame clipped to white for over a second                    FAIL
  ground flashes    the frame swinging between dark and light more often than the scenes change    WARN
  centre weight     how much of the detail sits in the middle of the frame, where the eye is       WARN

Thresholds sit in LOOK below; a reel overrides any of them in reel.json under "look". Exits 1 on any FAIL.
"""
import colorsys, json, subprocess, sys
from pathlib import Path
import numpy as np
from frame import fit

ROOT = Path(__file__).resolve().parent.parent
W, H, FPS = 135, 240, 4
W, H = fit(W, H)
LOOK = {
    "saturation": [0.03, 0.45],   # mean saturation of the lit pixels: under is washed out (WARN), over is garish (FAIL)
    "garish": 0.25,               # share of pixels above 0.85 saturation
    "accent": "#4C8DFF",          # the theme's accent colour (theme.marker.color), unless the reel sets its own
    "accentFlood": 0.35,          # share of the frame in the accent colour
    "blown": 0.20,                # share of the frame at pure white
    "hold": 1.0,                  # seconds a flood or blown frame may last
    "centre": 0.45,               # share of the detail inside the middle of the frame
}
fails = 0


def say(level, msg):
    global fails
    fails += level == "FAIL"
    print(f"{level:4}  {msg}")


def frames(mp4):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(mp4), "-vf", f"fps={FPS},scale={W}:{H}", "-pix_fmt", "rgb24", "-f", "rawvideo", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).astype(np.float32) / 255


def hsv(a):
    mx, mn = a.max(-1), a.min(-1)
    s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    d = np.maximum(mx - mn, 1e-6)
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6
    return h, s, mx


def longest(mask):
    best = run = 0
    for m in mask:
        run = run + 1 if m else 0
        best = max(best, run)
    return best / FPS


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    slug, mp4 = sys.argv[1], sys.argv[2]
    cfg = ROOT / "reels" / slug / "reel.json"
    reel = json.loads(cfg.read_text()) if cfg.exists() else {}
    look = {**LOOK, **({"accent": reel["theme"]["marker"]["color"]} if reel.get("theme", {}).get("marker", {}).get("color") else {}), **reel.get("look", {})}
    a = frames(mp4)
    h, s, v = hsv(a)

    lit = v > 0.12
    sat = float(s[lit].mean()) if lit.any() else 0.0
    lo, hi = look["saturation"]
    say("FAIL" if sat > hi else "WARN" if sat < lo else "ok", f"colour strength: mean saturation {sat:.2f} (range {lo} to {hi})")
    gar = float((s > 0.85).mean())
    say("FAIL" if gar > look["garish"] else "ok", f"garish pixels: {gar:.1%} near full saturation (limit {look['garish']:.0%})")

    ah, as_, av = colorsys.rgb_to_hsv(*[int(look["accent"][i:i + 2], 16) / 255 for i in (1, 3, 5)])
    dh = np.minimum(np.abs(h - ah), 1 - np.abs(h - ah))
    near = (dh < 0.04) & (s > max(0.25, as_ * 0.5)) & (v > 0.25)
    share = near.mean(axis=(1, 2))
    t = longest(share > look["accentFlood"])
    say("FAIL" if t > look["hold"] else "ok", f"accent flood: {look['accent']} over {look['accentFlood']:.0%} of the frame for {t:.2f} s at most (limit {look['hold']} s); peak {share.max():.0%}")

    white = (a.min(-1) > 0.98).mean(axis=(1, 2))
    t = longest(white > look["blown"])
    say("FAIL" if t > look["hold"] else "ok", f"blown light: over {look['blown']:.0%} of the frame clipped white for {t:.2f} s at most (limit {look['hold']} s)")

    words = ROOT / "reels" / slug / "words.json"
    scenes = len(json.loads(words.read_text())["scenes"]) if words.exists() else 1
    lum = a.mean(axis=(1, 2, 3))
    state = np.where(lum > 0.55, 1, np.where(lum < 0.35, -1, 0))
    flips = int(np.sum(np.abs(np.diff(state[state != 0])) == 2)) if (state != 0).any() else 0
    say("WARN" if flips > scenes else "ok", f"ground flashes: {flips} swings between dark and light, against {scenes} scenes")

    g = a.mean(-1)
    edge = np.abs(g[:, 1:, 1:] - g[:, :-1, 1:]) + np.abs(g[:, 1:, 1:] - g[:, 1:, :-1])
    _, hh, ww = edge.shape
    mid = edge[:, int(hh * 0.2):int(hh * 0.8), int(ww * 0.15):int(ww * 0.85)].sum()
    cw = float(mid / max(edge.sum(), 1e-6))
    say("WARN" if cw < look["centre"] else "ok", f"centre weight: {cw:.0%} of the detail in the middle of the frame (want {look['centre']:.0%} or more)")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
