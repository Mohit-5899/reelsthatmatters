#!/usr/bin/env node
// reelsthatmatters MCP server. It runs on your own machine over stdio and gives an agent (Claude Code, or any MCP client)
// the deterministic steps of a reel: set up, make the folder, voice it, time it, find 3D models, add music, check it,
// draft it, render it. The agents write the research, the script and the scenes; every check here answers PASS or FAIL.
// Nothing leaves your machine except the ElevenLabs calls (voice, music) with your own key, and Poly Haven model
// downloads when you turn them on.
//   As a Claude Code plugin it starts on its own. By hand: claude mcp add reelsthatmatters -- node /path/to/mcp/server.mjs
//
// Where the reels live: a checkout with node_modules works in place. An installed plugin keeps its code in a folder
// that is replaced on every update, so it works in RTM_HOME instead (~/reelsthatmatters by default); `setup` puts the
// engine there and installs it, and never touches the reels already in it.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const CODE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = process.env.RTM_HOME ? path.resolve(process.env.RTM_HOME.replace(/^~/, os.homedir()))
  : fs.existsSync(path.join(CODE, "node_modules")) ? CODE : path.join(os.homedir(), "reelsthatmatters");
const ENGINE = path.join(ROOT, "engine");
const REELS = path.join(ENGINE, "reels");
const PY = process.env.SH_PYTHON || "python3";
const VERSION = "0.1.0";
const SLUG = /^[a-z0-9][a-z0-9-]{0,60}$/;

// one step = one command in the engine folder; the result is its exit code and the last of its output
function run(cmd, args, timeoutMs = 30 * 60_000, cwd = ENGINE) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd, env: process.env });
    let out = "";
    const keep = (d) => { out = (out + d).slice(-12_000); };
    p.stdout.on("data", keep);
    p.stderr.on("data", keep);
    const timer = setTimeout(() => { p.kill("SIGTERM"); out += "\n(timed out)"; }, timeoutMs);
    p.on("close", (code) => { clearTimeout(timer); resolve({ pass: code === 0, out: out.replace(/\r[^\n]*(?=\r)/g, "").trim() }); });
    p.on("error", (e) => { clearTimeout(timer); resolve({ pass: false, out: String(e) }); });
  });
}

const ready = () => {
  if (!fs.existsSync(path.join(ROOT, "node_modules")) || !fs.existsSync(ENGINE)) throw new Error(`the engine is not set up in ${ROOT}: call setup first`);
};
const reelDir = (slug) => {
  if (!SLUG.test(slug || "")) throw new Error("slug: lowercase letters, digits and dashes");
  return path.join(REELS, slug);
};
const needReel = (slug) => {
  ready();
  const d = reelDir(slug);
  if (!fs.existsSync(d)) throw new Error(`no reel "${slug}": call new_reel first`);
  return d;
};
const latestRender = (slug) => {
  const out = path.join(ENGINE, "output");
  if (!fs.existsSync(out)) return null;
  const all = fs.readdirSync(out).flatMap((day) => {
    const d = path.join(out, day);
    return fs.statSync(d).isDirectory() ? fs.readdirSync(d).filter((f) => f.replace(/^\d+-/, "") === `${slug}.mp4`).map((f) => path.join(d, f)) : [];
  });
  return all.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] ?? null;
};
const verdict = (steps) => ({ pass: steps.every((s) => s.pass), steps });

const SCENE_STUB = (name) => `import React from "react";
import { useScene } from "../../../src/engine";

// ${name}: draw what the voice says here, on a canvas or in SVG, as one function of the frame.
// cue("word") is the frame that word starts; every move starts on a cue.
export const ${name}: React.FC = () => {
  const { f, cue, ground } = useScene();
  return <div style={{ position: "absolute", inset: 0, background: ground.bg }} />;
};
`;

const SCENE_STUB_3D = (name) => `import React from "react";
import { useScene, orbit, type Cam } from "../../../src/engine";
import { Floor, Studio, World3D } from "../../../src/engine/three";

// ${name}: a real 3D scene. Build the world in metres, place models with <Model src=... size=...>, and move the camera
// with orbit and spline on word cues, exactly as a 2D scene does. Every value is a function of the frame.
export const ${name}: React.FC = () => {
  const { f, cue, ground, scene } = useScene();
  // a slow drift around the world until the real camera path is written on word cues with spline
  const cam: Cam = { eye: orbit([0, 0.5, 0], 0.6 + 0.001 * (f - scene.from), 0.3, 6), at: [0, 0.5, 0], focal: 1500, cx: 540, cy: 960 };
  return (
    <World3D cam={cam} background={ground.bg}>
      <Studio />
      <Floor />
    </World3D>
  );
};
`;

