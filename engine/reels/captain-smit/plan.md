# Plan: captain-smit
Worlds:
1. The jet (3D): a generic all-white twin-engine narrowbody, no livery, no logo, no name, built from simple shapes at real
   737-8 size (fuselage 39.5 m long, 3.76 m across; wingspan 35.9 m), cruising level over a dark desert floor far below.
   Its nose is cut away on the camera's side so the camera can sit inside, at the flight-deck door in the forward
   bulkhead, about 2.6 m behind the nose tip. The door: 0.8 m wide, 1.9 m tall, a 4 cm armoured slab whose edge shows
   its layers, three lock bolts on the latch side, a small lock lamp, and the lock lever on the flight-deck side only.
   The flight-deck side has an instrument panel glow and windscreen, and a red alert light on the ceiling. No seats with
   anyone in them, no figures, no faces. Used by hook, door, captain, close.
2. The flight display (2D canvas): a dark avionics-style screen. Top half: a route map drawn from real lat/lon
   (equirectangular, x scaled by cos 29 deg), no map tiles. Bottom half: an altitude trace (feet against time).
   Used by route, dive, landing, after.
Keep scenes: hook, route, landing
(hook -> door: one camera pull-back at the door. route -> dive: same display, the camera slides from the map down to
the trace. landing -> after: same display, the camera eases into Tabuk. door -> route, dive -> captain, captain -> landing
and after -> close change world, each inside a 0.48 to 0.67 s silence, with a 24-frame morph: reel.json theme.morph.joins
= route, captain, landing, close.)

Models: models.py search for "plane", "airplane", "aircraft", "jet", "door", "cockpit", "lock" and HDRI "studio" found
nothing. The local library is empty and Poly Haven is off (commercial use), so every object is built from simple
Three.js shapes (no get_model calls). The one asset is the CC0 HDRI copied from ice-floats:
`captain-smit/hdris/brown_photostudio_02_1k.hdr` (in assets/hdris/).

Content rules for every scene: no airline livery, logo or name on the plane; never the attack, a weapon, blood, or a
person in the cockpit. People appear only as small neutral pale discs/spheres moving through the open door, never in
contact with each other. On-screen numbers only: "30 Sep 2026", "FZ1073", "2 h+", ">15,000 ft", "<2 min", "~1 h".
No head count, no co-pilot name, no altitude end-point label (sources give 17,000 and 19,000 ft).

Map points (lat N, lon E): Dubai 25.25, 55.36; Tel Aviv (Ben Gurion) 32.01, 34.89; Tabuk 28.37, 36.62; the turn-back
point 29.90, 38.40 (facts.md: "about 130 nm NE of Tabuk"), which is in Saudi airspace just short of the Jordan border.
Country names as plain text: UAE, SAUDI ARABIA, JORDAN, ISRAEL. Coasts (Gulf, Red Sea, Mediterranean edge) may be a few
hand-drawn approximate polygons; no borders need to be exact. The planned path is drawn as a smooth curve Dubai -> the
turn-back point -> Tel Aviv (real routes cross Saudi airspace, then Jordan); it is a sketch, so it gets no "route" label.

Cue notes for builders: repeated words need the nth argument within the scene, e.g. door scene `cue("inside", 2)`,
captain scene `cue("cockpit")`, landing `cue("flydubai", 2)`. The aligner timed a few words from their neighbours
(thirtieth, flydubai, ten seventy-three, fifteen thousand, Machchhar) and flagged "in"/"Saudi" and "a"/"hero" as 0.02 s
apart; hang no hard move on the second word of those pairs, use the block's key word instead.

## hook · 3D · world 1
Words: "A locked cockpit door keeps a plane safe." (0.0 - 2.3 s)
Shows: the flight-deck door, seen from the cabin side, square in frame; its bolts slide home; then the white fuselage
around it starts to show.
Models: none. Door = box 0.8 x 1.9 x 0.04 m (light grey), bolts = 3 cylinders r 0.012 m; bulkhead = box; fuselage =
cylinder r 1.88 m, 39.5 m long, nose = scaled sphere/cone, cut away on +x side (open-ended half shell, white).
Camera: starts 1.4 m from the door on the cabin side, eye 1.6 m up; from "plane" eases back toward 3 m and a little to
the side (continues straight into door).
- "locked" -> the three bolts slide into the frame (12 frames each, staggered)
- "door" -> the lock lamp turns green
- "plane" -> the camera starts its pull-back; the cut-away fuselage shell comes into view around the door
- "safe" -> hold on the closed, locked door inside the white shell

