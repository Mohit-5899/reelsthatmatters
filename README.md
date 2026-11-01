# reelsthatmatters

**Researched explainer reels, animated in code.** Give Claude a topic. A research agent finds the facts and their
sources, you pick one of several hooks and approve the script, and agents draw every scene: on a 2D canvas, or in real
3D with Three.js, lit models and soft shadows. Every move lands on a spoken word, and measured checks pass or fail every
render before it ships.

1080x1920, 60 fps, made for Reels, Shorts and TikTok.

## Install as a Claude Code plugin

```
/plugin marketplace add Mohit-5899/reelsthatmatters
/plugin install reelsthatmatters@reelsthatmatters
```

Then, in any Claude Code session:

> make a reel about why ice floats

The first time, Claude runs the `setup` tool. It puts the engine in `~/reelsthatmatters` (set `RTM_HOME` to change it),
installs it, checks ffmpeg, Python and whisper, and downloads the whisper model (about 490 MB) once. Put a voice key in
`~/reelsthatmatters/.env.local`, ElevenLabs or Sarvam (Indian voices; English, Hindi and Hinglish):

```
ELEVENLABS_API_KEY=...
SARVAM_API_KEY=...
```

### What the plugin adds

| Part | What it does |
|---|---|
| Skill `reelsthatmatters` | the whole method: order of work, 2D or 3D, caption format, scene code, checks |
| Agent `reel-researcher` | searches the web and writes `facts.md`, every claim with its source and a confidence |
| Agent `reel-writer` | writes 3 to 5 hooks for you to pick from, then the script from the facts only |
| Agent `reel-planner` | captions and times the voice, picks 2D or 3D per scene, finds the CC0 models, writes `plan.md` |
| Agent `reel-builder` | draws its scenes and checks its own motion; several run in parallel |
| Agent `reel-reviewer` | a fresh-eyes review, the render, and every check until all pass |
| MCP server | `setup`, `new_reel`, `voice`, `align`, `check_plan`, `find_model`, `get_model`, `typecheck`, `stills`, `draft`, `music`, `render`, `check_render`, `list_reels` |

The MCP server also works on its own in any MCP client:

```
claude mcp add reelsthatmatters -- node /path/to/reelsthatmatters/mcp/server.mjs
```

## From a checkout

Node 22.12 or newer, Python 3 with numpy and Pillow, ffmpeg, and whisper.cpp (`brew install whisper-cpp`)
with `models/ggml-small.en.bin` from huggingface.co/ggerganov/whisper.cpp; the voice step needs both.

```
npm install
cp .env.example .env.local     # then add your ElevenLabs or Sarvam key
cd engine
node render.mjs demo-3d --stills 4.5,7.5 --half    # two stills of the 3D demo, no key needed
node render.mjs demo-3d                            # the full 3D demo
```

A checkout with `node_modules` keeps its reels in place, in `engine/reels/`.

## 3D models

`find_model` and `get_model` (or `python3 engine/scripts/models.py`) search and fetch **CC0** models and HDRIs only, so
nothing needs a credit:

- **Your library** (`library/`): import any CC0 pack you downloaded, for example from Kenney, Quaternius or Poly Haven:
  `python3 engine/scripts/models.py import ~/Downloads/pack.zip`
- **Poly Haven** search and download, off by default. Their API is free for non-commercial use, and commercial use of
  the API needs their licence. Set `RTM_POLYHAVEN=1` in `.env.local` to turn it on.

## Music

Optional. `music` composes an instrumental bed with ElevenLabs Music from a mood prompt, as long as the reel, or takes a
track you have the rights to. It sits well under the voice, and the render is levelled to -14 LUFS.

## The checks

| Check | What fails |
|---|---|
| plan | caption blocks too long or too wide for two lines, two key words in a block, a scene change outside silence |
| render | nothing moving for over 1.2 s, bare ground during a scene change |
| motion | a move too fast to follow, a cut or snap, a near-freeze then a jump, a scene under 2 s |
| joins | a scene change where one frame swaps the picture |
| loudness | away from -14 LUFS, or peaks above -1.5 dBTP |
| look | garish colour, the accent colour flooding the frame, blown white light (plus warnings for washed-out colour, flashing grounds, detail at the edges) |

## Example reels

`engine/reels/` holds the examples: `demo`, `demo-3d`, `gears`, `pendulum`, `ice-floats` (English) and `ice-floats-hi`
(the same scenes in Hinglish, through `"cues"` in `reel.json`), `captain-smit` (a news explainer with its sources in
`facts.md`) and `blinkit-ad` (a 30 s Hinglish ad). `blinkit-ad` is an unofficial spec ad made to show the method; it is
not made by or for Blinkit, and the name belongs to its owner.

## Licence

MIT. See `LICENSE`. Remotion, which renders the video, has its own licence: free for individuals and companies of up to
three people, a paid company licence above that. See remotion.dev/license.