const TOOLS = {
  setup: {
    description: "Run once before anything else, and again after the plugin updates: puts the engine in the reels folder, installs it (npm), and checks ffmpeg, Python (numpy, Pillow) and whisper. Never touches existing reels.",
    input: {},
    required: [],
    async run() {
      const steps = [];
      if (ROOT !== CODE) {
        fs.mkdirSync(ENGINE, { recursive: true });
        for (const f of ["package.json", "package-lock.json", "LICENSE", ".env.example", "workflow"])
          if (fs.existsSync(path.join(CODE, f))) fs.cpSync(path.join(CODE, f), path.join(ROOT, f), { recursive: true });
        for (const f of ["src", "scripts", "render.mjs", "draft.mjs", "tsconfig.json", "reels/index.ts"])
          fs.cpSync(path.join(CODE, "engine", f), path.join(ENGINE, f), { recursive: true });
        // the example reels come along once, so a first render works before any key is set
        for (const r of fs.readdirSync(path.join(CODE, "engine", "reels")))
          if (!fs.existsSync(path.join(REELS, r)) && fs.statSync(path.join(CODE, "engine", "reels", r)).isDirectory())
            fs.cpSync(path.join(CODE, "engine", "reels", r), path.join(REELS, r), { recursive: true });
        steps.push({ step: "engine", pass: true, out: `engine copied to ${ROOT}` });
      }
      if (!fs.existsSync(path.join(ROOT, ".env.local")) && fs.existsSync(path.join(ROOT, ".env.example")))
        fs.copyFileSync(path.join(ROOT, ".env.example"), path.join(ROOT, ".env.local"));
      steps.push({ step: "npm install", ...(await run("npm", ["install", "--no-audit", "--no-fund"], 20 * 60_000, ROOT)) });
      steps.push({ step: "ffmpeg", ...(await run("ffmpeg", ["-version"], 60_000, ROOT)) });
      steps.push({ step: "python", ...(await run(PY, ["-c", "import numpy, PIL; print('numpy', numpy.__version__, 'Pillow', PIL.__version__)"], 60_000, ROOT)) });
      const w = await run("whisper-cli", ["--help"], 60_000, ROOT);
      steps.push({ step: "whisper (optional)", pass: true, out: w.pass ? "whisper-cli found" : "whisper-cli missing: align.py falls back to the ElevenLabs alignment. On a Mac: brew install whisper-cpp" });
      for (const s of steps) s.out = s.out.split("\n").slice(-3).join("\n");
      return { home: ROOT, keys: `put ELEVENLABS_API_KEY or SARVAM_API_KEY in ${path.join(ROOT, ".env.local")}; never paste it in chat`, ...verdict(steps) };
    },
  },
  new_reel: {
    description: "Make a reel folder with its script, caption, config and one scene stub per scene. Write the script first: each scene is a line \"== id\" in the caption.",
    input: { slug: "string", script: "string: the words the voice says; a blank line between paragraphs", caption: "string: caption.txt (== id | ground: dark, one caption block a line, *key* word marks)", voice_id: "string, optional: an ElevenLabs voice id", three: "array of scene ids, optional: scenes drawn in real 3D (Three.js) instead of on a 2D canvas" },
    required: ["slug", "script", "caption"],
    async run({ slug, script, caption, voice_id, three = [] }) {
      ready();
      const d = reelDir(slug);
      if (fs.existsSync(d)) throw new Error(`reel "${slug}" already exists`);
      fs.mkdirSync(path.join(d, "scenes"), { recursive: true });
      fs.writeFileSync(path.join(d, "script.txt"), script.trim() + "\n");
      fs.writeFileSync(path.join(d, "caption.txt"), caption.trim() + "\n");
      fs.writeFileSync(path.join(d, "reel.json"), JSON.stringify({
        voice: { id: voice_id || "YOUR_VOICE_ID", model: "eleven_multilingual_v2", speed: 1.0, stability: 0.5, similarity: 0.8, style: 0.0 },
        theme: { motion: "measured", handover: "continuous" },
      }, null, 2) + "\n");
      const ids = [...caption.matchAll(/^==\s*([a-z0-9_-]+)/gim)].map((m) => m[1]);
      const name = (id) => id.replace(/(^|[-_])(\w)/g, (_, __, c) => c.toUpperCase());
      for (const id of ids) fs.writeFileSync(path.join(d, "scenes", `${name(id)}.tsx`), (three.includes(id) ? SCENE_STUB_3D : SCENE_STUB)(name(id)));
      fs.writeFileSync(path.join(d, "scenes", "index.tsx"),
        `import type { SceneMap } from "../../../src/engine/Stage";\n${ids.map((id) => `import { ${name(id)} } from "./${name(id)}";`).join("\n")}\n\nexport const scenes: SceneMap = { ${ids.map((id) => `${JSON.stringify(id)}: ${name(id)}`).join(", ")} };\n`);
      return { pass: true, folder: d, scenes: ids };
    },
  },
  voice: {
    description: "Voice the script with ElevenLabs (your key in .env.local), check the last line was spoken, then put every pause in real silence so no word is cut.",
    input: { slug: "string" },
    required: ["slug"],
    async run({ slug }) {
      needReel(slug);
      const a = await run(PY, ["scripts/voice.py", slug]);
      if (!a.pass) return verdict([{ step: "voice", ...a }]);
      return verdict([{ step: "voice", ...a }, { step: "tighten", ...(await run(PY, ["scripts/tighten.py", slug])) }]);
    },
  },
  align: {
    description: "Time every caption word to the voice and write words.json. Run after voice, and again after any caption change.",
    input: { slug: "string" },
    required: ["slug"],
    async run({ slug }) {
      needReel(slug);
      return verdict([{ step: "align", ...(await run(PY, ["scripts/align.py", slug])) }]);
    },
  },
  check_plan: {
    description: "Before drawing: caption blocks, key words, scene changes inside silence, pace, and type sizes in the scenes. PASS or FAIL.",
    input: { slug: "string" },
    required: ["slug"],
    async run({ slug }) {
      needReel(slug);
      return verdict([{ step: "check plan", ...(await run(PY, ["scripts/check.py", "plan", slug])) }]);
    },
  },
  typecheck: {
    description: "Type-check the engine and every reel's scenes.",
    input: {},
    required: [],
    async run() {
      ready();
      return verdict([{ step: "typecheck", ...(await run("node", [path.join(ROOT, "node_modules/typescript/bin/tsc"), "--noEmit", "-p", "."])) }]);
    },
  },
  stills: {
    description: "Render still frames at the given seconds (half size), to look at before any video. Returns the PNG paths.",
    input: { slug: "string", seconds: "array of numbers" },
    required: ["slug", "seconds"],
    async run({ slug, seconds }) {
      needReel(slug);
      const r = await run("node", ["render.mjs", slug, "--stills", seconds.map(Number).join(","), "--half"]);
      return { ...verdict([{ step: "stills", ...r }]), files: r.out.split("\n").filter((l) => l.endsWith(".png")) };
    },
  },
  draft: {
    description: "Render the moving DRAFT: the real drawn video at half size, stamped DRAFT and not checked yet. Show it before the final render.",
    input: { slug: "string" },
    required: ["slug"],
    async run({ slug }) {
      needReel(slug);
      const r = await run("node", ["draft.mjs", slug, "--no-open"]);
      return { ...verdict([{ step: "draft", ...r }]), file: r.out.split("\n").filter((l) => l.endsWith(".mp4")).pop() ?? null };
    },
  },
  render: {
    description: "Render the final reel at 1080x1920, 60 fps, then level its sound to -14 LUFS (the video is copied untouched).",
    input: { slug: "string" },
    required: ["slug"],
    async run({ slug }) {
      needReel(slug);
      const r = await run("node", ["render.mjs", slug, "--concurrency", "4"], 90 * 60_000);
      const file = latestRender(slug);
      if (!r.pass || !file) return { ...verdict([{ step: "render", ...r }]), file };
      const l = await run(PY, ["scripts/loud.py", file, "--fix"]);
      const fixed = file.replace(/\.mp4$/, ".loud.mp4");
      if (fs.existsSync(fixed)) fs.renameSync(fixed, file);
      return { ...verdict([{ step: "render", ...r }, { step: "level sound", ...l }]), file };
    },
  },
  check_render: {
    description: "Every check on the latest render: dead holds and bare handovers, motion too fast to follow, cuts at scene changes, loudness, and the look (colour strength, accent flood, blown light, ground flashes, centre weight). PASS only when all pass.",
    input: { slug: "string", keep: "array of scene ids, optional: scenes whose next scene carries on in the same world" },
    required: ["slug"],
    async run({ slug, keep = [] }) {
      const d = needReel(slug);
      const mp4 = latestRender(slug);
      if (!mp4) throw new Error(`no render of "${slug}" yet: call render first`);
      const words = path.join(d, "words.json");
      const k = keep.length ? ["--keep", keep.join(",")] : [];
      return { file: mp4, ...verdict([
        { step: "check render", ...(await run(PY, ["scripts/check.py", "render", slug, mp4])) },
        { step: "motion", ...(await run(PY, ["scripts/motion.py", mp4, "--words", words, ...k])) },
        { step: "joins", ...(await run(PY, ["scripts/joins.py", slug, mp4, "--sheet", path.join(d, "joins-sheet.jpg")])) },
        { step: "loudness", ...(await run(PY, ["scripts/loud.py", mp4])) },
        { step: "look", ...(await run(PY, ["scripts/look.py", slug, mp4])) },
      ]) };
    },
  },
  find_model: {
    description: "Search CC0 3D models (or HDRIs for light and reflections) in the local library, and on Poly Haven when RTM_POLYHAVEN=1. Returns ids, names and real sizes in metres.",
    input: { query: "string: what it is, e.g. 'wooden chair', 'airplane', 'skull'", type: "string, optional: model (default) or hdri" },
    required: ["query"],
    async run({ query, type = "model" }) {
      ready();
      return verdict([{ step: "find", ...(await run(PY, ["scripts/models.py", "search", query, "--type", type])) }]);
    },
  },
  get_model: {
    description: "Copy a model or HDRI found by find_model into the reel's assets. Returns the src to pass to <Model src=...> or <Studio hdri=...>.",
    input: { slug: "string", id: "string: the id find_model returned", type: "string, optional: model (default) or hdri" },
    required: ["slug", "id"],
    async run({ slug, id, type = "model" }) {
      needReel(slug);
      const r = await run(PY, ["scripts/models.py", "get", id, slug, "--type", type]);
      return { ...verdict([{ step: "get", ...r }]), src: r.pass ? r.out.split("\n").pop() : null };
    },
  },
  music: {
    description: "Add a music bed under the voice: compose one with ElevenLabs Music from a mood prompt (as long as the reel), or use a file you have the rights to. Optional; run after align, before render.",
    input: { slug: "string", prompt: "string, optional: the mood, e.g. 'calm curious piano, light pulse'", file: "string, optional: a path to your own track", volume: "string, optional: level under the voice, 0.05 to 0.3 (default 0.12)" },
    required: ["slug"],
    async run({ slug, prompt, file, volume }) {
      needReel(slug);
      const a = [slug, ...(prompt ? ["--prompt", prompt] : []), ...(file ? ["--file", file] : []), ...(volume ? ["--volume", String(volume)] : [])];
      return verdict([{ step: "music", ...(await run(PY, ["scripts/music.py", ...a], 10 * 60_000)) }]);
    },
  },
  list_reels: {
    description: "List the reels in this folder and how far each has got.",
    input: {},
    required: [],
    async run() {
      if (!fs.existsSync(REELS)) return { home: ROOT, reels: [], note: "nothing set up yet: call setup" };
      return {
        reels: fs.readdirSync(REELS).filter((s) => fs.statSync(path.join(REELS, s)).isDirectory()).map((slug) => {
          const has = (f) => fs.existsSync(path.join(REELS, slug, f));
          return { slug, voiced: has("voice.mp3"), aligned: has("words.json"), drafted: has(`draft/${slug}-DRAFT.mp4`), rendered: latestRender(slug) };
        }),
      };
    },
  },
};

