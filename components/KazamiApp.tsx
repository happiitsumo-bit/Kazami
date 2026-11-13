"use client";

import { useEffect } from "react";
import { MARKUP } from "@/lib/markup";
import type { Forecast, Observation } from "@/lib/forecast";
import { initKazami } from "@/lib/kazami";

export default function KazamiApp({ fc, obs }: { fc: Forecast; obs: Observation | null }) {
  useEffect(() => {
    initKazami(fc, obs);
  }, [fc, obs]);
  return <div dangerouslySetInnerHTML={{ __html: MARKUP }} />;
}
