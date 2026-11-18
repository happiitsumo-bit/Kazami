"use client";

// アプリ全体：選んでいる日付とタブを持ち、各タブを切り替える
import { useEffect, useState } from "react";
import type { Forecast, Observation } from "@/lib/forecast";
import { dayLabel } from "@/lib/wind";
import Header, { type TabKey } from "./Header";
import ForecastView from "./forecast/ForecastView";
import AnalogView from "./samples/AnalogView";
import ObsView from "./samples/ObsView";
import TacticsView from "./samples/TacticsView";

const TAB_KEY = "kazami-tab";

export default function KazamiApp({ fc, obs }: { fc: Forecast; obs: Observation | null }) {
  const keys = Object.keys(fc.days).sort();
  const [dayKey, setDayKey] = useState(() => keys.find((k) => k > fc.today) ?? keys[0]); // 最初は明日
  const [tab, setTab] = useState<TabKey>("today");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY) as TabKey | null;
      if (saved) setTab(saved);
    } catch {}
  }, []);
  const changeTab = (t: TabKey) => {
    setTab(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {}
  };

  const days = keys.map((k) => {
    const l = dayLabel(k, fc.today);
    return { key: k, label: `${l.date}${l.rel}`, date: l.date };
  });
  const current = days.find((d) => d.key === dayKey) ?? days[0];

  return (
    <>
      <Header days={days} dayKey={current.key} onDay={setDayKey} fetched={fc.fetched} obs={obs} tab={tab} onTab={changeTab} />
      <main className="wrap">
        {tab === "today" && <ForecastView fc={fc} dayKey={current.key} dayText={current.label} shortDate={current.date} />}
        {tab === "analog" && <AnalogView />}
        {tab === "obs" && <ObsView />}
        {tab === "tactics" && <TacticsView />}
      </main>
      <footer className="wrap">
        「風の予報」タブは Open-Meteo の予報（気象庁 MSM・ECMWF IFS 9km・ICON）を Supabase に毎時保存したものを表示し、10分ごとに更新します。
        「似た日から読む」「実測と答え合わせ」「レース振り返り」タブはサンプルです。地図の背景は国土地理院のシームレス空中写真（「地図」に切り替えると標高データから描いた海岸線）。
      </footer>
    </>
  );
}
