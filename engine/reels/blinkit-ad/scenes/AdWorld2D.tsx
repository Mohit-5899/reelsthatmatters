// The one world of the Blinkit spec ad, drawn on a 2D canvas. Every scene (hook, problems, open, door, end) draws the same
// picture from the reel's clock, so a scene change never swaps the picture: it only hands the frames to the next scene.
//   hook + problems  dark room at 11 pm: a ticking wall clock, a slide deck, a jammed printer, then a pile of empty-shelf
//                    cards that slam in one per word until the screen is chaos.
//   open             the chaos is swept away, a yellow burst, "blinkit" in plain type, a phone with a generic app grid;
//                    the phone parks top-right and each product pops out of it and falls (real gravity) into a yellow bag.
//                    Then a counter rolls 0 -> 30,000+.
//   door             the bag goes into the phone, then comes out at a front door and settles on the doormat.
//   end              yellow end card.
// Rules from facts.md: no delivery time, no rider, no clock on a delivery, no logo file, no real brands. The only clock is
// the wall clock in the hook (the time of the problem, not of a delivery).
// Every value is a pure function of the time t = f / fps, in seconds, so a 30 fps draft keeps the timing.
import React, { useLayoutEffect, useMemo, useRef } from "react";
import { useReel, useScene } from "../../../src/engine";

export type AdMode = "hook" | "problems" | "open" | "door" | "end";

// ---------- palette (blinkit.com: yellow, green, white cards, near-black) ----------
const Y = "#F8CB46", YD = "#D9A21C", YIN = "#B98512", G = "#0C831F", INK = "#1C1C1C", DARK = "#0E1014";
const CARD = "#F6F3EC", WARM = "#FFF7E2", TAN = "#EAD9B6", RED = "#E5484D", DIM = "#6B6B6B", SCREEN = "#FAFAF5";
const FONT = "Inter, sans-serif";

