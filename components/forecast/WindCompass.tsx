// 目盛り付きのコンパス。風が吹いてくる方角に印を付け、中心を通って風が吹いていく向きに矢印を描く。
// base（10–11時の平均）を薄い印で示し、今の風向との差を弧で塗る（右振れ＝緑、左振れ＝赤）。
import { angDiff, norm } from "@/lib/wind";

type Props = { dir: number; base: number; size?: number };

const C = 60; // viewBox 120 の中心
const pt = (deg: number, r: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [C + r * Math.sin(a), C - r * Math.cos(a)];
};
const LABELS: Record<number, string> = { 0: "N", 90: "E", 180: "S", 270: "W" };

export default function WindCompass({ dir, base, size = 112 }: Props) {
  const d = norm(dir);
  const b = norm(base);
  const shift = angDiff(d, b);
  const shiftColor = Math.abs(shift) < 3 ? "var(--ink-3)" : shift > 0 ? "var(--right)" : "var(--left)";

  // 振れの弧（半径 47）
  const [ax, ay] = pt(b, 47);
  const [bx, by] = pt(d, 47);
  const arc = `M${ax.toFixed(1)},${ay.toFixed(1)} A47,47 0 0 ${shift > 0 ? 1 : 0} ${bx.toFixed(1)},${by.toFixed(1)}`;

  // 矢印：風上側の外周 → 中心 → 風下側（矢じり）
  const [tx, ty] = pt(d, 40);
  const [hx, hy] = pt(d + 180, 36);
  const head = [pt(d + 180, 42), pt(d + 180 - 12, 31), pt(d + 180 + 12, 31)];
  // 風上側の外周の印（内向きの三角）
  const tip = [pt(d, 42), pt(d - 7, 55), pt(d + 7, 55)];
  const baseTip = [pt(b, 44), pt(b - 5, 54), pt(b + 5, 54)];
  const poly = (ps: [number, number][]) => ps.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={`風向 ${Math.round(d)}°`} className="compass">
      <circle cx={C} cy={C} r={56} style={{ fill: "var(--surface)", stroke: "var(--line)" }} />
      {/* 目盛り：10°ごと、30°ごとに長く */}
      {Array.from({ length: 36 }, (_, i) => i * 10).map((deg) => {
        const long = deg % 30 === 0;
        const [x1, y1] = pt(deg, 56);
        const [x2, y2] = pt(deg, long ? 49 : 52);
        return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={long ? 1.4 : 0.8} style={{ stroke: "var(--ink-3)" }} />;
      })}
      {Array.from({ length: 12 }, (_, i) => i * 30).map((deg) => {
        const [x, y] = pt(deg, 41);
        const card = LABELS[deg];
        return (
          <text
            key={deg}
            x={x}
            y={y + 3}
            textAnchor="middle"
            fontSize={card ? 10 : 7.5}
            fontWeight={card ? 700 : 400}
            style={{ fill: card ? "var(--ink)" : "var(--ink-3)", fontFamily: "var(--f-mono)" }}
          >
            {card ?? deg}
          </text>
        );
      })}
      {/* 振れの弧と 10–11時の印 */}
      {Math.abs(shift) >= 1 && <path d={arc} fill="none" strokeWidth={6} strokeLinecap="round" style={{ stroke: shiftColor, opacity: 0.55 }} />}
      <polygon points={poly(baseTip)} style={{ fill: "var(--ink-3)", opacity: 0.7 }} />
      {/* 矢印 */}
      <line x1={tx} y1={ty} x2={hx} y2={hy} strokeWidth={3.2} strokeLinecap="round" style={{ stroke: "var(--accent)" }} />
      <polygon points={poly(head)} style={{ fill: "var(--accent)" }} />
      <polygon points={poly(tip)} style={{ fill: "var(--accent)", stroke: "var(--surface)", strokeWidth: 1 }} />
      <circle cx={C} cy={C} r={3} style={{ fill: "var(--ink)" }} />
    </svg>
  );
}
