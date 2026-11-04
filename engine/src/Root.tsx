import React from "react";
import { Composition } from "remotion";
import { Reel, type ReelProps } from "./Reel";
import { theme, withOverrides, W, H } from "./theme";

const empty: ReelProps = { slug: "", audio: null, config: {}, data: { duration: 1, silences: [], scenes: [{ id: "none", ground: "dark", firstWord: 0 }], blocks: [], words: [] } };


export const Root: React.FC = () => (
  <>
  <Composition
    id="Reel"
    component={Reel as unknown as React.FC<Record<string, unknown>>}
    width={W}
    height={H}
    fps={theme.fps}
    durationInFrames={60}
    defaultProps={empty as unknown as Record<string, unknown>}
    calculateMetadata={({ props }) => {
      const p = props as unknown as ReelProps;
      const fps = withOverrides(theme, p.config.theme).fps;
      const [width, height] = p.config.size ?? [W, H]; // "size" in reel.json, such as [1920, 1080] for 16:9
      return { fps, width, height, durationInFrames: Math.max(1, Math.ceil(p.data.duration * fps)) };
    }}
  />
  </>
);
