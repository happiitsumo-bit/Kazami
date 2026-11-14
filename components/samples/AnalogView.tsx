"use client";

// 「似た日から読む」タブ（サンプル）
import { useState } from "react";
import LineChart from "@/components/charts/LineChart";
import { ANALOG_DAYS, ANALOG_MEDIAN } from "@/lib/samples";

const FILTERS = [
  ["冬型（西高東低）", true],
  ["風向 320–360°", true],
  ["風速 4–8 m/s", true],
  ["10–12月", true],
  ["晴れ", false],
  ["潮：上げ", false],
] as const;

export default function AnalogView() {
  const [picked, setPicked] = useState(-1);
  const [filters, setFilters] = useState<boolean[]>(FILTERS.map((f) => f[1]));

  return (
    <section className="view">
      <div className="panel">
        <p className="note" style={{ margin: "0 0 14px" }}>
          過去の実測データがまだないため、このタブはサンプル表示です。予報と観測の保存を始めると、実際の「似た日」に置き換わります。
        </p>
        <div className="answer">
          <div className="dots" aria-label="似た日 8日の結果">
            {ANALOG_DAYS.map((a) => (
              <i key={a.date} style={{ background: a.miss ? "var(--left)" : "var(--right)" }}>
                {a.miss ? "×" : "右"}
              </i>
            ))}
          </div>
          <div>
            <div className="eyebrow">明日と似た条件の過去 8日</div>
            <h2>8日中6日、昼すぎに右へ振れた。明日も右振れの可能性が高い</h2>
            <p>残りの2日は朝の北東の風が昼まで残り、北西の風が入りませんでした。</p>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="ph">
          <h2>この条件で探しています</h2>
          <p>タップで条件を外すと候補が増えます</p>
        </div>
        <div className="chips">
          {FILTERS.map(([label], i) => (
            <button
              key={label}
              type="button"
              className="chip"
              aria-pressed={filters[i]}
              onClick={() => setFilters((f) => f.map((v, j) => (j === i ? !v : v)))}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid2">
        <div className="panel">
          <div className="ph">
            <h2>似た日の風向の動き</h2>
            <div className="legend">
              <span>
                <i style={{ background: "var(--ink-3)" }} />
                似た日
              </span>
              <span>
                <i style={{ background: "var(--accent)", height: 4 }} />
                中央値
              </span>
            </div>
          </div>
          <LineChart
            label="似た日の風向"
            height={290}
            x={[10, 16]}
            y={[310, 370]}
            xTicks={[10, 11, 12, 13, 14, 15, 16]}
            yTicks={[310, 330, 350, 370]}
            xFormat={(h) => `${h}:00`}
            yFormat={(v) => `${v % 360}°`}
            series={[
              ...ANALOG_DAYS.map((a, k) => ({
                pts: a.pts,
                color: k === picked ? "var(--obs)" : "var(--ink-3)",
                width: k === picked ? 2 : 1,
                opacity: picked < 0 ? 0.28 : k === picked ? 1 : 0.15,
              })),
              { pts: ANALOG_MEDIAN, color: "var(--accent)", width: 3.5 },
            ]}
          />
          <p className="sample" style={{ margin: "8px 0 0" }}>
            ※ サンプルデータです
          </p>
        </div>
        <div className="panel">
          <div className="ph">
            <h2>似た日（似ている順）</h2>
            <p>タップでグラフを強調</p>
          </div>
          <div className="alist">
            {ANALOG_DAYS.map((a, k) => (
              <button key={a.date} type="button" className="arow" aria-pressed={k === picked} onClick={() => setPicked(k === picked ? -1 : k)}>
                <div className="score">
                  {a.score}
                  <small>%似</small>
                </div>
                <div>
                  <div className="d num">{a.date}</div>
                  <div className="m">
                    {a.pattern} ·{" "}
                    {a.miss ? <span style={{ color: "var(--left)" }}>北西の風が入らず</span> : <span style={{ color: "var(--right)" }}>右振れ +{a.shift}°</span>}
                  </div>
                </div>
                <svg viewBox="0 0 120 34" aria-hidden="true">
                  <path
                    d={a.pts.map(([t, v], j) => `${j ? "L" : "M"}${(((t - 10) / 6) * 118 + 1).toFixed(1)},${(34 - ((v - 310) / 60) * 34).toFixed(1)}`).join("")}
                    fill="none"
                    strokeWidth={1.4}
                    style={{ stroke: a.miss ? "var(--left)" : "var(--accent)" }}
                  />
                </svg>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="ph">
          <h2>似た日から言えること</h2>
        </div>
        <ul className="insights">
          <Insight big="6/8" title="13時前後に右へ振れた" text="平均 +14°。右海面へ早めに寄せた艇が有利だった日が多い。" />
          <Insight big="9分" title="午前の振れの周期" text="7–12分おきに左右 ±10° 前後。1レグに1回は振れが来る。" />
          <Insight big="+1.8" title="午後に上がる風速 (m/s)" text="12時→14時の平均。2レース目以降はハイクアウト前提で。" />
          <Insight big="2/8" title="予報どおりにならなかった日" text="朝8時に北東（30–60°）の風が吹いていたら、北西の風が入らないことがある。" />
        </ul>
      </div>
    </section>
  );
}

export function Insight({ big, title, text }: { big: string; title: string; text: string }) {
  return (
    <li>
      <span className="big num">{big}</span>
      <div>
        <b>{title}</b>
        <span>{text}</span>
      </div>
    </li>
  );
}
