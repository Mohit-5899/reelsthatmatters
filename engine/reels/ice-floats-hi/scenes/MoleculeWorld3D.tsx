// World 2: water molecules, drawn big. Scale 1 angstrom = 0.1 m (1 pm = 1 mm) for every length, so O-O 275 pm is
// 0.275 m and O-H 101 pm is 0.101 m. A molecule = a red oxygen, two white hydrogens at the 104.5 deg bend, white
// O-H sticks; a hydrogen bond = a thin pale-blue line from a hydrogen to the next molecule's oxygen.
// Shared by liquid, cage and roomy: ONE world drawn from the reel's frame, so the handovers are one continuous picture.
// 96 molecules (the ice block is 4 bilayers of 24, 7 hexagonal channels); all spheres and lines are instanced.
//   liquid "zoom" the camera flies in; "tumble" they turn and the column shears so neighbours slide past each other;
//          "bonds" hydrogen bonds show; "break" they flick on and off; "trillionth" the flicker quickens.
//   cage   "Freeze" each molecule eases to its ice Ih site (eased, 1.4 s) and turns so its hydrogens point along two
//          of its four bonds (ice rules: one H per bond); "oxygen" one oxygen glows and the camera comes close;
//          "four" its four bonds light, with the O-O 275 pm label; "rings" the camera rises to look down the c-axis and
//          the ring of six lights; "layer" the four bilayers light in turn, bottom to top.
//   roomy  "cage" the open hexagonal channels are tinted; "farther" the camera turns side-on and a glass column is
//          drawn round the ice; "liquid" the same 96 molecules as liquid, in the same column, beside it; "same" both
//          columns are counted; "takes" a level line runs from the liquid's top; "nine" the extra 9% is tinted.
// Times are word cues in 60 fps frames (a 30 fps draft is scaled by 60/fps so it plays the same). No useFrame.
import React, { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { useCurrentFrame } from "remotion";
import { type Cam, type V3, ease, orbit, prog, project, spline, useReel } from "../../../src/engine";
import { Studio, World3D } from "../../../src/engine/three";
import {
  BEND, ICE_H, LAT, LIQ_H, R_OH, RC, type P3, add, hash, len, lerp3, liquidPos, matchAt, mul, norm, sub, WOBBLE,
  latticeFrame,
} from "./moleculeLattice";

export type MoleculeMode = "liquid" | "cage" | "roomy";

const N = LAT.n;
const R_O = 0.065; // drawn radii (ball and stick): smaller than space-filling so the cage stays readable
const R_H = 0.038;
const R_STICK = 0.016;
const R_HB = 0.0065;
const O_COL = new THREE.Color("#e5484d");
const H_COL = new THREE.Color("#f4f4f4");
const HB_COL = new THREE.Color("#8fd0ff");
const GOLD = new THREE.Color("#ffd166");
const SIDE = 2 * RC + 0.2; // centre-to-centre gap of the two columns in roomy

// ---------- times ----------
type T = Record<string, number>;
function useTimes(): T {
  const { tl } = useReel();
  return useMemo(() => {
    const k = 60 / tl.fps;
    const idx = (id: string) => tl.scenes.findIndex((s) => s.id === id);
    const L = idx("liquid"), G = idx("cage"), R = idx("roomy");
    const c = (w: string, s: number, nth = 1) => tl.cue(w, nth, s) * k;
    return {
      start: tl.scenes[L].from * k, zoom: c("zoom", L), tumble: c("tumble", L), bonds: c("bonds", L), brk: c("break", L),
      tril: c("trillionth", L), still: c("still", L),
      freeze: c("freeze", G), oxygen: c("oxygen", G), four: c("four", G), cbonds: c("bonds", G), rings: c("rings", G),
      six: c("six", G), layer: c("layer", G), layer2: c("layer", G, 2),
      cage: c("cage", R), farther: c("farther", R), liquid: c("liquid", R), same: c("same", R), takes: c("takes", R),
      nine: c("nine", R), space: c("space", R), end: tl.scenes[R].to * k,
    };
  }, [tl]);
}

/** integral (in seconds) of a rate that is piecewise linear between keys [frame, rate per second] */
function integ(F: number, keys: [number, number][]): number {
  const rate = (x: number) => {
    if (x <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) if (x <= keys[i][0]) {
      const [a, ra] = keys[i - 1], [b, rb] = keys[i];
      return ra + ((rb - ra) * (x - a)) / Math.max(1e-6, b - a);
    }
    return keys[keys.length - 1][1];
  };
  if (F <= 0) return 0;
  let acc = 0, x0 = 0, r0 = rate(0);
  for (const x1 of [...keys.map((k) => k[0]).filter((x) => x > 0 && x < F), F]) {
    const r1 = rate(x1);
    acc += ((x1 - x0) * (r0 + r1)) / 2;
    x0 = x1; r0 = r1;
  }
  return acc / 60;
}

const smooth = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

// ---------- camera ----------
const C0: P3 = [0, ICE_H / 2, 0];
const STAR = LAT.o[LAT.star];
const Y_SIDE = 2.9; // the yaw the side-by-side columns are laid out for
const RIGHT: P3 = [Math.cos(Y_SIDE), 0, -Math.sin(Y_SIDE)];
const COPY: P3 = mul(RIGHT, -SIDE); // the liquid column sits to the left of the ice on screen

function camera(F: number, t: T): Cam {
  const yawStar = Math.atan2(STAR[0], STAR[2]);
  const yaw = spline(F, [[t.start, 0.6], [t.zoom, 0.62], [t.tumble, 0.95], [t.still, 1.45], [t.freeze, 1.62], [t.oxygen, 1.9],
    [t.four, yawStar], [t.cbonds, yawStar + 0.1], [t.rings, yawStar + 0.2], [t.layer, 2.4], [t.layer2, 2.5], [t.cage, 2.6],
    [t.farther, 2.72], [t.liquid, 2.84], [t.same, Y_SIDE], [t.end, Y_SIDE + 0.04]]);
  const pitch = spline(F, [[t.start, 0.16], [t.zoom, 0.17], [t.tumble, 0.22], [t.still, 0.3], [t.freeze, 0.32], [t.oxygen, 0.5],
    [t.four, 0.72], [t.cbonds, 1.0], [t.rings, 1.32], [t.six, 1.38], [t.layer, 0.9], [t.layer2, 0.55], [t.cage, 0.5],
    [t.farther, 0.4], [t.liquid, 0.16], [t.same, 0.1], [t.end, 0.09]]);
  const dist = spline(F, [[t.start, 11], [t.zoom, 10.6], [t.tumble, 4.4], [t.still, 3.8], [t.freeze, 3.7], [t.oxygen, 3.0],
    [t.four, 1.55], [t.cbonds, 2.3], [t.rings, 3.3], [t.six, 3.4], [t.layer, 3.6], [t.layer2, 3.75], [t.cage, 3.7],
    [t.farther, 4.6], [t.liquid, 6.2], [t.same, 6.4], [t.end, 6.5]]);
  const wStar = spline(F, [[t.freeze, 0], [t.oxygen, 0.15], [t.four, 1], [t.cbonds, 0.75], [t.rings, 0]]);
  const wSide = spline(F, [[t.cage, 0], [t.farther, 0.05], [t.liquid, 1]]);
  const at = add(lerp3(C0, STAR, Math.max(0, wStar)), mul(COPY, 0.5 * Math.max(0, wSide))) as V3;
  return { eye: orbit(at, yaw, pitch, dist), at, focal: 1500, cx: 540, cy: 960 };
}

// ---------- per-frame state ----------
type Mol = { o: P3; h: [P3, P3]; s: number };
type Bond = { a: P3; b: P3; s: number; hi: number }; // from a hydrogen to an oxygen; s 0..1 how much is drawn

const Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), M4 = new THREE.Matrix4(), V = new THREE.Vector3();
const LOCAL_H: [THREE.Vector3, THREE.Vector3] = [
  new THREE.Vector3(Math.sin(BEND / 2) * R_OH, Math.cos(BEND / 2) * R_OH, 0),
  new THREE.Vector3(-Math.sin(BEND / 2) * R_OH, Math.cos(BEND / 2) * R_OH, 0),
];
// each lattice site's orientation: its hydrogens along two of its four bonds
const SITE_Q: THREE.Quaternion[] = Array.from({ length: N }, (_, j) => {
  const [b, p] = latticeFrame(j);
  const z = new THREE.Vector3(...p).cross(new THREE.Vector3(...b));
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...p), new THREE.Vector3(...b), z));
});
function liquidQ(i: number, phi: number, out: THREE.Quaternion) {
  const w = WOBBLE[i];
  out.set(w.q0[0], w.q0[1], w.q0[2], w.q0[3]);
  Q2.setFromAxisAngle(V.set(...w.axis), w.w * phi);
  return out.multiply(Q2);
}
function hOf(o: P3, q: THREE.Quaternion): [P3, P3] {
  return LOCAL_H.map((l) => { V.copy(l).applyQuaternion(q); return [o[0] + V.x, o[1] + V.y, o[2] + V.z] as P3; }) as [P3, P3];
}

