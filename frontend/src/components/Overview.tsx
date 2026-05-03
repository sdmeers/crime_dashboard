import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, Cell, AreaChart, Area, CartesianGrid } from 'recharts';

interface OverviewStats {
  month: string;
  total_crimes: number;
  crime_types: { name: string; count: number }[];
  outcomes: { name: string; count: number }[];
  force_counts: { name: string; count: number }[];
  trends: Record<string, string | number>[];
}

export default function Overview() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrend, setSelectedTrend] = useState<string>('Total');
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  useEffect(() => {
    fetch('http://localhost:8000/api/overview-stats')
      .then(res => {
        if (!res.ok) throw new Error("Stats not generated yet");
        return res.json();
      })
      .then((data: OverviewStats) => {
        setStats(data);
        setSelectedMonth(data.month);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-slate-50">
        <div className="text-xl font-semibold text-slate-600 animate-pulse">Loading National Statistics...</div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-slate-50 p-6">
        <div className="bg-red-50 text-red-700 p-6 rounded-lg max-w-lg text-center shadow-sm">
          <h2 className="text-lg font-bold mb-2">Data Unavailable</h2>
          <p>{error || "Could not load stats."}</p>
          <p className="mt-4 text-sm text-red-600">Please ensure the backend batch processor has been run to generate the national stats.</p>
        </div>
      </div>
    );
  }

  // Get available months from trends
  const availableMonths = stats.trends.map(t => t.month as string);

  const formatMonthLabel = (val: any) => {
    if (!val || typeof val !== 'string') return val;
    const [y, m] = val.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  const formatMonthAxis = (val: string) => {
    const [y, m] = val.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1);
    return date.toLocaleString('default', { month: 'short', year: 'numeric' }).replace(' ', '\n');
  };

  // Find the currently selected month data
  const currentMonthData = stats.trends.find(t => t.month === selectedMonth) || stats.trends[stats.trends.length - 1];

  // We are keeping the Funnel, Leaderboard, and Crime Type KPIs based on the global stats object (which represents the latest month) 
  // because the backend batch_processor currently only generates outcome/force/crimetype distributions for the *latest* month.
  // The trend chart provides historical totals.

  // Prepare Funnel Data
  const totalOutcomes = stats.outcomes.reduce((acc, o) => acc + o.count, 0);
  const funnelData = stats.outcomes.map((o, idx) => {
    const percent = totalOutcomes > 0 ? ((o.count / totalOutcomes) * 100).toFixed(1) : "0";
    return {
      name: o.name,
      percentLabel: `${percent}%`,
      value: o.count,
      fill: ['#3b82f6', '#64748b', '#f59e0b', '#14b8a6', '#ef4444'][idx] || '#cbd5e1'
    };
  });

  // Prepare Crime Types Data
  const crimeTypeData = stats.crime_types.slice(0, 15).map(c => {
    const percent = stats.total_crimes > 0 ? ((c.count / stats.total_crimes) * 100).toFixed(1) : "0";
    return {
      name: c.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      percentLabel: `${percent}%`,
      count: c.count
    };
  });

  // Prepare Force Leaderboard
  const forceData = stats.force_counts.slice(0, 15); // Top 15 forces

  // Get available trend categories (exclude 'month')
  const trendCategories = stats.trends.length > 0 
    ? Object.keys(stats.trends[0]).filter(k => k !== 'month').sort()
    : [];

  // Sort "Total" to the top
  const sortedTrendCategories = trendCategories.sort((a, b) => {
    if (a === 'Total') return -1;
    if (b === 'Total') return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="h-full w-full bg-slate-50 overflow-y-auto p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header & Caveats */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center flex-wrap">
              UK Crime Overview - 
              <select 
                className="ml-2 bg-transparent text-blue-600 font-bold border-b-2 border-blue-200 focus:border-blue-600 outline-none cursor-pointer"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                {availableMonths.map(m => (
                  <option key={m} value={m}>{formatMonthLabel(m)}</option>
                ))}
              </select>
            </h1>
          </div>
          <p className="text-slate-600 text-sm md:text-base">
            Aggregated statistics from the official <a href="https://data.police.uk/about/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Police.uk API</a>. 
            Data covers England, Wales, and Northern Ireland. Scottish data is not provided by the API. 
            For exact definitions of crime types, see the <a href="https://www.police.uk/pu/contact-us/what-and-how-to-report/what-report/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">official definitions</a>.
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center items-center">
            <h3 className="text-slate-500 font-medium uppercase tracking-wider text-xs mb-1 text-center">Total Recorded Crimes - {formatMonthLabel(selectedMonth)}</h3>
            <div className="text-4xl font-black text-slate-800">
              {/* Show the total for the selected month from the trend data, or fallback */}
              {((currentMonthData['Total'] as number) || 0).toLocaleString()}
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center items-center opacity-75">
            <h3 className="text-slate-500 font-medium uppercase tracking-wider text-xs mb-1 text-center">Most Common Crime (Latest Month)</h3>
            <div className="text-2xl font-bold text-rose-600 text-center">{stats.crime_types[0]?.name.replace(/-/g, ' ')}</div>
            <div className="text-sm text-slate-500 mt-1">{stats.crime_types[0]?.count.toLocaleString()} cases</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center items-center opacity-75">
            <h3 className="text-slate-500 font-medium uppercase tracking-wider text-xs mb-1 text-center">Most Active Force (Latest Month)</h3>
            <div className="text-2xl font-bold text-blue-600 text-center">{stats.force_counts[0]?.name}</div>
            <div className="text-sm text-slate-500 mt-1">{stats.force_counts[0]?.count.toLocaleString()} cases</div>
          </div>
        </div>

        {/* 2x2 Charts Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          {/* Crime Types Breakdown (Top Left) */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Crime Types Breakdown (Latest Month)</h2>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={crimeTypeData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={140} interval={0} tick={{fontSize: 11, fill: '#475569'}} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{fill: '#f1f5f9'}} formatter={(val: any) => typeof val === 'number' ? val.toLocaleString() : val} contentStyle={{fontSize: '12px', borderRadius: '8px'}} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} maxBarSize={24}>
                    <LabelList dataKey="percentLabel" position="right" fontSize={12} fill="#64748b" fontWeight="bold" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Justice Funnel (Top Right) */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold text-slate-800 mb-4">The "Justice Funnel" (Outcomes - Latest Month)</h2>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={140} interval={0} tick={{fontSize: 11, fill: '#475569'}} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{fill: '#f1f5f9'}} formatter={(val: any) => typeof val === 'number' ? val.toLocaleString() : val} contentStyle={{fontSize: '12px', borderRadius: '8px'}} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={32}>
                    {funnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                    <LabelList dataKey="percentLabel" position="right" fontSize={12} fill="#64748b" fontWeight="bold" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-slate-500 mt-4 text-center">Shows the final recorded outcomes for crimes across the network.</p>
          </div>

          {/* Force Leaderboard (Bottom Left) */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Force Volume Leaderboard (Top 15 - Latest Month)</h2>
            <div className="h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={forceData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={140} interval={0} tick={{fontSize: 11, fill: '#475569'}} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{fill: '#f1f5f9'}} formatter={(val: any) => typeof val === 'number' ? val.toLocaleString() : val} contentStyle={{fontSize: '12px', borderRadius: '8px'}} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 12-Month Trends (Bottom Right) */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Crime per Month (12-Month Trend)</h2>
                <p className="text-xs text-slate-500">Historical trend for the selected category</p>
              </div>
              <select
                className="mt-4 sm:mt-0 bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 max-w-xs outline-none"
                value={selectedTrend}
                onChange={(e) => setSelectedTrend(e.target.value)}
              >
                {sortedTrendCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.trends} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                  onClick={(e: any) => {
                    if (e && e.activePayload && e.activePayload[0] && e.activePayload[0].payload) {
                      setSelectedMonth(e.activePayload[0].payload.month);
                    }
                  }}
                >
                  <defs>
                    <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={true} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="month" 
                    tickFormatter={formatMonthAxis}
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
                    labelFormatter={formatMonthLabel}
                    formatter={(val: any) => [typeof val === 'number' ? val.toLocaleString() : val, selectedTrend]}
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                    cursor={{ stroke: '#10b981', strokeWidth: 2, strokeDasharray: '5 5' }}
                  />
                  <Area 
                    type="linear" 
                    dataKey={selectedTrend} 
                    stroke="#10b981" 
                    strokeWidth={4}
                    fillOpacity={1} 
                    fill="url(#colorTrend)" 
                    activeDot={{ r: 8, strokeWidth: 2, stroke: '#fff', fill: '#059669' }}
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      const isSelected = payload.month === selectedMonth;
                      return (
                        <circle 
                          cx={cx} 
                          cy={cy} 
                          r={isSelected ? 6 : 4} 
                          stroke="#10b981" 
                          strokeWidth={2} 
                          fill={isSelected ? '#059669' : '#fff'} 
                          key={`dot-${payload.month}`} 
                        />
                      );
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
