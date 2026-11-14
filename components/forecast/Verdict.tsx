// 予報のまとめ（見出し・説明・タグ）と、選んだ時刻の振れメーター
import { AGREE_TEXT, jpDir, leadText, speedRange, type Summary } from "@/lib/wind";

type Props = { summary: Summary; dayText: string; hour: number; shift: number };

export default function Verdict({ summary: s, dayText, hour, shift }: Props) {
  const a = Math.round(Math.abs(shift));
  const color = a < 3 ? undefined : shift > 0 ? "var(--right)" : "var(--left)";
  return (
    <div className="verdict">
      <div className="pills">
        <span className={`pill ${s.agree === "bad" ? "warn" : s.agree}`}>{AGREE_TEXT[s.agree]}</span>
        {s.big ? <span className="pill warn">{s.startH}時ごろ {s.side}へ振れる</span> : <span className="pill info">大きな振れなし</span>}
        {s.rainFrom != null && <span className="pill info">{s.rainFrom}時ごろから雨</span>}
      </div>
      <div>
        <div className="eyebrow">{dayText} · 大村湾 南西部（琴海〜崎野沖）· 練習 10–15時</div>
        <h1>
          {jpDir(s.mean)}の風 {speedRange(s)}。
          {s.big ? (
            <>
              {s.startH}時ごろから
              <em style={{ color: s.peak > 0 ? "var(--right)" : "var(--left)" }}>
                {s.side}へ約{Math.round(Math.abs(s.peak) / 5) * 5}°
              </em>
              振れる予報
            </>
          ) : (
            "時間による大きな振れはない予報"
          )}
        </h1>
      </div>
      <p className="lead">{leadText(s)}</p>
      <div className="meter" aria-live="polite">
        <div className="top">
          <span>{hour}:00 の風は</span>
          <b style={{ color }}>{a < 3 ? "10–11時の平均とほぼ同じ" : `10–11時より ${shift > 0 ? "右" : "左"}へ ${a}°`}</b>
        </div>
        <div className="gauge">
          <div className="rail" />
          <div className="zero" />
          <div className="needle" style={{ left: `${50 + (Math.max(-30, Math.min(30, shift)) / 30) * 50}%` }} />
          <div className="lbl num">
            <span>−30°</span>
            <span>0</span>
            <span>+30°</span>
          </div>
        </div>
        <div className="foot">
          <span>← 左振れ（反時計回り）</span>
          <span>右振れ（時計回り）→</span>
        </div>
      </div>
    </div>
  );
}
