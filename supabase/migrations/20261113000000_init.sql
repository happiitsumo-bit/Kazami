-- Kazami: 大村湾の風予報・観測を毎時自動で貯めるための初期スキーマ
-- 予報: Open-Meteo（気象庁 MSM 2点 / ECMWF IFS 9km / ICON）
-- 観測: 長崎空港 METAR（RJFU, aviationweather.gov）
-- 取得は pg_cron + pg_net でデータベースの中だけで完結させる

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- 予報を取る地点（モデルごとの升目）
create table if not exists public.forecast_points (
  id             text primary key,
  label          text not null,
  model          text not null,           -- Open-Meteo の models パラメータ
  lat            double precision not null,
  lon            double precision not null,
  cell_selection text not null default 'nearest'
);

insert into public.forecast_points (id, label, model, lat, lon, cell_selection) values
  ('msm_w', 'MSM 琴海寄り',   'jma_msm',     32.900, 129.8125, 'nearest'),
  ('msm_e', 'MSM 湾中央寄り', 'jma_msm',     32.900, 129.875,  'nearest'),
  ('ecmwf', 'ECMWF 9km',      'ecmwf_ifs',   32.887, 129.835,  'sea'),
  ('icon',  'ICON（湾北部）', 'icon_global', 32.887, 129.835,  'sea')
on conflict (id) do update set label = excluded.label, model = excluded.model,
  lat = excluded.lat, lon = excluded.lon, cell_selection = excluded.cell_selection;

-- 最新の予報（毎時上書き）
create table if not exists public.forecast_latest (
  point_id     text not null references public.forecast_points(id),
  valid_time   timestamptz not null,
  wind_dir     real,
  wind_speed   real,      -- m/s
  wind_gust    real,      -- m/s（MSM は null）
  pressure_msl real,
  weather_code smallint,
  cloud_cover  smallint,
  temperature  real,
  fetched_at   timestamptz not null default now(),
  primary key (point_id, valid_time)
);

-- 予報の履歴（6時間ごとに保存。予報の当たり方を後で調べるため）
create table if not exists public.forecast_history (
  point_id     text not null references public.forecast_points(id),
  issued_at    timestamptz not null,
  valid_time   timestamptz not null,
  wind_dir     real,
  wind_speed   real,
  wind_gust    real,
  pressure_msl real,
  weather_code smallint,
  primary key (point_id, issued_at, valid_time)
);

-- 観測（長崎空港 METAR など）
create table if not exists public.observation (
  station     text not null,
  obs_time    timestamptz not null,
  wind_dir    smallint,           -- 風向（度）。VRB のときは null
  wind_var    boolean not null default false,
  wind_speed  real,               -- m/s
  wind_gust   real,               -- m/s
  temperature real,
  pressure    real,               -- hPa
  raw         text,
  fetched_at  timestamptz not null default now(),
  primary key (station, obs_time)
);

-- 取得処理の待ち行列と記録
create table if not exists public.ingest_queue (
  request_id bigint primary key,
  kind       text not null,       -- forecast / metar
  ref        text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ingest_log (
  id      bigserial primary key,
  ran_at  timestamptz not null default now(),
  kind    text not null,
  ref     text,
  status  int,
  rows    int,
  message text
);

-- 1) 取得リクエストを出す
create or replace function public.kazami_request() returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  p   record;
  rid bigint;
begin
  for p in select * from public.forecast_points loop
    select net.http_get(
      url := 'https://api.open-meteo.com/v1/forecast',
      params := jsonb_build_object(
        'latitude', p.lat, 'longitude', p.lon, 'models', p.model,
        'cell_selection', p.cell_selection,
        'hourly', 'wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,weather_code,cloud_cover,temperature_2m',
        'wind_speed_unit', 'ms', 'timezone', 'GMT',
        'forecast_days', '4', 'past_days', '1'),
      timeout_milliseconds := 20000) into rid;
    insert into public.ingest_queue (request_id, kind, ref) values (rid, 'forecast', p.id);
  end loop;

  select net.http_get(
    url := 'https://aviationweather.gov/api/data/metar',
    params := jsonb_build_object('ids', 'RJFU', 'format', 'json', 'hours', '6'),
    timeout_milliseconds := 20000) into rid;
  insert into public.ingest_queue (request_id, kind, ref) values (rid, 'metar', 'RJFU');
end $$;

-- 2) 返ってきたデータを保存する
create or replace function public.kazami_process() returns int
language plpgsql security definer set search_path = public, extensions as $$
declare
  q      record;
  n      int;
  total  int := 0;
  issued timestamptz := date_trunc('hour', now());
