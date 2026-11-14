"use client";

// 「風の予報」タブ：地図・まとめ・1時間ごとの風・作戦メモ・モデル比較
import { useEffect, useMemo, useState } from "react";
import type { CourseKey } from "@/lib/courses";
import type { Forecast } from "@/lib/forecast";
import { dirAt, gustAt, makeDay, planItems, shiftAt, speedAt, summarize, STRIP_HOURS } from "@/lib/wind";
import WindMap from "./WindMap";
import MapTools from "./MapTools";
import { useFacility } from "./useFacility";
import Verdict from "./Verdict";
import HourStrip from "./HourStrip";
import PlanMemo from "./PlanMemo";
import ModelDetails from "./ModelDetails";

type Props = { fc: Forecast; dayKey: string; dayText: string; shortDate: string };

export default function ForecastView({ fc, dayKey, dayText, shortDate }: Props) {
  const day = useMemo(() => makeDay(fc, dayKey), [fc, dayKey]);
  const summary = useMemo(() => summarize(day), [day]);
  const [hour, setHour] = useState(10);
  const [playing, setPlaying] = useState(false);
  const [course, setCourse] = useState<CourseKey>("wl");
  const [legKm, setLegKm] = useState(0.2);
  const fac = useFacility();

  // ▶ で 8〜17時を順に送る
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setHour((h) => (h >= STRIP_HOURS.at(-1)! ? STRIP_HOURS[0] : h + 1)), 1100);
    return () => clearInterval(id);
  }, [playing]);

  const pick = (h: number) => {
    setPlaying(false);
    setHour(h);
  };

  return (
    <section className="view">
      <div className="panel today">
        <div className="mapcol">
          <WindMap
            hour={hour}
            dir={dirAt(day, hour)}
            speed={speedAt(day, hour)}
            gust={gustAt(day, hour)}
            shift={shiftAt(day, hour)}
            course={course}
            legKm={legKm}
            playing={playing}
            facility={fac.pos}
            facCustom={fac.custom}
            placing={fac.placing}
            onPlace={fac.place}
            onHour={pick}
            onTogglePlay={() => setPlaying((v) => !v)}
          />
          <MapTools
            course={course}
            legKm={legKm}
            onCourse={setCourse}
            onLeg={setLegKm}
            placing={fac.placing}
            facCustom={fac.custom}
            onTogglePlacing={() => fac.setPlacing(!fac.placing)}
          />
        </div>
        <Verdict summary={summary} dayText={dayText} hour={hour} shift={shiftAt(day, hour)} />
      </div>

      <div className="panel">
        <div className="ph">
          <h2>1時間ごとの風</h2>
          <p>矢印は風が吹いていく向き。色は 10–11時の平均からの振れ</p>
        </div>
        <HourStrip day={day} hour={hour} onHour={pick} />
      </div>

      <PlanMemo title={`${shortDate}の作戦メモ`} items={planItems(summary)} />
      <ModelDetails day={day} summary={summary} />
    </section>
  );
}
