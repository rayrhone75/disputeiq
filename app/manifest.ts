import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DisputeIQ — Credit Action Platform",
    short_name: "DisputeIQ",
    description:
      "Analyze your tri-merge credit report, draft FCRA-grounded dispute packets, and send them via certified mail — all in one flow.",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0f1a",
    theme_color: "#6366f1",
    categories: ["finance", "productivity", "business"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
