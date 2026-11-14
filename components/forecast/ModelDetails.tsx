"use client";

// くわしく：4つの升目（MSM 2点・ECMWF・ICON）の風向・風速・表
import { useState } from "react";
import LineChart from "@/components/charts/LineChart";
import {
  HOURS,
  MODEL_KEYS,
  MODEL_META,
  STRIP_HOURS,
  angDiff,
  circMean,
  idx,
  norm,
  spreadAt,
  weatherText,
  type Day,
  type Summary,
} from "@/lib/wind";

const HOUR_TICKS = [6, 8, 10, 12, 14, 16, 18];
const hf = (h: number) => `${h}:00`;

export default function ModelDetails({ day, summary }: { day: Day; summary: Summary }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="more" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>
        くわしく：3モデルの予報を比べる<span>MSM · ECMWF · ICON</span>
      </summary>
      {open && <Body day={day} summary={summary} />}
    </details>
  );
}

function Body({ day, summary: s }: { day: Day; summary: Summary }) {
  // 風向は1日の平均を中心に連続した値へ直す（359°→1° の飛びをなくす）
  const ref = circMean(day.best.dir.slice(idx(8), idx(18)));
  const unwrapped = Object.fromEntries(MODEL_KEYS.map((k) => [k, day.raw[k].dir.map((v) => ref + angDiff(v, ref))]));
  const all = Object.values(unwrapped).flat();
  const lo = Math.floor((Math.min(...all) - 10) / 20) * 20;
  const hi = Math.ceil((Math.max(...all) + 10) / 20) * 20;
  const step = hi - lo > 120 ? 40 : 20;
  const dirTicks = Array.from({ length: Math.floor((hi - lo) / step) + 1 }, (_, i) => lo + i * step);

  const speeds = MODEL_KEYS.flatMap((k) => [...day.raw[k].spd, ...day.raw[k].gust.filter((v): v is number => v != null)]);
  const top = Math.max(6, Math.ceil((Math.max(...speeds) + 1) / 2) * 2);
  const sStep = top > 10 ? 4 : 2;
  const spdTicks = Array.from({ length: top / sStep + 1 }, (_, i) => i * sStep);

  return (
    <div className="inner">
      <div className="ph" style={{ margin: 0 }}>
        <h2>風向の時間変化</h2>
        <div className="legend">
          {MODEL_KEYS.map((k) => (
            <span key={k}>
              <i
                style={{
                  background: MODEL_META[k].dash
                    ? `repeating-linear-gradient(90deg,${MODEL_META[k].color} 0 4px,transparent 4px 7px)`
                    : MODEL_META[k].color,
                }}
              />
              {MODEL_META[k].name}
            </span>
          ))}
        </div>
      </div>
      <LineChart
        label="風向の時間変化"
        height={240}
        x={[6, 18]}
        y={[lo, hi]}
        xTicks={HOUR_TICKS}
        yTicks={dirTicks}
        xFormat={hf}
        yFormat={(v) => `${norm(v)}°`}
        shade={[[10, 15]]}
        series={MODEL_KEYS.map((k) => ({
          pts: HOURS.map((h, i) => [h, unwrapped[k][i]] as [number, number]),
          color: MODEL_META[k].color,
          width: 2.2,
          dash: MODEL_META[k].dash,
        }))}
      >
        {({ x, y }) =>
          s.big && s.startH != null ? (
            <g>
              <line x1={x(s.startH)} x2={x(s.startH)} y1={y(hi)} y2={y(lo)} strokeDasharray="3 3" style={{ stroke: "var(--warn)" }} />
              <text x={x(s.startH) + 5} y={y(lo) - 6} style={{ fill: "var(--warn)" }}>
                {s.side}振れ（MSM）
              </text>
            </g>
          ) : null
        }
      </LineChart>
      <div className="ph" style={{ margin: 0 }}>
        <h2>風速</h2>
        <p>m/s · 点線は突風（MSMは突風の予報なし）</p>
      </div>
      <LineChart
        label="風速の時間変化"
        height={160}
        x={[6, 18]}
        y={[0, top]}
        xTicks={HOUR_TICKS}
        yTicks={spdTicks}
        xFormat={hf}
        shade={[[10, 15]]}
        series={MODEL_KEYS.flatMap((k) => {
          const m = day.raw[k];
          const out = [{ pts: HOURS.map((h, i) => [h, m.spd[i]] as [number, number]), color: MODEL_META[k].color, width: 2.2, dash: MODEL_META[k].dash }];
          if (m.gust.every((v) => v != null))
            out.push({ pts: HOURS.map((h, i) => [h, m.gust[i] as number] as [number, number]), color: MODEL_META[k].color, width: 1.1, dash: "2 3" });
          return out;
        })}
      />
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>時刻</th>
              {MODEL_KEYS.map((k) => (
                <th key={k}>{MODEL_META[k].short}</th>
              ))}
              <th>風速 m/s</th>
              <th>モデルの差</th>
              <th>天気</th>
            </tr>
          </thead>
          <tbody>
            {STRIP_HOURS.map((h) => {
              const i = idx(h);
              const sp = spreadAt(day, h);
              const v = MODEL_KEYS.map((k) => day.raw[k].spd[i]);
              return (
                <tr key={h}>
                  <td className="num">{h}:00</td>
                  {MODEL_KEYS.map((k) => (
                    <td key={k} className="num">
                      {Math.round(norm(day.raw[k].dir[i]))}°
                    </td>
                  ))}
                  <td className="num">
                    {Math.min(...v).toFixed(1)}–{Math.max(...v).toFixed(1)}
                  </td>
                  <td>
                    <span className={`tag num ${sp < 20 ? "lo" : sp < 45 ? "mid" : "hi"}`}>{Math.round(sp)}°</span>
                  </td>
                  <td>{weatherText(day.raw.wx[i])}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
