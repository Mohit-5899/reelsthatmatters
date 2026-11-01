// World 1: the jet. A generic all-white twin-engine narrowbody (no livery, logo or name) built from simple shapes at real
// 737-8 size, its nose cut away on the +x side so the camera can sit at the flight-deck door in the forward bulkhead.
// Shared by hook, door, captain and close (see plan.md for every cue). hook and door draw ONE continuous camera path.
// Never show a person in the cockpit, a weapon or the attack: people are small neutral pale markers, danger is a red light.
// Every value is a pure function of the frame (60 fps frames; a 30 fps draft is scaled by k = 60 / fps). No useFrame().
//
// Axes (metres): the fuselage runs along z, nose toward -z. The door's cabin face looks toward +z (aft, the cabin);
// the flight deck is at z < 0. The cabin floor is y = 0, the fuselage axis is y = 0.85. The cut-away is on +x.
//   hook    "locked" bolts slide home; "door" lock lamp turns green; "plane" the camera starts to pull back.
//   door    "inside" red alert light on the flight-deck ceiling; "out" arrows push and stop at the door; "American"
//           plate "US rule (FAA)"; "forced" longer arrows, "resists forced entry"; "bullets" the armour layers in the
//           door's edge glow, "stops handgun rounds"; "inside" (2nd) the lever on the flight-deck face lights up,
//           "unlocks only from inside".
//   captain "Machchhar" / "Mumbai" title card; "injured" card fades, the red leak pulses; "open" bolts retract and the
//           door swings in; "help"/"in" pale markers walk in; "down" they rest, red light out, cockpit glow calm white.
//   close   "meant" bolts in, lamp green; "out" arrows push and stop; "opened" door swings open; the camera pulls out
//           through the cut-away to the whole white jet, flying level, by "plane".
import React, { useMemo } from "react";
import * as THREE from "three";
import { useCurrentFrame } from "remotion";
import { type Cam, type V3, ease, orbit, prog, project, spline, useReel } from "../../../src/engine";
import { Floor, Studio, World3D } from "../../../src/engine/three";

export type JetMode = "hook" | "door" | "captain" | "close";

// sizes in metres
export const FUSE_LEN = 39.5;
export const FUSE_R = 1.88;
export const SPAN = 35.9;
export const DOOR_W = 0.8;
export const DOOR_H = 1.9;
export const DOOR_T = 0.04;

const AXIS_Y = 0.85; // fuselage axis above the cabin floor
const NOSE_Z = -2.6; // nose tip (the door is 2.6 m behind it)
const NOSE_END = 2.0; // where the nose reaches full radius
const CUT_END = 6.0; // the cut-away runs from the nose to here
const TAIL_Z = NOSE_Z + FUSE_LEN; // 36.9
const CUT_HALF = 1.08; // half-angle of the cut-away wedge, radians (about 62 deg)
const HINGE_X = -DOOR_W / 2;
const LATCH_X = DOOR_W / 2;
const WALL_Z0 = -0.1, WALL_Z1 = -0.04; // the bulkhead sits just behind the door
const BOLT_Y = [0.35, 0.95, 1.55];
const OPEN = (70 * Math.PI) / 180;

const noseR = (z: number) => {
  if (z <= NOSE_Z) return 0;
  if (z >= NOSE_END) return FUSE_R;
  const u = (NOSE_END - z) / (NOSE_END - NOSE_Z);
  return FUSE_R * Math.sqrt(1 - u * u);
};

// ---------- times ----------
type T = Record<string, number>;
function useTimes(): { t: T; k: number } {
  const { tl } = useReel();
  return useMemo(() => {
    const k = 60 / tl.fps;
    const si = (id: string) => tl.scenes.findIndex((s) => s.id === id);
    const h = si("hook"), d = si("door"), c = si("captain"), z = si("close");
    const q = (w: string, sc: number, n = 1) => tl.cue(w, n, sc) * k;
    const t: T = {
      locked: q("locked", h), door: q("door", h), plane: q("plane", h), safe: q("safe", h), hookEnd: tl.scenes[h].to * k,
      inside: q("inside", d), out: q("out", d), american: q("american", d), forced: q("forced", d), handgun: q("handgun", d),
      bullets: q("bullets", d), lock: q("lock", d), inside2: q("inside", d, 2), doorEnd: tl.scenes[d].to * k,
      cStart: tl.scenes[c].from * k, machchhar: q("machchhar", c), mumbai: q("mumbai", c), injured: q("injured", c),
      open: q("open", c), help: q("help", c), cin: q("in", c), down: q("down", c), cEnd: tl.scenes[c].to * k,
      zStart: tl.scenes[z].from * k, meant: q("meant", z), zout: q("out", z), flight: q("flight", z), opened: q("opened", z),
      saved: q("saved", z), zplane: q("plane", z), end: tl.frames * k,
    };
    return { t, k };
  }, [tl]);
}

// ---------- camera ----------
type Key = { f: number; at: V3; yaw: number; pitch: number; d: number };
function camFrom(F: number, keys: Key[]): Cam {
  const sp = (g: (k: Key) => number) => spline(F, keys.map((k) => [k.f, g(k)] as [number, number]));
  const at: V3 = [sp((k) => k.at[0]), sp((k) => k.at[1]), sp((k) => k.at[2])];
  const d = Math.exp(sp((k) => Math.log(k.d)));
  return { eye: orbit(at, sp((k) => k.yaw), sp((k) => k.pitch), d), at, focal: 1500, cx: 540, cy: 960 };
}

