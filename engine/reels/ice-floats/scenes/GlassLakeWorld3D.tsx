// World 1: a glass of water with an ice cube, and, 0.8 m behind it, a cut-out slab of pond (1.4 m wide, 0.5 m of water).
// Shared by hook, lake and payoff. Hook and lake draw ONE continuous camera path from the reel's frame, so the handover
// between them is a single move; payoff comes back to the same set after the molecule world.
// Real sizes in metres: glass 0.07 m wide and 0.11 m tall, water 0.08 m deep, ice cube 0.025 m (density 917 kg/m3, so it
// rides 91.7 % under). All times are word cues, in 60 fps frames (a 30 fps draft is scaled by 60/fps so it plays the same).
//   hook   "Cold" the cube is held in tongs above the water; "sinks" they let go and it drops in and dives under;
//          "frozen" it stops going down; "float" it bobs back up (damped); "top" it rides at the surface.
//   lake   "Watch" the camera leaves the glass for the pond; "cools" the surface tints colder; "heavier" cold parcels
//          darken and a down arrow shows; "sinks" they sink and 4 C water fills the lake from the bottom; "four" the
//          whole lake is 4 C; "flips" the arrow turns up; "lighter" the top cools below 4 C and stays up; "coldest" it
//          reaches 0 C; "where" an ice sheet grows in from the banks, labelled on "ice".
//   payoff "Same" the cube is held at the bottom of the glass; "lighter" the tongs let go and it rises, settling on
//          "rises"; the camera pulls back to the pond, whose ice lid is now thicker: "lid" outlined, "below" the liquid
//          water underneath is labelled, "ponds" a fish swims under the ice; "cage" a small ice-cage inset.
import React, { useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { useCurrentFrame } from "remotion";
import { type Cam, type V3, ease, orbit, prog, project, spline, useReel } from "../../../src/engine";
import { Floor, Studio, World3D } from "../../../src/engine/three";

export type GlassLakeMode = "hook" | "lake" | "payoff";

// ---------- sizes (metres) ----------
const GLASS_H = 0.11;
const BASE = 0.008; // thick glass bottom
const R_IN0 = 0.0278; // inner radius at the bottom
const R_IN1 = 0.0325; // inner radius at the rim
const R_OUT0 = 0.0305;
const R_OUT1 = 0.035;
const WATER = 0.08; // water level with no ice in it
const S = 0.025; // ice cube edge
const RHO = 0.917; // ice / water density
const rIn = (y: number) => R_IN0 + ((R_IN1 - R_IN0) * (y - BASE)) / (GLASS_H - BASE);
const AREA = Math.PI * rIn(WATER) ** 2;
const LEVEL_EQ = WATER + (RHO * S ** 3) / AREA; // water level with the cube floating
const Y_EQ = LEVEL_EQ + S / 2 - RHO * S; // cube centre when floating

// the pond slab
const PX = 1.4; // width
const PD = 0.3; // depth of the cut (front to back)
const MUD = 0.05;
const PW = 0.5; // water depth
const PZ = -0.8; // centre of the slab
const FRONT = PZ + PD / 2;
const TOPW = MUD + PW; // water surface height

// ---------- times ----------
type T = Record<string, number>;
function useTimes(): { t: T; k: number } {
  const { tl } = useReel();
  return useMemo(() => {
    const k = 60 / tl.fps;
    const si = (id: string) => tl.scenes.findIndex((s) => s.id === id);
    const h = si("hook"), l = si("lake"), p = si("payoff");
    const c = (w: string, sc: number, n = 1) => tl.cue(w, n, sc) * k;
    const t: T = {
      cold: c("cold", h), sinks: c("sinks", h), frozen: c("frozen", h), float: c("float", h), top: c("top", h),
      hookEnd: tl.scenes[h].to * k,
      watch: c("watch", l), lake: c("lake", l), surface: c("surface", l), cools: c("cools", l), heavier: c("heavier", l),
      lsinks: c("sinks", l), four: c("four", l), flips: c("flips", l), lighter: c("lighter", l), coldest: c("coldest", l),
      ice: c("ice", l), where: c("where", l), lakeEnd: tl.scenes[l].to * k,
      pStart: tl.scenes[p].from * k, same: c("same", p), plighter: c("lighter", p), rises: c("rises", p), lid: c("lid", p),
      below: c("below", p), ponds: c("ponds", p), solid: c("solid", p), cage: c("cage", p), end: tl.frames * k,
    };
    return { t, k };
  }, [tl]);
}

// ---------- the cube ----------
/** a damped spring released from rest at y0 toward y1: zeta < 1 overshoots once a little, then settles */
function damped(u: number, y0: number, y1: number, peakFrames: number, zeta: number) {
  if (u <= 0) return y0;
  const wd = Math.PI / peakFrames;
  const w = wd / Math.sqrt(1 - zeta * zeta);
  const e = Math.exp(-zeta * w * u);
  return y1 + (y0 - y1) * e * (Math.cos(wd * u) + ((zeta * w) / wd) * Math.sin(wd * u));
}

const HOLD_GAP = 0.012; // cube bottom above the water when held
const Y_HOLD = WATER + HOLD_GAP + S / 2;
const Y_TOUCH = WATER + S / 2;
const Y_MIN = LEVEL_EQ - S / 2 - 0.007; // deepest point of the dive: top 7 mm under the surface
const Y_BOTTOM = BASE + S / 2 + 0.0005; // resting on the glass bottom

/** hook (and on through the lake): drop under gravity, dive and slow down, then bob up and settle */
function cubeHook(F: number, t: T) {
  if (F <= t.sinks) return Y_HOLD;
  const T0 = t.frozen - t.sinks;
  const h0 = HOLD_GAP, d = Y_TOUCH - Y_MIN;
  const Da = (T0 * h0) / (h0 + d), Db = T0 - Da;
  const v = (2 * h0) / Da;
  const u = F - t.sinks;
  if (u <= Da) return Y_HOLD - h0 * (u / Da) ** 2;
  if (u <= T0) { const s = u - Da; return Y_TOUCH - v * s + (v / (2 * Db)) * s * s; }
  return damped(u - T0, Y_MIN, Y_EQ, t.top - t.frozen + 8, 0.5);
}

/** payoff: held at the bottom, released on "lighter", rises and settles by "rises" */
function cubePayoff(F: number, t: T) {
  return damped(F - t.plighter - 4, Y_BOTTOM, Y_EQ, Math.max(60, t.rises - t.plighter), 0.55);
}

/** water level from how much of the cube is under */
const levelOf = (yc: number) => {
  const sub = Math.min(S, Math.max(0, WATER - (yc - S / 2)));
  return WATER + (sub * S * S) / AREA;
};

// ---------- camera ----------
const GLASS_AT: V3 = [0, 0.062, 0];
const SLAB_AT: V3 = [0, 0.29, PZ];
const mixV = (a: V3, b: V3, p: number): V3 => [a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p, a[2] + (b[2] - a[2]) * p];

function cameraWorld(mode: GlassLakeMode, F: number, t: T): Cam {
  if (mode !== "payoff") {
    // glass -> pond as one move from "Watch" to "cools", with a slow drift everywhere else
    const p = prog(F, t.watch - 6, t.cools - t.watch + 6, ease.inOut);
    const at = mixV(GLASS_AT, SLAB_AT, p);
    const logd = spline(F, [[0, Math.log(0.25)], [t.top, Math.log(0.27)], [t.watch, Math.log(0.28)], [t.cools, Math.log(2.08)], [t.four, Math.log(2.22)], [t.flips, Math.log(2.18)], [t.ice, Math.log(2.32)], [t.lakeEnd + 120, Math.log(2.38)]]);
    const yaw = spline(F, [[0, 0.46], [t.top, 0.4], [t.watch, 0.37], [t.cools, 0.3], [t.four, 0.08], [t.coldest, -0.2], [t.ice, -0.3], [t.lakeEnd + 120, -0.36]]);
    const pitch = spline(F, [[0, 0.34], [t.watch, 0.32], [t.cools, 0.1], [t.four, 0.15], [t.lighter, 0.1], [t.coldest, 0.14], [t.ice, 0.1], [t.lakeEnd + 120, 0.09]]);
    return { eye: orbit(at, yaw, pitch, Math.exp(logd)), at, focal: 1500, cx: 540, cy: 960 };
  }
  // payoff: close on the glass while the cube rises, then back to show the glass and the pond's lid together
  const go = t.rises - 10;
  const arriveAt = t.below;
  const p = prog(F, go, arriveAt - go, ease.inOut);
  const at = mixV(GLASS_AT, SLAB_AT, p);
  const logd = spline(F, [[t.pStart, Math.log(0.25)], [go, Math.log(0.28)], [arriveAt, Math.log(2.1)], [t.end, Math.log(2.3)]]);
  const yaw = spline(F, [[t.pStart, 0.5], [go, 0.4], [arriveAt, 0.2], [t.end, -0.04]]);
  const pitch = spline(F, [[t.pStart, 0.34], [go, 0.32], [arriveAt, 0.1], [t.cage, 0.13], [t.end, 0.12]]);
  return { eye: orbit(at, yaw, pitch, Math.exp(logd)), at, focal: 1500, cx: 540, cy: 960 };
}

// ---------- the pond's temperature map ----------
const STOPS: [number, [number, number, number]][] = [
  [0, [118, 192, 238]], [1.5, [88, 164, 228]], [3, [48, 112, 200]], [4, [26, 76, 170]], [6, [24, 110, 140]],
  [9, [70, 130, 110]], [11.5, [180, 140, 70]], [14, [214, 112, 52]],
];
function tempColor(T: number): [number, number, number] {
  if (T <= STOPS[0][0]) return STOPS[0][1];
  for (let i = 1; i < STOPS.length; i++) {
    if (T <= STOPS[i][0]) {
      const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i];
      const q = (T - a) / (b - a);
      return [ca[0] + (cb[0] - ca[0]) * q, ca[1] + (cb[1] - ca[1]) * q, ca[2] + (cb[2] - ca[2]) * q];
    }
  }
  return STOPS[STOPS.length - 1][1];
}
const sm = (a: number, b: number, x: number) => { const q = Math.min(1, Math.max(0, (x - a) / (b - a))); return q * q * (3 - 2 * q); };

