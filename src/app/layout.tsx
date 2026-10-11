import type { Metadata } from "next";
import { DM_Sans, Outfit } from "next/font/google";
import "mapbox-gl/dist/mapbox-gl.css";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });

export const metadata: Metadata = {
  title: "PPSU Campus 3D | Explore. Navigate. Experience.",
  description:
    "Explore the verified campus of P. P. Savani University in Dhamdod, Kosamba, Gujarat.",
  metadataBase: new URL("https://ppsu-campus-3d.vercel.app"),
  openGraph: {
    title: "PPSU Campus 3D — Explore. Navigate. Experience.",
    description: "A digital guide to the PPSU main campus in Dhamdod, Gujarat.",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} ${dmSans.variable}`}>{children}</body>
    </html>
  );
}