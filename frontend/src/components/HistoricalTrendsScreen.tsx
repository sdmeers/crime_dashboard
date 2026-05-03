import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

interface HistoricalTrendsScreenProps {
  bounds: string;
  selectedMonth: string;
  onClose: () => void;
}

export default function HistoricalTrendsScreen({ bounds, selectedMonth, onClose }: HistoricalTrendsScreenProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // We would fetch 12 months of data for this bounds
    // For now, we simulate fetching since Police API requires exact dates
    const fetchHistoricalData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`http://localhost:8000/api/historical-crimes?poly=${bounds}`);
        const result = await res.json();
        setData(result);
      } catch (err) {
        console.error("Failed to fetch historical data", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistoricalData();
  }, [bounds]);

  return (
    <div className="absolute inset-0 z-[2000] bg-white flex flex-col">
      <div className="bg-slate-900 text-white p-3 md:p-4 flex justify-between items-center">
        <h2 className="text-base md:text-xl font-bold truncate pr-4">Historical Crime Trends (Last 12 Months)</h2>
        <button onClick={onClose} className="text-slate-300 hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0">
          <X className="h-6 w-6" />
        </button>
      </div>
      
      <div className="p-3 md:p-4 bg-blue-50 text-blue-800 text-xs md:text-sm border-b border-blue-200">
        <strong>Note:</strong> This data reflects the crime trends strictly within the <strong>four corners of the previously visible map area</strong>.
      </div>

      <div className="flex-1 p-2 md:p-8 min-h-0">
        {loading ? (
          <div className="flex h-full items-center justify-center text-slate-500">
            Loading historical data...
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-slate-500">
            No historical data available for this specific area.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={true} stroke="#e2e8f0" />
              <XAxis 
                dataKey="month" 
                tickFormatter={(val) => {
                  if (!val) return '';
                  const [y, m] = val.split('-');
                  const date = new Date(parseInt(y), parseInt(m) - 1);
                  return `${date.toLocaleString('default', { month: 'short' })} '${y.slice(2)}`;
                }}
                tick={{fontSize: 12, fill: '#64748b'}} 
                axisLine={{stroke: '#cbd5e1'}} 
                tickLine={false}
                dy={10}
              />
              <YAxis 
                tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}
                tick={{fontSize: 12, fill: '#64748b'}} 
                axisLine={false} 
                tickLine={false}
              />
              <Tooltip 
                labelFormatter={(val) => {
                  if (!val || typeof val !== 'string') return val;
                  const [y, m] = val.split('-');
                  const date = new Date(parseInt(y), parseInt(m) - 1);
                  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
                }}
                contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                cursor={{ stroke: '#f59e0b', strokeWidth: 2, strokeDasharray: '5 5' }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              {selectedMonth && (
                <ReferenceLine 
                  x={selectedMonth} 
                  stroke="#f59e0b" 
                  strokeWidth={2}
                  strokeOpacity={0.8} 
                  strokeDasharray="3 3" 
                />
              )}
              <Line 
                type="linear" 
                dataKey="total" 
                stroke="#3b82f6" 
                strokeWidth={3}
                name="Total Crimes" 
                connectNulls={true} 
                activeDot={{ r: 8, strokeWidth: 2, stroke: '#fff', fill: '#2563eb' }}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  const isSelected = payload.month === selectedMonth;
                  return (
                    <circle cx={cx} cy={cy} r={isSelected ? 8 : 5} stroke={isSelected ? '#f59e0b' : '#3b82f6'} strokeWidth={isSelected ? 4 : 2} fill="#fff" key={`dot-${payload.month}-total`} />
                  );
                }}
              />
              <Line 
                type="linear" 
                dataKey="antiSocial" 
                stroke="#ef4444" 
                strokeWidth={3}
                name="Anti-social behaviour" 
                connectNulls={true} 
                activeDot={{ r: 8, strokeWidth: 2, stroke: '#fff', fill: '#dc2626' }}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  const isSelected = payload.month === selectedMonth;
                  return (
                    <circle cx={cx} cy={cy} r={isSelected ? 8 : 5} stroke={isSelected ? '#f59e0b' : '#ef4444'} strokeWidth={isSelected ? 4 : 2} fill="#fff" key={`dot-${payload.month}-anti`} />
                  );
                }}
              />
              <Line 
                type="linear" 
                dataKey="violent" 
                stroke="#8b5cf6" 
                strokeWidth={3}
                name="Violent crime" 
                connectNulls={true} 
                activeDot={{ r: 8, strokeWidth: 2, stroke: '#fff', fill: '#7c3aed' }}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  const isSelected = payload.month === selectedMonth;
                  return (
                    <circle cx={cx} cy={cy} r={isSelected ? 8 : 5} stroke={isSelected ? '#f59e0b' : '#8b5cf6'} strokeWidth={isSelected ? 4 : 2} fill="#fff" key={`dot-${payload.month}-violent`} />
                  );
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
