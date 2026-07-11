import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Parchment — Coffee Sourcing Intelligence",
    short_name: "Parchment",
    description:
      "A second brain for green coffee: origins, harvest calendars, a live seasonality map, weather-risk flags, tasting journal and a buy-now board.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4efe4",
    theme_color: "#a0562e",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
