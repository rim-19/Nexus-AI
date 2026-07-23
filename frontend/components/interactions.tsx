"use client";
import { useRef } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";

/** Element that magnetically drifts toward the cursor while hovered. */
export function Magnetic({ children, className, strength = 0.4 }: {
  children: React.ReactNode; className?: string; strength?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0), y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 15 });
  const sy = useSpring(y, { stiffness: 200, damping: 15 });
  return (
    <motion.div
      ref={ref} style={{ x: sx, y: sy }} className={className}
      onMouseMove={(e) => {
        const r = ref.current!.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onMouseLeave={() => { x.set(0); y.set(0); }}>
      {children}
    </motion.div>
  );
}

/** Card that tilts in 3D toward the cursor. */
export function Tilt({ children, className, max = 9 }: {
  children: React.ReactNode; className?: string; max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rx = useMotionValue(0), ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 200, damping: 20 });
  const sry = useSpring(ry, { stiffness: 200, damping: 20 });
  return (
    <motion.div
      ref={ref}
      style={{ rotateX: srx, rotateY: sry, transformPerspective: 900 }}
      className={className}
      onMouseMove={(e) => {
        const r = ref.current!.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        ry.set(px * max); rx.set(-py * max);
      }}
      onMouseLeave={() => { rx.set(0); ry.set(0); }}>
      {children}
    </motion.div>
  );
}
