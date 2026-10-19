import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gingerbread",
    short_name: "Gingerbread",
    description: "A private, end-to-end encrypted journal.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbf4e6",
    theme_color: "#c87a4a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
