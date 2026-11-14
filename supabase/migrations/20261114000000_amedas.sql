-- アメダス（気象庁）の10分ごとの観測を追加で取り込む
-- 大村(84371)＝長崎空港の構内、長崎(84496)、西海(84306)。observation.station は 'AMD' + 地点番号

create or replace function public.kazami_request() returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  p    record;
  rid  bigint;
  jst  timestamp := now() at time zone 'Asia/Tokyo';
  blk  timestamp := date_trunc('day', jst) + (floor(extract(hour from jst) / 3) * 3) * interval '1 hour';
  code text;
  b    timestamp;
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

  -- アメダス（10分ごと）：大村＝長崎空港、長崎、西海。今の3時間ブロックと1つ前を取る
  foreach code in array array['84371', '84496', '84306'] loop
    foreach b in array array[blk, blk - interval '3 hours'] loop
      select net.http_get(
        url := format('https://www.jma.go.jp/bosai/amedas/data/point/%s/%s.json', code, to_char(b, 'YYYYMMDD_HH24')),
        timeout_milliseconds := 20000) into rid;
      insert into public.ingest_queue (request_id, kind, ref) values (rid, 'amedas', code);
    end loop;
  end loop;
end $$;


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

      elsif q.status_code = 200 and q.kind = 'amedas' then
        -- キーは日本時間の "YYYYMMDDHHMMSS"、値は [値, 品質フラグ]。風向は16方位（1=北北東 … 16=北、0=静穏）
        insert into public.observation
          (station, obs_time, wind_dir, wind_var, wind_speed, wind_gust, temperature, pressure, raw)
        select 'AMD' || q.ref,
               to_timestamp(e.key, 'YYYYMMDDHH24MISS')::timestamp at time zone 'Asia/Tokyo',
               case when (e.value -> 'windDirection' ->> 0)::int between 1 and 16
                    then round(((e.value -> 'windDirection' ->> 0)::int * 22.5))::smallint end,
               coalesce((e.value -> 'windDirection' ->> 0)::int = 0, false),
               (e.value -> 'wind' ->> 0)::real,
               null,  -- アメダスの gust はその日の最大瞬間風速なので入れない（raw に残る）
               (e.value -> 'temp' ->> 0)::real,
               (e.value -> 'pressure' ->> 0)::real,
               e.value::text
        from jsonb_each(q.content::jsonb) e
        where e.value -> 'wind' ->> 0 is not null
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
