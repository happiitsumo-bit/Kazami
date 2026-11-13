// Supabase に貯めた予報・観測を読み、画面用の形にそろえる（サーバー側で実行）

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

// DB の地点 ID → 画面側のモデル名
const POINT_TO_MODEL: Record<string, string> = {
  msm_w: "msm",
  msm_e: "msm_e",
  ecmwf: "ecmwf",
  icon: "icon",
};
const MODELS = ["msm", "msm_e", "ecmwf", "icon"] as const;
const FIRST_HOUR = 6;
const LAST_HOUR = 18;
const JST = 9 * 3600 * 1000;

type Row = {
  point_id: string;
  valid_time: string;
  wind_dir: number | null;
  wind_speed: number | null;
  wind_gust: number | null;
  weather_code: number | null;
  fetched_at: string;
};
type ObsRow = { obs_time: string; wind_dir: number | null; wind_speed: number | null };

export type ModelSeries = { dir: number[]; spd: number[]; gust: (number | null)[] };
export type DayForecast = Record<(typeof MODELS)[number], ModelSeries> & { wx: number[] };
export type Forecast = { fetched: string; today: string; days: Record<string, DayForecast> };
export type Observation = { time: string; dir: number | null; speed: number };

async function rest<T>(path: string): Promise<T> {
  if (!URL_ || !KEY) throw new Error("SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY が設定されていません");
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    next: { revalidate: 600 },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

const jstDate = (ms: number) => new Date(ms + JST).toISOString().slice(0, 10);
const jstHour = (ms: number) => new Date(ms + JST).getUTCHours();
const fmtJst = (ms: number) => {
  const d = new Date(ms + JST);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};

export async function loadForecast(now = Date.now()): Promise<Forecast> {
  const today = jstDate(now);
  const from = new Date(Date.parse(`${today}T00:00:00+09:00`)).toISOString();
  const to = new Date(Date.parse(`${today}T00:00:00+09:00`) + 3 * 86400e3).toISOString();
  const rows = await rest<Row[]>(
    `forecast_latest?select=point_id,valid_time,wind_dir,wind_speed,wind_gust,weather_code,fetched_at` +
      `&valid_time=gte.${from}&valid_time=lt.${to}&order=valid_time`,
  );

  const days: Record<string, DayForecast> = {};
  let fetched = 0;
  for (const r of rows) {
    const t = Date.parse(r.valid_time);
    const h = jstHour(t);
    if (h < FIRST_HOUR || h > LAST_HOUR) continue;
    const model = POINT_TO_MODEL[r.point_id] as (typeof MODELS)[number] | undefined;
    if (!model) continue;
    const day = jstDate(t);
    const i = h - FIRST_HOUR;
    const empty = (): ModelSeries => ({ dir: [], spd: [], gust: [] });
    const d = (days[day] ??= { msm: empty(), msm_e: empty(), ecmwf: empty(), icon: empty(), wx: [] });
    d[model].dir[i] = r.wind_dir ?? 0;
    d[model].spd[i] = r.wind_speed ?? 0;
    d[model].gust[i] = r.wind_gust;
    if (model === "msm") d.wx[i] = r.weather_code ?? 0;
    fetched = Math.max(fetched, Date.parse(r.fetched_at));
  }

  // 6〜18時がすべてそろっている日だけ使う
  const n = LAST_HOUR - FIRST_HOUR + 1;
  for (const [day, d] of Object.entries(days)) {
    const complete = MODELS.every((m) => d[m].dir.filter((v) => v !== undefined).length === n);
    if (!complete) delete days[day];
  }
  return { fetched: fmtJst(fetched || now), today, days };
}

export async function loadLatestObservation(): Promise<Observation | null> {
  const rows = await rest<ObsRow[]>(
    "observation?select=obs_time,wind_dir,wind_speed&station=eq.RJFU&order=obs_time.desc&limit=1",
  );
  const r = rows[0];
  if (!r || r.wind_speed == null) return null;
  const t = Date.parse(r.obs_time);
  return { time: fmtJst(t).split(" ")[1], dir: r.wind_dir, speed: r.wind_speed };
}
