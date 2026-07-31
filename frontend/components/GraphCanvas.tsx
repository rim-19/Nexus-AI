"use client";
import { memo, useCallback, useEffect, useRef } from "react";
import ForceGraph2D from "react-force-graph-2d";
import type { GraphData, GraphNode } from "@/lib/api";

const COLORS: Record<string, string> = { collection: "#22d3ee", document: "#b200ff", file: "#4f8bff" };

/** Client-only force graph. Memoized + stable callbacks so react-force-graph
 *  doesn't re-process on every parent re-render (which triggered dev warnings). */
function GraphCanvasImpl({ data, width, height, onSelect, focus }: {
  data: GraphData; width: number; height: number;
  onSelect: (n: GraphNode | null) => void;
  focus: { label: string; nonce: number } | null;
}) {
  const fgRef = useRef<any>(null);

  useEffect(() => {
    if (!focus?.label || !fgRef.current) return;
    const n: any = data.nodes.find((x) => x.label.toLowerCase().includes(focus.label.toLowerCase()));
    if (n && n.x != null) {
      fgRef.current.centerAt(n.x, n.y, 800);
      fgRef.current.zoom(5, 800);
      onSelect(n);
    }
  }, [focus?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, scale: number) => {
    const color = COLORS[node.type] || "#888";
    const r = node.type === "collection" ? 6 : node.type === "document" ? 4.5 : 3;
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.shadowColor = color; ctx.shadowBlur = 10;
    ctx.fillStyle = color; ctx.fill();
    ctx.shadowBlur = 0;
    if (node.type !== "file" || scale > 2.2) {
      const fs = 10 / scale;
      ctx.font = `${fs}px Inter, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.fillText(node.label, node.x, node.y + r + 1);
    }
  }, []);

  const linkColor = useCallback(() => "rgba(150,140,255,0.22)", []);
  const particleColor = useCallback(() => "rgba(120,200,255,0.6)", []);
  const handleClick = useCallback((n: any) => onSelect(n), [onSelect]);
  const handleBg = useCallback(() => onSelect(null), [onSelect]);

  return (
    <ForceGraph2D
      ref={fgRef}
      graphData={data as any}
      width={width} height={height}
      backgroundColor="rgba(0,0,0,0)"
      nodeLabel="label"
      linkColor={linkColor}
      linkDirectionalParticles={2}
      linkDirectionalParticleWidth={1.4}
      linkDirectionalParticleColor={particleColor}
      onNodeClick={handleClick}
      onBackgroundClick={handleBg}
      nodeCanvasObject={paintNode}
    />
  );
}

// react-force-graph re-processes graphData on every render; memo keeps it stable.
export default memo(GraphCanvasImpl, (a, b) =>
  a.data === b.data && a.width === b.width && a.height === b.height &&
  a.focus?.nonce === b.focus?.nonce && a.onSelect === b.onSelect);
