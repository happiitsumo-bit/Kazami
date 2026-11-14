// ヘッダー：ロゴ・日付の選択・更新時刻と最新の観測・タブ
import type { Observation } from "@/lib/forecast";
import { jpDir } from "@/lib/wind";

export type TabKey = "today" | "analog" | "obs" | "tactics";
const TABS: { key: TabKey; label: string; stage: string }[] = [
  { key: "today", label: "風の予報", stage: "MVP" },
  { key: "analog", label: "似た日から読む", stage: "MVP" },
  { key: "obs", label: "実測と答え合わせ", stage: "STEP 2" },
  { key: "tactics", label: "レース振り返り", stage: "STEP 3" },
];

type Props = {
  days: { key: string; label: string }[];
  dayKey: string;
  onDay: (k: string) => void;
  fetched: string;
  obs: Observation | null;
  tab: TabKey;
  onTab: (t: TabKey) => void;
};

export default function Header({ days, dayKey, onDay, fetched, obs, tab, onTab }: Props) {
  return (
    <header>
      <div className="wrap hrow">
        <div className="brand">
          <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
            <circle cx="15" cy="15" r="13" fill="none" stroke="var(--accent)" strokeWidth="2" />
            <path d="M15 4 L19 17 L15 14 L11 17 Z" fill="var(--accent)" />
            <circle cx="15" cy="15" r="2" fill="var(--ink)" />
          </svg>
          <div>
            <b>Kazami</b> <small>風読み · 470 · 大村湾</small>
          </div>
        </div>
        <label className="select" htmlFor="date">
          日付
          <select id="date" value={dayKey} onChange={(e) => onDay(e.target.value)}>
            {days.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <div className="live">
          <span>
            予報 {fetched} 更新
            {obs && ` · 長崎空港 ${obs.time} ${obs.dir == null ? "風向不定" : jpDir(obs.dir)} ${obs.speed.toFixed(1)} m/s`}
          </span>
        </div>
      </div>
      <div className="wrap">
        <nav className="tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.key} className="tab" role="tab" type="button" aria-selected={tab === t.key} onClick={() => onTab(t.key)}>
              {t.label} <span className="stage">{t.stage}</span>
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
