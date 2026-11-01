// Pure geometry for the molecule world (no React, no Three.js): the ice Ih lattice, the proton arrangement that obeys
// the ice rules, and the liquid that freezes into it. Scale: 1 angstrom = 0.1 m (so 1 pm = 1 mm), applied uniformly.
//
// Ice Ih is the wurtzite arrangement of oxygens, c-axis along world y. With the O-O distance d:
//   a = d * sqrt(8/3), c = 8d/3 (ideal tetrahedra), so every oxygen has four neighbours at 109.47 deg.
// Looking down y the oxygens project onto a honeycomb (hexagonal rings of six) and the hexagon centres are open
// channels. The bilayers stack ABAB along c.

export type P3 = [number, number, number];

export const ANG = 0.1; // metres per angstrom
export const D_OO = 2.75 * ANG; // facts.md: O-O about 275 pm in ice
export const R_OH = 1.01 * ANG; // facts.md: O-H about 101 pm
export const BEND = (104.5 * Math.PI) / 180; // facts.md: bend of the free molecule about 104.5 deg (104.48)
export const VOLUME_RATIO = 0.99984 / 0.9167; // facts.md: 1.0907, ice takes about 9% more space
export const A = D_OO * Math.sqrt(8 / 3);
export const C = (8 * D_OO) / 3;
export const BILAYERS = 4;
export const ICE_H = (BILAYERS * C) / 2; // height of the ice block (one bilayer is c/2 thick)
export const SHELL = 1.53 * A; // honeycomb sites kept within this distance of the central channel: 7 full rings
export const RC = SHELL + 1.3 * ANG; // radius of the column the molecules fill (ice and liquid alike)
export const LIQ_H = ICE_H / VOLUME_RATIO; // the same molecules as liquid, in the same column: 9% less height

// ---------- seeded randomness ----------
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** a hash of a few integers to [0, 1) */
export function hash(a: number, b: number, c = 0): number {
  let h = Math.imul(a + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x27d4eb2f, 0xc2b2ae35) ^ Math.imul(c + 0x165667b1, 0x27d4eb2d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

// ---------- small vector helpers ----------
export const add = (a: P3, b: P3): P3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: P3, b: P3): P3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: P3, k: number): P3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: P3, b: P3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const len = (a: P3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: P3): P3 => mul(a, 1 / (len(a) || 1));
export const cross = (a: P3, b: P3): P3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const lerp3 = (a: P3, b: P3, t: number): P3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ---------- the lattice ----------
type Site = { p: P3; fz: number; s: 1 | 2; layer: number };

/** every oxygen site of an (unbounded in x/z) slab, fractional heights fz from z0 to z1 (in units of c) */
function sites(radius: number, z0: number, z1: number): Site[] {
  const out: Site[] = [];
  const n = Math.ceil(radius / A) + 2;
  const a1: [number, number] = [A, 0];
  const a2: [number, number] = [A / 2, (A * Math.sqrt(3)) / 2];
  // wurtzite basis with 60 deg cell vectors: S1 at (1/3,1/3) heights 0 and 3/8; S2 at (2/3,2/3) heights 1/2 and 7/8
  const basis: [number, number, number, 1 | 2][] = [[1 / 3, 1 / 3, 0, 1], [1 / 3, 1 / 3, 3 / 8, 1], [2 / 3, 2 / 3, 1 / 2, 2], [2 / 3, 2 / 3, 7 / 8, 2]];
  for (let k = Math.floor(z0) - 1; k <= Math.ceil(z1) + 1; k++)
    for (let i = -n; i <= n; i++)
      for (let j = -n; j <= n; j++)
        for (const [fx, fy, fz0, s] of basis) {
          const fz = k + fz0;
          if (fz < z0 - 1e-6 || fz > z1 + 1e-6) continue;
          const x = (i + fx) * a1[0] + (j + fy) * a2[0];
          const z = (i + fx) * a1[1] + (j + fy) * a2[1];
          if (Math.hypot(x, z) > radius + 1e-6) continue;
          // bilayers are {3/8, 1/2}, {7/8, 1}, ...: index them from the bottom
          const layer = Math.floor((fz - 3 / 8 + 1e-6) * 2);
          out.push({ p: [x, (fz - 3 / 16) * C, z], fz, s, layer });
        }
  return out;
}