const BLOBS = [0.18, 0.42, 0.3, 0.6, 0.12, 0.5];
const BLOB_FALL = 80;
/** the parcels of cold surface water that sink in autumn: [x, y, strength] in the slab's 0..1 coordinates */
function blobs(F: number, t: T) {
  const out: [number, number, number][] = [];
  const span = t.four - t.lsinks - BLOB_FALL;
  BLOBS.forEach((x, i) => {
    const s = t.lsinks + (i * Math.max(30, span)) / (BLOBS.length - 1);
    const born = i < 3 ? t.heavier : s - 40;
    const a = prog(F, born, 30, ease.out);
    if (a <= 0) return;
    const front = fillFront(s + BLOB_FALL, t);
    const fall = prog(F, s, BLOB_FALL, ease.inOut);
    const y = 0.9 + (Math.max(0.05, front - 0.04) - 0.9) * fall;
    const gone = 1 - prog(F, s + BLOB_FALL - 10, 24, ease.inOut);
    out.push([x, y, a * gone]);
  });
  return out;
}
const fillFront = (F: number, t: T) => prog(F, t.lsinks + 30, t.four - t.lsinks - 30, ease.inOut);

/** temperature (C) at (x, y) of the slab, 0..1 each, y up */
function tempAt(x: number, y: number, F: number, t: T, mode: GlassLakeMode, bl: [number, number, number][]) {
  const wob = 0.012 * Math.sin(x * 9 + F * 0.035) + 0.006 * Math.sin(x * 23 - F * 0.05);
  if (mode === "hook") return -1;
  if (mode === "payoff") {
    // winter: 0 C under the lid grading down to 4 C water at the bottom
    return 4 - 4 * sm(0.5, 0.86, y + wob);
  }
  const cool = prog(F, t.cools, 45, ease.inOut);
  let T = 8 + 6 * y - cool * 8 * sm(0.8, 0.93, y + wob);
  const front = fillFront(F, t);
  // above the front the lake keeps cooling toward 4 C; below it is all 4 C
  T = T + (Math.min(T, 5) - T) * front;
  if (front > 0) T = T + (4 - T) * (1 - sm(front - 0.03, front + 0.03, y + wob));
  // "heavier": the surface parcels darken
  for (const [bx, by, a] of bl) {
    const d = Math.hypot((x - bx) * 2.8, y - by);
    const g = a * (1 - sm(0.05, 0.11, d));
    T = T + (4 - T) * g;
  }
  // after "lighter" the top cools below 4 C and stays up; on "coldest" it reaches 0 C
  const lt = prog(F, t.lighter, 50, ease.inOut);
  const cd = prog(F, t.coldest, 50, ease.inOut);
  T = T - lt * 1.6 * sm(0.78, 0.95, y + wob) - cd * 2.4 * sm(0.74, 0.97, y + wob);
  return T;
}

