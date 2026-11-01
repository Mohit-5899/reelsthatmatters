// World 2: the flight display, drawn on a 2D canvas. A dark avionics-style screen with two panes: on top a route map drawn
// from real lat/lon (equirectangular, x scaled by cos 29 deg, no tiles, approximate hand-drawn coasts), below it an
// altitude trace (feet against time). Shared by route, dive, landing and after (see plan.md for every cue).
//   route -> dive    one continuous viewer path: the map pushes in toward the turn-back point, then the view slides down
//                    from the map to the trace.
//   landing -> after one continuous path: the map eases in on Tabuk and the text cards stack under it.
// On-screen numbers only as plan.md lists them (plus the 10,000 ft axis ticks plan.md asks for). No head count, no
// co-pilot name, no logo. Nothing violent is drawn: the alert is a red marker and a red lamp.
// Every value is a pure function of the frame. Durations are in seconds times fps, so a 30 fps draft keeps the timing.
import React, { useLayoutEffect, useMemo, useRef } from "react";
import { prog, typeOn, useReel, useScene } from "../../../src/engine";

export type FlightMode = "route" | "dive" | "landing" | "after";

// map points, degrees N / E
export const PLACES = {
  dubai: { lat: 25.25, lon: 55.36, label: "Dubai" },
  telAviv: { lat: 32.01, lon: 34.89, label: "Tel Aviv" },
  tabuk: { lat: 28.37, lon: 36.62, label: "Tabuk" },
  turnBack: { lat: 29.9, lon: 38.4, label: "" }, // about 130 nm NE of Tabuk (facts.md), Saudi airspace near Jordan
} as const;

const C = Math.cos((29 * Math.PI) / 180); // equirectangular: x = lon * cos(29 deg)
type LL = [number, number]; // [lat, lon]
type UV = [number, number]; // [lon * C, lat]
const uv = ([lat, lon]: LL): UV => [lon * C, lat];

// --- approximate geography, [lat, lon]: seas are drawn over a land-coloured pane ---
const RED_SEA: LL[] = [
  [29.95, 32.55], [29.2, 32.95], [28.4, 33.4], [27.75, 34.2], [28.4, 34.45], [29.5, 34.9], [29.53, 35.0], [28.8, 34.85],
  [28.05, 34.78], [27.6, 35.35], [27.35, 35.69], [26.24, 36.45], [25.2, 37.1], [24.09, 38.06], [22.5, 39.05],
  [21.2, 39.15], [19.0, 40.5], [19.0, 37.5], [22.0, 36.8], [24.0, 35.5], [25.5, 34.6], [26.7, 34.0], [27.2, 33.85],
  [27.9, 33.4], [28.7, 32.9], [29.6, 32.6],
];
const MED: LL[] = [
  [31.2, 29.9], [31.5, 31.0], [31.3, 32.3], [31.1, 33.0], [31.25, 34.2], [31.8, 34.6], [32.1, 34.77], [32.8, 34.98],
  [33.3, 35.2], [33.9, 35.48], [34.6, 35.8], [35.6, 35.8], [37.5, 35.8], [37.5, 28.0], [31.2, 28.0],
];
const GULF: LL[] = [
  [29.4, 48.0], [28.6, 48.4], [28.0, 48.7], [27.0, 49.6], [26.4, 50.1], [25.6, 50.2], [24.75, 50.8], [25.6, 50.8],
  [26.15, 51.25], [25.3, 51.6], [24.6, 51.45], [24.2, 52.0], [24.1, 53.5], [24.47, 54.37], [25.2, 55.25], [25.8, 55.95],
  [26.1, 56.1], [26.4, 56.3], [25.9, 56.4], [25.6, 56.35], [24.9, 56.4], [24.2, 57.0], [23.6, 58.6], [22.5, 59.8],
  [22.0, 62.0], [26.0, 62.0], [25.3, 60.5], [25.6, 58.0], [26.8, 57.0], [27.2, 56.3], [26.6, 54.5], [27.0, 53.0],
  [27.9, 51.5], [29.0, 50.6], [30.0, 49.5], [30.1, 48.6],
];
const DEAD_SEA: LL[] = [[31.75, 35.48], [31.75, 35.6], [31.2, 35.55], [31.1, 35.42]];
// approximate borders, dashed (plan.md: none need to be exact)
const BORDERS: LL[][] = [
  [[29.36, 34.96], [29.19, 36.07], [29.87, 36.5], [30.5, 37.67], [31.5, 39.2], [32.23, 39.3]], // Saudi Arabia / Jordan
  [[29.5, 34.9], [30.6, 34.5], [31.3, 34.25]], // Israel / Egypt
  [[29.55, 34.97], [30.5, 35.2], [31.3, 35.45], [32.6, 35.57]], // Israel / Jordan
  [[32.23, 39.3], [31.0, 42.0], [29.1, 44.7], [29.1, 46.5], [28.55, 48.4]], // Saudi Arabia / Iraq and Kuwait
  [[24.25, 51.6], [22.7, 55.1], [22.0, 55.6]], // Saudi Arabia / UAE
  [[22.0, 55.6], [24.0, 55.8], [24.9, 56.1], [25.6, 56.2]], // UAE / Oman
  [[32.23, 39.3], [33.4, 38.8]], // Jordan / Iraq
];

