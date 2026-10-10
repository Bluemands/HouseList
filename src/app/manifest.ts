import type { MetadataRoute } from "next";

// Lets both of you "Add to Home Screen" and open it like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "The House List",
    short_name: "House List",
    description: "Our jobs, buys and budget for the house.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f0ea",
    theme_color: "#f3f0ea",
    icons: [{ src: "/apple-icon", sizes: "180x180", type: "image/png" }],
  };
}
