import { useEffect, useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, Cell, AreaChart, Area, CartesianGrid, ReferenceLine } from 'recharts';

interface OverviewStats {
  month: string;
  total_crimes: number;
  crime_types: { name: string; count: number }[];
  outcomes: { name: string; count: number }[];
  force_counts: { id: string; name: string; count: number; rate_per_1000?: number | null }[];
  trends: Record<string, any>[];
  populations: Record<string, number>;
}

export default function Overview() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrend, setSelectedTrend] = useState<string>('Total');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [leaderboardMode, setLeaderboardMode] = useState<'volume' | 'rate'>('volume');

  useEffect(() => {
    fetch(import.meta.env.VITE_STATS_URL)
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

  // Calculate dynamic stats based on selectedMonth
  const activeData = useMemo(() => {
    if (!stats || !selectedMonth) return null;
    const index = stats.trends.findIndex(t => t.month === selectedMonth);
    const current = stats.trends[index];
    const previous = index > 0 ? stats.trends[index - 1] : null;

    if (!current) return null;

    // Crime Type Shifts
    const crimeShifts = Object.entries(current)
      .filter(([k]) => k !== 'month' && !k.startsWith('force:') && k !== 'Total')
      .map(([name, count]) => {
        const prevCount = previous ? (previous[name] || 0) : 0;
        const pct = prevCount > 100 ? round(((count - prevCount) / prevCount) * 100, 1) : null;
        return { name, pct };
      })
      .filter(s => s.pct !== null)
      .sort((a, b) => Math.abs(b.pct!) - Math.abs(a.pct!));

    // Force Shifts
    const forceShifts = Object.entries(current)
      .filter(([k]) => k.startsWith('force:'))
      .map(([key, count]) => {
        const name = key.replace('force:', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const prevCount = previous ? (previous[key] || 0) : 0;
        const pct = prevCount > 100 ? round(((count - prevCount) / prevCount) * 100, 1) : null;
        return { name, pct };
      })
      .filter(s => s.pct !== null)
      .sort((a, b) => Math.abs(b.pct!) - Math.abs(a.pct!));

    // Force Leaderboard Data
    const forceLeaderboard = Object.entries(current)
      .filter(([k]) => k.startsWith('force:'))
      .map(([key, count]) => {
        const id = key.replace('force:', '');
        const name = id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const pop = stats.populations[id];
        const rate = (pop && id !== 'city-of-london') ? round((count / pop) * 1000, 2) : null;
        return { id, name, count, rate_per_1000: rate };
      });

    return {
      crimeTypeShift: crimeShifts[0] || null,
      forceShift: forceShifts[0] || null,
      leaderboard: forceLeaderboard
    };
  }, [stats, selectedMonth]);

  function round(value: number, precision: number) {
    const multiplier = Math.pow(10, precision || 0);
    return Math.round(value * multiplier) / multiplier;
  }

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

  // Get available months from trends (newest to oldest)
  const availableMonths = [...stats.trends].reverse().map(t => t.month as string);

  const formatMonthLabel = (val: any) => {
    if (!val || typeof val !== 'string') return val;
    const [y, m] = val.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  const formatMonthAxis = (val: string) => {
    const [y, m] = val.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1);
    return `${date.toLocaleString('default', { month: 'short' })} '${y.slice(2)}`;
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
  const crimeTypeData = Object.entries(currentMonthData)
    .filter(([k]) => k !== 'month' && !k.startsWith('force:') && k !== 'Total')
    .map(([name, count]) => {
      const total = (currentMonthData['Total'] as number) || 1;
      const percent = ((count / total) * 100).toFixed(1);
      return {
        name: name,
        percentLabel: `${percent}%`,
        count: count
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  // Prepare Force Leaderboard
  let forceData = activeData?.leaderboard || [];
  if (leaderboardMode === 'rate') {
    forceData = [...forceData].filter(d => d.rate_per_1000 != null).sort((a, b) => (b.rate_per_1000 || 0) - (a.rate_per_1000 || 0));
  } else {
    forceData = [...forceData].sort((a, b) => b.count - a.count);
  }
  forceData = forceData.slice(0, 15).map(d => ({
    ...d,
    displayValue: leaderboardMode === 'rate' ? d.rate_per_1000 : d.count,
    formattedValue: leaderboardMode === 'rate' ? d.rate_per_1000 : d.count?.toLocaleString()
  }));

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
                className="ml-2 bg-transparent text-slate-800 font-bold outline-none cursor-pointer"
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
            Per capita figures are calculated using <a href="https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">ONS Mid-Year Population Estimates (2024)</a>.
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
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center items-center">
            <h3 className="text-slate-500 font-medium uppercase tracking-wider text-xs mb-1 text-center">Biggest Crime Type Shift (MoM)</h3>
            {activeData?.crimeTypeShift ? (
              <>
                <div className={`text-2xl font-bold text-center ${activeData.crimeTypeShift.pct! > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {activeData.crimeTypeShift.name}
                </div>
                <div className={`text-lg font-black mt-1 ${activeData.crimeTypeShift.pct! > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {activeData.crimeTypeShift.pct! > 0 ? '+' : ''}{activeData.crimeTypeShift.pct}%
                </div>
              </>
            ) : (
              <div className="text-slate-400">N/A</div>
            )}
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center items-center">
            <h3 className="text-slate-500 font-medium uppercase tracking-wider text-xs mb-1 text-center">Force with Biggest Shift (MoM)</h3>
            {activeData?.forceShift ? (
              <>
                <div className={`text-2xl font-bold text-center ${activeData.forceShift.pct! > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {activeData.forceShift.name}
                </div>
                <div className={`text-lg font-black mt-1 ${activeData.forceShift.pct! > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {activeData.forceShift.pct! > 0 ? '+' : ''}{activeData.forceShift.pct}%
                </div>
              </>
            ) : (
              <div className="text-slate-400">N/A</div>
            )}
          </div>
        </div>

        {/* 2x2 Charts Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          {/* Crime Types Breakdown (Top Left) */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Crime Types Breakdown ({formatMonthLabel(selectedMonth)})</h2>
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

          {/* Force Crime Rates (Bottom Left) */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-800">Force Crime Rates (Top 15)</h2>
              <select 
                className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-md p-1 outline-none cursor-pointer"
                value={leaderboardMode}
                onChange={(e) => setLeaderboardMode(e.target.value as 'volume' | 'rate')}
              >
                <option value="volume">Total Volume</option>
                <option value="rate">Rate per 1,000</option>
              </select>
            </div>
            <div className="h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={forceData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={140} interval={0} tick={{fontSize: 11, fill: '#475569'}} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{fill: '#f1f5f9'}} formatter={(val: any) => typeof val === 'number' ? val.toLocaleString() : val} contentStyle={{fontSize: '12px', borderRadius: '8px'}} />
                  <Bar dataKey="displayValue" fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={24}>
                    <LabelList dataKey="formattedValue" position="right" fontSize={11} fill="#64748b" fontWeight="bold" />
                  </Bar>
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
                  {selectedMonth && (
                    <ReferenceLine 
                      x={selectedMonth} 
                      stroke="#f59e0b" 
                      strokeWidth={2}
                      strokeOpacity={0.8} 
                      strokeDasharray="3 3" 
                    />
                  )}
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
                          r={isSelected ? 8 : 5} 
                          stroke={isSelected ? '#f59e0b' : '#10b981'} 
                          strokeWidth={isSelected ? 4 : 2} 
                          fill="#fff" 
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