const TW = 224, TH = 80;
function usePondTexture(F: number, t: T, mode: GlassLakeMode) {
  const key = mode === "hook" ? -1 : mode === "payoff" ? Math.round(F / 2) : Math.round(F);
  return useMemo(() => {
    const cv = document.createElement("canvas");
    cv.width = TW; cv.height = TH;
    const g = cv.getContext("2d")!;
    const img = g.createImageData(TW, TH);
    const bl = mode === "payoff" ? [] : blobs(F, t);
    for (let j = 0; j < TH; j++) {
      const y = 1 - (j + 0.5) / TH;
      for (let i = 0; i < TW; i++) {
        const x = (i + 0.5) / TW;
        const T = tempAt(x, y, F, t, mode, bl);
        const nat: [number, number, number] = [16, 58, 74];
        const tc = tempColor(Math.max(0, T));
        const m = mode === "hook" ? 0 : mode === "lake" ? prog(F, t.watch + 20, t.cools - t.watch - 20, ease.inOut) : 1;
        const r = nat[0] + (tc[0] - nat[0]) * m, gg = nat[1] + (tc[1] - nat[1]) * m, b = nat[2] + (tc[2] - nat[2]) * m;
        const o = (j * TW + i) * 4;
        // a faint darkening with depth, as light fades in water
        const dk = (0.8 + 0.2 * y) * (1 + 0.045 * Math.sin(x * 17 + 2.1 * Math.sin(y * 5 + F * 0.03) + F * 0.08) * Math.sin(y * 11 + 1.7 * Math.sin(x * 7 - F * 0.05)));
        img.data[o] = r * dk; img.data[o + 1] = gg * dk; img.data[o + 2] = b * dk; img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, mode, t]);
}

// ---------- shapes ----------
function glassProfile() {
  const pts: THREE.Vector2[] = [];
  pts.push(new THREE.Vector2(0.0001, 0));
  pts.push(new THREE.Vector2(R_OUT0 - 0.0015, 0));
  pts.push(new THREE.Vector2(R_OUT0, 0.0015));
  pts.push(new THREE.Vector2(R_OUT1, GLASS_H - 0.0008));
  // rounded rim
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * Math.PI;
    const rc = (R_OUT1 + R_IN1) / 2, hw = (R_OUT1 - R_IN1) / 2;
    pts.push(new THREE.Vector2(rc + hw * Math.cos(a), GLASS_H - 0.0008 + hw * Math.sin(a)));
  }
  pts.push(new THREE.Vector2(R_IN0, BASE));
  pts.push(new THREE.Vector2(0.0001, BASE));
  return pts;
}

const Tongs: React.FC<{ y: number; open: number; lift: number }> = ({ y, open, lift }) => {
  const L = 0.26;
  const arm = (side: 1 | -1) => (
    <group key={side} position={[0, y + L + lift, 0]} rotation={[0, 0, side * (0.004 + open * 0.035)]}>
      <mesh position={[side * (S / 2 + 0.002), -L / 2, 0]} castShadow>
        <boxGeometry args={[0.0025, L, 0.009]} />
        <meshStandardMaterial color="#c9ccd2" metalness={0.9} roughness={0.28} />
      </mesh>
      {/* the gripping pad */}
      <mesh position={[side * (S / 2 + 0.0012), -L + 0.006, 0]}>
        <boxGeometry args={[0.0028, 0.012, 0.011]} />
        <meshStandardMaterial color="#3a3d44" metalness={0.2} roughness={0.7} />
      </mesh>
    </group>
  );
  return <group>{arm(1)}{arm(-1)}</group>;
};

const Ripples: React.FC<{ F: number; at: number; level: number }> = ({ F, at, level }) => (
  <>
    {[0, 14].map((d) => {
      const p = prog(F, at + d, 50, ease.out);
      if (p <= 0 || p >= 1) return null;
      const r = S * 0.6 + (rIn(level) - S * 0.6 - 0.001) * p;
      return (
        <mesh key={d} position={[0, level + 0.0006, 0]} rotation-x={-Math.PI / 2} renderOrder={4}>
          <ringGeometry args={[r - 0.0012, r, 64]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.45 * (1 - p)} depthWrite={false} />
        </mesh>
      );
    })}
  </>
);

const Fish: React.FC<{ F: number; start: number }> = ({ F, start }) => {
  const a = prog(F, start, 40, ease.out);
  if (a <= 0) return null;
  const u = F - start;
  const x = -0.6 + Math.min(0.9, u * 0.003);
  const y = MUD + 0.12 + 0.01 * Math.sin(u * 0.05);
  const wag = 0.35 * Math.sin(u * 0.25);
  return (
    <group position={[x, y, FRONT + 0.016]} scale={a * 1.25}>
      <mesh scale={[0.06, 0.022, 0.012]} castShadow>
        <sphereGeometry args={[1, 24, 16]} />
        <meshStandardMaterial color="#e39a4a" roughness={0.5} />
      </mesh>
      <group position={[-0.055, 0, 0]} rotation={[0, wag, 0]}>
        <mesh position={[-0.015, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.02, 0.03, 3]} />
          <meshStandardMaterial color="#d9853a" roughness={0.5} />
        </mesh>
      </group>
      <mesh position={[0.035, 0.006, 0.011]}>
        <sphereGeometry args={[0.0035, 10, 8]} />
        <meshStandardMaterial color="#111" />
      </mesh>
    </group>
  );
};

// ---------- labels drawn over the canvas ----------
const Label: React.FC<{ cam: Cam; p: V3; a: number; text: string; size?: number; dx?: number; dy?: number; color?: string; anchor?: "left" | "center" | "right" }> = ({
  cam, p, a, text, size = 44, dx = 0, dy = 0, color = "#ffffff", anchor = "center",
}) => {
  if (a <= 0) return null;
  const s = project(cam, p);
  const tx = anchor === "center" ? "-50%" : anchor === "right" ? "-100%" : "0%";
  return (
    <div style={{
      position: "absolute", left: s.x + dx, top: s.y + dy, transform: `translate(${tx}, -50%) translateY(${(1 - a) * 12}px)`,
      opacity: a, color, font: `700 ${size}px Inter, sans-serif`, whiteSpace: "nowrap",
      textShadow: "0 2px 10px rgba(0,0,0,0.75), 0 0 2px rgba(0,0,0,0.9)", letterSpacing: "-0.01em",
    }}>{text}</div>
  );
};

/** the arrow inside the pond that says which way the cold water goes: down while it is heavier, up once the rule flips */
const Arrow: React.FC<{ cam: Cam; F: number; t: T }> = ({ cam, F, t }) => {
  const a = prog(F, t.heavier, 24, ease.out) * (1 - prog(F, t.coldest - 10, 30, ease.inOut));
  if (a <= 0) return null;
  const turn = prog(F, t.flips, 36, ease.inOut);
  const s = project(cam, [PX / 2 - 0.2, MUD + PW * 0.52, FRONT]);
  const word = F < t.lighter ? "heavier" : "lighter";
  const wa = F < t.lighter ? 1 - prog(F, t.flips, 20, ease.inOut) : prog(F, t.lighter, 20, ease.out);
  return (
    <div style={{ position: "absolute", left: s.x, top: s.y, opacity: a, transform: "translate(-50%, -50%)", textAlign: "center" }}>
      <svg width={90} height={150} viewBox="-45 -75 90 150" style={{ transform: `rotate(${turn * 180}deg)`, display: "block", margin: "0 auto",
        filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.6))" }}>
        <path d="M0 -60 L0 40" stroke="#fff" strokeWidth={10} strokeLinecap="round" />
        <path d="M-26 22 L0 56 L26 22" stroke="#fff" strokeWidth={10} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ font: "700 40px Inter, sans-serif", color: "#fff", opacity: wa, marginTop: 6,
        textShadow: "0 2px 10px rgba(0,0,0,0.75)" }}>{word}</div>
    </div>
  );
};