// ---------- maths ----------
const cl = (x: number) => Math.min(1, Math.max(0, x));
const P = (t: number, s: number, d: number) => cl((t - s) / d);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const sinIO = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * cl(x));
const outC = (x: number) => 1 - (1 - cl(x)) ** 3;
const outBack = (x: number, k = 1.9) => { const u = cl(x) - 1; return 1 + (k + 1) * u * u * u + k * u * u; };
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
function mixHex(a: string, b: string, k: number) {
  const p = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
  const c = [0, 1, 2].map((i) => Math.round(lerp(p(a, i), p(b, i), cl(k))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
/** a decaying wobble after an impact at s: [scaleX, scaleY] */
function squash(t: number, s: number, amt = 0.14, dur = 0.5): [number, number] {
  const u = t - s;
  if (u < 0 || u > dur) return [1, 1];
  const k = Math.exp(-u * 8) * Math.cos(u * 26);
  return [1 + amt * k, 1 - amt * k];
}
/** a slam-in: alpha, scale (1.45 -> 1 with overshoot) and the squash after it lands */
function slam(t: number, s: number, from = 1.3, dur = 0.3) {
  const a = sinIO(P(t, s, 0.16));
  const sc = lerp(from, 1, outBack(P(t, s, dur), 2.2));
  const [sx, sy] = squash(t, s + dur * 0.7, 0.08, 0.45);
  return { a, sx: sc * sx, sy: sc * sy, on: t >= s };
}

// ---------- canvas helpers ----------
type C2 = CanvasRenderingContext2D;
function rrect(g: C2, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}
function fillStroke(g: C2, fill: string, stroke = INK, lw = 5) {
  g.fillStyle = fill;
  g.fill();
  if (lw > 0) { g.strokeStyle = stroke; g.lineWidth = lw; g.lineJoin = "round"; g.stroke(); }
}
/** text; shrinks to maxW when it is wider. Returns the drawn width. */
function txt(g: C2, s: string, x: number, y: number, size: number, color: string, o: { w?: number; align?: CanvasTextAlign; maxW?: number; alpha?: number } = {}) {
  g.save();
  g.globalAlpha *= o.alpha ?? 1;
  g.font = `${o.w ?? 900} ${size}px ${FONT}`;
  let w = g.measureText(s).width;
  if (o.maxW && w > o.maxW) { size *= o.maxW / w; g.font = `${o.w ?? 900} ${size}px ${FONT}`; w = g.measureText(s).width; }
  g.textAlign = o.align ?? "center";
  g.textBaseline = "middle";
  g.fillStyle = color;
  g.fillText(s, x, y);
  g.restore();
  return w;
}
function shadow(g: C2, blur: number, dy: number, alpha: number) {
  g.shadowColor = `rgba(0,0,0,${alpha})`;
  g.shadowBlur = blur;
  g.shadowOffsetY = dy;
}
function noShadow(g: C2) { g.shadowColor = "transparent"; g.shadowBlur = 0; g.shadowOffsetY = 0; }

// ---------- times, in seconds ----------
type T = Record<string, number>;
function useTimes(): T {
  const { tl } = useReel();
  return useMemo(() => {
    const fps = tl.fps;
    const idx = (id: string) => tl.scenes.findIndex((s) => s.id === id);
    const H = idx("hook"), Pr = idx("problems"), O = idx("open"), D = idx("door"), E = idx("end");
    const c = (w: string, sc: number, n = 1) => tl.cue(w, n, sc) / fps;
    return {
      pFrom: tl.scenes[Pr].from / fps, oFrom: tl.scenes[O].from / fps, dFrom: tl.scenes[D].from / fps, eFrom: tl.scenes[E].from / fps,
      gyarah: c("gyarah", H), presentation: c("presentation", H), printer: c("printer", H), dhokha: c("dhokha", H),
      doodh: c("Doodh", Pr), dost: c("Dost", Pr), chips: c("chips", Pr), diapers: c("diapers", Pr), khatam2: c("khatam", Pr, 2),
      message: c("message", Pr), dhaniya: c("dhaniya", Pr), aana: c("aana", Pr),
      tension: c("Tension", O), blinkit: c("Blinkit", O), kholo: c("kholo", O),
      printout: c("Printout", O), doodh2: c("doodh", O), chips2: c("chips", O), diapers2: c("diapers", O), dawaiyan: c("dawaiyan", O),
      pet: c("pet", O), phone: c("phone", O), charger: c("charger", O), tees: c("Tees", O), products: c("products", O),
      app: c("app", D), seedha: c("seedha", D), darwaze: c("darwaze", D),
      blinkitEnd: c("Blinkit", E), last: c("Last", E), pakka: c("pakka", E),
    };
  }, [tl]);
}

// ---------- the products (simple vector, no brands), centred on 0,0, about 170 px tall ----------
type Kind = "paper" | "milk" | "chips" | "diapers" | "meds" | "pet" | "charger";
function item(g: C2, k: Kind) {
  g.save();
  switch (k) {
    case "paper": {
      g.beginPath();
      g.moveTo(-65, -85); g.lineTo(35, -85); g.lineTo(65, -55); g.lineTo(65, 85); g.lineTo(-65, 85); g.closePath();
      fillStroke(g, "#FBFAF6");
      g.beginPath(); g.moveTo(35, -85); g.lineTo(35, -55); g.lineTo(65, -55); fillStroke(g, "#E4E0D6");
      g.fillStyle = "#B9B4A8";
      for (let i = 0; i < 4; i++) rrect(g, -45, -60 + i * 20, i === 0 ? 70 : 90, 9, 4), g.fill();
      g.fillStyle = G; rrect(g, -42, 35, 22, 32, 3); g.fill();
      g.fillStyle = Y; rrect(g, -12, 15, 22, 52, 3); g.fill();
      g.fillStyle = G; rrect(g, 18, 0, 22, 67, 3); g.fill();
      break;
    }
    case "milk": {
      rrect(g, -55, -40, 110, 125, 8); fillStroke(g, "#F7F5EF");
      g.beginPath(); g.moveTo(-55, -40); g.lineTo(0, -88); g.lineTo(55, -40); g.closePath(); fillStroke(g, "#4C7BD9");
      rrect(g, -14, -104, 28, 20, 5); fillStroke(g, "#4C7BD9");
      g.fillStyle = "#4C7BD9"; g.fillRect(-52, 2, 104, 30);
      g.beginPath(); g.moveTo(0, 40); g.bezierCurveTo(16, 60, 16, 74, 0, 74); g.bezierCurveTo(-16, 74, -16, 60, 0, 40); g.fillStyle = "#4C7BD9"; g.fill();
      break;
    }
    case "chips": {
      g.beginPath();
      const zig = (y: number, dir: number) => { for (let i = 0; i <= 10; i++) g.lineTo(-62 + i * 12.4, y + (i % 2 ? dir * 8 : 0)); };
      g.moveTo(-62, -82); zig(-82, -1);
      g.quadraticCurveTo(80, 0, 62, 82);
      for (let i = 10; i >= 0; i--) g.lineTo(-62 + i * 12.4, 82 + (i % 2 ? 8 : 0));
      g.quadraticCurveTo(-80, 0, -62, -82);
      g.closePath();
      fillStroke(g, "#F08A24");
      g.beginPath(); g.arc(0, -8, 40, 0, Math.PI * 2); g.fillStyle = "#FFD45A"; g.fill();
      g.beginPath(); g.ellipse(0, -8, 26, 18, -0.4, 0, Math.PI * 2); fillStroke(g, "#F3D9A0", "#B5762B", 4);
      g.fillStyle = "#FFFFFF"; rrect(g, -38, 46, 76, 12, 6); g.fill();
      break;
    }
    case "diapers": {
      rrect(g, -80, -72, 160, 150, 18); fillStroke(g, "#CFE6F7");
      g.fillStyle = "#5A86AD"; rrect(g, -26, -62, 52, 14, 7); g.fill();
      g.beginPath(); g.moveTo(-42, -12); g.lineTo(42, -12); g.quadraticCurveTo(36, 38, 0, 44); g.quadraticCurveTo(-36, 38, -42, -12); g.closePath();
      fillStroke(g, "#FFFFFF", "#5A86AD", 4);
      g.fillStyle = "#5A86AD"; rrect(g, -42, -16, 84, 10, 5); g.fill();
      break;
    }
    case "meds": {
      g.beginPath(); g.moveTo(-75, -50); g.lineTo(-55, -70); g.lineTo(95, -70); g.lineTo(75, -50); g.closePath(); fillStroke(g, "#E7E4DC");
      g.beginPath(); g.moveTo(75, -50); g.lineTo(95, -70); g.lineTo(95, 40); g.lineTo(75, 60); g.closePath(); fillStroke(g, "#D6D2C8");
      rrect(g, -75, -50, 150, 110, 6); fillStroke(g, "#FBFAF6");
      g.fillStyle = G; rrect(g, -12, -36, 24, 72, 4); g.fill(); rrect(g, -36, -12, 72, 24, 4); g.fill();
      break;
    }
    case "pet": {
      g.beginPath(); g.moveTo(-60, -80); g.lineTo(60, -80); g.lineTo(72, 85); g.lineTo(-72, 85); g.closePath(); fillStroke(g, "#C07A3E");
      g.beginPath(); g.moveTo(-60, -80); g.lineTo(60, -80); g.lineTo(62, -56); g.lineTo(-62, -56); g.closePath(); fillStroke(g, "#9A5C2A");
      g.beginPath(); g.arc(0, 14, 40, 0, Math.PI * 2); g.fillStyle = "#FFF4E4"; g.fill();
      g.fillStyle = "#9A5C2A";
      g.beginPath(); g.ellipse(0, 24, 15, 12, 0, 0, Math.PI * 2); g.fill();
      for (const [x, y] of [[-20, 4], [-7, -6], [7, -6], [20, 4]]) { g.beginPath(); g.arc(x, y, 6.5, 0, Math.PI * 2); g.fill(); }
      break;
    }
    case "charger": {
      g.fillStyle = "#9AA0A6";
      rrect(g, -24, -78, 12, 34, 3); fillStroke(g, "#B8BDC2", INK, 4);
      rrect(g, 12, -78, 12, 34, 3); fillStroke(g, "#B8BDC2", INK, 4);
      g.beginPath(); g.moveTo(0, 50); g.bezierCurveTo(0, 95, 70, 70, 60, 30); g.bezierCurveTo(52, -5, 85, -10, 88, 20);
      g.strokeStyle = INK; g.lineWidth = 12; g.lineCap = "round"; g.stroke();
      g.strokeStyle = "#E9E9E4"; g.lineWidth = 6; g.stroke();
      rrect(g, 80, 16, 18, 26, 4); fillStroke(g, "#B8BDC2", INK, 4);
      rrect(g, -50, -48, 100, 100, 18); fillStroke(g, "#F4F4F0");
      g.beginPath(); g.moveTo(6, -28); g.lineTo(-16, 6); g.lineTo(0, 6); g.lineTo(-6, 32); g.lineTo(16, -4); g.lineTo(0, -4); g.closePath();
      g.fillStyle = G; g.fill();
      break;
    }
  }
  g.restore();
}

// ---------- the bag (rim centre at 0,0) ----------
function bagBack(g: C2) {
  g.save();
  for (const dx of [-105, 105]) {
    g.beginPath(); g.arc(dx, 4, 58, Math.PI, 0);
    g.strokeStyle = INK; g.lineWidth = 24; g.stroke();
    g.strokeStyle = G; g.lineWidth = 13; g.stroke();
  }
  g.beginPath(); g.ellipse(0, 0, 240, 30, 0, 0, Math.PI * 2); fillStroke(g, YIN, INK, 6);
  g.restore();
}
function bagFront(g: C2) {
  g.save();
  g.beginPath(); g.moveTo(-240, 0); g.lineTo(240, 0); g.lineTo(222, 300); g.quadraticCurveTo(0, 312, -222, 300); g.closePath();
  fillStroke(g, Y, INK, 6);
  g.beginPath(); g.moveTo(-236, 22); g.lineTo(236, 22); g.strokeStyle = YD; g.lineWidth = 6; g.stroke();
  rrect(g, -135, 115, 270, 92, 24); fillStroke(g, "#FFFDF4", INK, 4);
  txt(g, "blinkit", 0, 159, 62, INK, { w: 900 });
  g.restore();
}

// ---------- the phone (centre 0,0, 380 x 760) ----------
function phoneBody(g: C2, glow: number) {
  g.save();
  shadow(g, 40, 18, 0.25);
  rrect(g, -190, -380, 380, 760, 58); g.fillStyle = "#15171C"; g.fill();
  noShadow(g);
  rrect(g, -174, -364, 348, 728, 44); g.fillStyle = SCREEN; g.fill();
  g.save(); rrect(g, -174, -364, 348, 728, 44); g.clip();
  g.fillStyle = Y; g.fillRect(-174, -364, 348, 170);
  txt(g, "blinkit", -146, -268, 54, INK, { w: 900, align: "left" });
  rrect(g, -146, -222, 292, 46, 23); g.fillStyle = "#FFFFFF"; g.fill();
  g.fillStyle = "#C9C5BA"; rrect(g, -124, -204, 120, 10, 5); g.fill();
  const kinds: Kind[] = ["milk", "chips", "paper", "meds", "pet", "charger"];
  kinds.forEach((k, i) => {
    const x = -78 + (i % 2) * 156, y = -100 + Math.floor(i / 2) * 156;
    rrect(g, x - 68, y - 68, 136, 136, 22); g.fillStyle = i % 3 === 0 ? "#EEF6EA" : i % 3 === 1 ? "#FFF3D6" : "#EEF1F6"; g.fill();
    g.save(); g.translate(x, y); g.scale(0.6, 0.6); item(g, k); g.restore();
  });
  if (glow > 0) { g.fillStyle = `rgba(250,250,245,${0.92 * glow})`; g.fillRect(-174, -364, 348, 728); }
  g.restore();
  rrect(g, -50, -356, 100, 26, 13); g.fillStyle = "#15171C"; g.fill();
  g.restore();
}

// ---------- the problem cards ----------
function card(g: C2, w: number, h: number) {
  g.save();
  shadow(g, 36, 16, 0.45);
  rrect(g, -w / 2, -h / 2, w, h, 30); g.fillStyle = CARD; g.fill();
  g.restore();
}
function clock(g: C2, r: number, hour: number, min: number, sec: number, glow: number) {
  g.save();
  if (glow > 0) { g.beginPath(); g.arc(0, 0, r + 26, 0, Math.PI * 2); g.fillStyle = `rgba(248,203,70,${0.35 * glow})`; g.fill(); }
  g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fillStyle = "#2B2E35"; g.fill();
  g.beginPath(); g.arc(0, 0, r * 0.9, 0, Math.PI * 2); g.fillStyle = "#EFEBE0"; g.fill();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, big = i % 3 === 0;
    g.save(); g.rotate(a); g.fillStyle = INK; g.fillRect(-(big ? 5 : 3), -r * 0.84, big ? 10 : 6, r * (big ? 0.14 : 0.09)); g.restore();
  }
  const hand = (a: number, len: number, wd: number, col: string) => {
    g.save(); g.rotate(a); g.fillStyle = col; rrect(g, -wd / 2, -len, wd, len + r * 0.12, wd / 2); g.fill(); g.restore();
  };
  hand((hour / 12) * Math.PI * 2, r * 0.5, 16, INK);
  hand((min / 60) * Math.PI * 2, r * 0.74, 11, INK);
  hand((sec / 60) * Math.PI * 2, r * 0.8, 4, RED);
  g.beginPath(); g.arc(0, 0, 13, 0, Math.PI * 2); g.fillStyle = RED; g.fill();
  g.restore();
}
function printer(g: C2, jam: number, err: number) {
  g.save();
  rrect(g, -170, -205, 340, 90, 10); fillStroke(g, "#F3F1EA", INK, 4); // paper in the tray
  rrect(g, -270, -150, 540, 90, 26); fillStroke(g, "#555B66", INK, 5);
  rrect(g, -270, -80, 540, 200, 30); fillStroke(g, "#3A3E47", INK, 5);
  rrect(g, -200, 10, 400, 26, 13); g.fillStyle = "#16181C"; g.fill(); // output slot
  rrect(g, 120, -60, 120, 52, 10); g.fillStyle = err > 0 ? mixHex("#1F3B2A", RED, err) : "#1F3B2A"; g.fill();
  txt(g, err > 0.5 ? "ERR" : "OK", 180, -34, 30, "#FFFFFF", { w: 800 });
  if (jam > 0) {
    g.save(); g.translate(0, 22); g.scale(1, jam);
    g.beginPath();
    g.moveTo(-150, 0);
    const pts = [[-130, 70], [-90, 40], [-60, 110], [-20, 60], [20, 125], [60, 55], [95, 105], [130, 45], [150, 0]];
    for (const [x, y] of pts) g.lineTo(x, y);
    g.closePath();
    fillStroke(g, "#F3F1EA", INK, 4);
    g.strokeStyle = "#B9B4A8"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-90, 40); g.lineTo(-70, 10); g.moveTo(20, 125); g.lineTo(10, 20); g.moveTo(95, 105); g.lineTo(80, 15); g.stroke();
    g.restore();
  }
  g.restore();
}

// ---------- the painter ----------
function paint(g: C2, t: number, T: T) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  // camera float (never fully still) plus the printer's screen shake
  let ox = 3 * Math.sin((2 * Math.PI * t) / 3.3), oy = 3 * Math.sin((2 * Math.PI * t) / 2.7 + 1);
  if (t > T.dhokha && t < T.dhokha + 0.6) { const u = t - T.dhokha; ox += 10 * Math.sin(u * 70) * Math.exp(-u * 7); oy += 6 * Math.cos(u * 61) * Math.exp(-u * 7); }

  const burstS = T.blinkit - 0.25, burstD = 0.9, burstE = burstS + burstD;   // ends before the room turns white on "Printout"
  const whiteS = T.printout - 0.32, whiteK = sinIO(P(t, whiteS, 0.45));
  const tanK = sinIO(P(t, T.darwaze - 0.05, 0.45));
  const endS = T.eFrom, endD = 0.55, endE = endS + endD;

  if (t < burstE) {
    // ---------- the dark room ----------
    g.fillStyle = DARK; g.fillRect(0, 0, 1080, 1920);
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.3);
    const rg = g.createRadialGradient(560, 1780, 40, 560, 1780, 1100);
    rg.addColorStop(0, `rgba(120,150,210,${0.16 + 0.05 * pulse})`); rg.addColorStop(1, "rgba(120,150,210,0)");
    g.fillStyle = rg; g.fillRect(0, 0, 1080, 1920);
    g.save(); g.translate(ox, oy);
    paintDark(g, t, T);
    g.restore();
    if (t > burstS) {
      const r = 1250 * Math.sqrt(sinIO(P(t, burstS, burstD)));   // grows by area, so the screen fills at an even rate
      g.beginPath(); g.arc(540 + ox, 900 + oy, r, 0, Math.PI * 2); g.fillStyle = Y; g.fill();
      g.beginPath(); g.arc(540 + ox, 900 + oy, r, 0, Math.PI * 2); g.strokeStyle = "rgba(255,240,190,0.7)"; g.lineWidth = 18 * (1 - P(t, burstS, burstD)); g.stroke();
    }
  } else if (t < endE) {
    g.fillStyle = mixHex(Y, WARM, whiteK); g.fillRect(0, 0, 1080, 1920);
    if (whiteK > 0) {
      g.fillStyle = mixHex(Y, TAN, tanK); g.fillRect(0, 1520 + oy, 1080, 420);
      g.fillStyle = `rgba(0,0,0,${0.08 * whiteK})`; g.fillRect(0, 1520 + oy, 1080, 6);
    }
  }
  if (t >= burstS && t < endE) {
    g.save(); g.translate(ox, oy);
    paintBright(g, t, T);
    g.restore();
  }
  if (t >= endS) {
    const b = bagPose(t, T);
    if (t < endE) {
      const r = 1650 * sinIO(P(t, endS, endD));
      g.beginPath(); g.arc(b.x + ox, b.y + 120 * b.s + oy, r, 0, Math.PI * 2); g.fillStyle = Y; g.fill();
    } else { g.fillStyle = Y; g.fillRect(0, 0, 1080, 1920); }
    g.save(); g.translate(ox, oy);
    paintEnd(g, t, T);
    g.restore();
  }
}

