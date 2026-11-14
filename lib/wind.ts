// 風向・風速の計算と、予報から見出しや作戦メモを作るロジック（画面に依存しない純粋な関数）
import type { DayForecast, Forecast } from "./forecast";

export const FIRST_HOUR = 6;
export const LAST_HOUR = 18;
export const HOURS = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i);
export const STRIP_HOURS = HOURS.filter((h) => h >= 8 && h <= 17);
export const PRACTICE_HOURS = [10, 11, 12, 13, 14, 15];
export const idx = (h: number) => h - FIRST_HOUR;

const R = Math.PI / 180;
export const norm = (d: number) => ((d % 360) + 360) % 360;
/** a − b を −180〜180 で返す */
export const angDiff = (a: number, b: number) => ((((a - b) % 360) + 540) % 360) - 180;
export const circMean = (arr: number[]) => {
  let x = 0;
  let y = 0;
  for (const a of arr) {
    x += Math.cos(a * R);
    y += Math.sin(a * R);
  }
  return norm(Math.atan2(y, x) / R);
};
/** 359° → 1° のような飛びをなくして連続した値にする */
export const unwrap = (arr: number[]) => {
  const out: number[] = [];
  arr.forEach((v, i) => out.push(i ? out[i - 1] + angDiff(v, out[i - 1]) : v));
  return out;
};

const DIRS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const JP16 = ["北", "北北東", "北東", "東北東", "東", "東南東", "南東", "南南東", "南", "南南西", "南西", "西南西", "西", "西北西", "北西", "北北西"];
export const compass = (d: number) => DIRS[Math.round(norm(d) / 22.5) % 16];
export const jpDir = (d: number) => JP16[Math.round(norm(d) / 22.5) % 16];

const WD = "日月火水木金土";
export function dayLabel(key: string, today: string) {
  const t = new Date(`${key}T00:00:00Z`);
  const diff = (Date.parse(key) - Date.parse(today)) / 864e5;
  const rel = diff === 0 ? "今日" : diff === 1 ? "明日" : "";
  return { date: `${t.getUTCMonth() + 1}/${t.getUTCDate()}（${WD[t.getUTCDay()]}）`, rel };
}

export const isRain = (code: number) => code >= 51;
export const weatherText = (code: number) => (isRain(code) ? "雨" : code <= 1 ? "晴れ" : "くもり");

/* ---------- モデル ---------- */
export const MODEL_KEYS = ["msm", "msm_e", "ecmwf", "icon"] as const;
export type ModelKey = (typeof MODEL_KEYS)[number];
export const MODEL_META: Record<ModelKey, { name: string; short: string; color: string; dash?: string }> = {
  msm: { name: "MSM 琴海寄り", short: "MSM西", color: "var(--msm)" },
  msm_e: { name: "MSM 湾中央寄り", short: "MSM東", color: "var(--msm)", dash: "5 4" },
  ecmwf: { name: "ECMWF 9km", short: "ECMWF", color: "var(--ecmwf)" },
  icon: { name: "ICON（湾北部）", short: "ICON", color: "var(--icon)" },
};

/** 1日分の予報と、練習エリアの代表値（MSM 2点の平均） */
export type Day = {
  key: string;
  raw: DayForecast;
  best: { dir: number[]; spd: number[] }; // dir は unwrap 済み
  base: number; // 10–11時の平均風向
};

export function makeDay(fc: Forecast, key: string): Day {
  const raw = fc.days[key];
  const best = {
    dir: unwrap(HOURS.map((_, i) => circMean([raw.msm.dir[i], raw.msm_e.dir[i]]))),
    spd: HOURS.map((_, i) => (raw.msm.spd[i] + raw.msm_e.spd[i]) / 2),
  };
  return { key, raw, best, base: circMean([best.dir[idx(10)], best.dir[idx(11)]]) };
}

export const dirAt = (d: Day, h: number) => d.best.dir[idx(h)];
export const speedAt = (d: Day, h: number) => d.best.spd[idx(h)];
export const gustAt = (d: Day, h: number) => d.raw.ecmwf.gust[idx(h)];
/** 10–11時の平均からの振れ（＋が右振れ） */
export const shiftAt = (d: Day, h: number) => angDiff(dirAt(d, h), d.base);
/** 代表値・ECMWF・ICON の風向の最大差 */
export function spreadAt(d: Day, h: number) {
  const i = idx(h);
  const v = [d.best.dir[i], d.raw.ecmwf.dir[i], d.raw.icon.dir[i]];
  let m = 0;
  for (let a = 0; a < v.length; a++) for (let b = a + 1; b < v.length; b++) m = Math.max(m, Math.abs(angDiff(v[a], v[b])));
  return m;
}
const modelShift = (d: Day, k: ModelKey, h: number) => {
  const dir = d.raw[k].dir;
  return angDiff(dir[idx(h)], circMean([dir[idx(10)], dir[idx(11)]]));
};
export const confidence = (spread: number) => (spread < 20 ? 3 : spread < 45 ? 2 : 1);

/* ---------- まとめ（見出し・作戦メモの元） ---------- */
export type Summary = {
  mean: number;
  smin: number;
  smax: number;
  gmax: number | null;
  peak: number;
  startH: number | null;
  big: boolean;
  side: "右" | "左";
  othersAgree: ModelKey[];
  maxSpread: number;
  agree: "good" | "warn" | "bad";
  rainFrom: number | null;
  westWeaker: number; // MSM 琴海寄りが湾中央寄りより何 m/s 弱いか
};