export type Lattice = {
  n: number;
  o: P3[]; // oxygen sites
  layer: number[]; // bilayer index, 0 at the bottom
  edges: [number, number][]; // O-O hydrogen bonds inside the block
  donor: [number, number][]; // per edge: [donor, acceptor]
  hDir: [P3, P3][]; // per molecule: the two directions its hydrogens point along (ice rules)
  hTo: [number, number][]; // per molecule and hydrogen: the acceptor molecule, or -1 for a dangling one at the surface
  channels: [number, number][]; // x, z of the open hexagonal channels that are fully ringed
  star: number; // the oxygen the camera visits: top bilayer, next to the central channel, four neighbours
  starRing: number[]; // the ring of six around the central channel that contains it
};

function build(): Lattice {
  const z0 = 3 / 8, z1 = 3 / 8 + BILAYERS / 2 - 3 / 8; // 4 bilayers: 3/8 .. 15/8 + 1/8
  const raw = sites(SHELL, z0, z1 + 1 / 8);
  const n = raw.length;
  const o = raw.map((r) => r.p);
  const tol = 0.01 * ANG;
  const edges: [number, number][] = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (Math.abs(len(sub(o[i], o[j])) - D_OO) < tol) edges.push([i, j]);

  // the four tetrahedral directions of every site, from an extended lattice
  const big = sites(SHELL + 2 * A, z0 - 1, z1 + 2);
  const tet: P3[][] = o.map((p) => big.filter((b) => Math.abs(len(sub(b.p, p)) - D_OO) < tol).map((b) => norm(sub(b.p, p))));

  // Ice rules: each bond carries exactly one hydrogen, each oxygen donates two. An Euler circuit through the bond graph
  // (with a virtual node joined to every odd-degree oxygen) gives every inner oxygen two bonds out and two in.
  const V = n;
  const ends: [number, number][] = edges.map((e) => [e[0], e[1]]);
  const deg = new Array(n).fill(0);
  for (const [i, j] of edges) { deg[i]++; deg[j]++; }
  for (let i = 0; i < n; i++) if (deg[i] % 2 === 1) ends.push([i, V]);
  const adj: number[][] = Array.from({ length: n + 1 }, () => []);
  ends.forEach(([i, j], e) => { adj[i].push(e); adj[j].push(e); });
  const used = new Array(ends.length).fill(false);
  const dir: [number, number][] = new Array(ends.length);
  const ptr = new Array(n + 1).fill(0);
  for (let s0 = 0; s0 <= n; s0++) {
    // Hierholzer, iterative; every edge is oriented the way the walk crosses it
    const stack: number[] = [s0];
    while (stack.length) {
      const v = stack[stack.length - 1];
      while (ptr[v] < adj[v].length && used[adj[v][ptr[v]]]) ptr[v]++;
      if (ptr[v] === adj[v].length) { stack.pop(); continue; }
      const e = adj[v][ptr[v]];
      used[e] = true;
      const w = ends[e][0] === v ? ends[e][1] : ends[e][0];
      dir[e] = [v, w];
      stack.push(w);
    }
  }
  const donor: [number, number][] = edges.map((_, e) => dir[e]);
  const hTo: [number, number][] = [];
  const hDir: [P3, P3][] = [];
  for (let i = 0; i < n; i++) {
    const out = donor.filter(([d]) => d === i).map(([, a]) => a);
    const inn = donor.filter(([, a]) => a === i).map(([d]) => d);
    const dirs: P3[] = out.map((a) => norm(sub(o[a], o[i])));
    const to: number[] = [...out];
    // fill up to two hydrogens with directions toward missing neighbours (dangling, at the surface)
    const taken = [...out, ...inn].map((j) => norm(sub(o[j], o[i])));
    for (const t of tet[i]) {
      if (dirs.length >= 2) break;
      if (taken.some((q) => dot(q, t) > 0.99)) continue;
      dirs.push(t);
      to.push(-1);
      taken.push(t);
    }
    if (dirs.length !== 2) throw new Error(`ice rules: molecule ${i} has ${dirs.length} hydrogens`);
    hDir.push([dirs[0], dirs[1]]);
    hTo.push([to[0], to[1]]);
  }

  // open channels: hexagon centres whose whole ring of six lies inside the block
  const channels: [number, number][] = [];
  for (let i = -4; i <= 4; i++)
    for (let j = -4; j <= 4; j++) {
      const x = i * A + (j * A) / 2, z = (j * A * Math.sqrt(3)) / 2;
      let whole = true;
      for (let v = 0; v < 6; v++) {
        const th = Math.PI / 6 + (v * Math.PI) / 3;
        if (Math.hypot(x + (A / Math.sqrt(3)) * Math.cos(th), z + (A / Math.sqrt(3)) * Math.sin(th)) > SHELL + 1e-6) whole = false;
      }
      if (whole) channels.push([x, z]);
    }

  // the star: top bilayer, lower sublayer (its fourth bond points down into the block), on the central ring
  const top = BILAYERS - 1;
  const ringR = A / Math.sqrt(3);
  const cand = o
    .map((p, i) => ({ i, p }))
    .filter(({ i, p }) => raw[i].layer === top && Math.abs(Math.hypot(p[0], p[2]) - ringR) < tol && deg[i] === 4);
  // pick the one facing the camera's yaw on "oxygen" (eye direction atan2(x, z) near 1.5 rad)
  cand.sort((u, v) => Math.abs(Math.atan2(u.p[0], u.p[2]) - 1.5) - Math.abs(Math.atan2(v.p[0], v.p[2]) - 1.5));
  const star = cand[0].i;
  const starRing = o
    .map((p, i) => ({ i, p }))
    .filter(({ i, p }) => raw[i].layer === top && Math.abs(Math.hypot(p[0], p[2]) - ringR) < tol)
    .map(({ i }) => i);
  return { n, o, layer: raw.map((r) => r.layer), edges, donor, hDir, hTo, channels, star, starRing };
}