// --- the flight ---
const DXB = uv([PLACES.dubai.lat, PLACES.dubai.lon]);
const TLV = uv([PLACES.telAviv.lat, PLACES.telAviv.lon]);
const TUU = uv([PLACES.tabuk.lat, PLACES.tabuk.lon]);
const TB = uv([PLACES.turnBack.lat, PLACES.turnBack.lon]);

type Poly = { pts: UV[]; len: number[] }; // a polyline with its cumulative arc length
function quad(a: UV, c: UV, b: UV, n = 160): Poly {
  const pts: UV[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, s = 1 - t;
    pts.push([s * s * a[0] + 2 * s * t * c[0] + t * t * b[0], s * s * a[1] + 2 * s * t * c[1] + t * t * b[1]]);
  }
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, len };
}
function cut(p: Poly, from: number, to: number): Poly {
  const pts = p.pts.slice(from, to + 1);
  return { pts, len: p.len.slice(from, to + 1).map((l) => l - p.len[from]) };
}
/** the point a fraction q of the way along, and the heading there (radians, in u/lat space) */
function along(p: Poly, q: number): { at: UV; dir: number } {
  const L = p.len[p.len.length - 1] * Math.min(1, Math.max(0, q));
  let i = 1;
  while (i < p.len.length - 1 && p.len[i] < L) i++;
  const a = p.pts[i - 1], b = p.pts[i];
  const t = (L - p.len[i - 1]) / Math.max(1e-9, p.len[i] - p.len[i - 1]);
  return { at: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], dir: Math.atan2(b[1] - a[1], b[0] - a[0]) };
}
// the planned path Dubai -> Tel Aviv, a quadratic through the turn-back point at t = 0.5
const PLAN = quad(DXB, [2 * TB[0] - (DXB[0] + TLV[0]) / 2, 2 * TB[1] - (DXB[1] + TLV[1]) / 2], TLV);
const FLOWN = cut(PLAN, 0, 80); // Dubai -> the turn-back point
const AHEAD = cut(PLAN, 80, 160); // the turn-back point -> Tel Aviv, never flown
// the diversion: bends back from the turn-back point to Tabuk
const DIVERT = quad(TB, [TB[0] - 0.62, TB[1] - 0.32], TUU);

// --- the altitude trace, in display px: plot x 230..985, altitude 0 at y 1500, 40,000 ft at y 960 ---
const PX0 = 230, X_ATTACK = 640, X_BOTTOM = 700, X_LEVEL = 745, X_DESC = 900, X_LAND = 985;
const altY = (ft: number) => 1500 - (ft / 40000) * 540;
const ss = (t: number) => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };
function altAt(x: number): number {
  if (x < 310) return 34000 * (1 - (1 - Math.min(1, Math.max(0, (x - PX0) / 80))) ** 2); // the climb
  if (x < X_ATTACK) return 34000;
  if (x < X_BOTTOM) return 34000 - 16000 * ss((x - X_ATTACK) / (X_BOTTOM - X_ATTACK)); // the dive
  if (x < X_LEVEL) return 18000 - 1000 * ss((x - X_BOTTOM) / (X_LEVEL - X_BOTTOM));
  if (x < X_DESC) return 17000;
  return 17000 * (1 - ss((x - X_DESC) / (X_LAND - X_DESC))); // the descent to Tabuk
}

