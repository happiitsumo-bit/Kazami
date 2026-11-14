"use client";

// 練習エリアの地図：実際の海岸線、風の流れ、コース、レイライン、臨海研修所。
// 操作：マウスはドラッグで移動・ホイールとダブルクリックで拡大。スマホは2本指で移動・拡大（1本指はページのスクロール）、ダブルタップで拡大。
import { useEffect, useRef, useState } from "react";
import { BASE_LEG_KM, COURSES, markPoint, type CourseKey } from "@/lib/courses";
import {
  BAY_BOUNDS,
  COURSE_CENTER,
  KM_PER_DEG,
  KX,
  PLACES,
  PRACTICE_AREA,
  elevation,
  isSea,
} from "@/lib/terrain";
import { compass, norm } from "@/lib/wind";
import type { LatLon } from "./useFacility";

type Props = {
  hour: number;
  dir: number; // 練習エリアの代表風向
  speed: number;
  gust: number | null;
  shift: number; // 10–11時の平均からの振れ（＋が右）
  course: CourseKey;
  legKm: number;
  playing: boolean;
  facility: LatLon;
  facCustom: boolean;
  placing: boolean;
  onPlace: (p: LatLon) => void;
  onHour: (h: number) => void;
  onTogglePlay: () => void;
};

const PARTICLES = 110;
const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const rgb = (v: string): [number, number, number] => {
  const n = parseInt(css(v).slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export default function WindMap(p: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef(p); // 描画ループから最新の props を読む
  live.current = p;
  const [hint, setHint] = useState(false);
  const hintTimer = useRef(0);
  const showHint = () => {
    setHint(true);
    clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setHint(false), 1600);
  };
  const showHintRef = useRef(showHint);
  showHintRef.current = showHint;
  const api = useRef<{ zoomBy: (f: number) => void; fit: (what: "course" | "area" | "bay") => void; redraw: () => void } | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current!;
    const cv = canvasRef.current!;
    const ctx = cv.getContext("2d")!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const view = { lat: 32.88, lon: 129.833, ppd: 1 };
    let mw = 0;
    let mh = 0;
    let ready = false;
    let base: HTMLCanvasElement | null = null;
    let hiTimer = 0;
    let raf = 0;
    type P = { x: number; y: number; age: number; life: number };
    let parts: P[] = [];
    let courseDot: [number, number] | null = null; // 縮小時のコースの印（タップでコースに寄る）

    const cy = () => (mh - 60) / 2 + 6;
    const sx = (lon: number) => mw / 2 + (lon - view.lon) * view.ppd * KX;
    const sy = (lat: number) => cy() - (lat - view.lat) * view.ppd;
    const glon = (x: number) => view.lon + (x - mw / 2) / (view.ppd * KX);
    const glat = (y: number) => view.lat - (y - cy()) / view.ppd;
    const onLand = (x: number, y: number) => !isSea(glat(y), glon(x));

    const limits = () => {
      const h = Math.max(100, mh - 70);
      const B = BAY_BOUNDS;
      return { min: Math.min(h / (B.n - B.s), mw / ((B.e - B.w) * KX)), max: Math.min(h, mw) / (0.42 / KM_PER_DEG) };
    };
    const clamp = () => {
      const L = limits();
      view.ppd = Math.max(L.min, Math.min(L.max, view.ppd));
      view.lat = Math.max(BAY_BOUNDS.s, Math.min(BAY_BOUNDS.n, view.lat));
      view.lon = Math.max(BAY_BOUNDS.w, Math.min(BAY_BOUNDS.e, view.lon));
    };
    const fit = (what: "course" | "area" | "bay") => {
      const A = PRACTICE_AREA;
      if (what === "area") {
        view.lat = (A.n + A.s) / 2 - 0.003;
        view.lon = (A.w + A.e) / 2 + 0.004;
        view.ppd = Math.min((mh - 70) / 0.078, mw / (0.1 * KX));
      } else if (what === "bay") {
        view.lat = (BAY_BOUNDS.n + BAY_BOUNDS.s) / 2;
        view.lon = (BAY_BOUNDS.w + BAY_BOUNDS.e) / 2;
        view.ppd = 0;
      } else {
        const span = (live.current.legKm * 2.4) / KM_PER_DEG;
        view.lat = COURSE_CENTER.lat;
        view.lon = COURSE_CENTER.lon;
        view.ppd = Math.min((mh - 70) / span, mw / (span * KX));
      }
      clamp();
    };

    // 海岸線と陸の濃淡（ビュー変更時だけ作り直す）
    const renderBase = (scale: number) => {
      if (!mw) return;
      const w = Math.max(1, Math.round(mw * scale));
      const h = Math.max(1, Math.round(mh * scale));
      base = document.createElement("canvas");
      base.width = w;
      base.height = h;
      const bx = base.getContext("2d")!;
      const img = bx.createImageData(w, h);
      const d = img.data;
      const sea = rgb("--sea-1");
      const lo = rgb("--land");
      const hi = rgb("--land-line");
      const E = new Float32Array(w * h);
      for (let y = 0; y < h; y++) {
        const la = glat(y / scale);
        for (let x = 0; x < w; x++) E[y * w + x] = elevation(la, glon(x / scale));
      }
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const e = E[i];
          let c: number[];
          if (e <= 0.5) c = sea;
          else {
            const t = (Math.floor(Math.min(1, e / 400) * 4) / 4) * 0.7;
            c = [0, 1, 2].map((k) => lo[k] + (hi[k] - lo[k]) * t);
          }
          if (x > 0 && y > 0 && (e <= 0.5 !== E[i - 1] <= 0.5 || e <= 0.5 !== E[i - w] <= 0.5)) c = hi;
          d[i * 4] = c[0];
          d[i * 4 + 1] = c[1];
          d[i * 4 + 2] = c[2];
          d[i * 4 + 3] = 255;
        }
      bx.putImageData(img, 0, 0);
    };
    const viewChanged = () => {
      renderBase(1);
      clearTimeout(hiTimer);
      hiTimer = window.setTimeout(() => {
        renderBase(Math.min(2, devicePixelRatio || 1));
        if (reduce) draw();
      }, 180);
      if (reduce) draw();
    };

    const spawn = (q: P) => {
      let n = 0;
      do {
        q.x = Math.random() * mw;
        q.y = Math.random() * mh;
        n++;
      } while (onLand(q.x, q.y) && n < 50);
      q.age = 0;
      q.life = 60 + Math.random() * 90;
    };
    const initParticles = () => {
      parts = Array.from({ length: PARTICLES }, () => {
        const q = { x: 0, y: 0, age: 0, life: 0 };
        spawn(q);
        q.age = Math.random() * q.life;
        return q;
      });
    };

    // 風上側 0.5–1.5km に陸があれば、風が弱く左へ振れる（地形の影響の目安）
    const localWind = (x: number, y: number): [number, number] => {
      let d = live.current.dir;
      let s = live.current.speed;
      const la = glat(y);
      const lo = glon(x);
      const r = (d * Math.PI) / 180;
      let lee = 0;
      for (const k of [0.5, 1, 1.5])
        if (!isSea(la + (Math.cos(r) * k) / KM_PER_DEG, lo + (Math.sin(r) * k) / (KM_PER_DEG * KX))) lee++;
      if (lee) {
        s *= 1 - 0.12 * lee;
        d -= 3 * lee;
      }
      return [d, s];
    };

    const text = (t: string, x: number, y: number, o: { size?: number; w?: number; col?: string; align?: CanvasTextAlign } = {}) => {
      ctx.font = `${o.w ?? 600} ${o.size ?? 12}px "Noto Sans JP",sans-serif`;
      ctx.textAlign = o.align ?? "left";
      ctx.lineWidth = 3;
      ctx.strokeStyle = css("--surface");
      ctx.strokeText(t, x, y);
      ctx.fillStyle = o.col ?? css("--ink-2");
      ctx.fillText(t, x, y);
      ctx.textAlign = "left";
    };

    const drawCourse = () => {
      const { course, legKm, dir } = live.current;
      const C = COURSES[course];
      const r = (dir * Math.PI) / 180;
      const col = css("--icon");
      const k = legKm / BASE_LEG_KM; // 上り（スタート〜1）の長さ = legKm
      const P = (u: number, v: number): [number, number] => {
        u *= k;
        v = v * k - legKm * 0.5; // コースの中心を COURSE_CENTER に
        const la = COURSE_CENTER.lat + (v * Math.cos(r) - u * Math.sin(r)) / KM_PER_DEG;
        const lo = COURSE_CENTER.lon + (v * Math.sin(r) + u * Math.cos(r)) / (KM_PER_DEG * KX);
        return [sx(lo), sy(la)];
      };
      const pt = (key: string) => P(...markPoint(C, key));
      const [x0, y0] = P(0, 0);
      const [x1, y1] = P(0, BASE_LEG_KM);
      courseDot = null;
      if (Math.hypot(x1 - x0, y1 - y0) < 22) {
        courseDot = [(x0 + x1) / 2, (y0 + y1) / 2];
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc((x0 + x1) / 2, (y0 + y1) / 2, 5, 0, 7);
        ctx.fill();
        text("コース（タップで拡大）", (x0 + x1) / 2 + 8, (y0 + y1) / 2 + 4, { size: 11, col });
        return;
      }
      // レイライン：風上マークに真上りで届く線（風向から ±45°）。風が振れると一緒に回る
      const [mx, my] = P(0, BASE_LEG_KM);
      ctx.save();
      ctx.strokeStyle = css("--ink-2");
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      for (const side of [-1, 1]) {
        const [lx, ly] = P(side * BASE_LEG_KM * 0.55, BASE_LEG_KM * 0.45);
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(lx, ly);
        ctx.stroke();
        if (side === 1) text("レイライン", lx + 4, ly + 4, { size: 10, col: css("--ink-3") });
      }
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.6;
      ctx.globalAlpha = 0.85;
      const seen = new Set<string>();
      for (let i = 1; i < C.route.length; i++) {
        const a = C.route[i - 1];
        const b = C.route[i];
        const key = [a, b].sort().join();
        if (seen.has(key)) continue;
        seen.add(key);
        const [ax, ay] = pt(a);
        const [bx, by] = pt(b);
        ctx.setLineDash(b === "1" ? [2, 4] : [7, 4]);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }
      ctx.restore();
      const [s1x, s1y] = P(-0.25, 0);
      const [s2x, s2y] = P(0.25, 0);
      ctx.strokeStyle = css("--ink");
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s1x, s1y);
      ctx.lineTo(s2x, s2y);
      ctx.stroke();
      ctx.fillStyle = css("--ink");
      ctx.fillRect(s2x - 4, s2y - 4, 8, 8);
      text("スタート", s2x + 8, s2y + 16, { size: 11 });
      for (const [u, v] of Object.values(C.marks)) {
        const [x, y] = P(u, v);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(x, y, 5.5, 0, 7);
        ctx.fill();
        ctx.strokeStyle = css("--surface");
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      for (const key of ["1", "2", "3", "4"]) {
        if (!C.marks[key] && !C.marks[`${key}s`]) continue;
        const [x, y] = pt(key);
        const ox = key === "1" ? 10 : key === "2" || key === "3" ? -20 : 14;
        const oy = key === "1" || key === "2" ? 4 : -6;
        ctx.font = '700 12px "JetBrains Mono",monospace';
        ctx.lineWidth = 3;
        ctx.strokeStyle = css("--surface");
        ctx.strokeText(key, x + ox, y + oy);
        ctx.fillStyle = col;
        ctx.fillText(key, x + ox, y + oy);
      }
    };

    const drawOverlay = () => {
      if (base) ctx.drawImage(base, 0, 0, mw, mh);
      const pin = css("--left");
      const A = PRACTICE_AREA;
      ctx.save();
      ctx.setLineDash([7, 5]);
      ctx.strokeStyle = pin;
      ctx.lineWidth = 2;
      ctx.strokeRect(sx(A.w), sy(A.n), sx(A.e) - sx(A.w), sy(A.s) - sy(A.n));
      ctx.restore();
      text("練習エリア", sx(A.w) + 6, Math.max(sy(A.n) - 7, 104), { col: pin, w: 700 });
      drawCourse();
      for (const pl of PLACES) {
        const x = sx(pl.lon);
        const y = sy(pl.lat);
        if (pl.cross) {
          ctx.strokeStyle = css("--ink");
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x - 6, y);
          ctx.lineTo(x + 6, y);
          ctx.moveTo(x, y - 6);
          ctx.lineTo(x, y + 6);
          ctx.stroke();
        }
        text(pl.name, x + pl.dx, y + pl.dy, { size: pl.size, align: pl.align });
      }
      text("大 村 湾", sx(129.86), sy(32.975), { size: 14, col: css("--ink-3"), align: "center" });
      // 臨海研修所
      const f = live.current;
      const fx = sx(f.facility.lon);
      const fy = sy(f.facility.lat);
      ctx.fillStyle = css("--ink");
      ctx.beginPath();
      ctx.moveTo(fx, fy - 9);
      ctx.lineTo(fx + 8, fy - 2);
      ctx.lineTo(fx + 8, fy + 7);
      ctx.lineTo(fx - 8, fy + 7);
      ctx.lineTo(fx - 8, fy - 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = css("--surface");
      ctx.lineWidth = 1.5;
      ctx.stroke();
      text(f.facCustom ? "臨海研修所" : "臨海研修所（仮）", fx, fy + 22, { align: "center", w: 700, col: css("--ink") });
      // 方位・縮尺
      const nx = mw - 26;
      const ny = mh - 140;
      ctx.fillStyle = css("--ink-2");
      ctx.strokeStyle = css("--ink-2");
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(nx, ny + 26);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(nx, ny - 6);
      ctx.lineTo(nx - 5, ny + 4);
      ctx.lineTo(nx + 5, ny + 4);
      ctx.fill();
      ctx.font = '700 11px "JetBrains Mono",monospace';
      ctx.textAlign = "center";
      ctx.fillText("N", nx, ny - 10);
      const pxPerM = view.ppd / (KM_PER_DEG * 1000);
      const nice = [50, 100, 200, 500, 1000, 2000, 5000].filter((m) => m * pxPerM <= 110).pop() ?? 50;
      const bl = nice * pxPerM;
      const bx0 = mw - 20 - bl;
      const by = mh - 70;
      ctx.fillRect(bx0, by, bl, 3);
      ctx.fillText(nice >= 1000 ? `${nice / 1000} km` : `${nice} m`, bx0 + bl / 2, by - 5);
      ctx.textAlign = "left";
    };

    const draw = () => {
      if (!mw) return;
      drawOverlay();
      const sc = mw / 400;
      ctx.strokeStyle = css("--streak");
      ctx.lineCap = "round";
      for (const q of parts) {
        const [d, s] = localWind(q.x, q.y);
        const a = ((d + 90) * Math.PI) / 180; // 風が吹いていく向き
        const vx = Math.cos(a) * s * 0.26 * sc;
        const vy = Math.sin(a) * s * 0.26 * sc;
        const fade = Math.min(1, q.age / 15, (q.life - q.age) / 15);
        ctx.globalAlpha = 0.45 * Math.max(0, fade);
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(q.x - vx * 6, q.y - vy * 6);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
        if (!reduce) {
          q.x += vx;
          q.y += vy;
          q.age++;
        }
        if (q.age > q.life || onLand(q.x, q.y) || q.x < -10 || q.x > mw + 10 || q.y < -10 || q.y > mh + 10) spawn(q);
      }
      ctx.globalAlpha = 1;
    };
    const loop = () => {
      draw();
      raf = requestAnimationFrame(loop);
    };

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      if (!r.width) return;
      const dpr = Math.min(2, devicePixelRatio || 1);
      mw = r.width;
      mh = r.height;
      cv.width = Math.round(mw * dpr);
      cv.height = Math.round(mh * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!ready) {
        fit("area");
        ready = true;
      } else clamp();
      renderBase(dpr);
      initParticles();
      if (reduce) draw();
    };

    const zoomAt = (px: number, py: number, f: number) => {
      const la = glat(py);
      const lo = glon(px);
      const L = limits();
      view.ppd = Math.max(L.min, Math.min(L.max, view.ppd * f));
      view.lon = lo - (px - mw / 2) / (view.ppd * KX);
      view.lat = la + (py - cy()) / view.ppd;
      clamp();
      viewChanged();
    };

    // マウス：ドラッグで移動。スマホ：2本指で移動と拡大（1本指はページのスクロールに任せる）。感度は低め
    const ptrs = new Map<number, [number, number]>();
    let pinch: { d: number; ppd: number; mid: [number, number] } | null = null;
    let moved = false;
    let lastTap = { t: 0, x: 0, y: 0 };
    const local = (e: PointerEvent | WheelEvent | MouseEvent): [number, number] => {
      const r = wrap.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    const isUI = (e: Event) => (e.target as HTMLElement).closest("button,select,input,.mapctl,.maptag,.zoomctl");
    const pan = (dx: number, dy: number) => {
      view.lon -= dx / (view.ppd * KX);
      view.lat += dy / view.ppd;
      clamp();
    };
    const onDown = (e: PointerEvent) => {
      if (isUI(e)) return;
      if (e.pointerType !== "touch") wrap.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, local(e));
      moved = false;
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), ppd: view.ppd, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
      }
    };
    const onMove = (e: PointerEvent) => {
      const prev = ptrs.get(e.pointerId);
      if (!prev) return;
      const cur = local(e);
      ptrs.set(e.pointerId, cur);
      if (ptrs.size === 1 && e.pointerType !== "touch") {
        const dx = (cur[0] - prev[0]) * 0.85;
        const dy = (cur[1] - prev[1]) * 0.85;
        if (Math.abs(dx) + Math.abs(dy) > 0.5) {
          pan(dx, dy);
          moved = true;
          viewChanged();
        }
      } else if (ptrs.size === 1 && Math.hypot(cur[0] - prev[0], cur[1] - prev[1]) > 2) {
        moved = true;
      }
      if (ptrs.size === 2 && pinch) {
        const [a, b] = [...ptrs.values()];
        const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        pan((mid[0] - pinch.mid[0]) * 0.85, (mid[1] - pinch.mid[1]) * 0.85);
        pinch.mid = mid;
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        moved = true;
        zoomAt(mid[0], mid[1], (pinch.ppd * Math.pow(d / pinch.d, 0.6)) / view.ppd);
      }
    };
    const onUp = (e: PointerEvent) => {
      const at = ptrs.get(e.pointerId);
      if (!at) return;
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (e.type === "pointercancel") {
        // 1本指でなぞった（ブラウザがページのスクロールを始めた）
        if (e.pointerType === "touch" && ptrs.size === 0) showHintRef.current();
        return;
      }
      if (moved || ptrs.size > 0) return;
      if (live.current.placing) {
        live.current.onPlace({ lat: +glat(at[1]).toFixed(5), lon: +glon(at[0]).toFixed(5) });
        return;
      }
      const now = performance.now();
      if (e.pointerType === "touch" && now - lastTap.t < 320 && Math.hypot(at[0] - lastTap.x, at[1] - lastTap.y) < 30) {
        zoomAt(at[0], at[1], 1.8); // ダブルタップで拡大
        lastTap.t = 0;
        return;
      }
      lastTap = { t: now, x: at[0], y: at[1] };
      if (courseDot && Math.hypot(at[0] - courseDot[0], at[1] - courseDot[1]) < 28) {
        fit("course");
        viewChanged();
      }
    };
    const onDbl = (e: MouseEvent) => {
      if (isUI(e)) return;
      const [x, y] = local(e);
      zoomAt(x, y, 1.8);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const [x, y] = local(e);
      zoomAt(x, y, Math.max(0.88, Math.min(1.14, Math.exp(-e.deltaY * 0.0012))));
    };

    wrap.addEventListener("pointerdown", onDown);
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerup", onUp);
    wrap.addEventListener("pointercancel", onUp);
    wrap.addEventListener("wheel", onWheel, { passive: false });
    wrap.addEventListener("dblclick", onDbl);
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    // テーマ（ライト／ダーク）が変わったら色を作り直す
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const retheme = () => {
      renderBase(Math.min(2, devicePixelRatio || 1));
      if (reduce) draw();
    };
    mq.addEventListener("change", retheme);
    const mo = new MutationObserver(retheme);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    api.current = {
      zoomBy: (f) => zoomAt(mw / 2, cy(), f),
      fit: (what) => {
        fit(what);
        viewChanged();
      },
      redraw: () => reduce && draw(),
    };
    resize();
    if (!reduce) raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(hiTimer);
      ro.disconnect();
      mo.disconnect();
      mq.removeEventListener("change", retheme);
      wrap.removeEventListener("pointerdown", onDown);
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerup", onUp);
      wrap.removeEventListener("pointercancel", onUp);
      wrap.removeEventListener("wheel", onWheel);
      wrap.removeEventListener("dblclick", onDbl);
      api.current = null;
    };
  }, []);

  // 動きを減らす設定のときは、表示内容が変わるたびに描き直す
  useEffect(() => {
    api.current?.redraw();
  }, [p.hour, p.dir, p.course, p.legKm, p.facility, p.facCustom]);

  const a = Math.round(Math.abs(p.shift));
  return (
    <div className="mapwrap" id="mapwrap" ref={wrapRef} style={{ cursor: p.placing ? "crosshair" : undefined }}>
      <canvas ref={canvasRef} aria-label="大村湾 練習エリアの風の流れ" />
      <div className="maptag">
        <span className="eyebrow">練習エリア</span>
        <div className="windrow">
          <svg viewBox="0 0 28 28" aria-hidden="true">
            <circle cx="14" cy="14" r="13" fill="none" style={{ stroke: "var(--line)" }} />
            <g transform={`rotate(${p.dir + 180} 14 14)`}>
              <path d="M14 3 L19 12 L15.5 10.5 L15.5 24 L12.5 24 L12.5 10.5 L9 12Z" style={{ fill: "var(--accent)" }} />
            </g>
          </svg>
          <b className="num">
            {Math.round(norm(p.dir))}°<small>{compass(p.dir)}</small>
          </b>
        </div>
        <span className="num">
          {p.speed.toFixed(1)} m/s{p.gust != null && p.gust > p.speed + 0.5 ? ` · 突風 ${p.gust.toFixed(1)}` : ""}
        </span>
        <span className="shiftline" style={{ color: a < 3 ? "var(--ink-3)" : p.shift > 0 ? "var(--right)" : "var(--left)" }}>
          {a < 3 ? "10–11時とほぼ同じ" : `10–11時より${p.shift > 0 ? "右" : "左"}へ ${a}°`}
        </span>
      </div>
      <div className="zoomctl" role="group" aria-label="地図の拡大縮小">
        <button type="button" aria-label="拡大" onClick={() => api.current?.zoomBy(1.4)}>
          ＋
        </button>
        <button type="button" aria-label="縮小" onClick={() => api.current?.zoomBy(1 / 1.4)}>
          －
        </button>
        <button type="button" className="t" onClick={() => api.current?.fit("course")}>
          コース
        </button>
        <button type="button" className="t" onClick={() => api.current?.fit("area")}>
          エリア
        </button>
        <button type="button" className="t" onClick={() => api.current?.fit("bay")}>
          湾全体
        </button>
      </div>
      {p.placing && <div className="mapnote">地図をタップして研修所の位置を決めてください</div>}
      {hint && !p.placing && <div className="mapnote">地図は2本指で動かせます</div>}
      <div className="mapctl">
        <button className="play" type="button" aria-label={p.playing ? "停止" : "時間を再生"} onClick={p.onTogglePlay}>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            {p.playing ? (
              <>
                <rect x="2.5" y="2" width="3" height="10" fill="currentColor" />
                <rect x="8.5" y="2" width="3" height="10" fill="currentColor" />
              </>
            ) : (
              <path d="M3 1.5 L12 7 L3 12.5Z" fill="currentColor" />
            )}
          </svg>
        </button>
        <input type="range" min={8} max={17} step={1} value={p.hour} aria-label="時刻" onChange={(e) => p.onHour(+e.target.value)} />
        <span className="num">{p.hour}:00</span>
      </div>
    </div>
  );
}
