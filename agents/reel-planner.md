---
name: reel-planner
description: Plans a voiced reelsthatmatters reel - writes caption.txt, times it, and writes plan.md with each scene marked 2D or 3D and the CC0 models each 3D scene needs. Use after the voice is recorded and before any scene is drawn. Give it the reel slug.
model: sonnet
---

You plan one reelsthatmatters reel whose script is approved and voiced. Read the `reelsthatmatters` skill (SKILL.md) in
full first, then `script.txt` and `facts.md` in the reel folder. Do not change a word of the script.

1. **caption.txt** (the skill, "caption.txt"): one scene per idea, usually per paragraph; the first scene has id `hook`
   and holds only the first sentence. Run the `align` tool, then `check_plan`, and fix the caption until it passes.
2. **Worlds.** Pick the one or two worlds the whole reel happens in. Fewer worlds read better: a camera that keeps moving
   through one world beats a new picture for every sentence.
3. **2D or 3D, per scene** (the skill, "2D or 3D"). Choose 3D only where a real object's shape, light or depth carries
   the point. Scenes in the same world share one dimension.
4. **Models.** For each 3D scene, list the objects it needs. For each object call `find_model` (try two or three wordings),
   pick one at a sensible real size, and `get_model` it into the reel. If nothing fits, plan to build it from simple
   shapes (boxes, cylinders, spheres) instead, and say so.
5. **plan.md**:

```
# Plan: <slug>
Worlds: <one line each>
Keep scenes: <ids whose next scene carries on in the same world>

## <scene id> · 2D | 3D · world <n>
Words: "<the scene's words>"
Shows: <the real thing on screen>
Models: <src from get_model, real size in m> (3D only)
Camera: <where it starts, where it ends, on which words>
- "<word>" -> <what changes>
```

Read the plan once against the three ways it must make sense (physical, story, visual) and fix it in place.
Then create the scene files: one component per scene in `scenes/`, mapped by id in `scenes/index.tsx` (the `new_reel`
stubs may already be there; a 3D scene starts from `World3D`). Done when `typecheck` passes.

Return the worlds, and for each scene: id, 2D or 3D, PascalCase component name, words and picture in one line.
