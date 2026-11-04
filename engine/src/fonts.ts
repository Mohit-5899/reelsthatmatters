// Fonts a theme can pick from. For a different face, load it in this file, then set theme.font in that reel's reel.json.
import { loadFont as inter } from "@remotion/google-fonts/Inter";
import { loadFont as jetbrains } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as geist } from "@remotion/google-fonts/Geist";
import { loadFont as geistMono } from "@remotion/google-fonts/GeistMono";

const opts = { subsets: ["latin" as const] };
export const fontsReady = Promise.all([
  inter("normal", { weights: ["400", "500", "600", "700", "800", "900"], ...opts }).waitUntilDone(),
  jetbrains("normal", { weights: ["400", "700"], ...opts }).waitUntilDone(),
  geist("normal", { weights: ["400", "500", "600", "700"], ...opts }).waitUntilDone(),
  geistMono("normal", { weights: ["400", "500"], ...opts }).waitUntilDone(),
]);
