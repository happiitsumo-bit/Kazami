// 1時間ごとの風（矢印・風速・10–11時からの振れ・モデルの一致度）
import { STRIP_HOURS, compass, confidence, dirAt, idx, isRain, norm, shiftAt, speedAt, spreadAt, type Day } from "@/lib/wind";

type Props = { day: Day; hour: number; onHour: (h: number) => void };

export default function HourStrip({ day, hour, onHour }: Props) {
  return (
    <div className="strip">
      {STRIP_HOURS.map((h) => {
        const d = dirAt(day, h);
        const sh = shiftAt(day, h);
        const flat = Math.abs(sh) < 5;
        const c = flat ? "var(--ink-3)" : sh > 0 ? "var(--right)" : "var(--left)";
        const conf = confidence(spreadAt(day, h));
        return (
          <button key={h} type="button" className="hour" aria-pressed={h === hour} onClick={() => onHour(h)}>
            <span className="racebg">{h >= 10 && h <= 15 ? "練習" : ""}</span>
            <span className="t">{h}:00</span>
            <svg viewBox="0 0 40 40" aria-hidden="true">
              <circle cx="20" cy="20" r="18" fill="none" style={{ stroke: "var(--line)" }} />
              <g transform={`rotate(${d + 180} 20 20)`}>
                <path d="M20 6 L26 18 L21.5 16 L21.5 32 L18.5 32 L18.5 16 L14 18Z" style={{ fill: c }} />
              </g>
            </svg>
            <span className="d">
              {Math.round(norm(d))}° <small style={{ fontWeight: 400, color: "var(--ink-3)" }}>{compass(d)}</small>
            </span>
            <span className="s">
              {speedAt(day, h).toFixed(1)} m/s
              {isRain(day.raw.wx[idx(h)]) && (
                <>
                  {" · "}
                  <b style={{ color: "var(--accent)" }}>雨</b>
                </>
              )}
            </span>
            <span className="sh" style={{ color: c }}>
              {flat ? "変化なし" : `${sh > 0 ? "右 +" : "左 −"}${Math.round(Math.abs(sh))}°`}
            </span>
            <span className="conf" title="3モデルの一致度">
              {"●".repeat(conf) + "○".repeat(3 - conf)}
            </span>
            <span className="bar" style={{ background: c, opacity: flat ? 0.25 : 0.8 }} />
          </button>
        );
      })}
    </div>
  );
}
