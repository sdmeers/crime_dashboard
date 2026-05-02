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
    const map = new Map<string, {name: string, type: 'crime'|'stop'|'outcome', color: string, count: number}>();
    if (layers.crimes) {
      crimes.forEach(c => {
        if (!c.location) return;
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
    if (layers.outcomes) {
      outcomes.forEach(o => {
        if (!o.crime?.location) return;
        const name = o.category?.name || 'unknown';
        const key = `outcome-${name}`;
        if (!map.has(key)) map.set(key, { name: name, type: 'outcome', color: getCategoryColor(name), count: 0 });
        map.get(key)!.count += 1;
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
        <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 z-[1000] bg-white/95 backdrop-blur-sm rounded-lg shadow-xl flex flex-col max-h-[40vh] md:max-h-80 w-48 md:w-64 border border-slate-200 overflow-hidden">
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
    </div>
  );
}