export function summarize(d: Day): Summary {
  const H = PRACTICE_HOURS;
  const mean = circMean(H.map((h) => dirAt(d, h)));
  const sp = H.map((h) => speedAt(d, h));
  const gusts = H.map((h) => gustAt(d, h)).filter((v): v is number => v != null);
  let peak = 0;
  let peakH = 13;
  let startH: number | null = null;
  for (let h = 11; h <= 16; h++) {
    const s = shiftAt(d, h);
    if (Math.abs(s) > Math.abs(peak)) {
      peak = s;
      peakH = h;
    }
    if (startH === null && Math.abs(s) >= 10) startH = h;
  }
  const big = Math.abs(peak) >= 10;
  const othersAgree = big
    ? (["ecmwf", "icon"] as const).filter((k) => {
        const s = modelShift(d, k, peakH);
        return Math.sign(s) === Math.sign(peak) && Math.abs(s) >= Math.max(8, Math.abs(peak) * 0.5);
      })
    : [];
  const maxSpread = Math.max(...H.map((h) => spreadAt(d, h)));
  const rainH = H.find((h) => isRain(d.raw.wx[idx(h)]));
  const westWeaker = H.reduce((a, h) => a + d.raw.msm_e.spd[idx(h)] - d.raw.msm.spd[idx(h)], 0) / H.length;
  return {
    mean,
    smin: Math.min(...sp),
    smax: Math.max(...sp),
    gmax: gusts.length ? Math.max(...gusts) : null,
    peak,
    startH,
    big,
    side: peak > 0 ? "右" : "左",
    othersAgree: [...othersAgree],
    maxSpread,
    agree: maxSpread < 25 ? "good" : maxSpread < 50 ? "warn" : "bad",
    rainFrom: rainH ?? null,
    westWeaker,
  };
}

export const speedRange = (s: Summary) =>
  s.smax - s.smin < 1.5
    ? `${s.smin.toFixed(1)}–${s.smax.toFixed(1)} m/s`
    : `${Math.round(s.smin)}–${Math.round(s.smax)} m/s`;

export const AGREE_TEXT = { good: "3モデルがほぼ一致", warn: "モデルで少し差がある", bad: "モデルで予報が分かれる" };

export function leadText(s: Summary) {
  const out = [`練習時間は ${Math.round(s.mean)}° 前後、${speedRange(s)}${s.gmax != null ? `（突風 最大 ${s.gmax.toFixed(1)} m/s）` : ""}。`];
  if (s.big)
    out.push(
      s.othersAgree.length
        ? `${s.othersAgree.map((k) => MODEL_META[k].short).join("・")}も同じ向きの振れを予報しています。`
        : "この振れを予報しているのは MSM だけで、ECMWF・ICON はほぼ同じ風向のまま。外れる可能性も考えておきたい。",
    );
  if (s.agree !== "good") out.push(`3モデルの風向は最大 ${Math.round(s.maxSpread)}° 違います。`);
  if (s.rainFrom != null) out.push(`${s.rainFrom}時ごろから雨の予報。`);
  return out.join("");
}

export type PlanItem = { icon: string; title: string; text: string };

export function planItems(s: Summary): PlanItem[] {
  const sp = speedRange(s);
  const items: PlanItem[] = [];
  items.push({
    icon: "風",
    title: s.smax < 3 ? "微風。軽さ重視のセッティングで" : s.smax < 6.5 ? "軽風〜中風。基本のセッティングで" : "風が強め。ハイクアウト前提で",
    text: `練習時間の風速は ${sp}${s.gmax != null ? `、突風は最大 ${s.gmax.toFixed(1)} m/s（ECMWF）` : ""}。`,
  });
  if (s.big && s.startH != null)
    items.push({
      icon: `${s.startH}h`,
      title: `${s.startH}時ごろからは${s.side}海面へ`,
      text: `風が${s.side}へ${Math.round(Math.abs(s.peak))}°ほど振れていく予報。${s.side}へ振れるなら${s.side}海面に早めに伸ばした艇が得をする。${s.othersAgree.length ? "" : "ただしMSMだけの予報なので、実際の風を見て判断を。"}`,
    });
  else items.push({ icon: "→", title: "大きな振れはない予報", text: "時間による変化は小さい。目の前の小さな振れとブローを拾うことに集中。" });
  const wd = s.westWeaker;
  if (Math.abs(wd) >= 0.3)
    items.push({
      icon: "!",
      title: wd > 0 ? "琴海側（西）は風が弱い" : "琴海側（西）の方が風が強い",
      text: `MSMの予報では、琴海寄りの升目は湾中央寄りより平均 ${Math.abs(wd).toFixed(1)} m/s ${wd > 0 ? "弱い。風の強い湾中央寄りを使いたい。" : "強い。"}`,
    });
  if (s.rainFrom != null)
    items.push({ icon: "雨", title: `${s.rainFrom}時ごろから雨`, text: "雨の中は風が不安定になりやすい。雨雲の前後で風向・風速が急に変わることがある。" });
  else if (s.agree !== "good")
    items.push({
      icon: "?",
      title: "モデルで予報が分かれている",
      text: `3モデルの風向が最大 ${Math.round(s.maxSpread)}° 違う。予報を信じすぎず、出艇後に実際の風向を確かめたい。`,
    });
  return items;
}
