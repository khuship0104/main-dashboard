// Small server-rendered SVG charts. Colors come from CSS tokens so both themes work.

type Pt = { label: string; value: number | null };

const W = 560;
const H = 200;
const PAD = { l: 44, r: 12, t: 14, b: 26 };

function niceStep(range: number, ticks = 4) {
  const raw = range / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}

function xLabels(points: { label: string }[], x: (i: number) => number) {
  const every = Math.max(1, Math.ceil(points.length / 7));
  return points.map((p, i) =>
    i % every === 0 || i === points.length - 1 ? (
      <text key={i} className="label" x={x(i)} y={H - 8} textAnchor="middle">
        {p.label}
      </text>
    ) : null,
  );
}

export function LineChart({ points, target, unit, title }: { points: Pt[]; target?: number | null; unit: string; title: string }) {
  const vals = points.map((p) => p.value).filter((v): v is number => v !== null);
  if (vals.length === 0) return <p className="empty">No data in this range yet.</p>;
  const all = target != null ? [...vals, target] : vals;
  const step = niceStep(Math.max(1, Math.max(...all) - Math.min(...all)));
  const lo = Math.floor((Math.min(...all) - step / 2) / step) * step;
  const hi = Math.ceil((Math.max(...all) + step / 2) / step) * step;
  const x = (i: number) => PAD.l + (points.length === 1 ? (W - PAD.l - PAD.r) / 2 : (i * (W - PAD.l - PAD.r)) / (points.length - 1));
  const y = (v: number) => PAD.t + ((hi - v) * (H - PAD.t - PAD.b)) / (hi - lo || 1);
  const ticks: number[] = [];
  for (let t = lo; t <= hi + 1e-9; t += step) ticks.push(Math.round(t * 10) / 10);

  const defined = points.map((p, i) => ({ ...p, i })).filter((p) => p.value !== null) as (Pt & { i: number; value: number })[];
  const path = defined.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = defined.length > 1
    ? `${path} L${x(defined.at(-1)!.i).toFixed(1)},${H - PAD.b} L${x(defined[0].i).toFixed(1)},${H - PAD.b} Z`
    : "";
  const last = defined.at(-1)!;

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
      <title>{title}</title>
      {ticks.map((t) => (
        <g key={t}>
          <line className="gridline" x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} />
          <text className="label" x={PAD.l - 8} y={y(t) + 4} textAnchor="end">{t}</text>
        </g>
      ))}
      {area ? <path className="area" d={area} opacity={0.6} /> : null}
      {target != null ? <line className="target" x1={PAD.l} x2={W - PAD.r} y1={y(target)} y2={y(target)} /> : null}
      <path className="line" d={path} />
      {defined.map((p) => <circle key={p.i} className="point" cx={x(p.i)} cy={y(p.value)} r={p.i === last.i ? 4.5 : 2.5} />)}
      <text className="value" x={Math.min(x(last.i), W - PAD.r - 4)} y={y(last.value) - 10} textAnchor="end">
        {last.value.toFixed(1)} {unit}
      </text>
      {xLabels(points, x)}
    </svg>
  );
}

export function BarChart({
  points, target, title, max, tone = "water", futureFrom,
}: { points: Pt[]; target?: number | null; title: string; max?: number; tone?: "water" | "good"; futureFrom?: number }) {
  const vals = points.map((p) => p.value ?? 0);
  const top = Math.max(max ?? 0, target ?? 0, ...vals, 1);
  const step = niceStep(top);
  const hi = Math.ceil(top / step) * step;
  const slot = (W - PAD.l - PAD.r) / points.length;
  const bw = Math.min(36, slot * 0.62);
  const x = (i: number) => PAD.l + slot * i + slot / 2;
  const y = (v: number) => PAD.t + ((hi - v) * (H - PAD.t - PAD.b)) / hi;
  const ticks: number[] = [];
  for (let t = 0; t <= hi + 1e-9; t += step) ticks.push(Math.round(t * 10) / 10);

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
      <title>{title}</title>
      {ticks.map((t) => (
        <g key={t}>
          <line className={t === 0 ? "axis" : "gridline"} x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} />
          <text className="label" x={PAD.l - 8} y={y(t) + 4} textAnchor="end">{t}</text>
        </g>
      ))}
      {points.map((p, i) => {
        const future = futureFrom !== undefined && i >= futureFrom;
        const v = p.value ?? 0;
        const h = Math.max(future ? 3 : v > 0 ? 2 : 0, y(0) - y(v));
        return (
          <g key={i}>
            <rect
              className={`bar-mark ${future ? "future" : tone === "good" ? "good" : ""}`}
              x={x(i) - bw / 2}
              y={y(0) - h}
              width={bw}
              height={h}
              rx={3}
            />
            {!future && p.value !== null && slot > 26 ? (
              <text className="value" x={x(i)} y={y(0) - h - 4} textAnchor="middle">{p.value}</text>
            ) : null}
          </g>
        );
      })}
      {target != null && target > 0 ? <line className="target" x1={PAD.l} x2={W - PAD.r} y1={y(target)} y2={y(target)} /> : null}
      {xLabels(points, x)}
    </svg>
  );
}
