"use client";

export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-3xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold ${accent || "text-gray-900 dark:text-white"}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{sub}</div>}
    </div>
  );
}

export function TimeseriesChart({
  points,
}: {
  points: { day: string; conversations: number; errors: number; p95: number | null }[];
}) {
  const w = 640, h = 180, pad = 28;
  const maxC = Math.max(1, ...points.map((p) => p.conversations));
  const maxL = Math.max(1, ...points.map((p) => p.p95 || 0));
  const x = (i: number) => pad + (i / Math.max(1, points.length - 1)) * (w - pad * 2);
  const yC = (v: number) => h - pad - (v / maxC) * (h - pad * 2);
  const yL = (v: number) => h - pad - (v / maxL) * (h - pad * 2);
  const line = (vals: number[], y: (v: number) => number) =>
    vals.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={pad} x2={w - pad} y1={pad + f * (h - pad * 2)} y2={pad + f * (h - pad * 2)}
          stroke="currentColor" strokeOpacity={0.08} />
      ))}
      <polyline points={line(points.map((p) => p.conversations), yC)} fill="none"
        stroke="#2563eb" strokeWidth={2.5} strokeLinejoin="round" />
      {points.map((p) => p.p95).some((v) => v !== null) && (
        <polyline
          points={line(points.map((p) => p.p95 || 0), yL)} fill="none"
          stroke="#d97706" strokeWidth={1.5} strokeDasharray="5 4" />
      )}
      {points.map((p, i) => (
        <g key={p.day}>
          {p.errors > 0 && (
            <circle cx={x(i)} cy={yC(p.conversations)} r={4.5} fill="#dc2626" opacity={0.9} />
          )}
          <text x={x(i)} y={h - 8} fontSize={9} fill="currentColor" opacity={0.5} textAnchor="middle">
            {p.day.slice(5)}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function BarRow({ label, value, max, color = "#2563eb", right }: {
  label: string; value: number; max: number; color?: string; right?: string;
}) {
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-gray-500 dark:text-gray-400">{right ?? value}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div className="h-full rounded-full" style={{ width: `${max ? (value / max) * 100 : 0}%`, background: color }} />
      </div>
    </div>
  );
}
