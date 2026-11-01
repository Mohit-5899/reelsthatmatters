#!/usr/bin/env python3
"""Find a CC0 3D model or HDRI for a 3D scene and put it in the reel, ready for <Model src=...> or <Studio hdri=...>.

  models.py search <words> [--type model|hdri] [--source library|polyhaven|all]
  models.py get <id> <slug> [--type model|hdri] [--res 1k]     copies it into reels/<slug>/assets/ and prints the src to use
  models.py import <zip or folder> [--tags a,b]                adds every .glb/.gltf in it to the library
  models.py list                                               everything in the library

Two sources, CC0 only, so nothing needs a credit:
  library    library/ at the top of the repo: models you imported (Kenney, Quaternius and Poly Haven downloads are CC0)
  polyhaven  the Poly Haven API. Its own terms allow the API for non-commercial use only; commercial use of the API needs
             their licence. It is off unless RTM_POLYHAVEN=1 is set (in the environment or .env.local). Downloading their
             CC0 files by hand from polyhaven.com and importing them is always fine.
Sizes are printed in metres where the source knows them, so a scene can scale a model to its real size.
"""
import json, os, re, shutil, sys, urllib.request, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent          # engine/
TOP = ROOT.parent
LIB = TOP / "library"
API = "https://api.polyhaven.com"
UA = {"User-Agent": "reelsthatmatters/0.1 (model finder)"}


def env(name):
    if os.environ.get(name):
        return os.environ[name]
    f = TOP / ".env.local"
    if f.exists():
        for line in f.read_text().splitlines():
            if line.startswith(name + "="):
                return line.split("=", 1)[1].strip()
    return ""


def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read()


def words(s):
    return set(re.findall(r"[a-z0-9]+", s.lower()))


def score(query, name, tags):
    q, hay = words(query), words(name) | {t.lower() for t in tags}
    return sum(1 for w in q if w in hay) + 0.5 * sum(1 for w in q for h in hay if w != h and (w in h or h in w))


# --- the library -------------------------------------------------------------------------------------------------

def index():
    f = LIB / "index.json"
    return json.loads(f.read_text()) if f.exists() else {}


def save_index(ix):
    LIB.mkdir(exist_ok=True)
    (LIB / "index.json").write_text(json.dumps(ix, indent=1, sort_keys=True) + "\n")


def do_import(src, tags):
    src = Path(src).expanduser()
    tmp = None
    if src.suffix == ".zip":
        tmp = LIB / ".unzip"
        shutil.rmtree(tmp, ignore_errors=True)
        with zipfile.ZipFile(src) as z:
            z.extractall(tmp)
        src = tmp
    ix, added = index(), 0
    files = [src] if src.is_file() else sorted(p for p in src.rglob("*") if p.suffix.lower() in (".glb", ".gltf"))
    for f in files:
        mid = re.sub(r"[^a-z0-9]+", "-", f.stem.lower()).strip("-")
        dest = LIB / "models" / mid
        if dest.exists():
            continue
        dest.mkdir(parents=True)
        # a .gltf points at its .bin and textures by relative path, so its whole folder comes along
        if f.suffix.lower() == ".gltf":
            shutil.copytree(f.parent, dest, dirs_exist_ok=True)
        else:
            shutil.copy2(f, dest / f.name)
        ix[mid] = {"type": "model", "name": f.stem, "file": f.name, "tags": sorted(set(tags) | words(f.stem)), "from": str(src if not tmp else Path(sys.argv[2]).name)}
        added += 1
    save_index(ix)
    if tmp:
        shutil.rmtree(tmp, ignore_errors=True)
    print(f"added {added} models to {LIB / 'models'}")


# --- Poly Haven ----------------------------------------------------------------------------------------------------

def polyhaven_on():
    if env("RTM_POLYHAVEN") != "1":
        print("polyhaven: off. Its API is free for non-commercial use only; set RTM_POLYHAVEN=1 to use it,"
              " or download CC0 files from polyhaven.com by hand and run models.py import.", file=sys.stderr)
        return False
    return True


def ph_search(query, kind):
    d = json.loads(fetch(f"{API}/assets?type={'hdris' if kind == 'hdri' else 'models'}"))
    out = []
    for aid, a in d.items():
        s = score(query, a["name"] + " " + aid, a.get("tags", []) + a.get("categories", []))
        if s > 0:
            dims = a.get("dimensions")
            out.append((s, aid, a["name"], [round(x / 1000, 2) for x in dims] if dims else None))
    return sorted(out, key=lambda r: -r[0])


def ph_get(aid, slug, kind, res):
    files = json.loads(fetch(f"{API}/files/{aid}"))
    dest = ROOT / "reels" / slug / "assets" / ("hdris" if kind == "hdri" else "models")
    if kind == "hdri":
        f = files["hdri"][res]["hdr"]
        dest.mkdir(parents=True, exist_ok=True)
        (dest / f"{aid}_{res}.hdr").write_bytes(fetch(f["url"]))
        return f"{slug}/hdris/{aid}_{res}.hdr"
    g = files["gltf"][res]["gltf"]
    d = dest / aid
    d.mkdir(parents=True, exist_ok=True)
    name = Path(g["url"]).name
    (d / name).write_bytes(fetch(g["url"]))
    for rel, inc in g.get("include", {}).items():
        (d / rel).parent.mkdir(parents=True, exist_ok=True)
        (d / rel).write_bytes(fetch(inc["url"]))
    return f"{slug}/models/{aid}/{name}"


# --- commands ------------------------------------------------------------------------------------------------------

def opt(name, default):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    cmd, kind = sys.argv[1], opt("--type", "model")
    if cmd == "search" and len(sys.argv) >= 3:
        query, source = sys.argv[2], opt("--source", "all")
        rows = []
        if source in ("library", "all"):
            for mid, m in index().items():
                if m["type"] == kind and (s := score(query, m["name"] + " " + mid, m["tags"])) > 0:
                    rows.append((s, mid, m["name"], "library", None))
        if source in ("polyhaven", "all") and polyhaven_on():
            rows += [(s, aid, name, "polyhaven", dims) for s, aid, name, dims in ph_search(query, kind)]
        if not rows:
            sys.exit(f"nothing for \"{query}\". Try other words, or import a CC0 pack: models.py import <zip>")
        for s, mid, name, src, dims in sorted(rows, key=lambda r: -r[0])[:15]:
            print(f"{mid:32} {src:9} {name}" + (f"  ({dims[0]} x {dims[1]} x {dims[2]} m)" if dims else ""))
    elif cmd == "get" and len(sys.argv) >= 4:
        mid, slug = sys.argv[2], sys.argv[3]
        if not (ROOT / "reels" / slug).exists():
            sys.exit(f"no reel {slug}")
        ix = index()
        if mid in ix:
            dest = ROOT / "reels" / slug / "assets" / "models" / mid
            shutil.copytree(LIB / "models" / mid, dest, dirs_exist_ok=True)
            print(f"{slug}/models/{mid}/{ix[mid]['file']}")
        elif polyhaven_on():
            print(ph_get(mid, slug, kind, opt("--res", "1k")))
        else:
            sys.exit(1)
    elif cmd == "import" and len(sys.argv) >= 3:
        do_import(sys.argv[2], [t for t in opt("--tags", "").split(",") if t])
    elif cmd == "list":
        for mid, m in sorted(index().items()):
            print(f"{mid:32} {m['type']:6} {', '.join(m['tags'][:8])}")
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
