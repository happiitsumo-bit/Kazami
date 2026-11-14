// 「レース振り返り」タブ（第3段階のサンプル）
import { TRACK_LEGS } from "@/lib/samples";
import { Insight } from "./AnalogView";

const TACK_NO = "①②③④⑤⑥⑦";

export default function TacticsView() {
  return (
    <section className="view">
      <div className="grid2">
        <div className="panel">
          <div className="ph">
            <h2>GPS航跡と風の振れ（サンプル）</h2>
            <p>上りレグ · スマホGPS</p>
          </div>
          <div className="mapbox">
            <svg viewBox="0 0 400 320" role="img" aria-label="GPS航跡">
              <rect width="400" height="320" style={{ fill: "var(--sea-1)" }} />
              {Array.from({ length: 10 }, (_, i) => (
                <line key={`v${i}`} x1={i * 40} y1={0} x2={i * 40} y2={320} style={{ stroke: "var(--sea-2)" }} />
              ))}
              {Array.from({ length: 8 }, (_, i) => (
                <line key={`h${i}`} x1={0} y1={i * 40} x2={400} y2={i * 40} style={{ stroke: "var(--sea-2)" }} />
              ))}
              {TRACK_LEGS.map(([x1, y1, x2, y2, lift], k) => (
                <g key={k}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={4} strokeLinecap="round" style={{ stroke: lift ? "var(--right)" : "var(--left)" }} />
                  {k > 0 && (
                    <>
                      <circle cx={x1} cy={y1} r={9} strokeWidth={1.5} style={{ fill: "var(--surface)", stroke: "var(--ink)" }} />
                      <text x={x1} y={y1 + 4} textAnchor="middle" fontSize={11} fontWeight={700} style={{ fill: "var(--ink)" }}>
                        {TACK_NO[k - 1]}
                      </text>
                    </>
                  )}
                </g>
              ))}
              <circle cx={205} cy={22} r={7} style={{ fill: "var(--icon)" }} />
              <text x={216} y={26} fontSize={11} style={{ fill: "var(--ink-2)" }}>
                風上マーク
              </text>
              <line x1={170} y1={305} x2={240} y2={305} strokeWidth={2} style={{ stroke: "var(--ink-2)" }} />
              <text x={248} y={309} fontSize={11} style={{ fill: "var(--ink-2)" }}>
                スタート
              </text>
              <path d="M360,30 L360,80 M352,70 L360,82 L368,70" strokeWidth={2.5} fill="none" style={{ stroke: "var(--accent)" }} />
              <text x={360} y={22} textAnchor="middle" fontSize={11} fontWeight={700} style={{ fill: "var(--accent)" }}>
                風 340°
              </text>
            </svg>
          </div>
          <div className="legend" style={{ marginTop: 10 }}>
            <span>
              <i style={{ background: "var(--right)" }} />
              リフトで走れた区間
            </span>
            <span>
              <i style={{ background: "var(--left)" }} />
              ヘッダーで走った区間
            </span>
            <span>①② タック</span>
          </div>
        </div>
        <div className="panel">
          <div className="ph">
            <h2>タックの判断（サンプル）</h2>
            <p>振れに合わせて返せたか</p>
          </div>
          <div className="stats" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
            <Stat k="ヘッダーで返せた" v="5/7" u="回" />
            <Stat k="ヘッダーで走った時間" v="31" u="%" />
            <Stat k="返すまでの平均" v="48" u="秒" />
            <Stat k="VMG" v="2.9" u="kt" />
          </div>
          <ul className="insights" style={{ marginTop: 14, gridTemplateColumns: "minmax(0,1fr)" }}>
            <Insight big="④" title="12°のヘッダーを90秒走り続けた" text="この区間で約 25m のロス。6° を超えたら返す基準に。" />
            <Insight big="⑥" title="右振れの前に右海面へ" text="13:10 の右振れを予報どおり先取りして 3艇抜き。" />
          </ul>
        </div>
      </div>
    </section>
  );
}

function Stat({ k, v, u }: { k: string; v: string; u: string }) {
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className="v num">
        {v}
        <small>{u}</small>
      </div>
    </div>
  );
}
