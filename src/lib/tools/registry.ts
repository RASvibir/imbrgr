export type ToolCategory = "photo" | "video" | "gif" | "fun" | "ar";
export type ToolStatus = "live" | "beta" | "soon";

export interface ToolLandingInfo {
  id?: string;
  order?: number;
  outcome: string;
  promise: string;
  cta?: string;
  badge?: string;
}

export interface OutcomeTool {
  id: string;
  outcome: string;
  promise: string;
  cta: string;
  href: string;
  badge?: string;
}

export interface ToolDefinition {
  id: string;
  title: string;
  tagline: string;
  description: string;
  href: string;
  emoji: string;
  category: ToolCategory;
  badge?: string;
  status: ToolStatus;
  featureChips: string[];
  features: string[];
  cta: string;
  popular?: boolean;
  gradient: string;
  inCreateHub?: boolean;
  landing?: ToolLandingInfo;
}

export interface ToolCategoryInfo {
  id: ToolCategory | "all";
  label: string;
  emoji: string;
  description: string;
}

export const TOOL_CATEGORIES: ToolCategoryInfo[] = [
  { id: "all", label: "All Tools", emoji: "🧰", description: "Browse the full creative suite" },
  { id: "photo", label: "Photo", emoji: "🖼️", description: "Image generation, retouching & collages" },
  { id: "video", label: "Video", emoji: "🎬", description: "AI video generation, timelines & shaders" },
  { id: "gif", label: "GIF", emoji: "🎞️", description: "Video to GIF, animated bursts & loops" },
  { id: "fun", label: "Fun & Memes", emoji: "🐸", description: "Viral memes, glitch FX & stickers" },
  { id: "ar", label: "AR & Vision", emoji: "👁️", description: "Real-time face tracking & AR filters" },
];