## door · 3D · world 1 (carries on from hook)
Words: "Unless the danger is inside. Cockpit doors are built to keep attackers out. Under American rules, a door must
hold against being forced, and stop handgun bullets. Its lock opens only from inside." (2.3 - 13.7 s)
Shows: the same door. The red alert light comes on behind it; then what the door is built to do, as arrows and a
cut section; then the lock lever, which exists only on the flight-deck side.
Models: none. Push arrows = cone + cylinder groups; armour layers = 3 thin boxes in the door's cut edge; lever = small
box on the flight-deck face; red alert light = small sphere + red point light on the flight-deck ceiling.
Camera: continues the pull-back to about 3 m, side-on to the cut-away so both sides of the door are visible by "inside";
on "American" swings to a three-quarter view of the cabin face; on "bullets" pushes in to the door's cut edge (0.8 m);
on "inside" (2nd) orbits round to the flight-deck side, looking back at the door's inner face.
- "inside" -> the red alert light on the flight-deck ceiling glows, the door stays shut (danger shown as light only)
- "out" -> three grey arrows from the cabin side push at the door and stop dead at its face
- "American" -> a small plain text plate "US rule (FAA)" settles beside the door
- "forced" -> the arrows push again, harder (longer); the door does not move; label "resists forced entry"
- "bullets" -> the door's cut edge shows its armour layers glowing; label "stops handgun rounds" (no gun, no bullet drawn)
- "inside" (2nd) -> the lock lever on the flight-deck face lights up; label "unlocks only from inside"; the cabin face
  has no lever

## route · 2D · world 2
Words: "On the thirtieth of September, flydubai flight ten seventy-three left Dubai for Tel Aviv. More than two hours in,
over Saudi Arabia near Jordan, the co-pilot attacked the captain inside the locked cockpit." (13.7 - 24.1 s)
Shows: the flight display. The map: Dubai, Tel Aviv, the countries named. A white aircraft marker (a simple chevron,
no livery) leaves Dubai on a dashed path to Tel Aviv, flies for two hours, and is near Jordan when its marker turns
red. The altitude trace below shows a flat line at cruise as the marker flies.
Camera: 2D; starts framing the whole map (Dubai to Tel Aviv) with the trace panel just visible below; slow push toward
the turn-back point from "hours" to "cockpit".
- "thirtieth" -> header card "30 Sep 2026" types on
- "seventy-three" -> "FZ1073 · Dubai -> Tel Aviv" types on beneath it
- "Dubai" -> the Dubai dot lights; the dashed planned path draws to Tel Aviv, whose dot lights at "Aviv"
- "hours" -> the marker travels the path from Dubai to the turn-back point; a clock reads "2 h+"; the trace draws a
  flat cruise line
- "Jordan" -> the marker reaches the point near the border; "JORDAN" and "SAUDI ARABIA" labels brighten
- "attacked" -> the marker turns red and a red alert ring pulses on it (nothing else shown)
- "cockpit" -> a small locked-door icon with a red lamp appears beside the marker (the door from world 1)

## dive · 2D · world 2 (carries on from route)
Words: "The jet dived, falling more than fifteen thousand feet in under two minutes." (24.1 - 28.3 s)
Shows: the altitude trace: the flat cruise line breaks into a near-vertical drop, then levels lower down.
Camera: 2D; slides from the map down to centre the trace on "The", holds there.
- "dived" -> the trace drops steeply (it draws over about 40 frames, steep, not a cut); the red marker on the map above
  stays put
- "thousand" -> a vertical bracket on the drop with ">15,000 ft"
- "minutes" -> a horizontal bracket under the drop with "<2 min"; both hold to the scene end
(Axis ticks every 10,000 ft only; the bottom of the drop gets no number.)

