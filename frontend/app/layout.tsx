import "./globals.css";
import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import { SmoothScroll } from "@/components/SmoothScroll";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = IBM_Plex_Mono({
  subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono", display: "swap",
});

export const metadata: Metadata = {
  title: "Nexus AI — Mission Control for Your Knowledge",
  description: "Upload anything. Ask anything. Watch your AI think.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${mono.variable}`}>
      <body>
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