// --- colours ---
const INK = "#FFFFFF", DIM = "#8C96A3", LAND = "#1A2029", SEA = "#0B111A", COAST = "#323C49", BORDER = "#56616E";
const ACC = "#5BC8FF", ALARM = "#E5484D", OK = "#3DDC97", PANE = "#0E1116", EDGE = "#2A303A", CARD = "#181D25";
const FONT = "Inter, sans-serif";

// display layout: map pane and trace pane, in display px (the viewer camera pans and zooms over this)
const MAP = { x: 40, y: 0, w: 1000, h: 820 };
const TRACE = { x: 40, y: 860, w: 1000, h: 700 };

const sinIO = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));
/** a value that starts at v0 and glides (sine in-out) through each [start, dur, to] in turn */
function glides(f: number, v0: number, steps: [number, number, number][]) {
  let v = v0;
  for (const [s, d, to] of steps) v += (to - v) * sinIO((f - s) / Math.max(1, d));
  return v;
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function mixHex(a: string, b: string, t: number) {
  const p = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
  const c = [0, 1, 2].map((i) => Math.round(lerp(p(a, i), p(b, i), Math.min(1, Math.max(0, t)))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

type Times = Record<string, number>;

function useTimes(): Times {
  const { tl } = useReel();
  const { fps } = useScene();
  return useMemo(() => {
    const idx = (id: string) => tl.scenes.findIndex((s) => s.id === id);
    const r = idx("route"), d = idx("dive"), l = idx("landing"), a = idx("after");
    const c = (w: string, sc: number, n = 1) => tl.cue(w, n, sc);
    return {
      fps,
      routeFrom: tl.scenes[r].from, diveFrom: tl.scenes[d].from, landFrom: tl.scenes[l].from, afterFrom: tl.scenes[a].from,
      thirtieth: c("thirtieth", r), seventy: c("seventy-three", r), dubai: c("Dubai", r), aviv: c("Aviv", r),
      hours: c("hours", r), jordan: c("Jordan", r), attacked: c("attacked", r), cockpit: c("cockpit", r),
      the: c("The", d), dived: c("dived", d), thousand: c("thousand", d), under: c("under", d),
      pilots: c("pilots", l), controls: c("controls", l), about: c("About", l), hour: c("hour", l), tabuk: c("Tabuk", l),
      fd2: c("flydubai", l, 2),
      aThe: c("The", a), aTabuk: c("Tabuk", a), embassy: c("Embassy", a), well: c("well", a), indias: c("India's", a),
      hero: c("hero", a),
    };
  }, [tl, fps]);
}

// ---------- drawing helpers ----------
function rrect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, o: { w?: number; align?: CanvasTextAlign; spacing?: number; alpha?: number } = {}) {
  g.save();
  g.globalAlpha *= o.alpha ?? 1;
  g.font = `${o.w ?? 600} ${size}px ${FONT}`;
  g.textAlign = o.align ?? "left";
  g.textBaseline = "middle";
  g.fillStyle = color;
  if (o.spacing) (g as unknown as { letterSpacing: string }).letterSpacing = `${o.spacing}px`;
  g.fillText(s, x, y);
  g.restore();
}
/** a two-line text card; each line types on from its own frame */
function card(g: CanvasRenderingContext2D, f: number, fps: number, x: number, y: number, w: number, lines: { s: string; at: number; w?: number; color?: string }[], alpha: number, accent = ACC) {
  if (alpha <= 0.001) return;
  const LH = 60, h = lines.length * LH + 44;
  g.save();
  g.globalAlpha = alpha;
  rrect(g, x, y, w, h, 22);
  g.fillStyle = CARD;
  g.fill();
  g.strokeStyle = EDGE;
  g.lineWidth = 2;
  g.stroke();
  g.fillStyle = accent;
  rrect(g, x, y + 20, 7, h - 40, 3.5);
  g.fill();
  lines.forEach((l, i) => {
    const t = typeOn(l.s, f, l.at, fps, 30);
    if (t.text) text(g, t.text, x + 40, y + 22 + LH * i + LH / 2, 46, l.color ?? INK, { w: l.w ?? 600 });
  });
  g.restore();
}
function marker(g: CanvasRenderingContext2D, x: number, y: number, ang: number, color: string) {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.scale(1.6, 1.6);
  g.beginPath();
  g.moveTo(24, 0);
  g.lineTo(-14, -16);
  g.lineTo(-5, 0);
  g.lineTo(-14, 16);
  g.closePath();
  g.fillStyle = color;
  g.strokeStyle = "#0B0E12";
  g.lineWidth = 3;
  g.lineJoin = "round";
  g.fill();
  g.stroke();
  g.restore();
}
/** the cockpit door from world 1, as a small icon: a grey slab, three bolts, a lamp */
function doorIcon(g: CanvasRenderingContext2D, x: number, y: number, lamp: string, alpha: number) {
  if (alpha <= 0.001) return;
  g.save();
  g.globalAlpha = alpha;
  g.translate(x, y);
  g.scale(1.5, 1.5);
  g.translate(-x, -y);
  rrect(g, x - 34, y - 46, 68, 92, 12);
  g.fillStyle = CARD;
  g.fill();
  g.strokeStyle = EDGE;
  g.lineWidth = 2;
  g.stroke();
  rrect(g, x - 18, y - 32, 36, 64, 4);
  g.fillStyle = "#C9CCD2";
  g.fill();
  g.fillStyle = "#5A616B";
  for (let i = 0; i < 3; i++) g.fillRect(x + 9, y - 18 + i * 16, 9, 4);
  g.beginPath();
  g.arc(x + 25, y - 36, 8, 0, Math.PI * 2);
  g.fillStyle = lamp;
  g.shadowColor = lamp;
  g.shadowBlur = 18;
  g.fill();
  g.restore();
}
function clockChip(g: CanvasRenderingContext2D, x: number, y: number, label: string, turns: number, alpha: number) {
  if (alpha <= 0.001) return;
  g.save();
  g.globalAlpha = alpha;
  rrect(g, x, y, 220, 88, 44);
  g.fillStyle = CARD;
  g.fill();
  g.strokeStyle = EDGE;
  g.lineWidth = 2;
  g.stroke();
  const cx = x + 46, cy = y + 44;
  g.beginPath();
  g.arc(cx, cy, 23, 0, Math.PI * 2);
  g.strokeStyle = INK;
  g.lineWidth = 3.5;
  g.stroke();
  g.lineCap = "round";
  const hand = (a: number, r: number, w: number) => {
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.sin(a) * r, cy - Math.cos(a) * r);
    g.lineWidth = w;
    g.stroke();
  };
  hand(turns * Math.PI * 2, 17, 3);
  hand((turns / 12) * Math.PI * 2 + Math.PI / 3, 11, 4);
  text(g, label, x + 86, cy + 1, 48, INK, { w: 700 });
  g.restore();
}

// ---------- the frame ----------
function paint(g: CanvasRenderingContext2D, f: number, mode: FlightMode, T: Times, bg: string) {
  const fps = T.fps;
  const S = (s: number) => Math.round(s * fps);
  const first = mode === "route" || mode === "dive";
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, 1080, 1920);
  g.fillStyle = bg;
  g.fillRect(0, 0, 1080, 1920);

  // ---- the viewer camera over the display: keys on word cues, plus a slow circular drift so it never stops ----
  const slide0 = T.diveFrom - S(0.35); // route -> dive: from the map down to the trace
  let cy: number, Z: number;
  if (first) {
    const sl = sinIO((f - slide0) / S(1.35));
    cy = lerp(470, 1175, sl);
    Z = lerp(1.0, 1.15, sl) + 0.025 * sinIO((f - T.hours) / S(4));
  } else {
    const e = sinIO((f - T.aThe) / S(1.3));
    cy = lerp(730, 600, e);
    Z = lerp(0.97, 1.1, e);
  }
  const w = (2 * Math.PI) / S(7);
  const cx = 540 + 16 * Math.cos(w * f);
  cy += 16 * Math.sin(w * f);
  g.setTransform(Z, 0, 0, Z, 540 - cx * Z, 960 - cy * Z);

  // ---- the map camera (its own range, like a nav display) ----
  let K: number, lon0: number, lat0: number;
  if (first) {
    const push = (to: number, v0: number) => glides(f, v0, [[T.hours, T.cockpit + S(0.5) - T.hours, to]]);
    K = push(130, 47);
    lon0 = push(38.25, 45.1);
    lat0 = push(29.8, 28.6);
  } else {
    const st: [number, number][] = [[T.hour, T.tabuk + S(0.6) - T.hour], [T.aThe, S(1.3)]];
    K = glides(f, 260, [[st[0][0], st[0][1], 290], [st[1][0], st[1][1], 320]]);
    lon0 = glides(f, 37.5, [[st[0][0], st[0][1], 37.1], [st[1][0], st[1][1], 37.37]]);
    lat0 = glides(f, 29.45, [[st[0][0], st[0][1], 29.2], [st[1][0], st[1][1], 27.71]]);
  }
  const mcx = MAP.x + MAP.w / 2, mcy = MAP.y + MAP.h / 2;
  const P = (p: UV): [number, number] => [mcx + (p[0] - lon0 * C) * K, mcy - (p[1] - lat0) * K];
  const PL = (p: LL) => P(uv(p));

  // ---- header (route only): date, then flight ----
  if (first) {
    const d = typeOn("30 Sep 2026", f, T.thirtieth, fps, 40);
    text(g, d.text, 540, -150, 66, INK, { w: 700, align: "center" });
    const fl = typeOn("FZ1073 · Dubai → Tel Aviv", f, T.seventy, fps, 30);
    text(g, fl.text, 540, -68, 48, "#C7CED6", { w: 500, align: "center" });
  }

  // ---- the map pane ----
  g.save();
  rrect(g, MAP.x, MAP.y, MAP.w, MAP.h, 30);
  g.fillStyle = LAND;
  g.fill();
  g.clip();
  // graticule every degree
  g.strokeStyle = "rgba(255,255,255,0.045)";
  g.lineWidth = 1.5;
  for (let lat = 18; lat <= 36; lat++) {
    const y = PL([lat, 40])[1];
    g.beginPath(); g.moveTo(MAP.x, y); g.lineTo(MAP.x + MAP.w, y); g.stroke();
  }
  for (let lon = 28; lon <= 62; lon++) {
    const x = PL([30, lon])[0];
    g.beginPath(); g.moveTo(x, MAP.y); g.lineTo(x, MAP.y + MAP.h); g.stroke();
  }
  for (const sea of [RED_SEA, MED, GULF, DEAD_SEA]) {
    g.beginPath();
    sea.forEach((p, i) => { const [x, y] = PL(p); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    g.closePath();
    g.fillStyle = SEA;
    g.fill();
    g.strokeStyle = COAST;
    g.lineWidth = 2.5;
    g.stroke();
  }
  g.setLineDash([10, 9]);
  g.strokeStyle = BORDER;
  g.lineWidth = 2.5;
  for (const b of BORDERS) {
    g.beginPath();
    b.forEach((p, i) => { const [x, y] = PL(p); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    g.stroke();
  }
  g.setLineDash([]);

  // country names (anchors differ by range so each sits inside its country and clear of the path)
  const bright = first ? prog(f, T.jordan, S(0.5)) : 0;
  const cl = (name: string, p: LL, a: number, lit = 0) => {
    const [x, y] = PL(p);
    text(g, name, x, y, 34, mixHex("#6E7A88", "#DCE3EA", lit), { w: 700, align: "center", spacing: 4, alpha: a });
  };
  if (first) {
    cl("UAE", [23.0, 54.0], 1);
    cl("SAUDI ARABIA", [27.3, 40.9], 1, bright);
    cl("JORDAN", [31.65, 38.3], 1, bright);
    cl("ISRAEL", [30.4, 34.8], 1);
  } else {
    const fade = 1 - prog(f, T.aThe, S(0.8));
    cl("SAUDI ARABIA", [28.95, 38.35], fade);
    cl("JORDAN", [30.3, 36.05], fade);
  }

  // the planned path (dashed) Dubai -> Tel Aviv, drawn on "Dubai" and reaching Tel Aviv on "Aviv"
  const drawPoly = (p: Poly, q: number) => {
    const L = p.len[p.len.length - 1] * q;
    g.beginPath();
    for (let i = 0; i < p.pts.length; i++) {
      const [x, y] = P(p.pts[i]);
      if (i === 0) g.moveTo(x, y);
      else if (p.len[i] <= L) g.lineTo(x, y);
      else {
        const { at } = along(p, q);
        const [ex, ey] = P(at);
        g.lineTo(ex, ey);
        break;
      }
    }
    g.stroke();
  };
  const planQ = first ? sinIO((f - T.dubai) / Math.max(S(0.5), T.aviv - T.dubai)) : 1;
  const aheadDim = first ? 1 : 1 - 0.65 * prog(f, T.controls, S(0.6));
  g.setLineDash([16, 12]);
  g.lineCap = "round";
  g.lineWidth = 5;
  g.strokeStyle = ACC;
  g.globalAlpha = 0.75 * aheadDim;
  if (first) drawPoly(PLAN, planQ);
  else drawPoly(AHEAD, 1); // the part never flown, dimming after the turn
  g.globalAlpha = 1;
  g.setLineDash([]);

  // where the jet is
  const flyQ = first ? sinIO((f - T.hours) / (T.jordan - T.hours)) : 1;
  const divQ = first ? 0 : sinIO((f - T.hour) / (T.tabuk - T.hour));
  // flown trail: solid white
  g.lineWidth = 6;
  g.strokeStyle = INK;
  if (f >= T.hours || !first) drawPoly(FLOWN, flyQ);
  if (!first && divQ > 0) {
    g.strokeStyle = INK;
    drawPoly(DIVERT, divQ);
  }

  // cities
  const city = (p: UV, lit: number, label: string, lx: number, ly: number, align: CanvasTextAlign, a = 1) => {
    const [x, y] = P(p);
    g.save();
    g.globalAlpha = a;
    if (lit > 0) {
      g.beginPath();
      g.arc(x, y, 14 + 10 * lit, 0, Math.PI * 2);
      g.fillStyle = `rgba(91,200,255,${(0.22 * lit).toFixed(3)})`;
      g.fill();
    }
    g.beginPath();
    g.arc(x, y, 10, 0, Math.PI * 2);
    g.fillStyle = mixHex("#4A5462", "#FFFFFF", lit);
    g.fill();
    g.restore();
    if (label && lit > 0) text(g, label, x + lx, y + ly, 46, INK, { w: 700, align, alpha: a * lit });
  };
  if (first) {
    city(DXB, prog(f, T.dubai, S(0.4)), "Dubai", 0, -44, "center");
    city(TLV, prog(f, T.aviv, S(0.4)), "Tel Aviv", -12, -46, "left");
  } else {
    city(TUU, prog(f, T.tabuk, S(0.4)), "Tabuk", 34, 50, "left", 1);
  }

  // the marker
  let mPos: UV, mAng: number, mCol: string, ringA: number;
  if (first) {
    const a = along(FLOWN, flyQ);
    mPos = a.at;
    mAng = -a.dir;
    mCol = mixHex(INK, ALARM, prog(f, T.attacked, S(0.3)));
    ringA = prog(f, T.attacked, S(0.3));
  } else {
    const a0 = along(FLOWN, 1), a1 = along(DIVERT, 0);
    const turn = sinIO((f - T.controls) / S(0.7));
    if (divQ <= 0) {
      mPos = a0.at;
      let dd = a1.dir - a0.dir;
      dd = Math.atan2(Math.sin(dd), Math.cos(dd)); // the short way round
      mAng = -(a0.dir + dd * turn);
    } else {
      const a = along(DIVERT, divQ);
      mPos = a.at;
      mAng = -a.dir;
    }
    mCol = mixHex(ALARM, INK, prog(f, T.controls, S(0.5)));
    ringA = 1 - prog(f, T.controls, S(0.5));
  }
  const [mx, my] = P(mPos);
  const markerA = first ? prog(f, T.dubai, S(0.4)) : 1;
  if (ringA > 0) {
    const ph = (((f - T.attacked) % S(1)) + S(1)) % S(1) / S(1);
    g.beginPath();
    g.arc(mx, my, 44 + 60 * ph, 0, Math.PI * 2);
    g.strokeStyle = `rgba(229,72,77,${(0.85 * (1 - ph) * ringA).toFixed(3)})`;
    g.lineWidth = 5;
    g.stroke();
    g.beginPath();
    g.arc(mx, my, 44, 0, Math.PI * 2);
    g.strokeStyle = `rgba(229,72,77,${(0.9 * ringA).toFixed(3)})`;
    g.lineWidth = 4;
    g.stroke();
  }
  if (markerA > 0) {
    g.save();
    g.globalAlpha = markerA;
    marker(g, mx, my, mAng, mCol);
    g.restore();
  }
  // the locked door, beside the marker, from "cockpit"
  if (first) {
    const da = prog(f, T.cockpit, S(0.45));
    doorIcon(g, mx + 120, my - 100 + 14 * (1 - da), ALARM, da);
  }
  g.restore(); // end of map clip
  rrect(g, MAP.x, MAP.y, MAP.w, MAP.h, 30);
  g.strokeStyle = EDGE;
  g.lineWidth = 3;
  g.stroke();

  // clock chips
  if (first) {
    const ca = prog(f, T.hours, S(0.4));
    clockChip(g, MAP.x + MAP.w - 250, MAP.y + 30, "2 h+", 2.25 * flyQ, ca);
  } else {
    const ca = prog(f, T.hour, S(0.4)) * (1 - prog(f, T.aThe, S(0.6)));
    clockChip(g, MAP.x + MAP.w - 250, MAP.y + MAP.h - 118, "~1 h", 1 * divQ, ca);
  }

  // ---- the trace pane ----
  rrect(g, TRACE.x, TRACE.y, TRACE.w, TRACE.h, 30);
  g.fillStyle = PANE;
  g.fill();
  g.strokeStyle = EDGE;
  g.lineWidth = 3;
  g.stroke();
  text(g, "ALTITUDE (ft)", TRACE.x + 36, TRACE.y + 40, 34, DIM, { w: 700, spacing: 3 });
  g.lineWidth = 2;
  for (const ft of [10000, 20000, 30000]) {
    const y = altY(ft);
    g.strokeStyle = "rgba(255,255,255,0.08)";
    g.beginPath(); g.moveTo(PX0, y); g.lineTo(X_LAND + 20, y); g.stroke();
    text(g, ft.toLocaleString("en-US"), PX0 - 18, y, 32, DIM, { w: 500, align: "right" });
  }
  g.strokeStyle = "rgba(255,255,255,0.35)";
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(PX0, altY(0)); g.lineTo(X_LAND + 20, altY(0)); g.stroke();

  // how far the trace has drawn
  let xp: number;
  if (first) {
    xp = PX0 + (X_ATTACK - PX0) * flyQ;
    xp += (X_BOTTOM - X_ATTACK) * prog(f, T.dived, S(0.75), (t) => t * t * (3 - 2 * t));
    xp += (X_LEVEL - X_BOTTOM) * sinIO((f - T.dived - S(0.75)) / S(0.7));
  } else {
    xp = X_LEVEL + (X_LAND - X_LEVEL) * divQ;
  }
  const seg = (x0: number, x1: number, color: string) => {
    if (xp <= x0) return;
    const end = Math.min(xp, x1);
    g.beginPath();
    for (let x = x0; x <= end; x += 1) { const y = altY(altAt(x)); if (x === x0) g.moveTo(x, y); else g.lineTo(x, y); }
    g.lineTo(end, altY(altAt(end)));
    g.strokeStyle = color;
    g.lineWidth = 7;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.stroke();
  };
  if (f >= T.hours || !first) {
    seg(PX0, X_ATTACK, ACC);
    seg(X_ATTACK, X_BOTTOM, ALARM);
    seg(X_BOTTOM, X_LAND, ACC);
    // the pen: a dot at the head of the trace
    const hy = altY(altAt(xp));
    g.beginPath();
    g.arc(xp, hy, 9, 0, Math.PI * 2);
    g.fillStyle = INK;
    g.fill();
  }

  // brackets on the drop
  if (first) {
    const ba = prog(f, T.thousand, S(0.45));
    if (ba > 0) {
      g.save();
      g.globalAlpha = ba;
      const bx = X_ATTACK - 26, y0 = altY(34000), y1 = altY(18000);
      g.strokeStyle = INK;
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(bx + 14, y0); g.lineTo(bx, y0); g.lineTo(bx, y0 + (y1 - y0) * ss(ba * 1.2));
      if (ba > 0.8) { g.lineTo(bx, y1); g.lineTo(bx + 14, y1); }
      g.stroke();
      const ty = (y0 + y1) / 2;
      g.font = `800 52px ${FONT}`;
      const tw = g.measureText(">15,000 ft").width;
      rrect(g, bx - 26 - tw - 22, ty - 40, tw + 44, 80, 16);
      g.fillStyle = PANE;
      g.fill();
      text(g, ">15,000 ft", bx - 26, ty, 52, INK, { w: 800, align: "right" });
      g.restore();
    }
    const ha = prog(f, T.under, S(0.45));
    if (ha > 0) {
      g.save();
      g.globalAlpha = ha;
      const y = altY(18000) + 70, x0 = X_ATTACK, x1 = X_BOTTOM;
      g.strokeStyle = INK;
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(x0, y - 14); g.lineTo(x0, y); g.lineTo(x1, y); g.lineTo(x1, y - 14);
      g.stroke();
      g.font = `800 52px ${FONT}`;
      const tw = g.measureText("<2 min").width;
      const tx = (x0 + x1) / 2;
      rrect(g, tx - tw / 2 - 22, y + 14, tw + 44, 76, 16);
      g.fillStyle = PANE;
      g.fill();
      text(g, "<2 min", tx, y + 52, 52, INK, { w: 800, align: "center" });
      g.restore();
    }
  }

  // ---- cards ----
  if (!first) {
    // landing: one card at a time at the top of the map pane
    const c1 = prog(f, T.pilots, S(0.4)) * (1 - prog(f, T.about - S(0.45), S(0.4)));
    card(g, f, fps, 80, 34, 920, [
      { s: "2 flydubai pilots,", at: T.pilots, w: 700 },
      { s: "on board for the return flight", at: T.pilots + S(0.35), color: "#C7CED6", w: 500 },
    ], c1, OK);
    const c2 = prog(f, T.fd2, S(0.4)) * (1 - prog(f, T.aThe, S(0.5)));
    card(g, f, fps, 80, 34, 920, [
      { s: "flydubai:", at: T.fd2, w: 700 },
      { s: "every passenger safe", at: T.fd2 + S(0.25), color: "#C7CED6", w: 500 },
    ], c2, OK);
    // after: three cards stack under Tabuk
    const rise = (at: number) => 18 * (1 - sinIO((f - at) / S(0.5)));
    const ca = prog(f, T.aTabuk, S(0.45));
    card(g, f, fps, 100, 300 + rise(T.aTabuk), 880, [
      { s: "Capt. Smit Machchhar", at: T.aTabuk, w: 700 },
      { s: "treated in Tabuk", at: T.aTabuk + S(0.4), color: "#C7CED6", w: 500 },
    ], ca);
    const cb = prog(f, T.embassy, S(0.45));
    card(g, f, fps, 100, 480 + rise(T.embassy), 880, [
      { s: "Indian Embassy:", at: T.embassy, w: 700 },
      { s: "recovering well", at: T.well, color: "#C7CED6", w: 500 },
    ], cb);
    const cc = prog(f, T.indias, S(0.45));
    card(g, f, fps, 100, 660 + rise(T.indias), 880, [
      { s: "India's Prime Minister:", at: T.indias, w: 700 },
      { s: "a hero", at: T.hero, color: "#C7CED6", w: 500 },
    ], cc);
  }
}

export const FlightDisplay2D: React.FC<{ mode: FlightMode }> = ({ mode }) => {
  const { f, ground } = useScene();
  const T = useTimes();
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const g = ref.current?.getContext("2d");
    if (g) paint(g, f, mode, T, ground.bg);
  }, [f, mode, T, ground.bg]);
  return (
    <div style={{ position: "absolute", inset: 0, background: ground.bg }}>
      <canvas ref={ref} width={1080} height={1920} style={{ position: "absolute", inset: 0 }} />
    </div>
  );
};
