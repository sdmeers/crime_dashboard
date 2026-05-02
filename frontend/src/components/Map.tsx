import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet.heat';

// Fix Leaflet's default icon issue in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface MapProps {
  center: [number, number];
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

function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMapEvents({});
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

function HeatmapLayer({ points }: { points: [number, number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (!points || points.length === 0) return;
    
    // Create the heat layer
    const heatLayer = (L as any).heatLayer(points, {
      radius: 25,
      blur: 15,
      maxZoom: 15,
      max: 1.0,
    }).addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [points, map]);

  return null;
}

export default function MapComponent({ center, zoom, layers, selectedMonth, onBoundsChange, onZoomChange }: MapProps) {
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

  return (
    <div className="h-full w-full relative">
      {loading && (
        <div className="absolute top-4 right-4 z-[1000] bg-white px-4 py-2 rounded-md shadow-md text-sm font-semibold text-blue-600">
          Loading Data...
        </div>
      )}
      <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
        <ChangeView center={center} zoom={zoom} />
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
                      icon={redIcon}
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
                  if (!outcome.location) return null;
                  return (
                    <Marker 
                      key={`outcome-${idx}`} 
                      position={[parseFloat(outcome.location.latitude), parseFloat(outcome.location.longitude)]}
                      icon={greenIcon}
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
              />
            )}
          </>
        )}
      </MapContainer>
    </div>
  );
}
