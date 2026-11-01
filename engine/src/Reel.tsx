// Layers from back to front: ground, stage, caption, pinned chrome, then the voice and an optional music bed under it.
// No camera and no cuts here; all timing comes from the voice.
import React, { useEffect, useMemo, useState } from "react";
import { AbsoluteFill, Audio, continueRender, delayRender, staticFile } from "remotion";
import { theme as base, withOverrides } from "./theme";
import { fontsReady } from "./fonts";
import { ReelContext } from "./engine/context";
import { setEntrance } from "./engine/moves";
import { buildTimeline, type ReelConfig, type ReelData } from "./engine/timeline";
import { Ground } from "./engine/Ground";
import { Stage } from "./engine/Stage";
import { Caption } from "./engine/Caption";
import { Chrome } from "./engine/Chrome";
import { reels } from "../reels";

// The music sits well under the voice (0.12 of full level by default), fades in and out, and is cut at the reel's end.
// loud.py then levels the whole mix, so this volume sets the balance, not the loudness.
const MusicBed: React.FC<{ src: string; config: ReelConfig; frames: number; fps: number }> = ({ src, config, frames, fps }) => {
  const m = config.music;
  const v = m?.volume ?? 0.12;
  const fin = Math.max(1, (m?.fadeIn ?? 1) * fps);
  const fout = Math.max(1, (m?.fadeOut ?? 1.5) * fps);
  return <Audio src={staticFile(src)} volume={(f) => v * Math.min(1, f / fin, Math.max(0, (frames - f) / fout))} />;
};

export type ReelProps = { slug: string; data: ReelData; config: ReelConfig; audio: string | null; music?: string | null; guides?: boolean; noCaption?: boolean };

// Layout bands plus the areas Instagram covers with its own UI. Turned on by --guides, meant for stills.
const Guides: React.FC = () => (
  <AbsoluteFill style={{ fontFamily: "monospace", fontSize: 22, color: "#ff3b7f" }}>
    {[[300, "caption"], [520, "stage"], [1450, "stage ends"], [1600, "chrome"]].map(([y, label]) => (
      <div key={label} style={{ position: "absolute", top: y as number, left: 0, right: 0, borderTop: "2px dashed #ff3b7f" }}>&nbsp;{label} {y}</div>
    ))}
    <div style={{ position: "absolute", top: 1700, bottom: 0, left: 0, right: 0, background: "rgba(255,59,127,0.16)" }}>&nbsp;Instagram caption + buttons</div>
    <div style={{ position: "absolute", top: 1100, bottom: 220, right: 0, width: 130, background: "rgba(255,59,127,0.16)" }} />
  </AbsoluteFill>
);

export const Reel: React.FC<ReelProps> = ({ slug, data, config, audio, music, guides, noCaption }) => {
  const [handle] = useState(() => delayRender("fonts"));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    fontsReady.then(() => {
      setReady(true);
      continueRender(handle);
    });
  }, [handle]);
  const theme = useMemo(() => withOverrides(base, config.theme), [config.theme]);
  setEntrance(theme.entrance);
  const tl = useMemo(() => buildTimeline(data, theme), [data, theme]);
  if (!ready) return null;
  // an optional layer over every scene for the whole reel ("__overlay" in the scene map), such as a logo in a corner
  const Overlay = reels[slug]?.__overlay;
  return (
    <ReelContext.Provider value={{ theme, tl }}>
      <AbsoluteFill>
        <Ground />
        <Stage scenes={reels[slug] ?? {}} />
        {Overlay && <Overlay />}
        {!noCaption && <Caption />}
        <Chrome config={config.chrome} />
        {guides && <Guides />}
        {audio && <Audio src={staticFile(audio)} />}
        {music && <MusicBed src={music} config={config} frames={tl.frames} fps={tl.fps} />}
      </AbsoluteFill>
    </ReelContext.Provider>
  );
};
