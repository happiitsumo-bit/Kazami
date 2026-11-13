# Kazami 風読み

大村湾 南西部（琴海〜崎野沖）で練習する 470 チームのための風予報アプリ。

- 気象庁 MSM（2地点）・ECMWF IFS 9km・ICON の予報を、地図・1時間ごとの振れ・作戦メモで表示
- 予報と長崎空港の観測（METAR）を Supabase に毎時自動で保存（`supabase/migrations`）

## 構成

| 部分 | 使っているもの |
|---|---|
| 画面 | Next.js（App Router）→ Vercel |
| データ | Supabase（PostgreSQL）。pg_cron + pg_net で毎時 Open-Meteo と aviationweather.gov から取得 |

- `app/page.tsx` … Supabase から予報と観測を読み、10分ごとに作り直す
- `lib/forecast.ts` … DB のデータを画面用の形にそろえる
- `lib/kazami.js` / `lib/markup.ts` … 画面（モックから移植）
- `lib/dem-*.json` … 地図の海岸線用の標高データ（Open-Meteo Elevation API）
- `supabase/migrations/` … テーブルと毎時の取得処理

## 手元で動かす

```bash
cp .env.example .env.local   # 値を入れる
npm install
npm run dev
```

## Vercel に公開する

1. Vercel で「Add New → Project」→ このリポジトリを Import
2. Environment Variables に `SUPABASE_URL` と `SUPABASE_PUBLISHABLE_KEY` を入れる
3. Deploy

## 部のアカウントへ移すとき

1. GitHub: Settings → Transfer で部のアカウントへ
2. Supabase: 部のアカウントで新しいプロジェクトを作り、`supabase/migrations` の SQL を実行。貯めたデータは `forecast_latest` / `forecast_history` / `observation` を書き出して移す
3. Vercel: 部のアカウントで Import し直し、環境変数を新しい Supabase の値にする
