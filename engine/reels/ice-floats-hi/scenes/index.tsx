import type React from "react";
import type { SceneMap } from "../../../src/engine/Stage";
import { GlassLakeWorld3D } from "./GlassLakeWorld3D";
import { MoleculeWorld3D } from "./MoleculeWorld3D";

// World 1 (glass + pond): hook, lake, payoff. World 2 (molecules): liquid, cage, roomy.
// Each scene is its own component so builders can own them; they share the world file of their world.
const Hook: React.FC = () => <GlassLakeWorld3D mode="hook" />;
const Lake: React.FC = () => <GlassLakeWorld3D mode="lake" />;
const Liquid: React.FC = () => <MoleculeWorld3D mode="liquid" />;
const Cage: React.FC = () => <MoleculeWorld3D mode="cage" />;
const Roomy: React.FC = () => <MoleculeWorld3D mode="roomy" />;
const Payoff: React.FC = () => <GlassLakeWorld3D mode="payoff" />;

export const scenes: SceneMap = { hook: Hook, lake: Lake, liquid: Liquid, cage: Cage, roomy: Roomy, payoff: Payoff };