/** liquid hydrogen bonds: each hydrogen to the nearest other oxygen within reach, flicking on and off */
function liquidBonds(m: Mol[], psi: number, pOn: number, k: number, salt: number): Bond[] {
  const out: Bond[] = [];
  if (k <= 0) return out;
  for (let i = 0; i < m.length; i++)
    for (let h = 0; h < 2; h++) {
      const H = m[i].h[h];
      let best = -1, bd = 0.25;
      for (let j = 0; j < m.length; j++) {
        if (j === i) continue;
        const d = len(sub(m[j].o, H));
        if (d < bd) { bd = d; best = j; }
      }
      if (best < 0) continue;
      const ph = psi + hash(i, h, 99 + salt);
      const win = Math.floor(ph), u = ph - win;
      const on = hash(i * 2 + h, win, 7 + salt) < pOn ? 1 : 0;
      const s = on * smooth(u / 0.16) * smooth((1 - u) / 0.16) * k * Math.min(m[i].s, m[best].s);
      if (s > 0.01) out.push({ a: H, b: m[best].o, s, hi: 0 });
    }
  return out;
}

function state(F: number, t: T, site: number[]) {
  // liquid motion runs on its own clock: slow at first, full tumble from "tumble"
  const phi = integ(F, [[t.zoom, 0.45], [t.tumble, 0.45], [t.tumble + 40, 1.0]]);
  const psi = integ(F, [[t.bonds, 0.3], [t.brk, 0.3], [t.brk + 30, 1.4], [t.tril, 1.4], [t.tril + 30, 3.6]]);
  const pOn = 0.92 - 0.3 * prog(F, t.brk, 12);
  const e = prog(F, t.freeze, 84, ease.inOut); // the freeze
  const bondsIn = prog(F, t.bonds, 30, ease.out);

  // the main set: liquid, then frozen into the lattice
  const inv = new Array(N);
  site.forEach((j, i) => { inv[j] = i; });
  const main: Mol[] = [];
  for (let i = 0; i < N; i++) {
    const o = e > 0 ? lerp3(liquidPos(i, phi), LAT.o[site[i]], e) : liquidPos(i, phi);
    liquidQ(i, phi, Q);
    if (e > 0) Q.slerp(SITE_Q[site[i]], e);
    main.push({ o, h: hOf(o, Q), s: 1 });
  }

  // highlights (cage)
  const star = inv[LAT.star];
  const starOn = prog(F, t.oxygen, 18) * (1 - prog(F, t.layer, 30));
  const fourOn = prog(F, t.four, 20) * (1 - prog(F, t.rings + 20, 30));
  const ringOn = prog(F, t.rings + 6, 24) * (1 - prog(F, t.layer2 + 10, 40));
  const ring = new Set(LAT.starRing.map((j) => inv[j]));
  const step = Math.max(14, (t.layer2 + 24 - t.layer) / 3);
  // the bilayers light one after another, bottom to top, and stay lit until the stack is complete
  const layerOn = [0, 1, 2, 3].map((k) => prog(F, t.layer + k * step, 14, ease.out) * (1 - prog(F, t.layer2 + 60, 40, ease.inOut)));

  const bonds: Bond[] = liquidBonds(main, psi, pOn, bondsIn * (1 - smooth((e - 0.1) / 0.5)), 0);
  const lat = smooth((e - 0.5) / 0.5);
  if (lat > 0)
    for (let i = 0; i < N; i++)
      for (let h = 0; h < 2; h++) {
        const accSite = LAT.hTo[site[i]][h];
        if (accSite < 0) continue;
        const j = inv[accSite];
        let hi = 0;
        if (i === star || j === star) hi = Math.max(hi, fourOn);
        if (ring.has(i) && ring.has(j)) hi = Math.max(hi, ringOn);
        const li = LAT.layer[site[i]];
        if (li === LAT.layer[accSite]) hi = Math.max(hi, 0.75 * layerOn[li]);
        bonds.push({ a: main[i].h[h], b: main[j].o, s: lat, hi });
      }

  // roomy: the same molecules again, as liquid, in the column to the left
  const copyIn = (i: number) => prog(F, t.liquid + (hash(i, 3) * 22), 20, ease.out);
  const copy: Mol[] = [];
  if (F >= t.liquid) {
    for (let i = 0; i < N; i++) {
      const o = add(liquidPos(i, phi), COPY);
      liquidQ(i, phi, Q);
      copy.push({ o, h: hOf(o, Q), s: copyIn(i) });
    }
    const psiC = integ(F, [[t.liquid, 3.0]]) + 50;
    bonds.push(...liquidBonds(copy, psiC, 0.62, 1, 5));
  }

  // per-oxygen glow: the star, its ring, the layer pulse
  const glow = main.map((_, i) => {
    let g = 0;
    if (i === star) g = Math.max(g, starOn);
    if (ring.has(i)) g = Math.max(g, ringOn * 0.8);
    return g;
  });
  const tint = main.map((_, i) => Math.max(glow[i], 0.5 * layerOn[LAT.layer[site[i]]]));
  return { main, copy, bonds, glow, tint, e, star, starOn };
}

