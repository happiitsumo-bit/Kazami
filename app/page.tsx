import KazamiApp from "@/components/KazamiApp";
import { loadForecast, loadLatestObservation } from "@/lib/forecast";

// 10分ごとに Supabase の最新データで作り直す
export const revalidate = 600;

export default async function Page() {
  const [fc, obs] = await Promise.all([loadForecast(), loadLatestObservation().catch(() => null)]);
  if (Object.keys(fc.days).length === 0) {
    return <p style={{ padding: 24 }}>予報データがまだありません。しばらくしてから開き直してください。</p>;
  }
  return <KazamiApp fc={fc} obs={obs} />;
}
