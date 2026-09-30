import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NeuroCres",
    short_name: "NeuroCres",
    description:
      "Un espacio para comprenderte, orientarte y cuidar de tu bienestar.",
    lang: "es-CO",
    start_url: "/perfil",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#E8E4D8",
    theme_color: "#214B45",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/512-maskable",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
