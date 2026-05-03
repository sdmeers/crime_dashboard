import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, FunnelChart, Funnel, LabelList, Cell } from 'recharts';

interface OverviewStats {
  month: string;
  total_crimes: number;
  crime_types: { name: string; count: number }[];
  outcomes: { name: string; count: number }[];
  force_counts: { name: string; count: number }[];
}

export default function Overview() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('http://localhost:8000/api/overview-stats')
      .then(res => {
        if (!res.ok) throw new Error("Stats not generated yet");
        return res.json();
      })
      .then(data => {
        setStats(data);
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

  // Prepare Funnel Data
  const totalOutcomes = stats.outcomes.reduce((acc, o) => acc + o.count, 0);
  const funnelData = stats.outcomes.map((o, idx) => {
    const percent = totalOutcomes > 0 ? ((o.count / totalOutcomes) * 100).toFixed(1) : "0";
    return {
      name: o.name,
      labelName: `${o.name} (${percent}%)`,
      value: o.count,
      fill: ['#3b82f6', '#64748b', '#f59e0b', '#14b8a6', '#ef4444'][idx] || '#cbd5e1'
    };
  });

  // Prepare Force Leaderboard
  const forceData = stats.force_counts.slice(0, 15); // Top 15 forces

  return (
    <div className="h-full w-full bg-slate-50 overflow-y-auto p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header & Caveats */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">UK Crime Overview - {stats.month}</h1>
          <p className="text-slate-600 text-sm md:text-base">
            Aggregated statistics from the official <a href="https://data.police.uk/about/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Police.uk API</a>. 
            Data covers England, Wales, and Northern Ireland. Scottish data is not provided by the API. 
            For exact definitions of crime types, see the <a href="https://www.police.uk/pu/contact-us/what-and-how-to-report/what-report/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">official definitions</a>.
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center items-center">
            <h3 className="text-slate-500 font-medium uppercase tracking-wider text-xs mb-1">Total Recorded Crimes</h3>
            <div className="text-4xl font-black text-slate-800">{stats.total_crimes.toLocaleString()}</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center items-center">
            <h3 className="text-slate-500 font-medium uppercase tracking-wider text-xs mb-1">Most Common Crime</h3>
            <div className="text-2xl font-bold text-rose-600 text-center">{stats.crime_types[0]?.name.replace(/-/g, ' ')}</div>
            <div className="text-sm text-slate-500 mt-1">{stats.crime_types[0]?.count.toLocaleString()} cases</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center items-center">
            <h3 className="text-slate-500 font-medium uppercase tracking-wider text-xs mb-1">Most Active Force</h3>
            <div className="text-2xl font-bold text-blue-600 text-center">{stats.force_counts[0]?.name}</div>
            <div className="text-sm text-slate-500 mt-1">{stats.force_counts[0]?.count.toLocaleString()} cases</div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Justice Funnel */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold text-slate-800 mb-4">The "Justice Funnel" (Outcomes)</h2>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <FunnelChart>
                  <Tooltip formatter={(value: number) => value.toLocaleString()} />
                  <Funnel dataKey="value" data={funnelData} isAnimationActive>
                    <LabelList position="right" fill="#475569" stroke="none" dataKey="labelName" fontSize={12} />
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-slate-500 mt-4 text-center">Shows the chronological progression of outcomes for reported crimes.</p>
          </div>

          {/* Force Leaderboard */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Force Volume Leaderboard (Top 15)</h2>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={forceData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={140} interval={0} tick={{fontSize: 11, fill: '#475569'}} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{fill: '#f1f5f9'}} formatter={(val: number) => val.toLocaleString()} contentStyle={{fontSize: '12px', borderRadius: '8px'}} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
