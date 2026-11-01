import type React from "react";
import type { SceneMap } from "../../../src/engine/Stage";
import { JetWorld3D } from "./JetWorld3D";
import { FlightDisplay2D } from "./FlightDisplay2D";

// World 1 (the jet and its cockpit door, 3D): hook, door, captain, close. World 2 (the flight display, 2D): route, dive,
// landing, after. Each scene is its own component; scenes of one world share that world's file, so a builder owns one
// world file and never touches the other. This index needs no edits while building.
const Hook: React.FC = () => <JetWorld3D mode="hook" />;
const Door: React.FC = () => <JetWorld3D mode="door" />;
const Route: React.FC = () => <FlightDisplay2D mode="route" />;
const Dive: React.FC = () => <FlightDisplay2D mode="dive" />;
const Captain: React.FC = () => <JetWorld3D mode="captain" />;
const Landing: React.FC = () => <FlightDisplay2D mode="landing" />;
const After: React.FC = () => <FlightDisplay2D mode="after" />;
const Close: React.FC = () => <JetWorld3D mode="close" />;

export const scenes: SceneMap = { hook: Hook, door: Door, route: Route, dive: Dive, captain: Captain, landing: Landing, after: After, close: Close };