function cameraWorld(mode: JetMode, F: number, t: T): Cam {
  if (mode === "hook" || mode === "door") {
    // one path for both scenes: square on the door, back and round to the side, the cabin face, the door's edge, the lever
    return camFrom(F, [
      { f: 0, at: [0, 0.97, 0], yaw: 0, pitch: 0.1, d: 2.0 },
      { f: t.plane, at: [0, 0.97, 0], yaw: 0.02, pitch: 0.1, d: 2.08 },
      { f: t.hookEnd, at: [0, 0.98, -0.12], yaw: 0.42, pitch: 0.13, d: 2.6 },
      { f: t.inside, at: [0, 1.0, -0.45], yaw: 1.36, pitch: 0.12, d: 3.4 },
      { f: t.out, at: [0, 1.0, -0.4], yaw: 1.42, pitch: 0.12, d: 3.5 },
      { f: t.american, at: [0, 1.0, -0.38], yaw: 1.4, pitch: 0.12, d: 3.45 },
      { f: t.american + 70, at: [0.05, 0.95, 0], yaw: 0.62, pitch: 0.16, d: 2.7 },
      { f: t.forced, at: [0.05, 0.95, 0], yaw: 0.53, pitch: 0.16, d: 2.6 },
      { f: t.handgun, at: [0.06, 0.96, 0], yaw: 0.5, pitch: 0.15, d: 2.5 },
      { f: t.bullets + 40, at: [0.4, 1.25, 0], yaw: 1.25, pitch: 0.08, d: 0.8 },
      { f: t.lock + 20, at: [0.39, 1.22, 0], yaw: 1.38, pitch: 0.07, d: 0.78 },
      { f: t.inside2 + 25, at: [0.3, 1.1, -0.03], yaw: 2.4, pitch: 0.05, d: 1.3 },
      { f: t.doorEnd + 30, at: [0.3, 1.1, -0.03], yaw: 2.5, pitch: 0.05, d: 1.38 },
    ]);
  }
  if (mode === "captain") {
    return camFrom(F, [
      { f: t.cStart - 10, at: [0, 1.1, 0], yaw: 0.3, pitch: 0.14, d: 2.95 },
      { f: t.injured, at: [0, 1.1, 0], yaw: 0.07, pitch: 0.1, d: 2.56 },
      { f: t.open, at: [0, 1.05, 0], yaw: 0.03, pitch: 0.1, d: 2.5 },
      { f: t.open + 60, at: [0.05, 1.0, -0.45], yaw: 0.22, pitch: 0.12, d: 2.6 },
      { f: t.down, at: [0.05, 1.0, -0.45], yaw: 0.27, pitch: 0.12, d: 2.75 },
      { f: t.cEnd + 30, at: [0.05, 1.0, -0.45], yaw: 0.32, pitch: 0.12, d: 3.0 },
    ]);
  }
  // close: the door, then back out through the cut-away to the whole jet
  return camFrom(F, [
    { f: t.zStart - 10, at: [0, 1.05, 0], yaw: 0.22, pitch: 0.1, d: 2.6 },
    { f: t.meant, at: [0, 1.05, 0], yaw: 0.3, pitch: 0.1, d: 2.55 },
    { f: t.zout, at: [0, 1.05, 0], yaw: 0.4, pitch: 0.1, d: 2.5 },
    { f: t.opened, at: [0, 1.0, -0.2], yaw: 0.3, pitch: 0.11, d: 2.6 },
    { f: t.opened + 30, at: [0, 1.0, -0.2], yaw: 0.4, pitch: 0.2, d: 3.4 },
    { f: t.opened + 62, at: [0, 1.1, 1], yaw: 0.55, pitch: 0.38, d: 6.5 },
    { f: t.opened + 97, at: [0, 0.8, 6], yaw: 0.6, pitch: 0.42, d: 18 },
    { f: t.opened + 137, at: [0, 0.5, 19], yaw: 0.62, pitch: 0.42, d: 48 },
    { f: t.end, at: [0, 0.5, 19.6], yaw: 0.6, pitch: 0.42, d: 54 },
  ]);
}

