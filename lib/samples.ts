// 「似た日」「実測と答え合わせ」「レース振り返り」タブのサンプルデータ。
// 予報と観測が貯まったら、Supabase の実データに置き換える。

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export type AnalogDay = { date: string; pattern: string; score: number; miss: boolean; shift: number; pts: [number, number][] };

const TT = Array.from({ length: 121 }, (_, i) => +(10 + i * 0.05).toFixed(3)); // 10:00〜16:00 を3分ごと

export const ANALOG_DAYS: AnalogDay[] = (
  [
    ["2025/11/09", "冬型 · 晴", 94],
    ["2025/10/26", "冬型 · 晴時々曇", 91],
    ["2024/11/17", "冬型 · 晴", 89],
    ["2025/11/03", "移動性高気圧 · 晴", 86],
    ["2024/12/01", "冬型 · 曇", 84],
    ["2025/10/21", "冬型 · 晴", 81],
    ["2024/11/24", "冬型 · 晴", 79],
    ["2023/11/12", "冬型 · 晴", 77],
  ] as const
).map(([date, pattern, score], k) => {
  const r = rng(31 + k * 97);
  const miss = k === 3 || k === 5;
  const shift = miss ? -3 : 12 + r() * 6;
  const on = 12.4 + r() * 1.2;
  const per = (7 + r() * 5) / 60;
  const ph = r() * 6;
  const amp = 3.5 + r() * 3;
  const off = -6 + r() * 10;
  const pts = TT.map(
    (t) =>
      [
        t,
        333 + off + shift / (1 + Math.exp(-(t - on) * 3)) + (miss && t > 14.3 ? 8 : 0) + amp * Math.sin((2 * Math.PI * t) / per + ph) + (r() - 0.5) * 3,
      ] as [number, number],
  );
  return { date, pattern, score, miss, shift: Math.round(12 + (k % 3) * 2), pts };
});

export const ANALOG_MEDIAN: [number, number][] = TT.map((t, j) => {
  const v = ANALOG_DAYS.map((a) => a.pts[j][1]).sort((a, b) => a - b);
  return [t, (v[3] + v[4]) / 2] as [number, number];
}).map((p, j, A) => {
  const w = A.slice(Math.max(0, j - 4), j + 5);
  return [p[0], w.reduce((s, q) => s + q[1], 0) / w.length];
});

export const OSCILLATION: [number, number][] = (() => {
  const r = rng(5);
  return Array.from({ length: 301 }, (_, i) => {
    const t = 10 + i / 60;
    return [t, 9 * Math.sin((2 * Math.PI * t) / (9.5 / 60)) + 4 * Math.sin((2 * Math.PI * t) / (23 / 60)) + (r() - 0.5) * 4] as [number, number];
  });
})();

export const MODEL_ERRORS = {
  dir: [
    { name: "MSM", value: 11.2, color: "var(--msm)" },
    { name: "ECMWF", value: 8.6, color: "var(--ecmwf)" },
    { name: "ICON", value: 9.9, color: "var(--icon)" },
  ],
  spd: [
    { name: "MSM", value: 1.1, color: "var(--msm)" },
    { name: "ECMWF", value: 1.4, color: "var(--ecmwf)" },
    { name: "ICON", value: 1.3, color: "var(--icon)" },
  ],
};

/** 上りレグの航跡 [x1, y1, x2, y2, リフトで走れたか] */
export const TRACK_LEGS: [number, number, number, number, boolean][] = [
  [200, 300, 140, 250, true],
  [140, 250, 175, 215, false],
  [175, 215, 110, 170, true],
  [110, 170, 150, 128, true],
  [150, 128, 205, 100, false],
  [205, 100, 250, 70, true],
  [250, 70, 225, 48, true],
  [225, 48, 205, 28, true],
];
