import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  const basePath = process.env.GITHUB_ACTIONS === "true" ? "/BlueSpherix" : "";

  return {
    name: "BlueSpherix — Trading Intelligence",
    short_name: "BlueSpherix",
    description: "Performance, risk and trading intelligence in one clear workspace.",
    start_url: `${basePath}/`,
    display: "standalone",
    background_color: "#070a0f",
    theme_color: "#070a0f",
    icons: [
      { src: `${basePath}/icon.svg`, sizes: "any", type: "image/svg+xml" },
    ],
  };
}