// ---------- the door's state ----------
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function doorState(mode: JetMode, F: number, t: T) {
  // bolts: 0 retracted, 1 in the keeper
  let bolts = [1, 1, 1];
  let lamp = 1; // 0 amber, 1 green
  let angle = 0; // door swing, radians, into the flight deck
  let red = 0; // the alert light on the flight-deck ceiling
  let calm = 0; // the cockpit glow turning calm white
  let layers = 0; // the armour layers glowing
  let lever = 0;
  if (mode === "hook") {
    bolts = BOLT_Y.map((_, i) => prog(F, t.locked + 4 + i * 9, 14, ease.inOut));
    lamp = prog(F, t.door, 10, ease.out);
  } else if (mode === "door") {
    red = prog(F, t.inside, 24, ease.out);
    red *= 0.85 + 0.15 * Math.cos((F - t.inside) * 0.09);
    layers = prog(F, t.bullets, 20, ease.out);
    lever = prog(F, t.inside2, 16, ease.out);
  } else if (mode === "captain") {
    const pulse = 0.75 + 0.25 * Math.cos((F - t.cStart) * 0.075);
    red = (1 - prog(F, t.down, 30, ease.inOut)) * pulse;
    calm = prog(F, t.down, 40, ease.inOut);
    bolts = BOLT_Y.map((_, i) => 1 - prog(F, t.open - 8 + i * 3, 12, ease.inOut));
    lamp = 1 - prog(F, t.open - 8, 10, ease.out);
    angle = OPEN * prog(F, t.open + 8, 36, ease.inOut);
  } else {
    calm = 1;
    bolts = BOLT_Y.map((_, i) => prog(F, t.meant - 4 + i * 8, 14, ease.inOut) * (1 - prog(F, t.opened - 10 + i * 3, 12, ease.inOut)));
    lamp = prog(F, t.meant + 18, 10, ease.out) * (1 - prog(F, t.opened - 10, 10, ease.out));
    angle = OPEN * prog(F, t.opened + 6, 36, ease.inOut);
  }
  return { bolts, lamp, angle, red, calm, layers, lever };
}

/** three grey arrows from the cabin that push at the door and stop dead at its face, with a small recoil */
function arrowSet(F: number, start: number, long: boolean) {
  const travel = long ? 30 : 24;
  const a = prog(F, start - 4, 12, ease.out) * (1 - prog(F, start + travel + 70, 22, ease.inOut));
  const z0 = long ? 1.55 : 1.0;
  const hit = start + travel;
  let tip = z0 + (0.03 - z0) * prog(F, start, travel, ease.in);
  if (F > hit) tip = 0.03 + 0.035 * Math.exp(-(F - hit) / 9) * Math.sin(((F - hit) / 14) * Math.PI);
  return { a, tip, len: long ? 0.85 : 0.5, hit };
}

// ---------- shapes ----------
function lathe(points: [number, number][], phiStart: number, phiLength: number, segs = 96) {
  return new THREE.LatheGeometry(points.map(([r, z]) => new THREE.Vector2(r, z)), segs, phiStart, phiLength);
}

function noseProfile(z0: number, z1: number, n: number, dr = 0): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const z = z0 + ((z1 - z0) * i) / n;
    out.push([Math.max(0.0001, noseR(z) + dr), z]);
  }
  return out;
}

/** a swept wing or tailplane, planform in x (out) and z (aft), extruded up by its thickness */
function wingGeo(rootX: number, tipX: number, rootLE: number, rootC: number, tipLE: number, tipC: number, th: number) {
  const s = new THREE.Shape();
  s.moveTo(rootX, -rootLE);
  s.lineTo(tipX, -tipLE);
  s.lineTo(tipX, -(tipLE + tipC));
  s.lineTo(rootX, -(rootLE + rootC));
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: true, bevelThickness: th * 0.3, bevelSize: th * 0.3, bevelSegments: 2 });
  g.rotateX(-Math.PI / 2);
  return g;
}

function useGeometries() {
  return useMemo(() => {
    // the forward shell, open on +x, and the aft shell, whole
    const fwdPts: [number, number][] = [...noseProfile(NOSE_Z, NOSE_END, 40), [FUSE_R, CUT_END]];
    const fwd = lathe(fwdPts, Math.PI / 2 + CUT_HALF, Math.PI * 2 - 2 * CUT_HALF);
    const aftPts: [number, number][] = [[FUSE_R, CUT_END], [FUSE_R, 27], [1.78, 29.5], [1.5, 31.8], [1.1, 34], [0.62, 35.9], [0.32, TAIL_Z], [0.0001, TAIL_Z]];
    const aft = lathe(aftPts, 0, Math.PI * 2);
    // windscreen: a dark band on the nose, left and centre (the right one is in the cut-away)
    const wsL = lathe(noseProfile(-1.62, -1.02, 8, 0.006), Math.PI + 0.32, 0.8, 24);
    const wsC = lathe(noseProfile(-1.95, -1.55, 8, 0.006), Math.PI - 0.3, 0.6, 24);
    // the bulkhead: a disc with the door opening
    const rb = noseR(WALL_Z1) - 0.02;
    const bs = new THREE.Shape();
    bs.absarc(0, AXIS_Y, rb, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.moveTo(HINGE_X, -0.12);
    hole.lineTo(LATCH_X + 0.005, -0.12);
    hole.lineTo(LATCH_X + 0.005, DOOR_H + 0.005);
    hole.lineTo(HINGE_X, DOOR_H + 0.005);
    hole.closePath();
    bs.holes.push(hole);
    const bulk = new THREE.ExtrudeGeometry(bs, { depth: WALL_Z1 - WALL_Z0, bevelEnabled: false, curveSegments: 64 });
    const wing = wingGeo(1.4, 17.95, 10.5, 6.2, 18.1, 1.4, 0.32);
    const stab = wingGeo(0.5, 7.2, 30.6, 3.8, 34.4, 1.3, 0.16);
    const fin = (() => {
      const s = new THREE.Shape();
      s.moveTo(28.6, 2.0);
      s.lineTo(34.4, 9.0);
      s.lineTo(36.1, 9.0);
      s.lineTo(36.4, 1.0);
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.28, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 });
      g.translate(0, 0, -0.14);
      g.rotateY(-Math.PI / 2);
      return g;
    })();
    return { fwd, aft, wsL, wsC, bulk, wing, stab, fin };
  }, []);
}