## captain · 3D · world 1
Words: "The captain was Smit Machchhar, from Mumbai. He was seriously injured. But the cockpit door came open, and help
got in. Crew and passengers held the attacker down." (28.3 - 37.3 s)
Shows: back at the door, cabin side, closed and locked, with red light leaking round its edges. A plain title card names
the captain. Then the bolts pull back, the door swings open into the flight deck, and small neutral pale markers move
in from the cabin; the red light goes out.
Models: none. Same door world; people = 3 or 4 pale grey spheres r 0.12 m at 1.2 m height (markers, not figures).
Camera: starts 2.2 m from the cabin face, eye 1.6 m; on "open" eases sideways to see through the doorway at an angle; on
"down" drifts back to 3 m.
- "Machchhar" -> plain title card (HTML overlay, no photo or face): "Capt. Smit Machchhar"
- "Mumbai" -> second line "from Mumbai"
- "injured" -> the title card fades; the red light round the door edge pulses slowly (no injury shown)
- "open" -> the bolts retract and the door swings open into the flight deck (about 70 degrees over 30 frames)
- "in" -> the pale markers move in a line from the cabin through the doorway
- "down" -> the markers come to rest together inside, no contact drawn; the red alert light goes out, the cockpit glow
  turns calm white

## landing · 2D · world 2
Words: "Two flydubai pilots on board for the return flight took the controls. About an hour later, they landed safely
at Tabuk, in Saudi Arabia. flydubai said every passenger was safe." (37.3 - 47.0 s)
Shows: back on the flight display. The marker turns from red to white; a new solid path bends back from the turn-back
point to Tabuk; the altitude trace runs level at the lower altitude then descends to the ground at Tabuk.
Camera: 2D; starts on the map framed around the turn-back point and Tabuk (closer than in route), holds; eases toward
Tabuk on "hour".
- "pilots" -> a text card "2 flydubai pilots, on board for the return flight" (no figures)
- "controls" -> the marker turns white and swings its heading toward Tabuk
- "hour" -> the marker flies the solid path to Tabuk; a clock reads "~1 h"; the trace runs level, then descends
- "Tabuk" -> the marker reaches the Tabuk dot and stops; the trace meets the ground line; "Tabuk" label
- "safe" -> card "flydubai: every passenger safe" (attributed, no number)

## after · 2D · world 2 (carries on from landing)
Words: "The captain was treated in Tabuk, and the Indian Embassy said he was recovering well. India's Prime Minister
called him a hero." (47.0 - 53.2 s)
Shows: the same display, eased in on Tabuk; plain text cards stack beside it.
Camera: 2D; continues easing in on Tabuk, then holds.
- "Tabuk" -> card "Capt. Smit Machchhar · treated in Tabuk"
- "Embassy" -> card "Indian Embassy:" types on
- "well" -> "recovering well" completes that card
- "hero" -> card "India's Prime Minister: a hero" (no portrait, no flag needed)

## close · 3D · world 1
Words: "A locked door is meant to keep danger out. On this flight, the door that opened is what saved the plane."
(53.2 - 60.2 s)
Shows: the door once more: shut and locked with the grey arrows bouncing off it, then open with calm light through it,
then the camera pulls all the way back out of the cut-away to the whole white jet flying level.
Camera: starts 2.5 m from the cabin face; on "opened" holds on the open door; from "saved" pulls back and out through
the cut-away to about 60 m, a three-quarter view of the whole jet, level; holds to the end.
- "meant" -> the door shown shut, bolts in, lamp green
- "out" -> the grey arrows push and stop at its face (as in door)
- "opened" -> the bolts retract and the door swings open; calm white light through the doorway
- "plane" -> the whole white jet in frame, wings level, flying on; hold about 1 s to the end

## Checks (read once)
- Physical: the jet keeps flying level in world 1 (the dive is only shown as the trace, so no 3D plane needs to pitch);
  the door turns on its hinge, it does not fade; bolts slide, they do not pop; markers walk at a walking pace (about
  1.2 m/s) on the floor. Map points come from real lat/lon; the turn-back point is from facts.md (130 nm NE of Tabuk).
- Story: a locked door (hook) -> what it keeps out and that it opens only from inside (door) -> the flight and the
  alert near Jordan (route) -> the drop on the trace (dive) -> the captain, the door coming open, help getting in
  (captain) -> the turn to Tabuk and the landing (landing) -> what was said after (after) -> the same door, open, and
  the whole jet safe (close). The same door and the same marker are seen each time.
- Visual: one change per cue word; labels sit beside the thing, never over a number; every new picture holds about 2 s
  (hook is 2.3 s and its pull-back carries straight into door). Script wording is followed on screen: no head count,
  no co-pilot name, the door "came open" (not who opened it).
