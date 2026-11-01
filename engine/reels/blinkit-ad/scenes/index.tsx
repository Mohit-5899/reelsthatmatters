import type React from "react";
import type { SceneMap } from "../../../src/engine/Stage";
import { AdWorld2D } from "./AdWorld2D";

// One 2D world for the whole ad (see plan.md). Every scene draws the same picture from the reel's clock, so the
// scene changes hand over frames without swapping the picture. "open" also holds the product drop (see caption.txt).
const Hook: React.FC = () => <AdWorld2D mode="hook" />;
const Problems: React.FC = () => <AdWorld2D mode="problems" />;
const Open: React.FC = () => <AdWorld2D mode="open" />;
const Door: React.FC = () => <AdWorld2D mode="door" />;
const End: React.FC = () => <AdWorld2D mode="end" />;

export const scenes: SceneMap = { hook: Hook, problems: Problems, open: Open, door: Door, end: End };
