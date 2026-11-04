---
name: reelsthatmatters
description: Make a researched, narrated explainer reel (1080x1920, 60 fps) animated in code, as a 2D canvas or in real 3D with Three.js and CC0 models, with checks that pass or fail every render. Use for "make a reel about X", "explain X in a short video", "make a Short/Reel/TikTok explaining X", or to edit or re-render a reel made with reelsthatmatters.
---

# reelsthatmatters

A reel is a voice and a picture. The picture is drawn in code, frame by frame: on a 2D canvas through a pinhole camera,
or in real 3D with Three.js, lit models and soft shadows. Both use the same camera and the same word cues, so a reel can
mix them. Every move starts on a word the voice says. There is no presenter and no cut.

The `reelsthatmatters` MCP tools do every deterministic step. Call `setup` once first; it says where the reels live
(the "home", `~/reelsthatmatters` by default). All commands below run from `<home>/engine`, and a reel lives in
`<home>/engine/reels/<slug>/`.

## The order

The person makes exactly two choices: the hook, and the script. Everything else runs on its own.

1. **Research.** Run the `reel-researcher` agent with the topic and the slug. It writes `facts.md`: every claim with its
   source, the common myth, the real numbers with units, and the pictures that would prove each point.
2. **Hooks.** Run the `reel-writer` agent to write `hooks.md`: 3 to 5 different openings, each a first sentence and the
   angle it takes. **Show them and let the person pick one.** This is the first manual step.
3. **Script.** The `reel-writer` agent writes the script from the chosen hook and `facts.md` only: plain spoken sentences,
   45 to 75 s at about 3 words a second, every claim in `facts.md`. **Get the person's approval.** Then `new_reel`.
4. **Voice.** `voice`, which needs `ELEVENLABS_API_KEY` or `SARVAM_API_KEY` in `<home>/.env.local` (never ask for a key in
   chat) and a voice in `reel.json`. For Hindi or Hinglish with Sarvam, write `script.tts.txt` in Devanagari and set
   `"timing": "sentence"`; captions stay in Roman script, and `"cues"` maps the scenes' cue words to the spoken ones. To audition voices: `python3 scripts/voice.py <slug> --audition id:label,id:label`.
5. **Plan.** Run the `reel-planner` agent: it writes `caption.txt`, runs `align` and `check_plan` until PASS, then writes
   `plan.md`: the one or two worlds of the reel, **2D or 3D for each scene**, which scenes carry on in the same world, the
   models each 3D scene needs (found with `find_model` and fetched with `get_model`), and word -> what changes.
6. **Scenes.** Run one `reel-builder` agent per world or per half of the scenes, in parallel, each with its own scenes.
7. **DRAFT.** `draft`: the real video at half size, stamped DRAFT. Show it to the person before the final render.
8. **Music** (optional). `music` with a mood prompt, or with the person's own track.
9. **Render and check.** Run the `reel-reviewer` agent: a fresh review of the whole reel, then `render` and
   `check_render`. Nothing is delivered with a FAIL.

The saved workflow in `workflow/express.workflow.js` runs steps 5 to 9 on its own once the script is approved.

## It must make sense three ways

- **Physical.** Gravity holds. Nothing floats, vanishes or appears from nowhere. Whatever loses its support falls the full
  distance, starting slowly. Use real sizes and real gravity (9.81 m/s², which is 9.81/3600 m per frame² at 60 fps).
- **Story.** One chain of cause then effect, on objects already seen, that a stranger could retell from the pictures alone.
- **Visual.** One change at a time, where the eye already is. What the voice names is centred and whole. No label over a
  number. Every new picture holds about 2 s before the camera leaves it.

## 2D or 3D

| Use | When |
|---|---|
| **2D canvas** | diagrams, numbers, graphs, cut-aways, forces drawn as arrows, anything abstract; fast to render |
| **3D** | a real object whose shape matters (a plane, an engine, a skull, a room), light and shadow that explain something, a camera flying around or into a thing |

A 3D scene renders slower (WebGL), so keep 3D for the scenes where depth carries the point.

## 16:9

A reel is 1080x1920 unless `reel.json` sets `"size": [1920, 1080]`. The stage, caption, 3D canvas, draft and every check
follow it. For a wide cut of a finished vertical reel, copy its folder (voice, `words.json`, scenes) to a new slug, set the
size, and move each scene's pieces into the wide frame: type on one side, the picture on the other. Do not crop the vertical
picture, and do not put it in the middle with bars at the sides. A quick way that keeps the scenes' code and timing: two
wrapper divs, each 1080x1920 with `transform-origin: 0 0`, that translate and scale the vertical coordinates, one into the
left half for the type and one into the right half for the picture, centred on what each beat shows.

## caption.txt

```
== hook | ground: dark                 opens a scene: its id (its key in scenes/index.tsx) and its ground (dark or light)
This *block*                           each line is one caption block, at most two lines on screen
is drawn with *code,*                  *word* marks the block's key word, which gets the selection box
and the only thing / holding it *up*   " / " breaks the line there
@bottom / @top                         moves the caption slot, from the next block on
# a comment
```

