"use client";

// 「実測と答え合わせ」タブ（第2段階のサンプル。かんたん記録は試せる）
import { useState } from "react";
import LineChart from "@/components/charts/LineChart";
import { MODEL_ERRORS, OSCILLATION } from "@/lib/samples";

const SOURCES = [
  { ico: "✈", title: "長崎空港の観測（自動）", text: "湾内にある空港の公開観測。毎時、風向・風速を自動で保存", tag: ["lo", "自動・稼働中"] },
  { ico: "AM", title: "アメダス（自動）", text: "湾周辺の観測点を10分ごとに保存", tag: ["mid", "今後"] },
  { ico: "✎", title: "部員のかんたん記録", text: "練習中にスマホで「振れた」をタップ。本部船のハンドコンパスの値も入力可", tag: ["mid", "手入力"] },
  { ico: "GPS", title: "スマホのGPSログ（第3段階）", text: "防水ケースに入れたスマホで航跡を記録 → アップロード", tag: ["mid", "今後"] },
];

const QUICK = [
  { cls: "l", label: "◀ 左振れ", sub: "反時計回り", text: "左に振れた" },
  { cls: "g", label: "ブロー", sub: "強い風", text: "ブローが来た" },
  { cls: "r", label: "右振れ ▶", sub: "時計回り", text: "右に振れた" },
];

export default function ObsView() {
  const [log, setLog] = useState([
    { t: "10:42", text: "右に振れた · 本部船 340°" },
    { t: "10:35", text: "ブローが来た · 右海面" },
    { t: "10:31", text: "左に振れた · 本部船 326°" },
  ]);
  const record = (text: string) => {
    const n = new Date();
    const t = `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
    setLog((l) => [{ t, text: `${text} · 記録しました` }, ...l]);
  };

  return (
    <section className="view">
      <div className="grid2">
        <div className="panel">
          <div className="ph">
            <h2>実測データの入手先</h2>
            <p>計測器がなくても始められます</p>
          </div>
          <div className="srcs">
            {SOURCES.map((s) => (
              <div key={s.title} className="src">
                <div className="ico">{s.ico}</div>
                <div>
                  <b>{s.title}</b>
                  <span>{s.text}</span>
                </div>
                <span className={`tag ${s.tag[0]}`}>{s.tag[1]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <div className="ph">
            <h2>かんたん記録</h2>
            <p>海の上でタップするだけ（試せます・保存はまだされません）</p>
          </div>
          <div className="quick">
            {QUICK.map((q) => (
              <button key={q.cls} type="button" className={`qb ${q.cls}`} onClick={() => record(q.text)}>
                {q.label}
                <small>{q.sub}</small>
              </button>
            ))}
          </div>
          <ul className="log">
            {log.map((l, i) => (
              <li key={`${l.t}-${i}`}>
                <span className="num">{l.t}</span>
                {l.text}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid2">
        <div className="panel">
          <div className="ph">
            <h2>どのモデルがよく当たる？（サンプル）</h2>
            <p>長崎空港の観測と比べた平均の外れ</p>
          </div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            風向
          </div>
          <Bars rows={MODEL_ERRORS.dir} max={15} unit="°" />
          <div className="eyebrow" style={{ margin: "16px 0 8px" }}>
            風速
          </div>
          <Bars rows={MODEL_ERRORS.spd} max={2} unit="m/s" />
        </div>
        <div className="panel">
          <div className="ph">
            <h2>予報のクセ（サンプル）</h2>
          </div>
          <p className="note">
            大村湾では <b>MSM が風向を平均 8° 左寄り</b>に予報する傾向。明日の MSM の予報も、右に 8° ずらして読むのがおすすめ。
          </p>
          <p className="note" style={{ marginTop: 10 }}>
            冬型の日は <b>ECMWF の風速がやや弱め</b>（−1.1 m/s）。
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="ph">
          <h2>風の振れの記録（サンプル）</h2>
          <p>平均からのずれ。右振れ＝緑、左振れ＝赤</p>
        </div>
        <LineChart
          label="風の振れ"
          height={200}
          x={[10, 15]}
          y={[-20, 20]}
          xTicks={[10, 11, 12, 13, 14, 15]}
          yTicks={[-20, -10, 0, 10, 20]}
          xFormat={(h) => `${h}:00`}
          yFormat={(v) => `${v > 0 ? "+" : ""}${v}°`}
          series={[]}
        >
          {({ x, y }) => (
            <g>
              {OSCILLATION.slice(1).map(([t, v], j) => {
                const [t0, v0] = OSCILLATION[j];
                return <line key={t} x1={x(t0)} y1={y(v0)} x2={x(t)} y2={y(v)} strokeWidth={1.8} style={{ stroke: v >= 0 ? "var(--right)" : "var(--left)" }} />;
              })}
              <line x1={x(10)} x2={x(15)} y1={y(0)} y2={y(0)} style={{ stroke: "var(--ink-3)" }} />
            </g>
          )}
        </LineChart>
      </div>
    </section>
  );
}

function Bars({ rows, max, unit }: { rows: { name: string; value: number; color: string }[]; max: number; unit: string }) {
  return (
    <div className="bars">
      {rows.map((r) => (
        <div key={r.name} className="bar">
          <span>{r.name}</span>
          <div className="track">
            <div className="fill" style={{ width: `${(r.value / max) * 100}%`, background: r.color }} />
          </div>
          <span className="num">
            {r.value}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}
