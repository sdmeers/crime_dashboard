import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
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
    'Investigation complete; no suspect identified': '#64748b', // slate
    'Unable to prosecute suspect': '#334155', // slate-700
    'Awaiting court outcome': '#f59e0b', // amber
    'Local resolution': '#22c55e', // green
  };
  return predefined[category] || stringToColour(category);
};

const createCustomIcon = (category: string, type: 'crime' | 'stop' | 'outcome') => {
  const color = getCategoryColor(category);
  let svgPath = '';
  
  if (type === 'crime') {
    svgPath = `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" fill="white" />`;
  } else if (type === 'stop') {
    svgPath = `<polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" /><line x1="12" y1="8" x2="12" y2="12" stroke="white" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="16" x2="12.01" y2="16" stroke="white" stroke-width="2" stroke-linecap="round"/>`;
  } else if (type === 'outcome') {
    svgPath = `<rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><path d="M9 12l2 2 4-4" stroke="white" stroke-width="2" stroke-linecap="round" fill="none" />`;
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
    iconAnchor: [12, type === 'crime' ? 24 : 12],
    popupAnchor: [0, type === 'crime' ? -24 : -12]
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
  };
  selectedMonth: string;
  onBoundsChange: (bounds: string) => void;
  onZoomChange: (zoom: number) => void;
}

function MapEvents({ onBoundsChange, onZoomChange, isReadyToFetch }: any) {
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

  const fetchPolyData = async (poly: string) => {
    if (!selectedMonth || zoom < 13) return;
    setLoading(true);
    
    try {
      const promises = [];
      if (layers.crimes || layers.heatmap) {
        promises.push(fetch(`http://localhost:8000/api/crimes?poly=${poly}&date=${selectedMonth}`).then(res => res.json()));
      } else promises.push(Promise.resolve([]));
      
      if (layers.stops) {
        promises.push(fetch(`http://localhost:8000/api/stops?poly=${poly}&date=${selectedMonth}`).then(res => res.json()));
      } else promises.push(Promise.resolve([]));

      if (layers.outcomes) {
        promises.push(fetch(`http://localhost:8000/api/outcomes?poly=${poly}&date=${selectedMonth}`).then(res => res.json()));
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
  }, [layers, selectedMonth, currentPoly]);

  const handleBoundsChange = (poly: string) => {
    setCurrentPoly(poly);
    onBoundsChange(poly);
  };

  // Derive visible legend items
  const visibleLegendItems = (() => {
    const map = new Map<string, {name: string, type: 'crime'|'stop'|'outcome', color: string}>();
    if (layers.crimes) {
      crimes.forEach(c => {
        const cat = c.category || 'unknown';
        if (!map.has(`crime-${cat}`)) map.set(`crime-${cat}`, { name: cat, type: 'crime', color: getCategoryColor(cat) });
      });
    }
    if (layers.stops) {
      stops.forEach(s => {
        const type = s.type || 'unknown';
        if (!map.has(`stop-${type}`)) map.set(`stop-${type}`, { name: type, type: 'stop', color: getCategoryColor(type) });
      });
    }
    if (layers.outcomes) {
      outcomes.forEach(o => {
        const name = o.category?.name || 'unknown';
        if (!map.has(`outcome-${name}`)) map.set(`outcome-${name}`, { name: name, type: 'outcome', color: getCategoryColor(name) });
      });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  })();

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
                      icon={getIcon(outcome.category?.name, 'outcome')}
                    >
                      <Popup>
                        <strong>Outcome</strong><br/>
                        {outcome.category?.name}
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
        <div className="absolute bottom-6 right-6 z-[1000] bg-white/90 backdrop-blur-sm p-4 rounded-lg shadow-xl max-h-80 overflow-y-auto w-64 border border-slate-200">
          <h3 className="text-sm font-bold text-slate-800 mb-3 sticky top-0 bg-white/90 pb-1">Visible Categories</h3>
          <div className="space-y-2">
            {visibleLegendItems.map(item => (
              <div key={`${item.type}-${item.name}`} className="flex items-center text-xs text-slate-700">
                <div 
                  className="w-4 h-4 rounded-sm mr-2 flex-shrink-0 border border-black/10"
                  style={{ backgroundColor: item.color, borderRadius: item.type === 'crime' ? '50%' : item.type === 'outcome' ? '2px' : '0' }}
                />
                <span className="truncate" title={item.name}>{item.name.replace(/-/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
