export * from "./plugin-types";
export * from "./plugin-manager";
export * from "./eco-render-plugin";
export * from "./vhs-retro-plugin";
export * from "./cyberpunk-neon-plugin";
export * from "./film-grain-plugin";
export * from "./glitch-plugin";
export * from "./noir-plugin";
export * from "./fun-filter-plugins";
export * from "./photo-filter-plugins";

import { ecoRenderPlugin } from "./eco-render-plugin";
import { vhsRetroPlugin } from "./vhs-retro-plugin";
import { cyberpunkNeonPlugin } from "./cyberpunk-neon-plugin";
import { filmGrainPlugin } from "./film-grain-plugin";
import { glitchPlugin } from "./glitch-plugin";
import { noirPlugin } from "./noir-plugin";
import { FUN_FILTER_PLUGINS } from "./fun-filter-plugins";
import { PHOTO_FILTER_PLUGINS } from "./photo-filter-plugins";
import type { VideoPlugin } from "./plugin-types";

export const BUILTIN_VIDEO_PLUGINS: VideoPlugin[] = [
  ecoRenderPlugin,
  vhsRetroPlugin,
  cyberpunkNeonPlugin,
  filmGrainPlugin,
  glitchPlugin,
  noirPlugin,
  ...FUN_FILTER_PLUGINS,
  ...PHOTO_FILTER_PLUGINS,
];