export const TOOLS: ToolDefinition[] = [
  {
    id: "image",
    title: "AI Image Studio",
    tagline: "Prompt, refine, and convert",
    description:
      "Generate photorealistic art from text prompts, erase blemishes, refine variations, and convert between WebP, PNG, JPEG, and AVIF.",
    href: "/studio",
    emoji: "✨",
    category: "photo",
    badge: "Core Studio",
    status: "live",
    featureChips: ["Text-to-Image AI", "Spot Eraser & Brush", "Multi-format Convert", "Instant Download"],
    features: ["Text-to-Image AI", "Spot Eraser & Brush", "Multi-format Convert", "Instant Download"],
    cta: "Open image studio",
    popular: true,
    gradient: "from-orange-500/10 via-amber-500/5 to-transparent",
    inCreateHub: true,
    landing: {
      id: "ai",
      outcome: "Generate images & video with AI",
      promise:
        "Cook fresh images, text-to-video clips, and motion loops, then trim them on the timeline.",
      cta: "Generate with AI",
      badge: "AI Kitchen",
      order: 6,
    },
  },
  {
    id: "video",
    title: "AI Video Studio",
    tagline: "CapCut timeline & pacNcap engine",
    description:
      "Generate AI motion video, stitch multi-track clips, apply Ken Burns camera sweeps, and render with real-time pacNcap shader plugins.",
    href: "/studio?tab=video",
    emoji: "🎬",
    category: "video",
    badge: "⚡ pacNcap Engine",
    status: "live",
    featureChips: ["AI Text & Image to Video", "Multi-Track Timeline", "Hot-swappable Shaders", "WebM/MP4 Export"],
    features: ["AI Text & Image to Video", "Multi-Track Timeline", "Hot-swappable Shaders", "WebM/MP4 Export"],
    cta: "Open video studio",
    popular: true,
    gradient: "from-amber-500/10 via-rose-500/5 to-transparent",
    inCreateHub: true,
  },
  {
    id: "fun",
    title: "Fun Filters & Magic Lab",
    tagline: "Effects, memes, and shaders",
    description:
      "Text overlays, retro VHS tape distortion, cyberpunk glow, scanline tearing, speed controls, and one-click GIF/video publishing.",
    href: "/studio?tab=video&mode=fun",
    emoji: "🎉",
    category: "fun",
    badge: "Creative FX",
    status: "live",
    featureChips: ["Retro VHS & Glitch", "Caption Overlays", "Eco Scrub Bypass", "1-Click Gallery Post"],
    features: ["Retro VHS & Glitch", "Caption Overlays", "Eco Scrub Bypass", "1-Click Gallery Post"],
    cta: "Launch fun tools",
    popular: true,
    gradient: "from-rose-500/10 via-purple-500/5 to-transparent",
    inCreateHub: true,
  },
  {
    id: "shaders",
    title: "Shader Plugins",
    tagline: "Real-time visual FX shaders",
    description:
      "Vintage CRT, glitch chromatic aberration, noir black & white, and cyberpunk glow shaders for video clips and canvases.",
    href: "/studio?tab=video&mode=plugins",
    emoji: "⚡",
    category: "video",
    badge: "pacNcap FX",
    status: "live",
    featureChips: ["Real-Time WebGL", "6+ Shaders", "Hardware Accelerated", "Live Preview"],
    features: ["Real-Time WebGL", "6+ Shaders", "Hardware Accelerated", "Live Preview"],
    cta: "Explore shaders",
    popular: false,
    gradient: "from-cyan-500/10 via-blue-500/5 to-transparent",
  },
  {
    id: "meme",
    title: "Meme Maker",
    tagline: "Top & bottom text, modern templates",
    description:
      "Create viral memes in seconds with classic Impact captions, modern Twitter-style bars, sticker overlays, and instant download.",
    href: "/tools/meme",
    emoji: "🐸",
    category: "fun",
    badge: "Viral Meme",
    status: "live",
    featureChips: ["Classic & Modern Layouts", "Custom Font Styling", "Instant Export", "Zero Watermark"],
    features: ["Classic & Modern Layouts", "Custom Font Styling", "Instant Export", "Zero Watermark"],
    cta: "Create a meme",
    popular: true,
    gradient: "from-emerald-500/10 via-teal-500/5 to-transparent",
    landing: {
      id: "meme",
      outcome: "Make a meme",
      promise: "Drop punchlines, classic caption text, and stickers in seconds.",
      cta: "Make a meme",
      badge: "Viral Classic",
      order: 1,
    },
  },
  {
    id: "gif",
    title: "GIF Maker",
    tagline: "Video to GIF, frame bursts, loops",
    description:
      "Convert video clips or frame sequences into ultra-crisp, optimized animated GIFs with gifenc client-side quantization.",
    href: "/tools/gif",
    emoji: "🎞️",
    category: "gif",
    badge: "High-FPS GIF",
    status: "live",
    featureChips: ["Video to GIF", "Burst Animation", "gifenc Quantization", "Smooth Looping"],
    features: ["Video to GIF", "Burst Animation", "gifenc Quantization", "Smooth Looping"],
    cta: "Make a GIF",
    popular: true,
    gradient: "from-purple-500/10 via-pink-500/5 to-transparent",
    landing: {
      id: "gif",
      outcome: "Turn a video into a GIF",
      promise: "Trim, scrub, and export lightweight looping GIFs with zero lag.",
      cta: "Create a GIF",
      badge: "Loop Ready",
      order: 2,
    },
  },
  {
    id: "collage",
    title: "Collage Builder",
    tagline: "Multi-photo grids, polaroids, layouts",
    description:
      "Combine multiple photos into beautiful grids, side-by-side comparisons, polaroid stacks, and social story collages.",
    href: "/tools/collage",
    emoji: "🖼️",
    category: "photo",
    badge: "Collage Grid",
    status: "live",
    featureChips: ["Multi-Image Grids", "Custom Spacing & Radius", "High-Res Export", "Canvas Layouts"],
    features: ["Multi-Image Grids", "Custom Spacing & Radius", "High-Res Export", "Canvas Layouts"],
    cta: "Build collage",
    popular: false,
    gradient: "from-blue-500/10 via-indigo-500/5 to-transparent",
    landing: {
      id: "collage",
      outcome: "Combine photos",
      promise: "Arrange side-by-side comparisons, multi-shots, and clean grids.",
      cta: "Combine photos",
      badge: "Multi-Shot",
      order: 3,
    },
  },
  {
    id: "filters",
    title: "Photo Filters & Video Looks",
    tagline: "Presets, film grain, color grading",
    description:
      "Transform your photos and videos with instant aesthetic presets, analog film grain, duotone vibes, and exposure curve controls.",
    href: "/tools/filters",
    emoji: "🎨",
    category: "photo",
    badge: "Client FX",
    status: "live",
    featureChips: ["Photos & Videos", "Film Looks & Duotone", "Exposure & Contrast", "PNG, JPEG, WebP & WebM Export"],
    features: ["Photos & Videos", "Film Looks & Duotone", "Exposure & Contrast", "PNG, JPEG, WebP & WebM Export"],
    cta: "Apply filters",
    popular: false,
    gradient: "from-fuchsia-500/10 via-rose-500/5 to-transparent",
    landing: {
      id: "style",
      outcome: "Style a photo or video",
      promise: "Flame-grill, deep-fry, and apply retro halftone and VHS shaders.",
      cta: "Style your media",
      badge: "Sizzle & Shaders",
      order: 4,
    },
  },
  {
    id: "ar",
    title: "AR Camera",
    tagline: "Live face tracking & burger AR effects",
    description:
      "Real-time face tracking with procedural burger hats, cheese drips, condiment staches, flame halo, sunglasses, and retro HUD filters directly in your browser.",
    href: "/tools/ar",
    emoji: "🍔",
    category: "ar",
    badge: "AI Vision",
    status: "live",
    featureChips: ["MediaPipe Vision", "Live Face Tracking", "Procedural AR Effects", "Snap & Video Record"],
    features: ["MediaPipe Vision", "Live Face Tracking", "Procedural AR Effects", "Snap & Video Record"],
    cta: "Launch AR camera",
    popular: true,
    gradient: "from-sky-500/10 via-teal-500/5 to-transparent",
    landing: {
      id: "ar",
      outcome: "Try a face effect",
      promise: "Live interactive burger hats, glowing heat vision, and AR masks.",
      cta: "Try face effects",
      badge: "Realtime Face AR",
      order: 5,
    },
  },
];

