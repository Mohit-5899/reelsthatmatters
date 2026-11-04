"""The shape of the video being checked. The checks shrink every frame to a small thumbnail; a wide (16:9) reel
gets the same thumbnail turned on its side, so nothing is squeezed and pixel speeds mean the same thing."""
import json
import subprocess
import sys


def fit(w, h, mp4=None):
    """(w, h) for a portrait thumbnail, swapped when the video is wider than tall. Finds the .mp4 in argv if not given."""
    mp4 = mp4 or next((a for a in sys.argv[1:] if a.endswith(".mp4")), None)
    if not mp4:
        return w, h
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", mp4],
                       capture_output=True, text=True)
    try:
        s = json.loads(r.stdout)["streams"][0]
    except (ValueError, KeyError, IndexError):
        return w, h
    return (h, w) if s["width"] > s["height"] else (w, h)
