import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DISASTER_TYPES, DISASTER_LABELS, DISASTER_COLORS } from '@/lib/disaster-types';
import type { YearTypeRow } from '@/lib/disaster-stats';

export default function TypeYearChart({
  data,
  selectedYear = null,
  onSelectYear,
}: {
  data: YearTypeRow[];
  selectedYear?: number | null;
  onSelectYear?: (year: number) => void;
}) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
        onClick={(state) => {
          const label = (state as { activeLabel?: string | number } | null)?.activeLabel;
          if (label != null && onSelectYear) onSelectYear(Number(label));
        }}
      >
        <CartesianGrid stroke="#e1e0d9" vertical={false} />
        <XAxis dataKey="year" tickFormatter={(y) => `${y}`} tick={{ fill: '#898781', fontSize: 12 }}
          axisLine={{ stroke: '#c3c2b7' }} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fill: '#898781', fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip labelFormatter={(y) => `พ.ศ. ${y}`} />
        <Legend />
        {DISASTER_TYPES.map((t) => (
          <Bar key={t} dataKey={t} name={DISASTER_LABELS[t]} stackId="a"
            fill={DISASTER_COLORS[t]} stroke="#fcfcfb" strokeWidth={2}
            cursor={onSelectYear ? 'pointer' : undefined}>
            {data.map((row) => (
              <Cell key={row.year} fillOpacity={selectedYear == null || row.year === selectedYear ? 1 : 0.25} />
            ))}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