// ---------- hook + problems ----------
function paintDark(g: C2, t: number, T: T) {
  // the sweep on "Tension": everything leaves, alternating left and right, accelerating
  const sweep = (i: number) => P(t, T.oFrom - 0.12 + i * 0.06, 0.55);
  const away = (i: number, fn: () => void) => {
    const u = sweep(i), k = sinIO(u);
    if (u >= 1) return;
    const dir = i % 2 ? 1 : -1;
    g.save();
    g.globalAlpha *= 1 - sinIO(u);
    g.translate(540, 960); g.rotate(dir * 0.18 * k); g.scale(1 - 0.12 * k, 1 - 0.12 * k); g.translate(-540 + dir * 300 * k, -960 + 60 * k);
    fn();
    g.restore();
  };
  const tremble = (i: number) => (t > T.aana && t < T.oFrom + 0.3 ? 4 * Math.sin(t * 57 + i * 2) : 0);

  // hook group: recedes on the scene change into problems
  const rec = sinIO(P(t, T.pFrom, 0.45));
  away(0, () => {
    g.save();
    g.translate(540, 900); g.scale(lerp(1, 0.8, rec), lerp(1, 0.8, rec)); g.translate(-540, -900);
    g.globalAlpha = lerp(1, 0.4, rec);
    // title: the first sentence, literally, from frame 0
    const ta = 1 - P(t, T.pFrom, 0.3);
    if (ta > 0) {
      g.save(); g.globalAlpha *= ta; g.translate(0, -60 * P(t, T.pFrom, 0.3));
      const size = 84, parts = ["Raat ke ", "gyarah", " baje."];
      g.font = `900 ${size}px ${FONT}`;
      const ws = parts.map((p) => g.measureText(p).width), tot = ws.reduce((a, b) => a + b, 0);
      let x = 540 - tot / 2;
      const gy = P(t, T.gyarah, 0.15);
      parts.forEach((p, i) => {
        const sc = i === 1 ? 1 + 0.12 * Math.sin(Math.PI * P(t, T.gyarah, 0.3)) : 1;
        g.save(); g.translate(x + ws[i] / 2, 300); g.scale(sc, sc);
        txt(g, p, 0, 0, size, i === 1 ? mixHex("#FFFFFF", Y, gy) : "#FFFFFF", { w: 900 });
        g.restore();
        x += ws[i];
      });
      g.restore();
    }
    // the wall clock: 10:50, snaps to 11:00 on "gyarah"; the second hand ticks every second
    const mv = outBack(P(t, T.presentation, 0.34), 1.6);
    const cx = lerp(540, 290, mv), cy = lerp(760, 700, mv), r = lerp(215, 150, mv);
    const snap = outBack(P(t, T.gyarah, 0.24), 2.4);
    const min = lerp(50, 60, snap), hour = 10 + min / 60;
    const tick = Math.floor(t) + outBack(P(t - Math.floor(t), 0, 0.09), 2);
    const glow = Math.sin(Math.PI * P(t, T.gyarah, 0.7));
    g.save(); g.translate(cx, cy); clock(g, r, hour, min, 32 + tick, glow); g.restore();
    // the slide deck: "Kal 9 AM"
    const s1 = slam(t, T.presentation + 0.04);
    if (s1.on) {
      g.save(); g.globalAlpha *= s1.a; g.translate(750, 700); g.rotate(0.06); g.scale(s1.sx, s1.sy);
      card(g, 430, 300);
      g.fillStyle = "#E4E0D6"; rrect(g, -215, -150, 430, 56, 30); g.fill(); g.fillRect(-215, -120, 430, 26);
      for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(-180 + i * 26, -122, 8, 0, Math.PI * 2); g.fillStyle = ["#E5484D", "#F8CB46", "#3DDC97"][i]; g.fill(); }
      txt(g, "Presentation", 0, -44, 38, DIM, { w: 700 });
      txt(g, "Kal 9 AM", 0, 40, 84, INK, { w: 900, maxW: 370 });
      g.fillStyle = RED; rrect(g, -150, 96, 300, 10, 5); g.fill();
      g.restore();
    }
    // the printer: pops on "printer", jams on "dhokha"
    const pr = P(t, T.printer, 0.32);
    if (pr > 0) {
      const u = t - T.dhokha, shake = u > 0 && u < 0.9 ? 12 * Math.sin(u * 64) * Math.exp(-u * 4) : 0;
      g.save(); g.globalAlpha *= P(t, T.printer, 0.1);
      g.translate(540 + shake, lerp(1360, 1180, outBack(pr, 2)));
      g.rotate(u > 0 && u < 0.9 ? 0.02 * Math.sin(u * 51) * Math.exp(-u * 4) : 0);
      printer(g, outBack(P(t, T.dhokha, 0.22), 2), P(t, T.dhokha, 0.12));
      g.restore();
      const e = slam(t, T.dhokha + 0.06, 1.6);
      if (e.on) {
        g.save(); g.globalAlpha *= e.a; g.translate(540, 1420); g.rotate(-0.07); g.scale(e.sx, e.sy);
        shadow(g, 30, 12, 0.5); rrect(g, -200, -62, 400, 124, 26); g.fillStyle = RED; g.fill(); noShadow(g);
        txt(g, "ERROR", 0, 2, 78, "#FFFFFF", { w: 900 });
        g.restore();
      }
    }
    g.restore();
  });

  // 1. Doodh: an empty carton on its side, a drip of nothing
  away(1, () => {
    const s = slam(t, T.doodh);
    if (!s.on) return;
    g.save(); g.globalAlpha *= s.a; g.translate(300 + tremble(1), 560); g.rotate(-0.07); g.scale(s.sx, s.sy);
    card(g, 460, 420);
    g.save(); g.translate(-10, -50); g.rotate(-1.35);
    rrect(g, -50, -40, 100, 120, 8); fillStroke(g, "#E9E6DE");
    g.beginPath(); g.moveTo(-50, -40); g.lineTo(0, -82); g.lineTo(50, -40); g.closePath(); fillStroke(g, "#8FA9DC");
    rrect(g, -12, -98, 24, 18, 5); fillStroke(g, "#8FA9DC");
    g.restore();
    // the drip falls from the open spout, every 0.9 s
    const u = ((t - T.doodh) % 0.9) / 0.9;
    const dx = -100, dy = -70;
    const grow = cl(u / 0.45), fall = cl((u - 0.45) / 0.55);
    g.fillStyle = "#DCE6F5";
    g.beginPath(); g.arc(dx, dy + 6 * grow + 120 * fall * fall, 4 + 6 * grow, 0, Math.PI * 2);
    g.globalAlpha *= 1 - fall * 0.8; g.fill();
    g.restore();
    g.save(); g.globalAlpha *= s.a; g.translate(300 + tremble(1), 560); g.rotate(-0.07); g.scale(s.sx, s.sy);
    txt(g, "Doodh khatam", 0, 140, 60, INK, { w: 900, maxW: 410 });
    g.restore();
  });

  // 2. friends at the door: "Ding dong!", then the empty chips bowl
  away(2, () => {
    const d = slam(t, T.dost, 1.5, 0.24);
    if (d.on) {
      g.save(); g.globalAlpha *= d.a; g.translate(790 + tremble(2), 400); g.scale(d.sx, d.sy);
      g.save(); shadow(g, 30, 12, 0.45); rrect(g, -190, -66, 380, 132, 66); g.fillStyle = CARD; g.fill(); g.restore();
      const u = t - T.dost, wob = 0.35 * Math.sin(u * 22) * Math.exp(-u * 3) + 0.06 * Math.sin(t * 9);
      g.save(); g.translate(-122, 0); g.rotate(wob);
      g.beginPath(); g.moveTo(-34, 24); g.quadraticCurveTo(-30, -38, 0, -40); g.quadraticCurveTo(30, -38, 34, 24); g.closePath(); fillStroke(g, Y, INK, 4);
      g.beginPath(); g.arc(0, 32, 9, 0, Math.PI * 2); fillStroke(g, Y, INK, 4);
      g.restore();
      txt(g, "Ding dong!", 46, 2, 54, INK, { w: 900, maxW: 250 });
      g.restore();
    }
    const s = slam(t, T.chips);
    if (!s.on) return;
    g.save(); g.globalAlpha *= s.a; g.translate(775 + tremble(3), 790); g.rotate(0.06); g.scale(s.sx, s.sy);
    card(g, 460, 420);
    g.beginPath(); g.ellipse(0, -60, 150, 34, 0, 0, Math.PI * 2); fillStroke(g, "#3A2A26", INK, 5);
    g.beginPath(); g.moveTo(-150, -60); g.quadraticCurveTo(-140, 60, 0, 66); g.quadraticCurveTo(140, 60, 150, -60); g.ellipse(0, -60, 150, 34, 0, 0, Math.PI); g.closePath();
    fillStroke(g, "#E07A5F", INK, 5);
    for (let i = 0; i < 5; i++) { g.save(); g.translate(-60 + i * 30, -62 + (i % 2) * 8); g.rotate(i); g.fillStyle = "#F3C76A"; g.fillRect(-5, -4, 10, 8); g.restore(); }
    txt(g, "Chips nahi!", 0, 140, 60, INK, { w: 900, maxW: 410 });
    g.restore();
  });

  // 3. diapers: an empty open box, stamped KHATAM
  away(3, () => {
    const s = slam(t, T.diapers);
    if (!s.on) return;
    g.save(); g.globalAlpha *= s.a; g.translate(310 + tremble(4), 1090); g.rotate(0.05); g.scale(s.sx, s.sy);
    card(g, 460, 420);
    g.save(); g.translate(0, -40);
    g.beginPath(); g.moveTo(-120, -50); g.lineTo(-190, -100); g.lineTo(-150, -40); g.closePath(); fillStroke(g, "#C99C62", INK, 4);
    g.beginPath(); g.moveTo(120, -50); g.lineTo(190, -100); g.lineTo(150, -40); g.closePath(); fillStroke(g, "#C99C62", INK, 4);
    g.beginPath(); g.moveTo(-120, -50); g.lineTo(120, -50); g.lineTo(100, -20); g.lineTo(-100, -20); g.closePath(); fillStroke(g, "#4A3826", INK, 4);
    rrect(g, -120, -24, 240, 120, 6); fillStroke(g, "#D9B27C", INK, 5);
    txt(g, "DIAPERS", 0, 34, 36, "#5A4326", { w: 900 });
    g.restore();
    txt(g, "Diapers?", 0, 140, 60, INK, { w: 900, maxW: 410 });
    const k = slam(t, T.khatam2, 1.8, 0.22);
    if (k.on) {
      g.save(); g.globalAlpha *= k.a; g.translate(60, -60); g.rotate(-0.2); g.scale(k.sx, k.sy);
      rrect(g, -150, -48, 300, 96, 14); g.fillStyle = "rgba(246,243,236,0.9)"; g.fill();
      g.strokeStyle = RED; g.lineWidth = 8; g.stroke();
      txt(g, "KHATAM", 0, 3, 60, RED, { w: 900 });
      g.restore();
    }
    g.restore();
  });

  // 4. Mummy's message: a buzzing phone, then the big bubble "Dhaniya le aana!"
  away(4, () => {
    const s = slam(t, T.message);
    if (!s.on) return;
    const u = t - T.message;
    const buzz = (u < 0.55 || (t > T.dhaniya && t < T.dhaniya + 0.5)) ? 6 * Math.sin(t * 95) : 1.5 * Math.sin(t * 40);
    g.save(); g.globalAlpha *= s.a; g.translate(770 + tremble(5), 1225); g.rotate(-0.05); g.scale(s.sx, s.sy);
    card(g, 440, 400);
    g.save(); g.translate(buzz, -40);
    rrect(g, -80, -130, 160, 260, 26); g.fillStyle = "#15171C"; g.fill();
    rrect(g, -68, -118, 136, 236, 18); g.fillStyle = "#24303D"; g.fill();
    rrect(g, -60, -70, 120, 64, 14); g.fillStyle = "#F6F3EC"; g.fill();
    g.beginPath(); g.arc(-38, -38, 12, 0, Math.PI * 2); g.fillStyle = G; g.fill();
    g.fillStyle = "#9A968C"; rrect(g, -18, -50, 64, 10, 5); g.fill(); rrect(g, -18, -32, 46, 10, 5); g.fill();
    g.strokeStyle = Y; g.lineWidth = 6; g.lineCap = "round";
    const ba = 0.5 + 0.5 * Math.sin(t * 18);
    g.globalAlpha *= 0.5 + 0.5 * ba;
    for (const sgn of [-1, 1]) for (const rr of [100, 125]) { g.beginPath(); g.arc(0, 0, rr, sgn > 0 ? -0.5 : Math.PI - 0.5, sgn > 0 ? 0.5 : Math.PI + 0.5); g.stroke(); }
    g.restore();
    txt(g, "Mummy", 0, 145, 60, INK, { w: 900, maxW: 380 });
    g.restore();
    const b = slam(t, T.dhaniya, 1.4, 0.26);
    if (b.on) {
      g.save(); g.globalAlpha *= b.a; g.translate(540 + tremble(6), 1530); g.rotate(-0.02); g.scale(b.sx, b.sy);
      g.save(); shadow(g, 40, 16, 0.5);
      rrect(g, -440, -85, 880, 170, 40); g.fillStyle = CARD; g.fill();
      g.beginPath(); g.moveTo(200, -80); g.lineTo(250, -130); g.lineTo(270, -80); g.closePath(); g.fill();
      g.restore();
      txt(g, "Mummy:", -400, -42, 40, G, { w: 900, align: "left" });
      txt(g, "Dhaniya le aana!", -400, 28, 70, INK, { w: 900, align: "left", maxW: 620 });
      // a coriander sprig
      g.save(); g.translate(330, 10); g.rotate(0.15 * Math.sin(t * 6));
      g.strokeStyle = "#2F7D32"; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 60); g.lineTo(0, -20); g.stroke();
      for (const [x, y, a] of [[-26, -30, -0.6], [26, -30, 0.6], [0, -52, 0], [-22, 6, -0.9], [22, 6, 0.9]]) {
        g.save(); g.translate(x, y); g.rotate(a);
        g.beginPath(); g.ellipse(0, 0, 18, 13, 0, 0, Math.PI * 2); g.fillStyle = "#3FA34D"; g.fill();
        g.restore();
      }
      g.restore();
      g.restore();
      // leaves scatter out of the bubble
      const lu = P(t, T.dhaniya, 0.9);
      if (lu > 0 && lu < 1) {
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI / 2 + (i - 3) * 0.42, sp = 260 + 90 * hash(i);
          const x = 860 + Math.cos(a) * sp * lu, y = 1515 + Math.sin(a) * sp * lu + 500 * lu * lu;
          g.save(); g.globalAlpha *= 1 - lu; g.translate(x, y); g.rotate(i + lu * 6);
          g.beginPath(); g.ellipse(0, 0, 14, 9, 0, 0, Math.PI * 2); g.fillStyle = "#3FA34D"; g.fill();
          g.restore();
        }
      }
    }
  });

  // "Tension mat lo." once the chaos is gone
  const tm = slam(t, T.tension + 0.08, 1.5, 0.28);
  if (tm.on) {
    g.save(); g.globalAlpha *= tm.a; g.translate(540, 900); g.scale(tm.sx, tm.sy);
    g.save(); shadow(g, 80, 0, 0.9); rrect(g, -500, -95, 1000, 190, 95); g.fillStyle = DARK; g.fill(); g.restore();
    txt(g, "Tension mat lo.", 0, 0, 104, "#FFFFFF", { w: 900, maxW: 940 });
    g.restore();
  }
}