// ---------- instanced drawing ----------
const UP = new THREE.Vector3(0, 1, 0);
function setSphere(m: THREE.InstancedMesh, k: number, p: P3, r: number) {
  M4.compose(V.set(p[0], p[1], p[2]), Q.identity(), new THREE.Vector3(r, r, r));
  m.setMatrixAt(k, M4);
}
const S3 = new THREE.Vector3();
function setRod(m: THREE.InstancedMesh, k: number, a: P3, b: P3, r: number) {
  const d = sub(b, a), l = len(d);
  Q.setFromUnitVectors(UP, V.set(d[0] / l, d[1] / l, d[2] / l));
  M4.compose(V.set(a[0], a[1], a[2]), Q, S3.set(r, l, r));
  m.setMatrixAt(k, M4);
}

const Instanced: React.FC<{ mesh: THREE.InstancedMesh; fill: (m: THREE.InstancedMesh) => number }> = ({ mesh, fill }) => {
  useLayoutEffect(() => {
    mesh.count = fill(mesh);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });
  return <primitive object={mesh} />;
};

function makeMeshes() {
  const sphere = new THREE.SphereGeometry(1, 28, 20);
  const rod = new THREE.CylinderGeometry(1, 1, 1, 10, 1).translate(0, 0.5, 0);
  const shiny = (c: string) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25 });
  const mk = (g: THREE.BufferGeometry, m: THREE.Material, n: number, shadow = true) => {
    const x = new THREE.InstancedMesh(g, m, n);
    x.frustumCulled = false;
    x.castShadow = shadow;
    x.receiveShadow = shadow;
    for (let i = 0; i < n; i++) x.setColorAt(i, new THREE.Color("#ffffff"));
    return x;
  };
  const glowMat = new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending });
  return {
    o: mk(sphere, shiny("#ffffff"), 2 * N),
    h: mk(sphere, shiny("#ffffff"), 4 * N),
    stick: mk(rod, shiny("#e9e9e9"), 4 * N),
    hb: mk(rod, new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.5, emissive: "#16324a" }), 8 * N, false),
    halo: mk(sphere, glowMat, N, false),
  };
}

