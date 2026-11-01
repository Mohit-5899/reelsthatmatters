import type React from "react";
import type { SceneMap } from "../../../src/engine/Stage";
import { BlockWorld3D } from "./BlockWorld3D";

// Both scenes draw the same 3D world from the reel's frame, so the handover is one continuous picture.
const Hook: React.FC = () => <BlockWorld3D />;
const Orbit: React.FC = () => <BlockWorld3D />;

export const scenes: SceneMap = { hook: Hook, orbit: Orbit };