// ---------- open (bright part) + door ----------
const KINDS: Kind[] = ["paper", "milk", "chips", "diapers", "meds", "pet", "charger"];
const NAMES = ["Printout", "Doodh", "Chips", "Diapers", "Dawaiyan", "Pet food", "Phone charger"];
// where each lands in the bag: [x, y] of its centre from the rim centre, and its tilt
const SLOTS: [number, number, number][] = [[-150, -45, -0.18], [-15, -60, 0.04], [140, -50, 0.22], [-95, -150, -0.1], [85, -140, 0.12], [-30, -235, -0.05], [140, -225, 0.2]];
const BAG = { x: 540, y: 1230 };
const PARK = { x: 868, y: 520, s: 0.5 };
const FLIGHT = 0.46, GRAV = 6000;
const launches = (T: T) => [T.printout, T.doodh2, T.chips2, T.diapers2, T.dawaiyan, T.pet, T.charger];

function phonePose(t: number, T: T) {
  const rise = outBack(P(t, T.kholo, 0.38), 1.5);
  let x = 540, y = lerp(2400, 1250, rise), s = 1;
  const park = sinIO(P(t, T.printout - 0.3, 0.32));
  x = lerp(x, PARK.x, park); y = lerp(y, PARK.y, park); s = lerp(s, PARK.s, park);
  y += park * 6 * Math.sin(t * 3.1);
  s *= 1 + 0.08 * Math.sin(Math.PI * P(t, T.app - 0.05, 0.3)); // a little pulse as the bag goes in
  const out = sinIO(P(t, T.darwaze + 0.05, 0.45));
  x += 420 * out; s *= 1 - 0.3 * out;
  return { x, y, s, a: 1 - out };
}
/** the bag: rises at the drop, flies into the phone on "app", comes out to the doormat, then sits on the end card */
function bagPose(t: number, T: T) {
  const rise = outBack(P(t, T.printout - 0.28, 0.4), 1.7);
  let x = BAG.x, y = lerp(BAG.y + 420, BAG.y, rise), s = 1;
  // into the phone
  const ph = { x: PARK.x, y: PARK.y + 40 };
  const kin = sinIO(P(t, T.app, 0.5));
  x = lerp(x, ph.x, kin); y = lerp(y, ph.y, kin) - 140 * Math.sin(Math.PI * kin); s = lerp(s, 0.2, kin);
  // out to the doormat, gently
  const mat = { x: 540, y: 1525 - 300 * 0.62, s: 0.62 };
  const kout = sinIO(P(t, T.seedha + 0.1, T.darwaze + 0.35 - T.seedha - 0.1));
  x = lerp(x, mat.x, kout); y = lerp(y, mat.y, kout) - 60 * Math.sin(Math.PI * kout); s = lerp(s, mat.s, kout);
  const [sx, sy] = squash(t, T.darwaze + 0.35, 0.06, 0.5);
  // the end card spot
  const ke = sinIO(P(t, T.blinkitEnd, 0.5));
  x = lerp(x, 540, ke); y = lerp(y, 1462, ke); s = lerp(s, 0.42, ke);
  y += ke * 6 * Math.sin(t * 2.6);
  return { x, y, s, sx, sy, a: P(t, T.printout - 0.28, 0.12) };
}

