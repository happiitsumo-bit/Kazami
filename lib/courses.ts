// 練習コースの形。座標は「上りレグ 1.8km」を基準にした km で、
// u: 風上を向いて右が＋、v: 風上方向。スタートラインの中央が原点。
export type CourseKey = "wl" | "outer" | "inner";
export type Course = { label: string; marks: Record<string, [number, number]>; route: string[] };

export const BASE_LEG_KM = 1.8;

export const COURSES: Record<CourseKey, Course> = {
  wl: { label: "上下", marks: { "1": [0, 1.8], "4s": [-0.1, 0.3], "4p": [0.1, 0.3] }, route: ["S", "1", "4", "1", "4"] },
  outer: {
    label: "アウター",
    marks: { "1": [0, 1.8], "2": [-0.95, 1.25], "3s": [-1.05, 0.3], "3p": [-0.85, 0.3] },
    route: ["S", "1", "2", "3", "2", "3"],
  },
  inner: {
    label: "インナー",
    marks: { "1": [0, 1.8], "2": [-0.95, 1.25], "3s": [-1.05, 0.3], "3p": [-0.85, 0.3], "4s": [-0.1, 0.3], "4p": [0.1, 0.3] },
    route: ["S", "1", "4", "1", "2", "3"],
  },
};

export const LEG_OPTIONS = [
  { km: 0.2, label: "200m" },
  { km: 0.3, label: "300m" },
  { km: 0.5, label: "500m" },
  { km: 0.8, label: "800m" },
  { km: 1.2, label: "1.2km" },
];

/** マーク名（ゲートは "4" → 4s と 4p の中点）の座標 */
export function markPoint(c: Course, key: string): [number, number] {
  if (key === "S") return [0, 0];
  if (c.marks[key]) return c.marks[key];
  const a = c.marks[`${key}s`];
  const b = c.marks[`${key}p`];
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}