const WHITE = "#f4f5f7";

const Wing: React.FC<{ geo: THREE.BufferGeometry; side: 1 | -1; y: number; dihedral: number }> = ({ geo, side, y, dihedral }) => (
  <group position={[0, y, 0]} rotation={[0, 0, side * dihedral]} scale={[side, 1, 1]}>
    <mesh geometry={geo} castShadow receiveShadow>
      <meshStandardMaterial color={WHITE} roughness={0.45} metalness={0.05} side={THREE.DoubleSide} />
    </mesh>
  </group>
);

const Engine: React.FC<{ x: number }> = ({ x }) => (
  <group position={[x, -1.25, 10.8]}>
    <mesh rotation-x={Math.PI / 2} castShadow receiveShadow>
      <cylinderGeometry args={[0.72, 0.88, 4.2, 40]} />
      <meshStandardMaterial color="#e9ebee" roughness={0.4} metalness={0.15} />
    </mesh>
    <mesh position={[0, 0, -2.105]} rotation-y={Math.PI}>
      <circleGeometry args={[0.8, 40]} />
      <meshStandardMaterial color="#2a2d33" roughness={0.6} metalness={0.4} />
    </mesh>
    <mesh position={[0, 0, 2.15]} rotation-x={Math.PI / 2}>
      <coneGeometry args={[0.4, 0.8, 24]} />
      <meshStandardMaterial color="#8d939c" roughness={0.5} metalness={0.5} />
    </mesh>
    {/* pylon up to the wing */}
    <mesh position={[0, 0.95, 0.9]} castShadow>
      <boxGeometry args={[0.22, 0.9, 3.2]} />
      <meshStandardMaterial color="#e3e6ea" roughness={0.45} />
    </mesh>
  </group>
);

/** the cabin windows: small dark panes on the outer skin, both sides, aft of the cut-away */
const Windows: React.FC = () => {
  const panes: React.ReactNode[] = [];
  const phiR = Math.PI / 2 + 0.25, phiL = (3 * Math.PI) / 2 - 0.25;
  for (let z = 7.0; z < 27; z += 0.53) {
    for (const phi of [phiR, phiL]) {
      const x = (FUSE_R + 0.004) * Math.sin(phi);
      const y = AXIS_Y - (FUSE_R + 0.004) * Math.cos(phi);
      // the pane faces outward: its normal is (sin phi, -cos phi, 0)
      const rotZ = Math.atan2(-Math.cos(phi), Math.sin(phi));
      panes.push(
        <mesh key={`${z.toFixed(2)}-${phi.toFixed(2)}`} position={[x, y, z]} rotation={[0, 0, rotZ]}>
          <boxGeometry args={[0.012, 0.3, 0.22]} />
          <meshStandardMaterial color="#20252d" roughness={0.2} metalness={0.3} />
        </mesh>,
      );
    }
  }
  return <>{panes}</>;
};

/** empty cabin seats in rows, aft of the forward entry area */
const Seats: React.FC = () => {
  const rows: React.ReactNode[] = [];
  for (let r = 0; r < 10; r++) {
    const z = 3.3 + r * 0.8;
    for (const sx of [-1, 1]) {
      const cx = sx * 0.88;
      rows.push(
        <group key={`${r}${sx}`} position={[cx, 0, z]}>
          <mesh position={[0, 0.24, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.3, 0.2, 0.48]} />
            <meshStandardMaterial color="#5d6878" roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.72, 0.24]} rotation-x={0.12} castShadow receiveShadow>
            <boxGeometry args={[1.3, 0.8, 0.1]} />
            <meshStandardMaterial color="#56606f" roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.07, 0]}>
            <boxGeometry args={[1.1, 0.14, 0.3]} />
            <meshStandardMaterial color="#3a3f47" roughness={0.7} />
          </mesh>
        </group>,
      );
    }
  }
  return <>{rows}</>;
};