/** a small hexagonal ring of six oxygens, the ice cage, as an inset */
const CageInset: React.FC<{ a: number }> = ({ a }) => {
  if (a <= 0) return null;
  const pts = Array.from({ length: 6 }, (_, i) => {
    const q = (i / 6) * Math.PI * 2 + Math.PI / 6;
    return [Math.cos(q) * 70, Math.sin(q) * 70] as const;
  });
  return (
    <div style={{ position: "absolute", left: 540, top: 470, transform: `translate(-50%, -50%) scale(${0.9 + 0.1 * a})`, opacity: a, textAlign: "center" }}>
      <svg width={220} height={200} viewBox="-110 -100 220 200" style={{ display: "block", margin: "0 auto" }}>
        {pts.map(([x, y], i) => {
          const [x2, y2] = pts[(i + 1) % 6];
          return <line key={`b${i}`} x1={x} y1={y} x2={x2} y2={y2} stroke="#9fd3ff" strokeWidth={5} strokeDasharray="7 7" />;
        })}
        {pts.map(([x, y], i) => <circle key={`o${i}`} cx={x} cy={y} r={17} fill="#e5484d" stroke="#fff" strokeWidth={3} />)}
      </svg>
      <div style={{ font: "700 40px Inter, sans-serif", color: "#fff", marginTop: 8, textShadow: "0 2px 10px rgba(0,0,0,0.75)" }}>ice: an open cage</div>
    </div>
  );
};

