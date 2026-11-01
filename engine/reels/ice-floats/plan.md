# Plan: ice-floats
Worlds:
1. The set: a real-size glass of water with an ice cube on a dark floor, and 0.8 m behind it a clear pond cross-section (slab 1.4 m wide, 0.5 m deep). Used by hook, lake, payoff. All 3D.
2. The molecules: dark space, water molecules drawn ~0.3 m across so the camera can sit close. Liquid tumble, then freezing into the hexagonal cage, then the cage compared with the liquid. Used by liquid, cage, roomy. All 3D.
Keep scenes: hook, liquid, cage
(hook -> lake: camera pulls back and across the same set. liquid -> cage -> roomy: same molecules, same camera path. lake -> liquid and roomy -> payoff change world, each inside a 0.5 s silence.)

Models: find_model ("glass", "ice cube", "lake water") found nothing. The model library is empty and Poly Haven is off, so every object is built from simple Three.js shapes (no get_model calls).

## hook · 3D · world 1
Words: "Cold water sinks. So why does frozen water float on top?"
Shows: the glass side-on, water inside, an ice cube dropped in from just above the rim.
Models: none. Glass = open cylinder (r 0.035 m, 0.11 m tall, transparent physical material) + water cylinder 0.08 m + ice cube box 0.025 m (transparent, pale blue).
Camera: starts 0.34 m from the glass, side view, on "Cold"; eases back to 0.46 m by "top".
- "Cold" -> the cube is held just above the water
- "sinks" -> the cube drops in and dips under the surface, slowly, the way the viewer expects
- "frozen" -> it stops going down (the voice names the surprise)
- "float" -> it bobs back up
- "top" -> it rides at the surface, about 9/10 submerged, and the camera holds on it (held about 2 s before the leave to the lake)

## lake · 3D · world 1
Words: "Watch a lake in autumn. The surface water cools, gets heavier, and sinks. That goes on until the whole lake is near four degrees. Then the rule flips. Below four degrees, water gets lighter as it cools. The coldest water stays on top, and that is where the ice forms."
Shows: the pond slab behind the glass, seen as a cross-section: water coloured by temperature (warm top, cold tint), arrows or tinted blobs of water sinking, a 4 °C layer filling from the bottom, then a thin ice sheet forming on the surface.
Models: none. Slab = box with a transparent material; temperature layers = stacked transparent planes/boxes; ice = a thin white-blue box on top; sinking water = a few small spheres or a tinted block moving down.
Camera: starts at the glass on "Watch" and slides across and back to 2.6 m from the slab by "ice"; keeps drifting to the end.
- "Watch" -> camera leaves the glass for the pond
- "cools" -> surface layer tints cold
- "sinks" -> that layer sinks to the bottom, a new surface layer takes its place
- "heavier" -> the sinking layer is shown as the denser one (stronger tint)
- "four" -> the whole slab is one even 4 °C tint, a "4 °C" label settles
- "flips" -> the tint stops sinking; the bottom keeps its 4 °C colour
- "lighter" -> the new colder water rises and stays at the top
- "coldest" -> the top layer goes pale blue
- "ice" -> a thin ice sheet grows across the surface

## liquid · 3D · world 2
Words: "To see why, zoom in. In liquid water, the molecules tumble past each other. The weak bonds between them break and re-form in a fraction of a trillionth of a second, so nothing holds still."
Shows: a cluster of water molecules (red oxygen sphere, two small white hydrogen spheres each), tumbling and sliding past each other; faint bond lines flick on and off.
Models: none. Sphere geometry for O and H, cylinders (or lines) for bonds.
Camera: starts wide at 9 m on "zoom", drifts closer and around (yaw) to 6 m by "still".
- "zoom" -> molecules fade in as the camera moves in
- "tumble" -> they rotate and slide past each other
- "break" -> bond lines flick off (cue "break")
- "trillionth" -> the flicker quickens
- "still" -> keep the motion going; nothing locks yet (the freeze comes in the next scene)

## cage · 3D · world 2 (carries on from liquid)
Words: "Freeze them, and every oxygen locks onto four neighbours. The bonds join into rings of six, stacked layer on layer."
Shows: the same molecules slowing and snapping into the hexagonal ice lattice: one oxygen first with four bonds at tetrahedral angles, then the lattice builds out into rings of six, ABAB layers.
Models: none. Same spheres and bond cylinders as liquid.
Camera: keeps orbiting from liquid; on "oxygen" pushes in on one oxygen, then pulls back and tilts to look down the axis on "rings".
- "Freeze" -> the tumbling slows and the molecules drift to their lattice spots
- "oxygen" -> one oxygen is highlighted
- "four" -> its four bonds draw out
- "rings" -> six oxygens light up as a ring, bonds join them
- "layer" -> the ring layers stack up, one above another

## roomy · 3D · world 2
Words: "That cage is roomy. The molecules sit farther apart than they did in the liquid, so the same water takes up about nine percent more space."
Shows: the cage opens out and the gaps are lit; then the same molecules shown twice, side by side, as a liquid block and an ice block: same count, the ice block about 9% taller, and a thin line marks where the liquid ended.
Models: none. Spheres, bond cylinders, two transparent boxes for the water volumes, a thin plane as the level line.
Camera: orbits the cage from 7 m on "cage" to 9 m by "space" so both blocks come into frame.
- "cage" -> the hexagonal gaps are tinted
- "farther" -> the molecules spread slightly apart (real O-O gap is longer in ice)
- "same" -> a liquid block of the same molecules appears beside it
- "percent" -> a level line rises from the liquid block's top; the ice block reaches 9% above it
- "space" -> the extra 9% is tinted

## payoff · 3D · world 1
Words: "Same water, more room. Ice ends up lighter than the water around it, so it rises. That floating lid insulates the water below, so ponds usually don't freeze solid. Ice floats because freezing opens water into a cage that is lighter than the water it came from."
Shows: back on the set: the cube in the glass rises and floats; the pond's ice sheet thickens into a lid with water still liquid below; the last lines show glass and pond together with a small cage inset.
Models: none. Same shapes as hook and lake.
Camera: starts 1.2 m from the glass at "Same", pulls back to 2.6 m by "solid" so glass and pond are both in frame, then holds to the end.
- "Same" -> the glass and its cube reappear in view
- "lighter" -> the cube rises in the water
- "rises" -> it settles floating, 9/10 submerged
- "lid" -> the pond's ice lid is outlined
- "insulates" -> a band of liquid water shows underneath, tinted warmer
- "solid" -> the lid holds and the water below stays liquid
- "cage" -> a small ice-cage inset beside the cube
- last words -> everything holds still on the glass and the lid

## Checks (read once)
- Physical: ice cube is lighter than water and rises, as the voice says; the molecules keep their real topology (4 bonds on each oxygen, rings of six); the sinking layers fall under gravity and the ice sheet forms on top.
- Story: the cube dips and bobs (question) -> the lake cools and flips -> zoom into molecules -> freeze into a cage -> the cage takes 9% more room -> back to the cube and the lid (answer). The viewer sees the same glass at the start and the end.
- Visual: one change at a time, per word. Every new picture holds about 2 s before the camera leaves it.