/** the door: three layers (skin, armour core, skin), bolts on the cabin face, a lock lamp, the lever on the flight-deck face */
const Door: React.FC<{ angle: number; lamp: number; layers: number; lever: number; bolts: number[]; leverColor: string }> = ({
  angle, lamp, layers, lever, bolts, leverColor,
}) => {
  const lampCol = new THREE.Color("#c98a2a").lerp(new THREE.Color("#3DDC97"), lamp);
  const core = new THREE.Color("#7b6f5a");
  const glow = new THREE.Color("#ffb347");
  return (
    <group position={[HINGE_X, 0.01, 0]} rotation={[0, angle, 0]}>
      <group position={[DOOR_W / 2, DOOR_H / 2 - 0.005, 0]}>
        {/* cabin skin, armour core, flight-deck skin */}
        <mesh position={[0, 0, DOOR_T / 2 - 0.004]} castShadow receiveShadow>
          <boxGeometry args={[DOOR_W, DOOR_H - 0.01, 0.008]} />
          <meshStandardMaterial color="#cfd3d9" roughness={0.55} metalness={0.15} />
        </mesh>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[DOOR_W - 0.0005, DOOR_H - 0.0105, 0.024]} />
          <meshStandardMaterial color={core} roughness={0.8} emissive={glow} emissiveIntensity={layers * 1.6} />
        </mesh>
        <mesh position={[0, 0, -DOOR_T / 2 + 0.004]} castShadow receiveShadow>
          <boxGeometry args={[DOOR_W, DOOR_H - 0.01, 0.008]} />
          <meshStandardMaterial color="#c3c8cf" roughness={0.55} metalness={0.15} />
        </mesh>
        {/* skins light up a little too, so the three layers read in the edge */}
        {layers > 0 && [1, -1].map((s) => (
          <mesh key={s} position={[DOOR_W / 2 + 0.0008, 0, s * (DOOR_T / 2 - 0.004)]}>
            <boxGeometry args={[0.001, DOOR_H - 0.01, 0.0075]} />
            <meshBasicMaterial color="#e8eef6" transparent opacity={layers} />
          </mesh>
        ))}
        {/* a recessed panel line on the cabin face */}
        <mesh position={[0, 0.05, DOOR_T / 2 + 0.0006]}>
          <planeGeometry args={[DOOR_W - 0.14, DOOR_H - 0.3]} />
          <meshStandardMaterial color="#d8dce1" roughness={0.6} metalness={0.1} />
        </mesh>
        {/* bolt housings and the three bolts, which slide toward the latch side (+x) into the keepers */}
        {BOLT_Y.map((y, i) => {
          const bx = 0.25 + 0.17 * bolts[i];
          return (
            <group key={i} position={[0, y - DOOR_H / 2, DOOR_T / 2]}>
              <mesh position={[0.29, 0, 0.006]} castShadow>
                <boxGeometry args={[0.16, 0.05, 0.012]} />
                <meshStandardMaterial color="#8e959f" roughness={0.4} metalness={0.7} />
              </mesh>
              <mesh position={[bx, 0, 0.022]} rotation-z={Math.PI / 2} castShadow>
                <cylinderGeometry args={[0.012, 0.012, 0.13, 20]} />
                <meshStandardMaterial color="#b9c0c9" roughness={0.25} metalness={0.9} />
              </mesh>
            </group>
          );
        })}
        {/* lock lamp */}
        <mesh position={[0.24, 1.22 - DOOR_H / 2, DOOR_T / 2 + 0.008]}>
          <boxGeometry args={[0.06, 0.03, 0.012]} />
          <meshStandardMaterial color={lampCol} emissive={lampCol} emissiveIntensity={1.8} roughness={0.3} />
        </mesh>
        {/* the lever, on the flight-deck face only */}
        <group position={[0.26, 1.05 - DOOR_H / 2, -DOOR_T / 2]}>
          {[-0.06, 0.06].map((x) => (
            <mesh key={x} position={[x, 0, -0.02]}>
              <boxGeometry args={[0.02, 0.025, 0.04]} />
              <meshStandardMaterial color="#6f7680" roughness={0.4} metalness={0.7} />
            </mesh>
          ))}
          <mesh position={[0, 0, -0.045]} castShadow>
            <boxGeometry args={[0.17, 0.028, 0.026]} />
            <meshStandardMaterial color={lever > 0 ? new THREE.Color("#9aa1ab").lerp(new THREE.Color(leverColor), lever) : "#9aa1ab"}
              emissive={leverColor} emissiveIntensity={lever * 1.4} roughness={0.35} metalness={0.5} />
          </mesh>
        </group>
        {/* hinges */}
        {[0.25, 0.95, 1.65].map((y) => (
          <mesh key={y} position={[-DOOR_W / 2 - 0.006, y - DOOR_H / 2, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.12, 16]} />
            <meshStandardMaterial color="#7a818b" roughness={0.4} metalness={0.8} />
          </mesh>
        ))}
      </group>
    </group>
  );
};

const Arrow: React.FC<{ x: number; y: number; tip: number; len: number; a: number }> = ({ x, y, tip, len, a }) => {
  if (a <= 0) return null;
  const head = 0.11;
  return (
    <group position={[x, y, tip]}>
      <mesh position={[0, 0, head / 2]} rotation-x={-Math.PI / 2} castShadow>
        <coneGeometry args={[0.045, head, 24]} />
        <meshStandardMaterial color="#a9b0ba" roughness={0.45} metalness={0.4} transparent opacity={a} />
      </mesh>
      <mesh position={[0, 0, head + len / 2]} rotation-x={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.016, 0.016, len, 16]} />
        <meshStandardMaterial color="#a9b0ba" roughness={0.45} metalness={0.4} transparent opacity={a} />
      </mesh>
    </group>
  );
};