// ---------- the world ----------
export const MoleculeWorld3D: React.FC<{ mode: MoleculeMode }> = () => {
  const { tl, theme } = useReel();
  const t = useTimes();
  const F = useCurrentFrame() * (60 / tl.fps);
  const site = useMemo(() => matchAt(integ(t.freeze, [[t.zoom, 0.45], [t.tumble, 0.45], [t.tumble + 40, 1.0]])), [t]);
  const meshes = useMemo(makeMeshes, []);
  const cam = camera(F, t);
  const S = state(F, t, site);
  const dist = len(sub(cam.eye as P3, cam.at as P3));
  const ground = theme.grounds.dark;
  const accent = theme.marker.color;

  const all = [...S.main, ...S.copy];
  const col = new THREE.Color();

  // roomy pieces
  const chan = prog(F, t.cage, 30, ease.inOut) * (1 - 0.55 * prog(F, t.same, 40, ease.inOut));
  const iceGlass = prog(F, t.farther + 10, 30, ease.inOut);
  const liqGlass = prog(F, t.liquid, 30, ease.inOut);
  const level = prog(F, t.takes, 34, ease.inOut);
  const extra = prog(F, t.nine, 24, ease.out);

  // labels
  const P = (p: P3) => project(cam, p as V3);
  const legend = prog(F, t.bonds, 18) * (1 - prog(F, t.freeze, 30));
  const fs = prog(F, t.tril, 18) * (1 - prog(F, t.freeze, 30));
  const pm = prog(F, t.four + 6, 18) * (1 - prog(F, t.rings, 20));
  const nb = LAT.edges.find(([i, j]) => (i === LAT.star && LAT.starRing.includes(j)) || (j === LAT.star && LAT.starRing.includes(i)))!;
  const pmAt = P(lerp3(LAT.o[nb[0]], LAT.o[nb[1]], 0.5));
  const nameIce = prog(F, t.farther + 10, 24);
  const nameLiq = prog(F, t.liquid + 6, 24);
  const counts = prog(F, t.same, 20);
  const iceFoot = P([0, -0.12, 0]);
  const liqFoot = P(add(COPY, [0, -0.12, 0]));
  const plusAt = P([0, ICE_H + 0.02, 0]);
  const label = (o: number): React.CSSProperties => ({
    position: "absolute", opacity: o, color: ground.ink, font: `600 40px ${theme.font.ui}`, whiteSpace: "nowrap",
    textShadow: "0 2px 14px rgba(0,0,0,0.85)", transform: `translate(-50%, -50%) translateY(${(1 - o) * 10}px)`,
  });

  return (
    <>
      <World3D cam={cam} background={ground.bg} fog={[dist + 0.4, dist + 5]}>
        <Studio sun={[3, 6, 4]} intensity={2.3} sky="#dfe8ff" groundColor="#2a2622" />
        <directionalLight position={[-4, 2, -5]} intensity={0.6} color="#9ec9ff" />
        <Instanced mesh={meshes.o} fill={(m) => {
          all.forEach((x, k) => {
            setSphere(m, k, x.o, R_O * x.s);
            const g = k < N ? S.tint[k] : 0;
            m.setColorAt(k, col.copy(O_COL).lerp(GOLD, g * 0.55));
          });
          return all.length;
        }} />
        <Instanced mesh={meshes.h} fill={(m) => {
          all.forEach((x, k) => { setSphere(m, 2 * k, x.h[0], R_H * x.s); setSphere(m, 2 * k + 1, x.h[1], R_H * x.s); m.setColorAt(2 * k, H_COL); m.setColorAt(2 * k + 1, H_COL); });
          return 2 * all.length;
        }} />
        <Instanced mesh={meshes.stick} fill={(m) => {
          all.forEach((x, k) => { setRod(m, 2 * k, x.o, x.h[0], R_STICK * x.s); setRod(m, 2 * k + 1, x.o, x.h[1], R_STICK * x.s); });
          return 2 * all.length;
        }} />
        <Instanced mesh={meshes.hb} fill={(m) => {
          let k = 0;
          for (const b of S.bonds) {
            // from the hydrogen's surface to the oxygen's surface, growing out of the hydrogen
            const d = norm(sub(b.b, b.a));
            const a = add(b.a, mul(d, R_H * 0.9));
            const full = len(sub(b.b, b.a)) - R_H * 0.9 - R_O * 0.9;
            if (full <= 0.005) continue;
            const end = add(a, mul(d, full * b.s));
            setRod(m, k, a, end, R_HB * (0.5 + 0.5 * b.s) * (1 + 0.9 * b.hi));
            m.setColorAt(k, col.copy(HB_COL).lerp(GOLD, b.hi));
            k++;
          }
          return k;
        }} />
        <Instanced mesh={meshes.halo} fill={(m) => {
          let k = 0;
          S.main.forEach((x, i) => {
            const g = i === S.star ? Math.max(S.starOn, S.glow[i]) : S.glow[i];
            if (g < 0.02) return;
            setSphere(m, k, x.o, R_O * (1.35 + 0.9 * g));
            m.setColorAt(k, col.copy(GOLD).multiplyScalar(g));
            k++;
          });
          return k;
        }} />
        {/* the open hexagonal channels of the cage, tinted on "cage" */}
        {chan > 0.01 && LAT.channels.map(([x, z], i) => (
          <mesh key={i} position={[x, ICE_H / 2, z]}>
            <cylinderGeometry args={[0.17, 0.17, ICE_H * 0.98, 6, 1, false]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.5} transparent opacity={0.28 * chan} depthWrite={false} />
          </mesh>
        ))}
        {/* the glass columns: same width, the ice one 9% taller */}
        {iceGlass > 0.01 && <Column at={[0, 0, 0]} h={ICE_H} o={iceGlass} />}
        {liqGlass > 0.01 && <Column at={COPY} h={LIQ_H} o={liqGlass} />}
        {level > 0.01 && (() => {
          // the level line runs from the liquid's top across to the ice column
          const a = add(COPY, mul(RIGHT, -RC - 0.08)), b = mul(RIGHT, RC + 0.08);
          const p0: P3 = [a[0], LIQ_H, a[2]];
          const p1 = lerp3(p0, [b[0], LIQ_H, b[2]], level);
          const mid = lerp3(p0, p1, 0.5), l = len(sub(p1, p0));
          return (
            <mesh position={mid} rotation={[0, Math.atan2(-RIGHT[2], RIGHT[0]), Math.PI / 2]}>
              <cylinderGeometry args={[0.007, 0.007, l, 8]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          );
        })()}
        {extra > 0.01 && (
          <mesh position={[0, LIQ_H + ((ICE_H - LIQ_H) * extra) / 2, 0]}>
            <cylinderGeometry args={[RC + 0.006, RC + 0.006, (ICE_H - LIQ_H) * extra, 64, 1, true]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.6} transparent opacity={0.45} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        )}
      </World3D>

      {/* liquid: the legend, then the time scale */}
      {legend > 0.01 && (
        <div style={{ ...label(legend), left: 540, top: 600, display: "flex", alignItems: "center", gap: 22 }}>
          <span style={{ display: "inline-block", width: 70, height: 6, borderRadius: 3, background: "#8fd0ff" }} />
          hydrogen bond
        </div>
      )}
      {fs > 0.01 && (
        <div style={{ ...label(fs), left: 540, top: 1560, textAlign: "center", lineHeight: "52px" }}>
          breaks and re-forms in<br />under 200 femtoseconds
        </div>
      )}
      {pm > 0.01 && (
        <div style={{ ...label(pm), left: pmAt.x, top: pmAt.y - 150, color: "#ffd166" }}>O–O 275 pm</div>
      )}
      {nameIce > 0.01 && (
        <div style={{ ...label(nameIce), left: iceFoot.x, top: iceFoot.y + 40, textAlign: "center", lineHeight: "50px" }}>
          ice{counts > 0.01 && <div style={{ opacity: counts, font: `500 36px ${theme.font.ui}`, color: ground.dim }}>96 molecules</div>}
        </div>
      )}
      {nameLiq > 0.01 && (
        <div style={{ ...label(nameLiq), left: liqFoot.x, top: liqFoot.y + 40, textAlign: "center", lineHeight: "50px" }}>
          liquid{counts > 0.01 && <div style={{ opacity: counts, font: `500 36px ${theme.font.ui}`, color: ground.dim }}>96 molecules</div>}
        </div>
      )}
      {extra > 0.01 && (
        <div style={{ ...label(extra), left: plusAt.x, top: plusAt.y - 50, color: accent, font: `700 56px ${theme.font.ui}` }}>+9% space</div>
      )}
    </>
  );
};

/** a clear glass column with bright rims, standing on y = 0 */
const Column: React.FC<{ at: P3; h: number; o: number }> = ({ at, h, o }) => (
  <group position={at}>
    <mesh position={[0, h / 2, 0]}>
      <cylinderGeometry args={[RC, RC, h, 64, 1, true]} />
      <meshPhysicalMaterial color="#cfe6ff" roughness={0.1} transparent opacity={0.1 * o} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
    {[0, h].map((y) => (
      <mesh key={y} position={[0, y, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[RC, 0.006, 8, 96]} />
        <meshBasicMaterial color="#cfe6ff" transparent opacity={0.8 * o} />
      </mesh>
    ))}
    <mesh position={[0, -0.004, 0]} rotation-x={-Math.PI / 2}>
      <circleGeometry args={[RC, 64]} />
      <meshStandardMaterial color="#cfe6ff" transparent opacity={0.12 * o} depthWrite={false} />
    </mesh>
  </group>
);