function drawBagWithPile(g: C2, t: number, T: T, pose: ReturnType<typeof bagPose>) {
  if (pose.a <= 0) return;
  const L = launches(T);
  g.save();
  g.globalAlpha *= pose.a;
  g.translate(pose.x, pose.y); g.scale(pose.s * pose.sx, pose.s * pose.sy);
  bagBack(g);
  L.forEach((l, i) => {
    if (t < l) return;
    const [sx0, sy0, rot] = SLOTS[i];
    const land = l + FLIGHT;
    g.save();
    if (t < land) {
      // in flight, in the bag's own frame (the bag stands still during the drop): a real arc under gravity
      const ph = phonePose(l, T);
      const x0 = (ph.x - BAG.x), y0 = (ph.y + 60 * ph.s - BAG.y);
      const tau = t - l;
      const vy0 = (sy0 - y0 - 0.5 * GRAV * FLIGHT * FLIGHT) / FLIGHT;
      const x = lerp(x0, sx0, tau / FLIGHT), y = y0 + vy0 * tau + 0.5 * GRAV * tau * tau;
      const sc = lerp(0.35, 1, outC(tau / 0.22));
      g.translate(x, y); g.rotate(rot + (1 - tau / FLIGHT) * 1.4 * (i % 2 ? 1 : -1)); g.scale(sc, sc);
    } else {
      const v = (t - land) / 0.24, v2 = (t - land - 0.24) / 0.14;
      const hop = v < 1 ? 34 * 4 * v * (1 - v) : v2 < 1 && v2 > 0 ? 10 * 4 * v2 * (1 - v2) : 0;
      const [qx, qy] = squash(t, land, 0.16, 0.45);
      g.translate(sx0, sy0 - hop + 85 * (1 - qy)); g.rotate(rot); g.scale(qx, qy);
    }
    item(g, KINDS[i]);
    g.restore();
  });
  bagFront(g);
  g.restore();
}

