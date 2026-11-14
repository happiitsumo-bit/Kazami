// 作戦メモ（予報から自動で作成）
import type { PlanItem } from "@/lib/wind";

export default function PlanMemo({ title, items }: { title: string; items: PlanItem[] }) {
  return (
    <div className="panel">
      <div className="ph">
        <h2>{title}</h2>
        <p>予報データから自動で作成</p>
      </div>
      <ul className="plan">
        {items.map((it) => (
          <li key={it.title}>
            <div className="ic">{it.icon}</div>
            <div>
              <b>{it.title}</b>
              <span>{it.text}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