/** a neutral pale marker for a person: a disc foot, a slim post and a ball, never a figure */
const Marker: React.FC<{ p: [number, number]; a: number }> = ({ p, a }) => (
  <group position={[p[0], 0, p[1]]}>
    <mesh position={[0, 0.015, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.12, 0.13, 0.03, 32]} />
      <meshStandardMaterial color="#d9d6d0" roughness={0.6} transparent={a < 1} opacity={a} />
    </mesh>
    <mesh position={[0, 0.56, 0]} castShadow>
      <cylinderGeometry args={[0.04, 0.05, 1.06, 20]} />
      <meshStandardMaterial color="#d9d6d0" roughness={0.6} transparent={a < 1} opacity={a} />
    </mesh>
    <mesh position={[0, 1.2, 0]} castShadow>
      <sphereGeometry args={[0.12, 32, 20]} />
      <meshStandardMaterial color="#e4e1db" roughness={0.5} transparent={a < 1} opacity={a} />
    </mesh>
  </group>
);

/** walking along a path with a trapezoid speed: a short speed-up, an even walk, a short slow-down */
function walk(F: number, start: number, path: [number, number][], speed: number): [number, number] {
  const seg = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1]));
  const L = seg.reduce((a, b) => a + b, 0);
  const ramp = 14;
  const dur = L / speed + ramp;
  const u = Math.min(dur, Math.max(0, F - start));
  const v = L / (dur - ramp);
  let s: number;
  if (u < ramp) s = (v * u * u) / (2 * ramp);
  else if (u < dur - ramp) s = v * (u - ramp / 2);
  else s = L - (v * (dur - u) * (dur - u)) / (2 * ramp);
  for (let i = 0; i < seg.length; i++) {
    if (s <= seg[i] || i === seg.length - 1) {
      const q = clamp01(s / seg[i]);
      return [path[i][0] + (path[i + 1][0] - path[i][0]) * q, path[i][1] + (path[i + 1][1] - path[i][1]) * q];
    }
    s -= seg[i];
  }
  return path[path.length - 1];
}

// ---------- labels over the canvas ----------
const Label: React.FC<{ cam: Cam; p: V3; a: number; text: string; size?: number; dx?: number; dy?: number; plate?: boolean; color?: string }> = ({
  cam, p, a, text, size = 46, dx = 0, dy = 0, plate = false, color = "#ffffff",
}) => {
  if (a <= 0) return null;
  const s = project(cam, p);
  return (
    <div style={{
      position: "absolute", left: s.x + dx, top: s.y + dy, transform: `translate(-50%, -50%) translateY(${(1 - a) * 14}px)`,
      opacity: a, color, font: `700 ${size}px Inter, sans-serif`, whiteSpace: "nowrap", letterSpacing: "-0.01em",
      textShadow: "0 2px 10px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.9)",
      ...(plate ? { background: "rgba(17,18,20,0.78)", border: "2px solid rgba(255,255,255,0.35)", borderRadius: 14, padding: "10px 22px", textShadow: "none" } : {}),
    }}>{text}</div>
  );
};

const TitleCard: React.FC<{ a1: number; a2: number }> = ({ a1, a2 }) => {
  if (a1 <= 0) return null;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 250, textAlign: "center", color: "#fff", fontFamily: "Inter, sans-serif" }}>
      <div style={{ opacity: a1, transform: `translateY(${(1 - Math.min(1, a1 * 1.2)) * 16}px)`, font: "800 72px Inter, sans-serif", letterSpacing: "-0.02em",
        textShadow: "0 3px 14px rgba(0,0,0,0.85)" }}>Capt. Smit Machchhar</div>
      <div style={{ margin: "16px auto 0", width: 120 * Math.min(a1, 1), height: 4, borderRadius: 2, background: "#4C8DFF", opacity: a1 }} />
      <div style={{ opacity: Math.min(a1, a2), transform: `translateY(${(1 - a2) * 12}px)`, marginTop: 16, font: "600 50px Inter, sans-serif",
        color: "#dfe3ea", textShadow: "0 3px 14px rgba(0,0,0,0.85)" }}>from Mumbai</div>
    </div>
  );
};