function paintBright(g: C2, t: number, T: T) {
  const L = launches(T);
  // "blinkit": pops in the burst, rises on "kholo", leaves as the phone parks
  const bt = slam(t, T.blinkit + 0.06, 0.55, 0.32);
  const lift = sinIO(P(t, T.kholo, 0.36));
  const gone = sinIO(P(t, T.printout - 0.32, 0.26));
  if (bt.on && gone < 1) {
    const br = 1 + 0.015 * Math.sin(t * 5);
    g.save(); g.globalAlpha *= bt.a * (1 - gone);
    g.translate(540, lerp(900, 520, lift) - 120 * gone);
    g.scale(bt.sx * lerp(1, 0.78, lift) * br * (1 - 0.3 * gone), bt.sy * lerp(1, 0.78, lift) * br * (1 - 0.3 * gone));
    txt(g, "blinkit", 0, 0, 250, INK, { w: 900, maxW: 900 });
    g.restore();
  }

  // the door, on "darwaze" (drawn behind the bag)
  const dr = P(t, T.darwaze - 0.1, 0.42);
  if (dr > 0) {
    g.save(); g.globalAlpha *= cl(dr * 2.5);
    g.translate(540, lerp(1300, 1160, outBack(dr, 1.6)));
    // wall light around the door
    g.fillStyle = "rgba(248,203,70,0.25)"; rrect(g, -270, -400, 540, 760, 30); g.fill();
    rrect(g, -230, -370, 460, 730, 14); fillStroke(g, "#FFFDF6", INK, 5);
    rrect(g, -200, -345, 400, 705, 10); fillStroke(g, G, INK, 5);
    for (const [y, h] of [[-300, 270], [10, 300]]) { rrect(g, -150, y, 300, h, 14); fillStroke(g, "#0A6E1A", INK, 3); }
    g.beginPath(); g.arc(140, 20, 18, 0, Math.PI * 2); fillStroke(g, Y, INK, 4);
    g.restore();
    // the doormat, on the floor
    const ma = cl(dr * 2);
    g.save(); g.globalAlpha *= ma;
    g.beginPath(); g.moveTo(290, 1512); g.lineTo(790, 1512); g.lineTo(830, 1580); g.lineTo(250, 1580); g.closePath(); fillStroke(g, "#5A4A3A", INK, 4);
    g.restore();
  }

  // "Seedha aapke / darwaze tak." over the door
  const dt = slam(t, T.darwaze, 1.35, 0.26);
  if (dt.on) {
    g.save(); g.globalAlpha *= dt.a * (1 - sinIO(P(t, T.eFrom - 0.12, 0.22))); g.translate(540, 470); g.scale(dt.sx, dt.sy);
    txt(g, "Seedha aapke", 0, -62, 92, INK, { w: 900, maxW: 900 });
    txt(g, "darwaze tak.", 0, 52, 92, G, { w: 900, maxW: 900 });
    g.restore();
  }

  // the phone
  if (t >= T.kholo) {
    const ph = phonePose(t, T);
    if (ph.a > 0) {
      g.save(); g.globalAlpha *= ph.a; g.translate(ph.x, ph.y); g.scale(ph.s, ph.s);
      phoneBody(g, P(t, T.app + 0.15, 0.3));
      const tk = slam(t, T.app + 0.5, 1.6, 0.24);
      if (tk.on) {
        g.save(); g.globalAlpha *= tk.a; g.translate(130, -300); g.scale(tk.sx, tk.sy);
        g.beginPath(); g.arc(0, 0, 70, 0, Math.PI * 2); fillStroke(g, G, "#FFFFFF", 8);
        g.beginPath(); g.moveTo(-32, 2); g.lineTo(-8, 26); g.lineTo(34, -22); g.strokeStyle = "#FFFFFF"; g.lineWidth = 16; g.lineCap = "round"; g.lineJoin = "round"; g.stroke();
        g.restore();
      }
      g.restore();
    }
  }

  // the bag and its pile
  const pose = bagPose(t, T);
  drawBagWithPile(g, t, T, pose);

  // landings: particles and a "+1"
  L.forEach((l, i) => {
    const land = l + FLIGHT, u = t - land;
    if (u < 0 || u > 0.8 || t > T.app) return;
    const x0 = BAG.x + SLOTS[i][0], y0 = BAG.y + SLOTS[i][1] - 40;
    const pu = cl(u / 0.5);
    if (pu < 1) {
      for (let j = 0; j < 14; j++) {
        const a = (j / 14) * Math.PI * 2 + i, sp = 180 + 140 * hash(i * 31 + j);
        const x = x0 + Math.cos(a) * sp * outC(pu), y = y0 + Math.sin(a) * sp * outC(pu) + 260 * pu * pu;
        g.save(); g.globalAlpha *= 1 - pu; g.translate(x, y); g.rotate(a + pu * 4);
        g.fillStyle = [Y, G, INK, "#FFFFFF"][j % 4];
        if (j % 2) g.fillRect(-7, -7, 14, 14); else { g.beginPath(); g.arc(0, 0, 8, 0, Math.PI * 2); g.fill(); }
        g.restore();
      }
    }
    const st = slam(t, land, 0.4, 0.22);
    const fade = 1 - P(t, land + 0.5, 0.3);
    g.save(); g.globalAlpha *= st.a * fade;
    g.translate(x0 + (i % 2 ? 120 : -120), y0 - 150 - 90 * outC(u / 0.8)); g.scale(st.sx, st.sy); g.rotate(i % 2 ? 0.12 : -0.12);
    rrect(g, -70, -44, 140, 88, 44); fillStroke(g, G, "#FFFFFF", 5);
    txt(g, "+1", 0, 2, 56, "#FFFFFF", { w: 900 });
    g.restore();
  });

  // the product names, one per word, top left
  const shows = [T.printout, T.doodh2, T.chips2, T.diapers2, T.dawaiyan, T.pet, T.phone];
  shows.forEach((s, i) => {
    const end = i < shows.length - 1 ? shows[i + 1] : T.tees;
    if (t < s || t > end + 0.2) return;
    const inn = outBack(P(t, s, 0.2), 2), out = P(t, end - 0.12, 0.12);   // gone before the next name arrives
    g.save(); g.globalAlpha *= P(t, s, 0.08) * (1 - out);
    g.translate(70, 440 + 40 * (1 - inn) - 40 * out);
    txt(g, NAMES[i], 0, 0, 104, INK, { w: 900, align: "left", maxW: 680 });
    g.fillStyle = G; rrect(g, 0, 62, 120 * inn, 12, 6); g.fill();
    g.restore();
  });

  // the counter: 0 -> 30,000 by "products", then "+", held until "app" (clear before the door text)
  if (t >= T.tees) {
    const fade = 1 - P(t, T.app, 0.3);
    if (fade > 0) {
      const v = 30000 * outC(P(t, T.tees, Math.max(0.4, T.products - T.tees)));
      const plus = slam(t, T.products, 1.8, 0.22);
      g.save(); g.globalAlpha *= P(t, T.tees, 0.1) * fade;
      const s0 = slam(t, T.tees, 1.3, 0.24);
      g.translate(70, 430); g.scale(s0.sx, s0.sy);
      const w = txt(g, Math.round(v).toLocaleString("en-US"), 0, 0, 170, INK, { w: 900, align: "left", maxW: 600 });
      if (plus.on) { g.save(); g.globalAlpha *= plus.a; g.translate(w + 50, -8); g.scale(plus.sx, plus.sy); txt(g, "+", 0, 0, 160, G, { w: 900 }); g.restore(); }
      const pr = slam(t, T.products, 1.3, 0.24);
      if (pr.on) { g.save(); g.globalAlpha *= pr.a; g.translate(4, 140); g.scale(pr.sx, pr.sy); txt(g, "products", 0, 0, 76, G, { w: 900, align: "left" }); g.restore(); }
      g.restore();
    }
  }
}

