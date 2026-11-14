"use client";

// 折れ線グラフ（SVG）。幅は親要素に合わせて自動で決まる
import { useEffect, useRef, useState, type ReactNode } from "react";

export type Series = { pts: [number, number][]; color: string; width?: number; dash?: string; opacity?: number; endDot?: boolean };
export type Scale = { x: (v: number) => number; y: (v: number) => number; width: number; height: number };

type Props = {
  height: number;
  x: [number, number];
  y: [number, number];
  xTicks: number[];
  yTicks: number[];
  xFormat?: (v: number) => string;
  yFormat?: (v: number) => string;
  shade?: [number, number][];
  series: Series[];
  children?: (s: Scale) => ReactNode; // 線の上に重ねる注記など
  label?: string;
};

const M = { l: 40, r: 12, t: 10, b: 24 };

export default function LineChart(p: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(200, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = p.height;
  const x = (v: number) => M.l + ((v - p.x[0]) / (p.x[1] - p.x[0])) * (width - M.l - M.r);
  const y = (v: number) => H - M.b - ((v - p.y[0]) / (p.y[1] - p.y[0])) * (H - M.t - M.b);
  const path = (pts: [number, number][]) => pts.map(([a, b], i) => `${i ? "L" : "M"}${x(a).toFixed(1)},${y(b).toFixed(1)}`).join("");

  return (
    <svg ref={ref} className="chart" height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label={p.label}>
      {p.yTicks.map((t) => (
        <g key={`y${t}`}>
          <line x1={M.l} x2={width - M.r} y1={y(t)} y2={y(t)} style={{ stroke: "var(--line)" }} />
          <text x={M.l - 6} y={y(t) + 4} textAnchor="end">
            {p.yFormat ? p.yFormat(t) : t}
          </text>
        </g>
      ))}
      {p.xTicks.map((t) => (
        <text key={`x${t}`} x={x(t)} y={H - 6} textAnchor="middle">
          {p.xFormat ? p.xFormat(t) : t}
        </text>
      ))}
      {p.shade?.map(([a, b]) => (
        <rect key={`s${a}`} x={x(a)} y={M.t} width={x(b) - x(a)} height={H - M.t - M.b} style={{ fill: "var(--accent)", opacity: 0.06 }} />
      ))}
      {p.series.map((s, i) => (
        <g key={i}>
          <path
            d={path(s.pts)}
            fill="none"
            strokeWidth={s.width ?? 2}
            strokeDasharray={s.dash}
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ stroke: s.color, opacity: s.opacity ?? 1 }}
          />
          {s.endDot && s.pts.length > 0 && (
            <circle cx={x(s.pts[s.pts.length - 1][0])} cy={y(s.pts[s.pts.length - 1][1])} r={3.5} style={{ fill: s.color }} />
          )}
        </g>
      ))}
      {p.children?.({ x, y, width, height: H })}
    </svg>
  );
}
