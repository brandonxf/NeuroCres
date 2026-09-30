import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NeuroCres",
  description:
    "Un espacio para comprenderte, orientarte y cuidar de tu bienestar.",
  applicationName: "NeuroCres",
  appleWebApp: { capable: true, title: "NeuroCres", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/192", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/192", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#214B45",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-CO"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