// ---------- end card ----------
function paintEnd(g: C2, t: number, T: T) {
  const br = 1 + 0.014 * Math.sin((2 * Math.PI * t) / 2.2);
  // sparkles, always drifting
  for (let i = 0; i < 10; i++) {
    const a = P(t, T.eFrom + 0.3, 0.4) * (0.35 + 0.35 * Math.sin(t * 2.2 + i * 1.7));
    const x = 120 + 840 * hash(i + 3) + 14 * Math.sin(t * 0.9 + i), y = 420 + 1050 * hash(i + 11) + 18 * Math.cos(t * 0.7 + i);
    g.save(); g.globalAlpha *= a; g.translate(x, y); g.rotate(t * 0.8 + i); g.fillStyle = i % 3 ? "#FFFFFF" : G;
    g.beginPath(); for (let k = 0; k < 8; k++) { const rr = k % 2 ? 4 : 14; const aa = (k / 8) * Math.PI * 2; g.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } g.closePath(); g.fill();
    g.restore();
  }
  const bl = slam(t, T.blinkitEnd, 0.6, 0.32);
  if (bl.on) {
    g.save(); g.globalAlpha *= bl.a; g.translate(540, 640); g.scale(bl.sx * br, bl.sy * br);
    txt(g, "blinkit", 0, 0, 250, INK, { w: 900, maxW: 900 });
    g.restore();
  }
  // "Last minute ka" types on, "pakka dost" lands in a green pill
  const line = "Last minute ka";
  const n = Math.min(line.length, Math.floor(Math.max(0, t - T.last) / 0.042) + (t >= T.last ? 1 : 0));
  if (n > 0) {
    g.save();
    g.font = `900 92px ${FONT}`;
    const full = g.measureText(line).width;
    txt(g, line.slice(0, n), 540 - full / 2, 880, 92, INK, { w: 900, align: "left" });
    g.restore();
  }
  const pk = slam(t, T.pakka, 1.5, 0.26);
  if (pk.on) {
    g.save(); g.globalAlpha *= pk.a; g.translate(540, 1015); g.rotate(-0.02); g.scale(pk.sx * br, pk.sy * br);
    g.font = `900 96px ${FONT}`;
    const w = g.measureText("pakka dost").width;
    g.save(); shadow(g, 24, 10, 0.18); rrect(g, -w / 2 - 44, -70, w + 88, 140, 70); g.fillStyle = G; g.fill(); g.restore();
    txt(g, "pakka dost", 0, 4, 96, "#FFFFFF", { w: 900 });
    g.restore();
  }
  const sub = P(t, T.pakka + 0.7, 0.4);
  if (sub > 0) {
    g.save(); g.globalAlpha *= sub; g.translate(0, 24 * (1 - outC(sub)));
    txt(g, "30,000+ products", 540, 1165, 50, INK, { w: 800 });
    txt(g, "delivered to your doorstep", 540, 1228, 46, "#3A3320", { w: 600 });
    g.restore();
  }
  // the bag stays, small, under the card
  drawBagWithPile(g, t, T, bagPose(t, T));
  // corner note
  txt(g, "Spec ad · concept", 1010, 1596, 32, "rgba(28,28,28,0.5)", { w: 600, align: "right", alpha: P(t, T.eFrom + 0.2, 0.4) });
}

export const AdWorld2D: React.FC<{ mode: AdMode }> = ({ mode }) => {
  const { f, fps, ground } = useScene();
  const T = useTimes();
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const g = ref.current?.getContext("2d");
    if (g) paint(g, f / fps, T);
  }, [f, fps, T]);
  return (
    <div data-mode={mode} style={{ position: "absolute", inset: 0, background: ground.bg }}>
      <canvas ref={ref} width={1080} height={1920} style={{ position: "absolute", inset: 0 }} />
    </div>
  );
};
