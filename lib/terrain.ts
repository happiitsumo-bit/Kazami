// 大村湾の地形（標高）と、地図に載せる場所の定義
import DEM_FINE from "./dem-fine.json";
import DEM_BAY from "./dem-bay.json";

type Dem = { S: number; W: number; step: number; ny: number; nx: number; el: number[] };
const FINE = DEM_FINE as Dem; // 練習エリア周辺 約200m間隔
const BAY = DEM_BAY as Dem; // 湾全体 約400m間隔

function sample(D: Dem, lat: number, lon: number): number | null {
  const fx = (lon - D.W) / D.step;
  const fy = (lat - D.S) / D.step;
  if (fx < 0 || fy < 0 || fx > D.nx - 1 || fy > D.ny - 1) return null;
  const x0 = Math.min(D.nx - 2, Math.floor(fx));
  const y0 = Math.min(D.ny - 2, Math.floor(fy));
  const tx = fx - x0;
  const ty = fy - y0;
  const g = (i: number, j: number) => D.el[j * D.nx + i];
  return (g(x0, y0) * (1 - tx) + g(x0 + 1, y0) * tx) * (1 - ty) + (g(x0, y0 + 1) * (1 - tx) + g(x0 + 1, y0 + 1) * tx) * ty;
}

/** 標高（m）。0.5m 以下を海とみなす */
export const elevation = (lat: number, lon: number) => sample(FINE, lat, lon) ?? sample(BAY, lat, lon) ?? 50;
export const isSea = (lat: number, lon: number) => elevation(lat, lon) <= 0.5;

/** 経度1度の長さ ÷ 緯度1度の長さ */
export const KX = Math.cos(32.95 * (Math.PI / 180));
export const KM_PER_DEG = 111;

export const PRACTICE_AREA = { s: 32.85, n: 32.917, w: 129.8106, e: 129.8512 };
export const BAY_BOUNDS = { s: 32.835, n: 33.11, w: 129.715, e: 129.99 };
export const COURSE_CENTER = {
  lat: (PRACTICE_AREA.n + PRACTICE_AREA.s) / 2 + 0.004,
  lon: (PRACTICE_AREA.w + PRACTICE_AREA.e) / 2 + 0.004,
};
/** 長崎大学 臨海研修所（時津町子々川郷）。正確な座標が分かるまでの仮の位置 */
export const FACILITY_DEFAULT = { lat: 32.857, lon: 129.822 };

export const PLACES = [
  { name: "琴海", lat: 32.9034, lon: 129.8037, dx: -4, dy: 4, align: "right" as const },
  { name: "崎野", lat: 32.8579, lon: 129.8538, dx: 8, dy: 4 },
  { name: "堂崎ノ鼻", lat: 32.8861, lon: 129.8814, dx: 8, dy: 4 },
  { name: "二島", lat: 32.8976, lon: 129.8576, dx: 6, dy: -4, size: 11 },
  { name: "長崎空港", lat: 32.9169, lon: 129.9136, dx: 9, dy: 4, cross: true },
];