The caption is the script. It is never transcribed from the voice. The word caption is off in renders by default; set
`"caption": true` in `reel.json` to burn it in (`stills`, `draft` and `render` follow it; by hand, `--caption`). Turn it on
for a voice the viewer may not follow by ear (Hindi, Hinglish, a borrowed narration) or when asked. White caption type
needs a dark band behind it at the top of the frame: no check measures that, so look at a captioned still.

## A 2D scene

```tsx
import React from "react";
import { useScene, prog, ease } from "../../../src/engine";

export const Drop: React.FC = () => {
  const { f, cue, ground } = useScene();     // f: the frame; cue("word"): the frame that word starts
  const land = prog(f, cue("lands"), 24, ease.out);   // 0 to 1 over 24 frames from "lands"
  return <div style={{ position: "absolute", inset: 0, background: ground.bg }}>{/* draw here */}</div>;
};
```

Every value is a pure function of the frame, so any frame renders on its own. For a world in depth, draw on a
`<canvas width={1080} height={1920}>` in a `useLayoutEffect`, through the camera in `src/engine/camera.ts`:

- `project(cam, [x, y, z])` gives the screen point, its depth for sorting and its scale.
- `orbit(target, yaw, pitch, distance)` places the camera around a target.
- `spline(f, [[frame, value], ...])` joins keys on word cues with a smooth curve that never jumps and keeps moving through
  the middle keys.

## A 3D scene

```tsx
import React from "react";
import { useScene, orbit, spline, type Cam } from "../../../src/engine";
import { Floor, Model, Studio, World3D } from "../../../src/engine/three";

export const Wing: React.FC = () => {
  const { f, cue, ground } = useScene();
  const yaw = spline(f, [[cue("wing"), 0.4], [cue("air"), 1.3]]);
  const cam: Cam = { eye: orbit([0, 1, 0], yaw, 0.25, 9), at: [0, 1, 0], focal: 1500, cx: 540, cy: 960 };
  return (
    <World3D cam={cam} background={ground.bg}>
      <Studio hdri="<slug>/hdris/studio_1k.hdr" />          {/* sun with soft shadows, optional HDRI light */}
      <Floor />
      <Model src="<slug>/models/plane/plane.glb" size={12} position={[0, 1, 0]} />   {/* size: its longest side, in metres */}
    </World3D>
  );
};
```

- The camera is the same `Cam` as in 2D, so a 2D scene can hand over to a 3D one on the same path.
- Build in metres, at real sizes. `Model` scales a file so its longest side is `size` and stands it on y = 0.
- Any Three.js object works inside `World3D` (`mesh`, `boxGeometry`, `meshStandardMaterial`, `group`, lines).
- **Never use `useFrame()` or any loop.** Position, rotation and colour come from `f` and `cue`, like every 2D value.
- Models and HDRIs: `find_model` then `get_model`, which copies the files into the reel's `assets/` and returns the `src`.
  Only CC0 sources are used, so nothing needs a credit. `python3 scripts/models.py import <zip>` adds a CC0 pack you
  downloaded (Kenney, Quaternius, Poly Haven) to the shared library.

**One continuous world.** When two scenes happen in the same place, draw that world from the reel's frame in one shared
component, and use it in both scenes (see `reels/demo` in 2D and `reels/demo-3d` in 3D). With `"handover": "continuous"`
in `reel.json` the next scene takes over on its first frame, so the picture never jumps. List those scenes as keep scenes
for the motion check.

`src/engine/moves.ts` has the motion verbs: `prog`, `ease`, `arrive`, `leave`, `blurIn`, `blurOut`, `pop`, `typeOn`,
`countTo`, `draw`, `stagger`, `mix`. `theme.ts` holds every value a reel may override in `reel.json` under `"theme"`.

## The checks

Each prints PASS or FAIL with the reason and exits 1 on a FAIL. A check that could not run counts as a FAIL.
`check_plan` and `check_render` run them for you.

| Command | What fails |
|---|---|
| `check.py plan <slug>` | a caption block over 8 words, two key words in a block, a scene change outside silence (it also warns on type under 32 px) |
| caption fit (in `check_plan`) | a caption block too wide for two lines with the real font: FAIL when the caption is on, WARN when it is off |
| `check.py render <slug> <mp4>` | nothing moving for over 1.2 s, bare ground during a scene change |
| `motion.py <mp4> --words reels/<slug>/words.json --keep a,b` | a move too fast to follow inside a world, a cut or snap, a near-freeze then a jump, a scene under 2 s |
| `joins.py <slug> <mp4> --sheet out.jpg` | a scene change where one frame swaps the picture; the sheet shows every change |
| `speed.py <mp4>` | the camera speed check on its own, for any clip |
| `loud.py <mp4> [--fix]` | sound away from -14 LUFS or peaks above -1.5 dBTP; `--fix` levels it, video untouched |
| `look.py <slug> <mp4>` | garish colour, the accent colour flooding the frame, blown white light; warns on washed-out colour, flashing grounds, detail pushed to the edges |

Thresholds for `look.py` can be set per reel in `reel.json` under `"look"`.

## Keys

Keys go in `<home>/.env.local` (`ELEVENLABS_API_KEY=...`, `SARVAM_API_KEY=...`). Never ask for one in chat and never commit one.
`RTM_POLYHAVEN=1` there turns on Poly Haven search; its API is free for non-commercial use, and commercial use of the API
needs their licence. Downloading their CC0 files by hand and importing them is always fine.