export const LAT: Lattice = build();

// ---------- molecule orientation ----------
/** the two hydrogen positions of a molecule at O with bisector b and in-plane unit p (both unit, perpendicular) */
export function hydrogens(O: P3, b: P3, p: P3): [P3, P3] {
  const cb = Math.cos(BEND / 2) * R_OH, sp = Math.sin(BEND / 2) * R_OH;
  return [add(O, add(mul(b, cb), mul(p, sp))), add(O, add(mul(b, cb), mul(p, -sp)))];
}
/** the frame (bisector, in-plane) that puts the hydrogens of a lattice molecule along its two donor directions,
 *  keeping the molecule's own 104.5 deg bend (each H sits 2.5 deg off the O-O line, as in real ice) */
export function latticeFrame(i: number): [P3, P3] {
  const [h1, h2] = LAT.hDir[i];
  return [norm(add(h1, h2)), norm(sub(h1, h2))];
}

// ---------- the liquid ----------
/** the same molecules as liquid: random, non-overlapping homes in the same column, 9% less tall */
function liquidHomes(): P3[] {
  const r = rng(20261031);
  const out: P3[] = [];
  const margin = 0.09;
  const minD = 2.3 * ANG;
  let tries = 0;
  while (out.length < LAT.n) {
    if (++tries > 2_000_000) throw new Error("liquid: could not place the molecules");
    const rad = (RC - margin) * Math.sqrt(r()), th = r() * Math.PI * 2;
    const p: P3 = [rad * Math.cos(th), margin + r() * (LIQ_H - 2 * margin), rad * Math.sin(th)];
    if (out.every((q) => len(sub(p, q)) >= minD)) out.push(p);
  }
  return out;
}
export const HOMES: P3[] = liquidHomes();

