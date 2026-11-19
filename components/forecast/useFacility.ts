"use client";

// 臨海研修所の位置。直した位置はこの端末のブラウザに保存する
import { useEffect, useState } from "react";
import { FACILITY_DEFAULT } from "@/lib/terrain";

const KEY = "kazami-fac";
export type LatLon = { lat: number; lon: number };

export function useFacility() {
  const [pos, setPos] = useState<LatLon>(FACILITY_DEFAULT);
  const [custom, setCustom] = useState(true); // 既定の位置は確認済みなので「仮」とは出さない（直した位置は端末に保存）
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
      if (v && typeof v.lat === "number" && typeof v.lon === "number") {
        setPos(v);
        setCustom(true);
      }
    } catch {}
  }, []);

  const place = (p: LatLon) => {
    setPos(p);
    setCustom(true);
    setPlacing(false);
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
    } catch {}
  };

  return { pos, custom, placing, setPlacing, place };
}
