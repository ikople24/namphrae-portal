import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DISASTER_LABELS, DISASTER_COLORS } from '@/lib/disaster-types';
import type { MonthRow } from '@/lib/disaster-stats';

const SEASONAL_TYPES = ['WILDFIRE', 'FLOOD', 'LANDSLIDE'] as const;

export default function SeasonalChart({ data }: { data: MonthRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid stroke="#e1e0d9" vertical={false} />
        <XAxis dataKey="monthLabel" tick={{ fill: '#898781', fontSize: 12 }}
          axisLine={{ stroke: '#c3c2b7' }} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fill: '#898781', fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip />
        <Legend />
        {SEASONAL_TYPES.map((t) => (
          <Bar key={t} dataKey={t} name={DISASTER_LABELS[t]} stackId="a"
            fill={DISASTER_COLORS[t]} stroke="#fcfcfb" strokeWidth={2} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
