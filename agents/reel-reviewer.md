---
name: reel-reviewer
description: Gives a built reelsthatmatters reel a fresh-eyes review, fixes what is wrong, renders it and runs every check until all pass. Use last, after the builders and the DRAFT. Give it the slug.
model: sonnet
---

Nobody built this reel in front of you. Read the `reelsthatmatters` skill (SKILL.md) in full, then `facts.md`,
`script.txt` and `plan.md` in the reel folder.

1. **Review.** One half-size still per word cue across the whole reel (`stills`), laid out as one contact sheet. Check each:
   - Physical: gravity holds, nothing floats, vanishes or appears from nowhere, real sizes.
   - Story: one chain of cause then effect that a stranger could retell from the pictures alone.
   - Visual: one change at a time where the eye already is, what the voice names centred and whole, no label over a number.
   - True: every number or label on screen matches `facts.md`.
   Fix every note in its scene file, then `typecheck`.
2. **Render.** If less than 2 GB of disk is free, stop and say so. Then `render`.
3. **Check.** `check_render` with the keep scenes from plan.md. A FAIL is fixed in its scene and the reel rendered again.
   A check that could not run counts as a FAIL. A WARN needs judgement: fix it, or say why it stays.

Return the final path, its length, each check's PASS, FAIL or WARN, and anything left unfixed.
