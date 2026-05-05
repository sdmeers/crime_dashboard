import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid, ReferenceLine, LabelList } from 'recharts';
import L from 'leaflet';
import '../lib/leaflet-heat.js';

// Fix Leaflet's default icon issue in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const stringToColour = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let colour = '#';
  for (let i = 0; i < 3; i++) {
    let value = (hash >> (i * 8)) & 0xFF;
    colour += ('00' + value.toString(16)).slice(-2);
  }
  return colour;
};

const getCategoryColor = (category: string) => {
  if (!category) return '#94a3b8'; // slate-400 fallback
  const predefined: Record<string, string> = {
    'violent-crime': '#ef4444', // red
    'anti-social-behaviour': '#f97316', // orange
    'public-order': '#eab308', // yellow
    'criminal-damage-arson': '#84cc16', // lime
    'vehicle-crime': '#06b6d4', // cyan
    'other-theft': '#3b82f6', // blue
    'burglary': '#6366f1', // indigo
    'drugs': '#a855f7', // purple
    'shoplifting': '#ec4899', // pink
    'Person search': '#14b8a6', // teal
    'Person and Vehicle search': '#0ea5e9', // sky
    'Under Investigation (Active)': '#3b82f6',
    'No Suspect Identified (Case Closed)': '#64748b',
    'Prosecution Not Possible': '#f59e0b',
    'Out-of-Court Resolution': '#14b8a6',
    'Formal Court Action': '#ef4444',
  };
  return predefined[category] || stringToColour(category);
};