export type Wobble = { f: P3; ph: P3; w: number; axis: P3; q0: [number, number, number, number] };
/** per molecule: wander frequencies and phases, tumble rate and axis, and a starting orientation (quaternion) */
export const WOBBLE: Wobble[] = HOMES.map((_, i) => {
  const r = rng(7919 * (i + 1));
  const u1 = r(), u2 = r(), u3 = r();
  // a uniform random rotation (Shoemake)
  const q0: [number, number, number, number] = [
    Math.sqrt(1 - u1) * Math.sin(2 * Math.PI * u2), Math.sqrt(1 - u1) * Math.cos(2 * Math.PI * u2),
    Math.sqrt(u1) * Math.sin(2 * Math.PI * u3), Math.sqrt(u1) * Math.cos(2 * Math.PI * u3),
  ];
  return {
    f: [0.25 + 0.35 * r(), 0.25 + 0.35 * r(), 0.25 + 0.35 * r()],
    ph: [r() * 6.283, r() * 6.283, r() * 6.283],
    w: (0.9 + 1.3 * r()) * (r() < 0.5 ? -1 : 1),
    axis: norm([r() - 0.5, r() - 0.5, r() - 0.5]),
    q0,
  };
});

/** where molecule i of the liquid is, at "liquid time" phi (seconds of motion so far) */
export function liquidPos(i: number, phi: number): P3 {
  const h = HOMES[i], w = WOBBLE[i];
  const amp = 0.38 * ANG;
  const p: P3 = [
    h[0] + amp * Math.sin(6.283 * w.f[0] * phi + w.ph[0]),
    h[1] + amp * Math.sin(6.283 * w.f[1] * phi + w.ph[1]),
    h[2] + amp * Math.sin(6.283 * w.f[2] * phi + w.ph[2]),
  ];
  // the column shears: inner molecules turn one way, outer ones the other, so neighbours slide past each other.
  // A turn about the column's own axis keeps every molecule inside the column.
  const r = Math.hypot(p[0], p[2]) / RC;
  const th = phi * 0.32 * (0.55 - r);
  const c = Math.cos(th), s = Math.sin(th);
  return [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]];
}

/** greedy nearest matching of liquid molecules to lattice sites, from the positions at the moment of freezing.
 *  The liquid is compared after stretching it 9% in height, so each molecule goes to a site near it. */
export function matchAt(phi: number): number[] {
  const n = LAT.n;
  const pairs: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const p = liquidPos(i, phi);
    const q: P3 = [p[0], p[1] * VOLUME_RATIO, p[2]];
    for (let j = 0; j < n; j++) pairs.push([len(sub(q, LAT.o[j])), i, j]);
  }
  pairs.sort((u, v) => u[0] - v[0]);
  const site = new Array(n).fill(-1);
  const taken = new Array(n).fill(false);
  for (const [, i, j] of pairs) if (site[i] < 0 && !taken[j]) { site[i] = j; taken[j] = true; }
  // then swap pairs while that shortens the moves (squared, so no one molecule crosses the block)
  const from = Array.from({ length: n }, (_, i) => { const p = liquidPos(i, phi); return [p[0], p[1] * VOLUME_RATIO, p[2]] as P3; });
  const cost = (i: number, j: number) => { const d = sub(from[i], LAT.o[j]); return dot(d, d); };
  for (let pass = 0; pass < 30; pass++) {
    let better = false;
    for (let i = 0; i < n; i++)
      for (let k = i + 1; k < n; k++)
        if (cost(i, site[k]) + cost(k, site[i]) < cost(i, site[i]) + cost(k, site[k]) - 1e-9) {
          const t = site[i]; site[i] = site[k]; site[k] = t; better = true;
        }
    if (!better) break;
  }
  return site;
}