// ---------- the world ----------
export const JetWorld3D: React.FC<{ mode: JetMode }> = ({ mode }) => {
  const { theme } = useReel();
  const { t, k } = useTimes();
  const F = useCurrentFrame() * k;
  const cam = cameraWorld(mode, F, t);
  const bg = theme.grounds.dark.bg;
  const g = useGeometries();
  const st = doorState(mode, F, t);
  const accent = theme.marker.color;

  // arrows
  const sets = mode === "door" ? [arrowSet(F, t.out - 2, false), arrowSet(F, t.forced, true)] : mode === "close" ? [arrowSet(F, t.zout - 6, false)] : [];

  // markers (captain): from the aisle, through the doorway, to rest apart inside
  const markers: { p: [number, number]; a: number }[] = [];
  if (mode === "captain") {
    const paths: [number, number][][] = [
      [[-1.05, 0.75], [-0.1, 0.4], [0.02, -0.2], [0.14, -0.6]],
      [[-1.25, 1.1], [-0.12, 0.45], [0, -0.2], [-0.08, -0.98]],
      [[-1.4, 1.5], [-0.14, 0.5], [0.03, -0.2], [0.24, -1.18]],
    ];
    const starts = [t.help - 6, t.help + 6, t.help + 18];
    paths.forEach((p, i) => {
      if (F < starts[i] - 1) return;
      markers.push({ p: walk(F, starts[i], p, 0.026), a: 1 });
    });
  }

  // the cockpit glow: cool screen light, calm white at the end
  const glowCol = new THREE.Color("#7fb0ff").lerp(new THREE.Color("#fff6ea"), st.calm);
  const redI = st.red;
  const leak = redI * (1 - clamp01((st.angle / OPEN) * 4));

  // labels
  const L = (s: number, d = 20) => prog(F, s, d, ease.out);
  const out = (s: number, d = 16) => 1 - prog(F, s, d, ease.inOut);

  return (
    <>
      <World3D cam={cam} background={bg} fog={[80, 900]}>
        <Studio sun={[6, 9, 6]} intensity={0} hdri="captain-smit/hdris/brown_photostudio_02_1k.hdr" hdriStrength={0.4} sky="#e6ecf7" groundColor="#3a3632" />
        <directionalLight
          position={[7, 9, 6]}
          intensity={2.1}
          castShadow
          shadow-mapSize={[4096, 4096]}
          shadow-camera-left={-22}
          shadow-camera-right={22}
          shadow-camera-top={22}
          shadow-camera-bottom={-22}
          shadow-camera-near={0.5}
          shadow-camera-far={60}
          shadow-bias={-0.0004}
          shadow-normalBias={0.02}
          shadow-radius={5}
        />
        {/* the desert far below */}
        <Floor y={-260} size={8000} color="#1f1b17" />

        {/* fuselage: the forward shell, cut away on +x, and the whole aft shell */}
        <group position={[0, AXIS_Y, 0]} rotation-x={Math.PI / 2}>
          <mesh geometry={g.fwd} castShadow receiveShadow>
            <meshStandardMaterial color={WHITE} roughness={0.42} metalness={0.05} side={THREE.DoubleSide} />
          </mesh>
          <mesh geometry={g.aft} castShadow receiveShadow>
            <meshStandardMaterial color={WHITE} roughness={0.42} metalness={0.05} side={THREE.DoubleSide} />
          </mesh>
          <mesh geometry={g.wsL}>
            <meshStandardMaterial color="#1c222b" roughness={0.15} metalness={0.4} side={THREE.DoubleSide} />
          </mesh>
          <mesh geometry={g.wsC}>
            <meshStandardMaterial color="#1c222b" roughness={0.15} metalness={0.4} side={THREE.DoubleSide} />
          </mesh>
        </group>
        <Windows />
        <Wing geo={g.wing} side={1} y={-0.5} dihedral={0.1} />
        <Wing geo={g.wing} side={-1} y={-0.5} dihedral={0.1} />
        <Wing geo={g.stab} side={1} y={1.05} dihedral={0.12} />
        <Wing geo={g.stab} side={-1} y={1.05} dihedral={0.12} />
        <mesh geometry={g.fin} castShadow receiveShadow>
          <meshStandardMaterial color={WHITE} roughness={0.45} side={THREE.DoubleSide} />
        </mesh>
        <Engine x={4.9} />
        <Engine x={-4.9} />

        {/* floors: the flight deck and the cabin */}
        <mesh position={[0, -0.05, -0.75]} receiveShadow>
          <boxGeometry args={[1.7, 0.1, 1.4]} />
          <meshStandardMaterial color="#3b3f46" roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.05, 0.48]} receiveShadow>
          <boxGeometry args={[2.8, 0.1, 1.06]} />
          <meshStandardMaterial color="#47505e" roughness={0.95} />
        </mesh>
        <mesh position={[0, -0.05, 15.5]} receiveShadow>
          <boxGeometry args={[3.16, 0.1, 29]} />
          <meshStandardMaterial color="#47505e" roughness={0.95} />
        </mesh>
        <Seats />

        {/* the forward bulkhead with the door opening, and the door frame */}
        <mesh geometry={g.bulk} position={[0, 0, WALL_Z0]} castShadow receiveShadow>
          <meshStandardMaterial color="#b9b4aa" roughness={0.75} side={THREE.DoubleSide} />
        </mesh>
        {/* hinge-side trim and header, standing proud of the wall */}
        <mesh position={[HINGE_X - 0.04, DOOR_H / 2 + 0.04, -0.005]} castShadow receiveShadow>
          <boxGeometry args={[0.07, DOOR_H + 0.08, 0.07]} />
          <meshStandardMaterial color="#6f767f" roughness={0.5} metalness={0.4} />
        </mesh>
        <mesh position={[0.005, DOOR_H + 0.045, -0.005]} castShadow receiveShadow>
          <boxGeometry args={[DOOR_W + 0.09, 0.07, 0.07]} />
          <meshStandardMaterial color="#6f767f" roughness={0.5} metalness={0.4} />
        </mesh>
        {/* latch-side post behind the door, and the three keepers the bolts slide into */}
        <mesh position={[LATCH_X + 0.045, DOOR_H / 2 + 0.04, (WALL_Z0 - 0.02) / 2]} castShadow receiveShadow>
          <boxGeometry args={[0.075, DOOR_H + 0.08, -WALL_Z0 - 0.02 + 0.0]} />
          <meshStandardMaterial color="#6f767f" roughness={0.5} metalness={0.4} />
        </mesh>
        {BOLT_Y.map((y) => (
          <mesh key={y} position={[LATCH_X + 0.05, y + 0.01, 0.022]} castShadow>
            <boxGeometry args={[0.07, 0.07, 0.086]} />
            <meshStandardMaterial color="#7d848e" roughness={0.4} metalness={0.7} />
          </mesh>
        ))}

        {/* the red light leaking round the door edges (seen from the cabin while the alert is on) */}
        {leak > 0.01 && (
          <mesh position={[0.0025, 0.01 + DOOR_H / 2, 0.067]}>
            <planeGeometry args={[DOOR_W + 0.22, DOOR_H + 0.22]} />
            <meshBasicMaterial color="#ff2a2a" alphaMap={RIM ?? undefined} transparent opacity={Math.min(1, leak)} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        )}

        <Door angle={st.angle} lamp={st.lamp} layers={st.layers} lever={st.lever} bolts={st.bolts} leverColor={accent} />

        {/* the flight deck: instrument panel with screens, glare shield, the red alert light, the cockpit glow */}
        <mesh position={[0, 0.98, -1.48]} castShadow receiveShadow>
          <boxGeometry args={[1.5, 0.5, 0.2]} />
          <meshStandardMaterial color="#2c3036" roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.27, -1.5]} castShadow>
          <boxGeometry args={[1.56, 0.07, 0.36]} />
          <meshStandardMaterial color="#23262b" roughness={0.8} />
        </mesh>
        {[-0.55, -0.2, 0.2, 0.55].map((x) => (
          <mesh key={x} position={[x, 0.99, -1.375]}>
            <planeGeometry args={[0.28, 0.3]} />
            <meshStandardMaterial color="#0e1420" emissive={glowCol} emissiveIntensity={0.9 + 0.3 * st.calm} />
          </mesh>
        ))}
        <mesh position={[0, 0.42, -1.2]} castShadow receiveShadow>
          <boxGeometry args={[0.32, 0.84, 0.5]} />
          <meshStandardMaterial color="#2a2d33" roughness={0.8} />
        </mesh>
        <pointLight position={[0, 1.15, -1.0]} color={glowCol} intensity={0.8 + 1.2 * st.calm} distance={3.5} decay={2} />
        {/* the alert light on the flight-deck ceiling */}
        <mesh position={[0, 2.2, -0.7]}>
          <cylinderGeometry args={[0.08, 0.08, 0.05, 24]} />
          <meshStandardMaterial color="#3a3d44" roughness={0.6} />
        </mesh>
        <mesh position={[0, 2.15, -0.7]}>
          <sphereGeometry args={[0.055, 24, 16]} />
          <meshStandardMaterial color={redI > 0.02 ? "#ff3b3b" : "#5a3a3a"} emissive="#ff2020" emissiveIntensity={redI * 4} />
        </mesh>
        {redI > 0.01 && <pointLight position={[0, 2.0, -0.7]} color="#ff2a2a" intensity={redI * 3} distance={2.2} decay={2} />}

        {/* the arrows */}
        {sets.map((s, i) => (
          <group key={i}>
            {[[-0.02, 0.55], [-0.02, 1.0], [-0.02, 1.45]].map(([x, y]) => (
              <Arrow key={y} x={x} y={y} tip={s.tip} len={s.len} a={s.a} />
            ))}
          </group>
        ))}

        {markers.map((m, i) => <Marker key={i} p={m.p} a={m.a} />)}
      </World3D>

      {/* labels */}
      {mode === "door" && (
        <>
          <Label cam={cam} p={[HINGE_X, DOOR_H + 0.12, 0.03]} dy={-30} a={L(t.american) * out(t.handgun)} text="US rule (FAA)" plate size={44} />
          <Label cam={cam} p={[0, 0.2, 0.25]} dy={40} a={L(t.forced) * out(t.handgun)} text="resists forced entry" size={46} />
          <Label cam={cam} p={[LATCH_X, 1.55, 0]} dy={-150} a={L(t.bullets + 6) * out(t.inside2 - 12)} text="stops handgun rounds" size={46} color="#ffd59a" />
          <Label cam={cam} p={[0.26, 1.05, -0.08]} dy={150} a={L(t.inside2)} text="unlocks only from inside" size={46} />
        </>
      )}
      {mode === "captain" && (
        <TitleCard a1={prog(F, t.machchhar, 20, ease.out) * (1 - prog(F, t.injured, 24, ease.inOut))} a2={prog(F, t.mumbai, 20, ease.out)} />
      )}
    </>
  );
};

// a glow frame for the red light leaking round the door: bright at the door's edge, fading out, dark in the middle
const RIM = (() => {
  if (typeof document === "undefined") return null;
  const W = 220, H = 422; // the plane is (0.8 + 0.22) x (1.9 + 0.22) m
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, W, H);
  const ex = (0.11 / 1.02) * W, ey = (0.11 / 2.12) * H; // the door's edge inside the plane
  g.shadowColor = "#fff";
  g.shadowBlur = 16;
  g.strokeStyle = "#fff";
  g.lineWidth = 5;
  g.strokeRect(ex, ey, W - 2 * ex, H - 2 * ey);
  g.shadowBlur = 0;
  g.fillStyle = "#000";
  g.fillRect(ex + 4, ey + 4, W - 2 * ex - 8, H - 2 * ey - 8);
  return new THREE.CanvasTexture(c);
})();
