import { useState, useEffect } from 'react';
import MapComponent from './components/Map';
import SearchBar from './components/SearchBar';
import TimeSlider from './components/TimeSlider';
import LayerControls from './components/LayerControls';
import HistoricalTrendsScreen from './components/HistoricalTrendsScreen';
import { Shield } from 'lucide-react';

export default function App() {
  const [selectedMonth, setSelectedMonth] = useState('');
  const [latestMonth, setLatestMonth] = useState('');
  const [layers, setLayers] = useState({
    crimes: true,
    stops: false,
    outcomes: false,
    heatmap: false
  });
  const [bounds, setBounds] = useState<any>(null);
  const [zoom, setZoom] = useState(6);
  const [showTrends, setShowTrends] = useState(false);
  const [searchLocation, setSearchLocation] = useState<{center: [number, number], zoom: number, timestamp: number} | null>(null);

  useEffect(() => {
    // Fetch last updated month
    fetch('http://localhost:8000/api/last-updated')
      .then(res => res.json())
      .then(data => {
        if (data && data.date) {
          // data.date is like "2026-03-01", we only want "2026-03"
          const monthOnly = data.date.substring(0, 7);
          setLatestMonth(monthOnly);
          setSelectedMonth(monthOnly);
        }
      })
      .catch(err => console.error("Failed to fetch last updated date", err));
  }, []);

  const handleSearch = async (postcode: string) => {
    try {
      const res = await fetch(`https://api.postcodes.io/postcodes/${postcode}`);
      const data = await res.json();
      if (data.status === 200) {
        setSearchLocation({
          center: [data.result.latitude, data.result.longitude],
          zoom: 14,
          timestamp: Date.now()
        });
      } else {
        alert("Postcode not found");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const isZoomedIn = zoom >= 13;

  return (
    <div className="flex h-screen bg-slate-100 flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-slate-900 text-white p-4 shadow-md flex items-center justify-between z-20">
        <div className="flex items-center space-x-2">
          <Shield className="h-6 w-6 text-blue-400" />
          <h1 className="text-xl font-bold tracking-tight">UK Crime Dashboard</h1>
        </div>
        <div className="flex items-center space-x-4">
          <SearchBar onSearch={handleSearch} />
          <button 
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              isZoomedIn ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-slate-700 text-slate-400 cursor-not-allowed'
            }`}
            onClick={() => isZoomedIn && setShowTrends(true)}
            title={!isZoomedIn ? "Zoom in to view historical trends" : "View historical trends for this area"}
          >
            Historical Trends
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 relative flex">
        {/* Sidebar */}
        <div className="w-80 bg-white shadow-xl z-10 flex flex-col p-4 border-r border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Controls</h2>
          
          <div className="mb-6">
            <TimeSlider 
              selectedMonth={selectedMonth} 
              latestMonth={latestMonth} 
              onChange={setSelectedMonth} 
            />
          </div>

          <div>
            <LayerControls 
              layers={layers} 
              onChange={setLayers} 
            />
          </div>

          {!isZoomedIn && (
            <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-sm">
              <strong>Notice:</strong> Please zoom in to view detailed crime data. The map covers too large an area.
            </div>
          )}
        </div>

        {/* Map Area */}
        <div className="flex-1 relative">
          <MapComponent 
            searchLocation={searchLocation}
            zoom={zoom}
            layers={layers}
            selectedMonth={selectedMonth}
            onBoundsChange={setBounds}
            onZoomChange={setZoom}
          />
        </div>
      </div>

      {showTrends && bounds && (
        <HistoricalTrendsScreen 
          bounds={bounds} 
          onClose={() => setShowTrends(false)} 
        />
      )}
    </div>
  );
}