// ---------- the world ----------
export const GlassLakeWorld3D: React.FC<{ mode: GlassLakeMode }> = ({ mode }) => {
  const { theme } = useReel();
  const { t, k } = useTimes();
  const F = useCurrentFrame() * k;
  const cam = cameraWorld(mode, F, t);
  const bg = theme.grounds.dark.bg;

  const glassGeo = useMemo(() => new THREE.LatheGeometry(glassProfile(), 96), []);
  const cubeGeo = useMemo(() => new RoundedBoxGeometry(S, S, S, 4, 0.0022), []);
  const slabEdges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(PX, PW, PD)), []);
  const tex = usePondTexture(F, t, mode);

  // the cube, the tongs and the water level
  const pay = mode === "payoff";
  const yc = pay ? cubePayoff(F, t) : cubeHook(F, t);
  const level = levelOf(yc);
  const tilt = pay
    ? 0.05 * Math.exp(-Math.max(0, F - t.plighter) / 50) * Math.sin(Math.max(0, F - t.plighter) * 0.06)
    : F < t.sinks ? 0 : 0.09 * Math.exp(-(F - t.sinks) / 70) * Math.sin((F - t.sinks) * 0.05);
  const release = pay ? t.plighter : t.sinks;
  const open = prog(F, release, 10, ease.out);
  const lift = 2.8 * prog(F, release + 8, 120, ease.in);
  const tongY = pay ? Y_BOTTOM - S / 2 + 0.002 : Y_HOLD - S / 2 + 0.002;
  const entry = pay ? -1 : t.sinks + ((t.frozen - t.sinks) * HOLD_GAP) / (HOLD_GAP + (Y_TOUCH - Y_MIN));
  const surfaceBack = pay ? t.plighter + Math.max(60, t.rises - t.plighter) * 0.75 : -1;
  const waterH = level - BASE;

  // the pond: ice sheet on "ice" (lake), a thicker lid in the payoff
  const grow = mode === "lake" ? prog(F, t.where, 50, ease.inOut) : mode === "payoff" ? 1 : 0;
  const thick = pay ? 0.075 : 0.03;
  const lidGlow = pay ? prog(F, t.lid, 24, ease.out) : 0;

  const labelsLake = mode === "lake";
  const pondY = (y: number) => MUD + PW * y;

  return (
    <>
      <World3D cam={cam} background={bg} fog={[6, 22]}>
        <Studio sun={[1.5, 3, 2]} intensity={0} hdri="ice-floats/hdris/brown_photostudio_02_1k.hdr" hdriStrength={0.55} />
        <directionalLight
          position={[1.2, 2.6, 1.6]}
          intensity={2.4}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-1.4}
          shadow-camera-right={1.4}
          shadow-camera-top={1.4}
          shadow-camera-bottom={-1.4}
          shadow-camera-near={0.5}
          shadow-camera-far={8}
          shadow-bias={-0.0003}
          shadow-radius={5}
        />
        <Floor color="#1a1c21" />
        {/* floor tiles 10 cm across, so the eye can read distance and the camera's drift */}
        <gridHelper args={[24, 240, "#30333b", "#2a2d34"]} position={[0, 0.0003, 0]} />

        {/* a soft contact shadow under the glass */}
        <mesh rotation-x={-Math.PI / 2} position={[0.004, 0.0004, -0.003]}>
          <circleGeometry args={[0.05, 48]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.35} depthWrite={false} alphaMap={RADIAL} />
        </mesh>

        {/* ice cube */}
        <group position={[0, yc, 0]} rotation={[tilt * 0.6, 0.35, tilt]}>
          <mesh geometry={cubeGeo} renderOrder={1}>
            <meshPhysicalMaterial color="#dff1ff" transparent opacity={0.5} roughness={0.08} clearcoat={1} clearcoatRoughness={0.05}
              envMapIntensity={2.4} emissive="#8fc4ea" emissiveIntensity={0.18} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
          {/* a cloudy core, the air frozen into the middle of a real cube */}
          <mesh scale={[S * 0.28, S * 0.28, S * 0.28]} renderOrder={2}>
            <sphereGeometry args={[1, 20, 14]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.22} depthWrite={false} />
          </mesh>
        </group>

        {lift < 2.7 && <Tongs y={tongY} open={open} lift={lift} />}

        {/* water: body, a brighter surface and the meniscus ring at the wall */}
        <mesh position={[0, BASE + waterH / 2, 0]} renderOrder={3}>
          <cylinderGeometry args={[rIn(level) - 0.0003, R_IN0 - 0.0003, waterH, 72, 1, true]} />
          <meshPhysicalMaterial color="#7fbef0" transparent opacity={0.32} roughness={0.05} side={THREE.DoubleSide} depthWrite={false} envMapIntensity={0.8} />
        </mesh>
        <mesh position={[0, level, 0]} rotation-x={-Math.PI / 2} renderOrder={4}>
          <circleGeometry args={[rIn(level) - 0.0003, 72]} />
          <meshPhysicalMaterial color="#a9d8ff" transparent opacity={0.4} roughness={0.02} metalness={0} clearcoat={1} depthWrite={false} side={THREE.DoubleSide} envMapIntensity={1.4} />
        </mesh>
        <mesh position={[0, level + 0.0008, 0]} rotation-x={-Math.PI / 2} renderOrder={5}>
          <torusGeometry args={[rIn(level) - 0.0008, 0.0008, 8, 96]} />
          <meshBasicMaterial color="#e8f6ff" transparent opacity={0.55} depthWrite={false} />
        </mesh>
        <Ripples F={F} at={entry} level={level} />
        {pay && <Ripples F={F} at={surfaceBack} level={level} />}

        {/* the glass: a real solid of revolution with a thick base and a rounded rim */}
        <mesh geometry={glassGeo} renderOrder={6}>
          <meshPhysicalMaterial color="#ffffff" transmission={1} thickness={0.003} ior={1.5} roughness={0.03} metalness={0}
            clearcoat={1} clearcoatRoughness={0.03} envMapIntensity={1.6} specularIntensity={1} transparent opacity={1} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>

        {/* the pond: mud, the water coloured by temperature, its outline, and the ice */}
        {(
          <group>
            <mesh position={[0, MUD / 2, PZ]} castShadow receiveShadow>
              <boxGeometry args={[PX, MUD, PD]} />
              <meshStandardMaterial color="#3b2f25" roughness={0.95} />
            </mesh>
            <mesh position={[0, MUD + PW / 2, PZ]} castShadow receiveShadow>
              <boxGeometry args={[PX, PW, PD]} />
              <meshPhysicalMaterial map={tex} roughness={0.12} clearcoat={0.8} clearcoatRoughness={0.1} envMapIntensity={0.6} />
            </mesh>
            <lineSegments geometry={slabEdges} position={[0, MUD + PW / 2, PZ]}>
              <lineBasicMaterial color="#cfe6ff" transparent opacity={0.35} />
            </lineSegments>
            {grow > 0 && [-1, 1].map((side) => {
              const w = (PX / 2) * grow + (side === 1 ? 0.0005 : 0);
              return (
                <mesh key={side} position={[side * (PX / 2 - w / 2), TOPW - RHO * thick + thick / 2, PZ]} castShadow receiveShadow>
                  <boxGeometry args={[w, thick, PD + 0.004]} />
                  <meshPhysicalMaterial color="#f6fbff" roughness={0.35} clearcoat={0.8} clearcoatRoughness={0.2} emissive="#cfe9ff" emissiveIntensity={0.25} envMapIntensity={1.2} />
                </mesh>
              );
            })}
            {lidGlow > 0 && (
              <lineSegments position={[0, TOPW - RHO * thick + thick / 2, PZ]}>
                <edgesGeometry args={[new THREE.BoxGeometry(PX + 0.01, thick + 0.01, PD + 0.012)]} />
                <lineBasicMaterial color={theme.marker.color} transparent opacity={lidGlow} />
              </lineSegments>
            )}
            {pay && <Fish F={F} start={t.ponds} />}
          </group>
        )}
      </World3D>

      {/* labels */}
      {labelsLake && (
        <>
          <Label cam={cam} p={[0, pondY(0.88), FRONT]} a={prog(F, t.cools + 10, 24, ease.out) * (1 - prog(F, t.lsinks, 20, ease.inOut))} text="cooling" />
          <Arrow cam={cam} F={F} t={t} />
          <Label cam={cam} p={[-0.12, F < t.lighter ? pondY(0.5) : pondY(0.5) + (pondY(0.25) - pondY(0.5)) * prog(F, t.lighter, 40, ease.inOut), FRONT]}
            a={prog(F, t.four, 24, ease.out)} text="4 °C" size={64} />
          <Label cam={cam} p={[-0.12, pondY(0.84), FRONT]} a={prog(F, t.coldest + 12, 24, ease.out)} text="0 °C" size={52} />
          <Label cam={cam} p={[0, TOPW + 0.02, FRONT]} a={prog(F, t.ice, 20, ease.out)} text="ice" size={52} dy={-50} />
        </>
      )}
      {pay && (
        <>
          <Label cam={cam} p={[0, TOPW, FRONT]} a={prog(F, t.lid + 6, 24, ease.out)} text="ice lid" size={52} dy={-70} />
          <Label cam={cam} p={[0.2, pondY(0.45), FRONT]} a={prog(F, t.below, 24, ease.out)} text="liquid water" size={48} />
          <CageInset a={prog(F, t.cage, 30, ease.out)} />
        </>
      )}
    </>
  );
};

// a radial falloff for the contact shadow (white in the middle, black at the edge)
const RADIAL = (() => {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  gr.addColorStop(0, "#ffffff");
  gr.addColorStop(0.55, "#888888");
  gr.addColorStop(1, "#000000");
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
