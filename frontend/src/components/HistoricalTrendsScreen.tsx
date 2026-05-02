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
  ResponsiveContainer
} from 'recharts';

interface HistoricalTrendsScreenProps {
  bounds: string;
  onClose: () => void;
}

export default function HistoricalTrendsScreen({ bounds, onClose }: HistoricalTrendsScreenProps) {
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
      <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
        <h2 className="text-xl font-bold">Historical Crime Trends (Last 12 Months)</h2>
        <button onClick={onClose} className="text-slate-300 hover:text-white transition-colors">
          <X className="h-6 w-6" />
        </button>
      </div>
      
      <div className="p-4 bg-blue-50 text-blue-800 text-sm border-b border-blue-200">
        <strong>Note:</strong> This data reflects the crime trends strictly within the <strong>four corners of the previously visible map area</strong>.
      </div>

      <div className="flex-1 p-8">
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
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="total" stroke="#3b82f6" activeDot={{ r: 8 }} name="Total Crimes" />
              <Line type="monotone" dataKey="antiSocial" stroke="#ef4444" name="Anti-social behaviour" />
              <Line type="monotone" dataKey="violent" stroke="#8b5cf6" name="Violent crime" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