const schema = (t) => ({
  type: "object",
  properties: Object.fromEntries(Object.entries(t.input).map(([k, d]) => [k, d.startsWith("array")
    ? { type: "array", items: { type: d.includes("numbers") ? "number" : "string" }, description: d }
    : { type: "string", description: d }])),
  required: t.required,
});

async function handle(msg) {
  const { id, method, params } = msg;
  const ok = (result) => ({ jsonrpc: "2.0", id, result });
  if (method === "initialize")
    return ok({ protocolVersion: params?.protocolVersion ?? "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "reelsthatmatters", version: VERSION },
      instructions: `reelsthatmatters. Reels live in ${ROOT}. Order: setup (once), research and pick a hook, new_reel, voice, align, check_plan, find_model/get_model for 3D scenes, draw the scenes, typecheck, stills, draft (show it), music (optional), render, check_render. Fix every FAIL before delivering.` });
  if (method === "tools/list")
    return ok({ tools: Object.entries(TOOLS).map(([name, t]) => ({ name, description: t.description, inputSchema: schema(t) })) });
  if (method === "tools/call") {
    const t = TOOLS[params?.name];
    if (!t) return { jsonrpc: "2.0", id, error: { code: -32602, message: `unknown tool ${params?.name}` } };
    try {
      const r = await t.run(params.arguments ?? {});
      return ok({ content: [{ type: "text", text: JSON.stringify(r, null, 2) }], isError: r.pass === false });
    } catch (e) {
      return ok({ content: [{ type: "text", text: String(e.message ?? e) }], isError: true });
    }
  }
  if (method === "ping") return ok({});
  if (id === undefined) return null; // a notification
  return { jsonrpc: "2.0", id, error: { code: -32601, message: `no method ${method}` } };
}

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", async (line) => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  const reply = await handle(msg);
  if (reply) process.stdout.write(JSON.stringify(reply) + "\n");
});