export function getToolById(id: string): ToolDefinition | undefined {
  return TOOLS.find((tool) => tool.id === id);
}

export function getToolsByCategory(category: ToolCategory | "all"): ToolDefinition[] {
  if (category === "all") return TOOLS;
  return TOOLS.filter((tool) => tool.category === category);
}

export function getPopularTools(): ToolDefinition[] {
  return TOOLS.filter((tool) => tool.popular);
}

export function getCreateHubTools(): ToolDefinition[] {
  return TOOLS.filter((tool) => tool.inCreateHub);
}

export function getNoveltyTools(): ToolDefinition[] {
  return TOOLS.filter((tool) => tool.href.startsWith("/tools/"));
}

export function getLandingTools(): OutcomeTool[] {
  return TOOLS.filter(
    (tool): tool is ToolDefinition & { landing: ToolLandingInfo } =>
      Boolean(tool.landing),
  )
    .sort((a, b) => (a.landing.order ?? 0) - (b.landing.order ?? 0))
    .map((tool) => ({
      id: tool.landing.id ?? tool.id,
      outcome: tool.landing.outcome,
      promise: tool.landing.promise,
      cta: tool.landing.cta ?? tool.cta,
      href: tool.href,
      badge: tool.landing.badge ?? tool.badge,
    }));
}
