// 地図の下のツールバー：コースの種類・上りレグの長さ・研修所の位置
import { COURSES, LEG_OPTIONS, type CourseKey } from "@/lib/courses";

type Props = {
  course: CourseKey;
  legKm: number;
  onCourse: (c: CourseKey) => void;
  onLeg: (km: number) => void;
  satellite: boolean;
  onSatellite: (v: boolean) => void;
  placing: boolean;
  facCustom: boolean;
  onTogglePlacing: () => void;
};

export default function MapTools(p: Props) {
  return (
    <div className="maptools">
      <div className="toolgroup">
        <span className="toollabel">コース</span>
        <div className="seg2" role="group" aria-label="コースの種類">
          {(Object.keys(COURSES) as CourseKey[]).map((k) => (
            <button key={k} type="button" aria-pressed={p.course === k} onClick={() => p.onCourse(k)}>
              {COURSES[k].label}
            </button>
          ))}
        </div>
      </div>
      <div className="toolgroup">
        <label className="toollabel" htmlFor="leg">
          上りレグ
        </label>
        <select id="leg" className="toolselect" value={p.legKm} onChange={(e) => p.onLeg(+e.target.value)}>
          {LEG_OPTIONS.map((o) => (
            <option key={o.km} value={o.km}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="toolgroup">
        <span className="toollabel">背景</span>
        <div className="seg2" role="group" aria-label="地図の背景">
          <button type="button" aria-pressed={p.satellite} onClick={() => p.onSatellite(true)}>
            航空写真
          </button>
          <button type="button" aria-pressed={!p.satellite} onClick={() => p.onSatellite(false)}>
            地図
          </button>
        </div>
      </div>
      <button type="button" className="facbtn" aria-pressed={p.placing} onClick={p.onTogglePlacing}>
        {p.placing ? "やめる" : p.facCustom ? "研修所の位置を直す" : "研修所の位置を直す（今は仮）"}
      </button>
    </div>
  );
}
