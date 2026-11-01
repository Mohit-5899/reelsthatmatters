# blinkit-ad — plan

Unofficial 30 s Hinglish spec ad. One 2D canvas world (`scenes/AdWorld2D.tsx`) shared by every scene; each scene
draws the same picture from the reel's clock, so no scene change swaps the picture. Times in seconds, `t = f / fps`
(30 fps drafts keep the timing). Captions off; the picture carries the words.

Palette: yellow #F8CB46, green #0C831F, warm-white cards, near-black #1C1C1C. Type: Inter 900 (800/900 added to
`src/fonts.ts`). Never: a delivery time, a rider, a clock on a delivery, a logo file, a real brand.

Scene change from the given plan: "open" also holds the product drop. "Tension mat lo. Blinkit kholo." alone is 1.8 s,
and motion.py fails any scene under 2 s. Only the `== drop` header was removed from caption.txt (words and times unchanged).

| scene | word | what changes |
|---|---|---|
| hook (dark) | frame 0 | "Raat ke gyarah baje." on screen, wall clock at 10:50, second hand ticking |
| | gyarah | "gyarah" turns yellow; the clock's hands snap to 11:00 with a glow |
| | presentation | the clock slides left; a slide card "Presentation / Kal 9 AM" slams in |
| | printer | a printer rises in |
| | dhokha | the printer shakes, a paper jam spits out, the screen shakes, a red ERROR stamp lands |
| problems (dark) | (change) | the hook recedes (80 %, dimmed) and stays behind as part of the chaos |
| | Doodh | card: empty carton on its side, a drip of nothing, "Doodh khatam" |
| | Dost | "Ding dong!" bell badge |
| | chips | card: empty bowl with crumbs, "Chips nahi!" |
| | diapers / khatam | card: empty open box, "Diapers?"; a red KHATAM stamp lands on "khatam" |
| | message | card: buzzing phone, "Mummy" |
| | dhaniya | big chat bubble "Mummy: Dhaniya le aana!" with a coriander sprig, leaves scatter |
| | aana | every card trembles |
| open (dark -> yellow -> warm white) | (change) / Tension | the chaos fades and drifts away; "Tension mat lo." on a dark plate |
| | Blinkit | a yellow burst from the centre fills the frame; "blinkit" in plain lowercase type |
| | kholo | a phone with a generic app grid rises; "blinkit" moves up |
| | before Printout | the phone parks top-right, the ground turns warm white over a yellow floor, the yellow bag rises |
| | Printout, doodh, chips, diapers, dawaiyan, pet, charger | each product pops out of the phone on its word and falls under gravity into the bag: bounce, squash, particles, "+1"; its name shows top-left |
| | Tees -> products | counter 0 -> 30,000, "+" and "products" land on "products"; held to "darwaze" (over 2 s) |
| door | app | the bag (with the pile) flies into the phone; a green tick |
| | seedha | the bag comes back out of the phone and glides down |
| | darwaze | a green front door with a doormat rises; "Seedha aapke / darwaze tak."; the bag settles on the mat |
| end (yellow) | (change) | a yellow circle grows from the bag over the frame |
| | Blinkit | "blinkit" big, breathing |
| | Last | "Last minute ka" types on |
| | pakka | "pakka dost" lands in a green pill; then "30,000+ products / delivered to your doorstep"; the bag sits small below; corner note "Spec ad · concept"; sparkles drift so nothing is ever still |
