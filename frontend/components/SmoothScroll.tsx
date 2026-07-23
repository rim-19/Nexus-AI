"use client";
import { ReactLenis } from "lenis/react";

/** App-wide smooth scrolling (Lenis). Wrap the app once at the root. */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  return (
    <ReactLenis root options={{ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 }}>
      {children}
    </ReactLenis>
  );
}