const createCustomIcon = (category: string, type: 'crime' | 'stop' | 'outcome') => {
  const color = getCategoryColor(category);
  let svgPath = '';
  
  if (type === 'crime') {
    // Circle
    svgPath = `<circle cx="12" cy="12" r="10" />`;
  } else if (type === 'stop') {
    // Diamond
    svgPath = `<polygon points="12 2 22 12 12 22 2 12 12 2" />`;
  } else if (type === 'outcome') {
    // Square
    svgPath = `<rect x="3" y="3" width="18" height="18" rx="2" ry="2" />`;
  }

  const html = `
    <div style="background-color: transparent;">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5">
        ${svgPath}
      </svg>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-leaflet-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  });
};

const iconCache: Record<string, L.DivIcon> = {};
const getIcon = (category: string, type: 'crime' | 'stop' | 'outcome') => {
  const key = `${type}-${category}`;
  if (!iconCache[key]) {
    iconCache[key] = createCustomIcon(category, type);
  }
  return iconCache[key];
};

interface MapProps {
  searchLocation: { center: [number, number], zoom: number, timestamp: number } | null;
  zoom: number;
  layers: {
    crimes: boolean;
    stops: boolean;
    outcomes: boolean;
    heatmap: boolean;
    activeAnalytic: string;
  };
  selectedMonth: string;
  onBoundsChange: (bounds: string) => void;
  onZoomChange: (zoom: number) => void;
}

function MapEvents({ onBoundsChange, onZoomChange }: any) {
  const map = useMapEvents({
    moveend: () => {
      const bounds = map.getBounds();
      const zoom = map.getZoom();
      onZoomChange(zoom);
      
      if (zoom >= 13) {
        const poly = `${bounds.getNorthWest().lat},${bounds.getNorthWest().lng}:${bounds.getNorthEast().lat},${bounds.getNorthEast().lng}:${bounds.getSouthEast().lat},${bounds.getSouthEast().lng}:${bounds.getSouthWest().lat},${bounds.getSouthWest().lng}`;
        onBoundsChange(poly);
      }
    },
    zoomend: () => {
      onZoomChange(map.getZoom());
    }
  });

  useEffect(() => {
    // Initial bounds fetch
    if (map.getZoom() >= 13) {
      const bounds = map.getBounds();
      const poly = `${bounds.getNorthWest().lat},${bounds.getNorthWest().lng}:${bounds.getNorthEast().lat},${bounds.getNorthEast().lng}:${bounds.getSouthEast().lat},${bounds.getSouthEast().lng}:${bounds.getSouthWest().lat},${bounds.getSouthWest().lng}`;
      onBoundsChange(poly);
    }
  }, [map]);

  return null;
}

function ChangeView({ searchLocation }: { searchLocation: any }) {
  const map = useMapEvents({});
  useEffect(() => {
    if (searchLocation) {
      map.flyTo(searchLocation.center, searchLocation.zoom);
    }
  }, [searchLocation?.timestamp, map]);
  return null;
}

function HeatmapLayer({ points, zoom }: { points: [number, number, number][], zoom: number }) {
  const map = useMap();
  
  useEffect(() => {
    if (!points || points.length === 0) return;
    
    // Scale pixel radius by zoom to maintain rough geographical consistency
    const getRadius = (z: number) => {
      const baseZoom = 13;
      const baseRadius = 15;
      // Double the pixel size for each zoom level to keep hotspots consistent geographically
      const multiplier = Math.min(Math.pow(2, Math.max(0, z - baseZoom)), 8);
      return baseRadius * multiplier;
    };

    const r = getRadius(zoom);
    const heatLayer = (L as any).heatLayer(points, {
      radius: r,
      blur: r * 0.8,
      maxZoom: 15,
      max: 1.0,
      minOpacity: 0.1
    }).addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [points, map, zoom]);

  return null;
}

export default function MapComponent({ searchLocation, zoom, layers, selectedMonth, onBoundsChange, onZoomChange }: MapProps) {
  const [crimes, setCrimes] = useState<any[]>([]);
  const [stops, setStops] = useState<any[]>([]);
  const [outcomes, setOutcomes] = useState<any[]>([]);
  const [currentPoly, setCurrentPoly] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [historicalLoading, setHistoricalLoading] = useState(false);

  const fetchPolyData = async (poly: string) => {
    if (!selectedMonth || zoom < 13) return;
    setLoading(true);
    
    try {
      const promises = [];
      if (layers.crimes || layers.heatmap || layers.activeAnalytic === 'crimeChart') {
        promises.push(fetch(`${import.meta.env.VITE_API_BASE_URL}/api/crimes?poly=${poly}&date=${selectedMonth}`).then(res => res.json()));
      } else promises.push(Promise.resolve([]));
      
      if (layers.stops) {
        promises.push(fetch(`${import.meta.env.VITE_API_BASE_URL}/api/stops?poly=${poly}&date=${selectedMonth}`).then(res => res.json()));
      } else promises.push(Promise.resolve([]));

      if (layers.outcomes || layers.activeAnalytic === 'outcomeChart') {
        promises.push(fetch(`${import.meta.env.VITE_API_BASE_URL}/api/outcomes?poly=${poly}&date=${selectedMonth}`).then(res => res.json()));
      } else promises.push(Promise.resolve([]));

      const [crimesData, stopsData, outcomesData] = await Promise.all(promises);
      
      if (Array.isArray(crimesData)) setCrimes(crimesData);
      if (Array.isArray(stopsData)) setStops(stopsData);
      if (Array.isArray(outcomesData)) setOutcomes(outcomesData);
      
    } catch (err) {
      console.error("Error fetching map data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentPoly) {
      fetchPolyData(currentPoly);
    }
  }, [layers.crimes, layers.heatmap, layers.stops, layers.outcomes, layers.activeAnalytic, selectedMonth, currentPoly]);

  useEffect(() => {
    if (layers.activeAnalytic === 'historicalTrends' && currentPoly) {
      setHistoricalLoading(true);
      fetch(`${import.meta.env.VITE_API_BASE_URL}/api/historical-crimes?poly=${currentPoly}`)
        .then(res => res.json())
        .then(data => {
          setHistoricalData(data);
          setHistoricalLoading(false);
        })
        .catch(err => {
          console.error(err);
          setHistoricalLoading(false);
        });
    }
  }, [layers.activeAnalytic, currentPoly]);

  const handleBoundsChange = (poly: string) => {
    setCurrentPoly(poly);
    onBoundsChange(poly);
  };

  // Maps backend outcome strings to grouped outcome categories
  const mapOutcome = (outcome_str: string) => {
      if (!outcome_str) return null;
      const o = outcome_str.trim();
      if (['Under investigation', 'Status update unavailable'].includes(o)) return "Under Investigation (Active)";
      if (o === 'Investigation complete; no suspect identified') return "No Suspect Identified (Case Closed)";
      if (['Unable to prosecute suspect', 'Formal action is not in the public interest', 'Further investigation is not in the public interest', 'Further action is not in the public interest', 'Action to be taken by another organisation'].includes(o)) return "Prosecution Not Possible";
      if (['Local resolution', 'Offender given a caution', 'Offender given a penalty notice', 'Offender given a drugs possession warning'].includes(o)) return "Out-of-Court Resolution";
      return "Formal Court Action";
  };

  // Derive visible legend items
  const visibleLegendItems = (() => {
    const map = new Map<string, {name: string, type: 'crime'|'stop'|'outcome', color: string, count: number}>();
    if (layers.crimes || layers.activeAnalytic === 'crimeChart') {
      crimes.forEach(c => {
        if (!c.location && layers.activeAnalytic !== 'crimeChart') return;
        const cat = c.category || 'unknown';
        const key = `crime-${cat}`;
        if (!map.has(key)) map.set(key, { name: cat, type: 'crime', color: getCategoryColor(cat), count: 0 });
        map.get(key)!.count += 1;
      });
    }
    if (layers.stops) {
      stops.forEach(s => {
        if (!s.location) return;
        const type = s.type || 'unknown';
        const key = `stop-${type}`;
        if (!map.has(key)) map.set(key, { name: type, type: 'stop', color: getCategoryColor(type), count: 0 });
        map.get(key)!.count += 1;
      });
    }
    if (layers.outcomes || layers.activeAnalytic === 'outcomeChart') {
      outcomes.forEach(o => {
        if (!o.crime?.location && layers.activeAnalytic !== 'outcomeChart') return;
        const name = mapOutcome(o.category?.name) || 'unknown';
        const key = `outcome-${name}`;
        if (!map.has(key)) map.set(key, { name: name, type: 'outcome', color: getCategoryColor(name), count: 0 });
        map.get(key)!.count += 1;
      });
    }
    return Array.from(map.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });
  })();

  const crimeChartData = useMemo(() => {
    if (layers.activeAnalytic !== 'crimeChart') return [];
    const counts: Record<string, number> = {};
    let totalCrimes = 0;
    crimes.forEach(c => {
      const cat = c.category || 'unknown';
      counts[cat] = (counts[cat] || 0) + 1;
      totalCrimes++;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ 
        name: name.replace(/-/g, ' '), 
        count, 
        percentLabel: totalCrimes > 0 ? `${((count / totalCrimes) * 100).toFixed(1)}%` : "0%",
        fill: getCategoryColor(name) 
      }))
      .sort((a, b) => b.count - a.count);
  }, [crimes, layers.activeAnalytic]);

  const outcomeChartData = useMemo(() => {
    if (layers.activeAnalytic !== 'outcomeChart') return [];
    const counts: Record<string, number> = {};
    let totalOutcomes = 0;
    outcomes.forEach(o => {
      const name = mapOutcome(o.category?.name) || 'unknown';
      counts[name] = (counts[name] || 0) + 1;
      totalOutcomes++;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ 
        name, 
        count, 
        percentLabel: totalOutcomes > 0 ? `${((count / totalOutcomes) * 100).toFixed(1)}%` : "0%",
        fill: getCategoryColor(name) 
      }))
      .sort((a, b) => b.count - a.count);
  }, [outcomes, layers.activeAnalytic]);

  const historicalCategories = useMemo(() => {
    if (!historicalData || historicalData.length === 0) return [];
    const keys = new Set<string>();
    historicalData.forEach(d => {
      Object.keys(d).forEach(k => {
        if (k !== 'month' && k !== 'total') keys.add(k);
      });
    });
    return Array.from(keys);
  }, [historicalData]);

  return (
    <div className="h-full w-full relative">
      {loading && (
        <div className="absolute top-4 right-4 z-[1000] bg-white px-4 py-2 rounded-md shadow-md text-sm font-semibold text-blue-600">
          Loading Data...
        </div>
      )}
      <MapContainer center={[54.5, -2.5]} zoom={6} style={{ height: '100%', width: '100%' }}>
        <ChangeView searchLocation={searchLocation} />
        <MapEvents onBoundsChange={handleBoundsChange} onZoomChange={onZoomChange} />
        
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {zoom >= 13 && (
          <>
            {layers.crimes && (
              <MarkerClusterGroup chunkedLoading>
                {crimes.map((crime, idx) => {
                  if (!crime.location) return null;
                  return (
                    <Marker 
                      key={`crime-${idx}`} 
                      position={[parseFloat(crime.location.latitude), parseFloat(crime.location.longitude)]}
                      icon={getIcon(crime.category, 'crime')}
                    >
                      <Popup>
                        <strong>{crime.category}</strong><br/>
                        {crime.location.street?.name}
                      </Popup>
                    </Marker>
                  );
                })}
              </MarkerClusterGroup>
            )}

            {layers.stops && (
              <MarkerClusterGroup chunkedLoading>
                {stops.map((stop, idx) => {
                  if (!stop.location) return null;
                  return (
                    <Marker 
                      key={`stop-${idx}`} 
                      position={[parseFloat(stop.location.latitude), parseFloat(stop.location.longitude)]}
                      icon={getIcon(stop.type, 'stop')}
                    >
                      <Popup>
                        <strong>Stop & Search</strong><br/>
                        Type: {stop.type}<br/>
                        Object: {stop.object_of_search}
                      </Popup>
                    </Marker>
                  );
                })}
              </MarkerClusterGroup>
            )}

            {layers.outcomes && (
              <MarkerClusterGroup chunkedLoading>
                {outcomes.map((outcome, idx) => {
                  const loc = outcome.crime?.location;
                  if (!loc) return null;
                  return (
                    <Marker 
                      key={`outcome-${idx}`} 
                      position={[parseFloat(loc.latitude), parseFloat(loc.longitude)]}
                      icon={getIcon(mapOutcome(outcome.category?.name) || 'unknown', 'outcome')}
                    >
                      <Popup>
                        <strong>Outcome</strong><br/>
                        {mapOutcome(outcome.category?.name) || outcome.category?.name}
                      </Popup>
                    </Marker>
                  );
                })}
              </MarkerClusterGroup>
            )}
            
            {layers.heatmap && crimes.length > 0 && (
              <HeatmapLayer 
                points={crimes.map(c => [
                  parseFloat(c.location.latitude), 
                  parseFloat(c.location.longitude), 
                  0.5 // default intensity
                ])} 
                zoom={zoom}
              />
            )}
          </>
        )}
      </MapContainer>

      {/* Legend Overlay */}
      {visibleLegendItems.length > 0 && (
        <div className="absolute bottom-6 left-2 md:bottom-6 md:left-auto md:right-6 z-[1000] bg-white/95 backdrop-blur-sm rounded-lg shadow-xl flex flex-col max-h-[40vh] md:max-h-80 w-48 md:w-64 border border-slate-200 overflow-hidden">
          <div className="p-3 md:p-4 pb-2 md:pb-3 bg-white z-10 shadow-sm shrink-0">
            <h3 className="text-xs md:text-sm font-bold text-slate-800">Visible Categories</h3>
          </div>
          <div className="p-3 md:p-4 pt-2 md:pt-2 overflow-y-auto space-y-1.5 md:space-y-2 flex-1">
            {visibleLegendItems.map(item => (
              <div key={`${item.type}-${item.name}`} className="flex items-center text-xs text-slate-700">
                <div 
                  className="w-4 h-4 mr-2 flex-shrink-0 border border-black/20"
                  style={{ 
                    backgroundColor: item.color, 
                    borderRadius: item.type === 'crime' ? '50%' : '0',
                    transform: item.type === 'stop' ? 'rotate(45deg) scale(0.8)' : 'none',
                    marginRight: item.type === 'stop' ? '10px' : '8px',
                    marginLeft: item.type === 'stop' ? '2px' : '0'
                  }}
                />
                <span className="truncate flex-1" title={`${item.name} (${item.count})`}>
                  {item.name.replace(/-/g, ' ')}
                </span>
                <span className="text-slate-400 font-medium ml-2 shrink-0">({item.count})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analytics Overlays Container (80% height, Left aligned) */}
      {layers.activeAnalytic !== 'none' && layers.activeAnalytic !== undefined && (
        <div className={`absolute top-4 left-4 md:top-6 md:left-6 z-[1000] flex flex-col pointer-events-none h-[80vh] w-[90vw] transition-[width] duration-300 ${
          layers.activeAnalytic === 'historicalTrends' ? 'md:w-[900px]' : 'md:w-[500px]'
        }`}>
          
          {layers.activeAnalytic === 'crimeChart' && crimeChartData.length > 0 && (
            <div className="bg-white/95 backdrop-blur-sm p-3 md:p-4 rounded-lg shadow-xl border border-slate-200 w-full h-full pointer-events-auto flex flex-col">
              <h3 className="text-sm md:text-base font-bold text-slate-800 mb-2 shrink-0">Crime Types</h3>
              <div className="flex-1 -ml-4 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={crimeChartData} layout="vertical" margin={{ top: 0, right: 60, left: 10, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={180} interval={0} tick={{fontSize: 13, fill: '#475569'}} axisLine={false} tickLine={false} />
                    <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{fontSize: '14px', borderRadius: '8px', border: '1px solid #e2e8f0'}} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
                      {crimeChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                      <LabelList dataKey="percentLabel" position="right" fontSize={13} fill="#64748b" fontWeight="bold" offset={10} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {layers.activeAnalytic === 'outcomeChart' && outcomeChartData.length > 0 && (
            <div className="bg-white/95 backdrop-blur-sm p-3 md:p-4 rounded-lg shadow-xl border border-slate-200 w-full h-full pointer-events-auto flex flex-col">
              <h3 className="text-sm md:text-base font-bold text-slate-800 mb-2 shrink-0">Crimes by Outcome</h3>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 40 }}>
                    <Pie
                      data={outcomeChartData}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="45%"
                      innerRadius={70}
                      outerRadius={120}
                      paddingAngle={2}
                      label={(props: any) => props.percentLabel || props.payload?.percentLabel}
                      labelLine={false}
                    >
                      {outcomeChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{fontSize: '14px', borderRadius: '8px', border: '1px solid #e2e8f0'}} />
                    <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '13px', paddingTop: '20px', paddingBottom: '20px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {layers.activeAnalytic === 'historicalTrends' && (
            <div className="bg-white/95 backdrop-blur-sm p-3 md:p-4 rounded-lg shadow-xl border border-slate-200 w-full h-full pointer-events-auto flex flex-col">
              <h3 className="text-sm md:text-base font-bold text-slate-800 mb-2 shrink-0">Historical Crime Trends</h3>
              <p className="text-xs text-slate-500 mb-2 shrink-0 border-b border-slate-200 pb-2">For currently visible map area</p>
              
              <div className="flex-1 -ml-4 min-h-0">
                {historicalLoading ? (
                  <div className="flex h-full items-center justify-center text-slate-500 text-sm">
                    Loading historical data...
                  </div>
                ) : historicalData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-slate-500 text-sm">
                    No historical data available.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historicalData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                      <RechartsTooltip 
                        labelFormatter={(val) => {
                          if (!val || typeof val !== 'string') return val;
                          const [y, m] = val.split('-');
                          const date = new Date(parseInt(y), parseInt(m) - 1);
                          return date.toLocaleString('default', { month: 'long', year: 'numeric' });
                        }}
                        itemSorter={(item) => -(item.value as number)}
                        contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '13px'}}
                        cursor={{ stroke: '#f59e0b', strokeWidth: 2, strokeDasharray: '5 5' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      {selectedMonth && (
                        <ReferenceLine 
                          x={selectedMonth} 
                          stroke="#f59e0b" 
                          strokeWidth={2}
                          strokeOpacity={0.8} 
                          strokeDasharray="3 3" 
                        />
                      )}
                      {/* Thinner lines for all individual crime types */}
                      {historicalCategories.map(cat => (
                        <Line 
                          key={cat} 
                          type="linear" 
                          dataKey={cat} 
                          stroke={getCategoryColor(cat)} 
                          strokeWidth={1.5}
                          name={cat.replace(/-/g, ' ')} 
                          dot={false}
                          activeDot={{ r: 4 }}
                          connectNulls={true}
                        />
                      ))}
                      {/* Bold line for Total */}
                      <Line 
                        type="linear" 
                        dataKey="total" 
                        stroke="#0f172a" 
                        strokeWidth={3}
                        name="Total Crimes" 
                        dot={false}
                        activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff', fill: '#0f172a' }}
                        connectNulls={true}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