begin
  for q in
    select iq.*, r.status_code, r.content, r.error_msg, r.timed_out
    from public.ingest_queue iq
    join net._http_response r on r.id = iq.request_id
  loop
    n := 0;
    begin
      if q.status_code = 200 and q.kind = 'forecast' then
        insert into public.forecast_latest as f
          (point_id, valid_time, wind_dir, wind_speed, wind_gust, pressure_msl, weather_code, cloud_cover, temperature, fetched_at)
        select q.ref,
               (t.v || ':00+00')::timestamptz,
               (h -> 'wind_direction_10m' ->> (t.i - 1)::int)::real,
               (h -> 'wind_speed_10m'     ->> (t.i - 1)::int)::real,
               (h -> 'wind_gusts_10m'     ->> (t.i - 1)::int)::real,
               (h -> 'pressure_msl'       ->> (t.i - 1)::int)::real,
               (h -> 'weather_code'       ->> (t.i - 1)::int)::smallint,
               (h -> 'cloud_cover'        ->> (t.i - 1)::int)::smallint,
               (h -> 'temperature_2m'     ->> (t.i - 1)::int)::real,
               now()
        from (select q.content::jsonb -> 'hourly' as h) s,
             jsonb_array_elements_text(s.h -> 'time') with ordinality t(v, i)
        on conflict (point_id, valid_time) do update set
          wind_dir = excluded.wind_dir, wind_speed = excluded.wind_speed, wind_gust = excluded.wind_gust,
          pressure_msl = excluded.pressure_msl, weather_code = excluded.weather_code,
          cloud_cover = excluded.cloud_cover, temperature = excluded.temperature, fetched_at = excluded.fetched_at;
        get diagnostics n = row_count;

        -- 日本時間 0・6・12・18 時の予報は履歴として残す
        if extract(hour from issued at time zone 'Asia/Tokyo')::int % 6 = 0 then
          insert into public.forecast_history
            (point_id, issued_at, valid_time, wind_dir, wind_speed, wind_gust, pressure_msl, weather_code)
          select point_id, issued, valid_time, wind_dir, wind_speed, wind_gust, pressure_msl, weather_code
          from public.forecast_latest
          where point_id = q.ref and valid_time >= issued
          on conflict do nothing;
        end if;

      elsif q.status_code = 200 and q.kind = 'metar' then
        insert into public.observation
          (station, obs_time, wind_dir, wind_var, wind_speed, wind_gust, temperature, pressure, raw)
        select o ->> 'icaoId',
               to_timestamp((o ->> 'obsTime')::bigint),
               case when jsonb_typeof(o -> 'wdir') = 'number' then (o ->> 'wdir')::smallint end,
               coalesce(o ->> 'wdir' = 'VRB', false),
               (o ->> 'wspd')::real * 0.514444,
               (o ->> 'wgst')::real * 0.514444,
               (o ->> 'temp')::real,
               (o ->> 'altim')::real,
               o ->> 'rawOb'
        from jsonb_array_elements(q.content::jsonb) o
        on conflict (station, obs_time) do nothing;
        get diagnostics n = row_count;
      end if;

      insert into public.ingest_log (kind, ref, status, rows, message)
      values (q.kind, q.ref, q.status_code, n,
              case when q.timed_out then 'timeout' else left(q.error_msg, 300) end);
    exception when others then
      insert into public.ingest_log (kind, ref, status, rows, message)
      values (q.kind, q.ref, q.status_code, 0, left(sqlerrm, 300));
    end;
    delete from public.ingest_queue where request_id = q.request_id;
    total := total + n;
  end loop;

  -- 2時間たっても返事がないものは捨てる
  delete from public.ingest_queue where created_at < now() - interval '2 hours';
  return total;
end $$;

revoke all on function public.kazami_request() from public, anon, authenticated;
revoke all on function public.kazami_process() from public, anon, authenticated;

-- 読み取りは誰でも可（公開の気象データのみ）。書き込みは上の関数だけ
alter table public.forecast_points  enable row level security;
alter table public.forecast_latest  enable row level security;
alter table public.forecast_history enable row level security;
alter table public.observation      enable row level security;
alter table public.ingest_queue     enable row level security;
alter table public.ingest_log       enable row level security;

drop policy if exists "read" on public.forecast_points;
drop policy if exists "read" on public.forecast_latest;
drop policy if exists "read" on public.forecast_history;
drop policy if exists "read" on public.observation;
drop policy if exists "read" on public.ingest_log;
create policy "read" on public.forecast_points  for select using (true);
create policy "read" on public.forecast_latest  for select using (true);
create policy "read" on public.forecast_history for select using (true);
create policy "read" on public.observation      for select using (true);
create policy "read" on public.ingest_log       for select using (true);

-- 毎時 5 分に取得、9 分と 20 分に保存
select cron.unschedule(jobname) from cron.job where jobname in ('kazami-request', 'kazami-process');
select cron.schedule('kazami-request', '5 * * * *', 'select public.kazami_request()');
select cron.schedule('kazami-process', '9,20 * * * *', 'select public.kazami_process()');
