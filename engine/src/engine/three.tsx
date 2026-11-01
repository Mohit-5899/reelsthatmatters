// The 3D path: real models and light through Three.js, on the same camera and word cues as the 2D canvas scenes.
// A scene builds its world inside <World3D cam={...}>, where `cam` comes from the same `orbit` and `spline` as a 2D scene,
// so a reel can hand over from a 2D picture to a 3D one without the camera jumping.
// Every value is still a pure function of the frame: never use useFrame(), never animate in a loop.
import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";
import type { Cam } from "./camera";

export const W3 = 1080;
export const H3 = 1920;

/** the vertical field of view that matches a pinhole camera's focal length (in pixels of the 1920-high frame) */
export const fovOf = (focal: number) => (2 * Math.atan(H3 / 2 / focal) * 180) / Math.PI;

/** puts the Three.js camera where the pinhole camera is, every frame, before the frame is drawn */
const CameraRig: React.FC<{ cam: Cam }> = ({ cam }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useLayoutEffect(() => {
    camera.position.set(...cam.eye);
    camera.fov = fovOf(cam.focal);
    camera.near = 0.05;
    camera.far = 2000;
    // the pinhole camera's centre (cx, cy) may sit off the middle of the frame: shift the lens to match
    camera.setViewOffset(W3, H3, W3 / 2 - cam.cx, H3 / 2 - cam.cy, W3, H3);
    camera.lookAt(...cam.at);
    camera.updateProjectionMatrix();
  });
  return null;
};

/** a lit studio: soft sky light, one sun with soft shadows, and an optional HDRI for reflections */
export const Studio: React.FC<{ sun?: [number, number, number]; intensity?: number; hdri?: string; hdriStrength?: number; sky?: string; groundColor?: string }> = ({
  sun = [4, 8, 5], intensity = 2.2, hdri, hdriStrength = 0.5, sky = "#dfe8ff", groundColor = "#3a3530",
}) => {
  const env = useHdri(hdri);
  const scene = useThree((s) => s.scene);
  useLayoutEffect(() => {
    scene.environment = env;
    scene.environmentIntensity = hdriStrength;
    return () => { scene.environment = null; };
  }, [env, scene, hdriStrength]);
  return (
    <>
      <hemisphereLight args={[sky, groundColor, env ? 0.35 : 0.9]} />
      <directionalLight
        position={sun}
        intensity={intensity}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0004}
        shadow-radius={4}
      />
    </>
  );
};

/** a floor that catches shadows; `size` in world units */
export const Floor: React.FC<{ color?: string; size?: number; y?: number }> = ({ color = "#1b1c20", size = 400, y = 0 }) => (
  <mesh rotation-x={-Math.PI / 2} position={[0, y, 0]} receiveShadow>
    <planeGeometry args={[size, size]} />
    <meshStandardMaterial color={color} roughness={0.92} metalness={0} />
  </mesh>
);

/** the canvas a 3D scene draws in: full frame, the camera on the pinhole path, soft shadows, filmic tone */
/** `fog` fades the world into the background from `fog[0]` to `fog[1]` world units away, so the floor never shows an edge */
export const World3D: React.FC<{ cam: Cam; background?: string; fog?: [number, number] | null; children: React.ReactNode }> = ({
  cam, background = "#111214", fog = [14, 45], children,
}) => (
  <ThreeCanvas
    width={W3}
    height={H3}
    shadows="percentage"
    dpr={1}
    gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping, outputColorSpace: THREE.SRGBColorSpace }}
    camera={{ fov: fovOf(cam.focal), position: cam.eye, near: 0.05, far: 2000 }}
    style={{ position: "absolute", inset: 0 }}
  >
    <color attach="background" args={[background]} />
    {fog && <fog attach="fog" args={[background, fog[0], fog[1]]} />}
    <CameraRig cam={cam} />
    {children}
  </ThreeCanvas>
);

// Files load once per render tab and are kept, so a model is not fetched again for every frame.
const gltfCache = new Map<string, Promise<THREE.Group>>();
const hdriCache = new Map<string, Promise<THREE.Texture>>();

// A loaded file arrives after the frame was drawn, and with frameloop "never" nothing draws it again, so the frame is
// held (delayRender) until the file is in the scene and the scene has been drawn once more with it.
function useLoaded<T>(key: string | undefined, load: (url: string) => Promise<T>): T | null {
  const [value, setValue] = useState<T | null>(null);
  const [handle] = useState(() => (key ? delayRender(`loading ${key}`) : null));
  const advance = useThree((s) => s.advance);
  useLayoutEffect(() => {
    if (!key) return;
    let live = true;
    load(key).then((v) => { if (live) setValue(() => v); }, (e) => cancelRender(new Error(`could not load ${key}: ${e}`)));
    return () => { live = false; };
  }, [key, load]);
  useEffect(() => {
    if (value === null || handle === null) return;
    advance(performance.now());
    continueRender(handle);
  }, [value, handle, advance]);
  return value;
}

const loadGltf = (src: string) => {
  if (!gltfCache.has(src))
    gltfCache.set(src, new GLTFLoader().loadAsync(src.startsWith("http") ? src : staticFile(src)).then((g) => g.scene));
  return gltfCache.get(src)!;
};
const loadHdri = (src: string) => {
  if (!hdriCache.has(src))
    hdriCache.set(src, new HDRLoader().loadAsync(staticFile(src)).then((t) => { t.mapping = THREE.EquirectangularReflectionMapping; return t; }));
  return hdriCache.get(src)!;
};

/** an HDRI from public/ (an .hdr file), for image-based light and reflections */
export const useHdri = (src?: string) => useLoaded(src, loadHdri);

/**
 * A glTF model (a .glb, or a .gltf with its files beside it), from the reel's assets: put it in reels/<slug>/assets/
 * and pass "<slug>/<path inside assets>". `size` scales it so its largest side is that many world units, and it sits
 * on y = 0 with its centre on the x/z origin, so real-world sizes can be set without knowing how the file was made.
 */
export const Model: React.FC<{
  src: string; size?: number; position?: [number, number, number]; rotation?: [number, number, number]; shadows?: boolean;
  tint?: (m: THREE.MeshStandardMaterial) => void;
}> = ({ src, size, position = [0, 0, 0], rotation = [0, 0, 0], shadows = true, tint }) => {
  const scene = useLoaded(src, loadGltf);
  const obj = useMemo(() => {
    if (!scene) return null;
    const o = scene.clone(true);
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = shadows;
      m.receiveShadow = shadows;
      if (tint) {
        m.material = (m.material as THREE.Material).clone();
        tint(m.material as THREE.MeshStandardMaterial);
      }
    });
    const box = new THREE.Box3().setFromObject(o);
    const dims = box.getSize(new THREE.Vector3());
    const k = size ? size / Math.max(dims.x, dims.y, dims.z, 1e-6) : 1;
    const c = box.getCenter(new THREE.Vector3());
    const wrap = new THREE.Group();
    o.position.set(-c.x, -box.min.y, -c.z);
    wrap.add(o);
    wrap.scale.setScalar(k);
    return wrap;
  }, [scene, size, shadows, tint]);
  if (!obj) return null;
  return <primitive object={obj} position={position} rotation={rotation} />;
};
