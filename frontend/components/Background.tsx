import { Particles } from "@/components/Particles";

/** Animated gradient-mesh background: drifting blurred blobs + constellation + film grain. */
export function Background() {
  return (
    <div className="noise pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
      <Particles />
      <div className="animate-blob absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-brand-blue/20 blur-[130px]" />
      <div className="animate-blob absolute -right-40 top-1/3 h-[480px] w-[480px] rounded-full bg-brand-purple/20 blur-[130px]"
        style={{ animationDelay: "-8s" }} />
      <div className="animate-blob absolute -bottom-40 left-1/3 h-[460px] w-[460px] rounded-full bg-brand-cyan/15 blur-[130px]"
        style={{ animationDelay: "-14s" }} />
      {/* vignette to keep edges dark */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,hsl(var(--background))_100%)]" />
    </div>
  );
}
