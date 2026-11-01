// The demo again, drawn in real 3D: the same block, the same fall, the same camera path on the same word cues as
// reels/demo, but lit by a sun with soft shadows through Three.js. Both scenes draw this one world from the reel's frame.
//   "block"  the block falls in from above the frame under real gravity and lands on "code"
//   "code"   its edges light up in the accent colour, as if being drawn
//   "frame"  a frame counter ticks in the corner, and the camera never fully stops
//   "camera" the camera starts circling it, "move" it rises to look down, "word" the top face lights and the camera settles
import React, { useMemo } from "react";
import * as THREE from "three";
import { useCurrentFrame } from "remotion";
import { type Cam, type V3, ease, orbit, prog, spline, useReel } from "../../../src/engine";
import { Floor, Model, Studio, World3D } from "../../../src/engine/three";

const S = 1.0; // block edge, in metres
const G = 9.81 / 3600; // gravity in metres per frame squared at 60 fps
const START = 4;

type T = { block: number; code: number; frame: number; camera: number; move: number; word: number; end: number };

function useTimes(): T {
  const { tl } = useReel();
  return useMemo(() => {
    const k = 60 / tl.fps; // written in 60 fps frames; a 30 fps draft scales them so it plays the same
    return {
      block: tl.cue("block", 1, 0) * k, code: tl.cue("code", 1, 0) * k, frame: tl.cue("frame", 1, 0) * k,
      camera: tl.cue("camera", 1, 1) * k, move: tl.cue("move", 1, 1) * k, word: tl.cue("word", 1, 1) * k, end: tl.frames * k,
    };
  }, [tl]);
}

const dropOf = (t: T) => 0.5 * G * (t.code - START) ** 2;
const lift = (f: number, t: T) => (f <= START ? dropOf(t) : f >= t.code ? 0 : dropOf(t) - 0.5 * G * (f - START) ** 2);

function camera(f: number, t: T): Cam {
  const at: V3 = [0, S * 0.5, 0];
  const yaw = spline(f, [[0, 0.45], [t.camera, 0.75], [t.move, 1.5], [t.word, 2.3], [t.end, 2.42]]);
  const pitch = spline(f, [[0, 0.3], [t.move, 0.34], [t.word, 0.78], [t.end, 0.8]]);
  const dist = spline(f, [[0, 7.4], [t.block, 7.0], [t.camera, 6.6], [t.word, 6.0], [t.end, 5.9]]);
  return { eye: orbit(at, yaw, pitch, dist), at, focal: 1500, cx: 540, cy: 980 };
}

const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(S * 1.002, S * 1.002, S * 1.002));

export const BlockWorld3D: React.FC = () => {
  const { tl, theme } = useReel();
  const t = useTimes();
  const f = useCurrentFrame() * (60 / tl.fps);
  const y = lift(f, t);
  const trace = prog(f, t.code + 2, 40, ease.inOut);
  const lit = prog(f, t.word, 24, ease.out);
  const accent = theme.marker.color;
  const show = prog(f, t.frame - 4, 14, ease.out);
  return (
    <>
    <World3D cam={camera(f, t)} background={theme.grounds.dark.bg}>
      <Studio sun={[3, 7, 4]} intensity={2.4} hdri="demo-3d/hdris/brown_photostudio_02_1k.hdr" />
      <Floor color="#16171b" />
      {/* a real CC0 model from the library, at its real size: an armchair about 1.07 m tall */}
      <Model src="demo-3d/models/ArmChair_01/ArmChair_01_1k.gltf" size={1.07} position={[1.7, 0, -0.9]} rotation={[0, -0.6, 0]} />
      <gridHelper args={[12, 12, "#3a3d46", "#2a2c33"]} position={[0, 0.002, 0]} />
      <group position={[0, y + S / 2, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[S, S, S]} />
          <meshStandardMaterial color="#c4966a" roughness={0.55} metalness={0} />
        </mesh>
        {/* the top face glows on "word" */}
        <mesh position={[0, S / 2 + 0.003, 0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[S, S]} />
          <meshBasicMaterial color={accent} transparent opacity={0.6 * lit} />
        </mesh>
        <lineSegments geometry={edges}>
          <lineBasicMaterial color={accent} transparent opacity={trace} />
        </lineSegments>
      </group>
    </World3D>
    {show > 0 && (
      <div style={{ position: "absolute", top: 1530, width: 1080, textAlign: "center", opacity: show, color: theme.grounds.dark.ink,
        font: "700 44px 'JetBrains Mono', monospace" }}>
        FRAME {String(Math.round(f)).padStart(4, "0")}
      </div>
    )}
    </>
  );
};
