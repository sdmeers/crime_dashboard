import { useState, useEffect } from 'react';
import MapComponent from './components/Map';
import SearchBar from './components/SearchBar';
import TimeSlider from './components/TimeSlider';
import LayerControls from './components/LayerControls';
import HistoricalTrendsScreen from './components/HistoricalTrendsScreen';
import { Shield, Menu, X } from 'lucide-react';

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
      <header className="bg-slate-900 text-white p-3 md:p-4 shadow-md flex items-center justify-between z-[2000]">
        <div className="flex items-center space-x-2">
          <button 
            className="md:hidden p-1 mr-1 text-slate-300 hover:text-white"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <Shield className="h-5 w-5 md:h-6 md:w-6 text-blue-400 shrink-0" />
          <h1 className="text-base md:text-xl font-bold tracking-tight hidden sm:block truncate">UK Crime Dashboard</h1>
        </div>
        <div className="flex items-center space-x-2 md:space-x-4 flex-1 justify-end ml-2">
          <SearchBar onSearch={handleSearch} />
          <button 
            className={`min-h-[44px] px-3 md:px-4 py-2 rounded-md text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
              isZoomedIn ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-slate-700 text-slate-400 cursor-not-allowed'
            }`}
            onClick={() => isZoomedIn && setShowTrends(true)}
            title={!isZoomedIn ? "Zoom in to view historical trends" : "View historical trends for this area"}
          >
            <span className="hidden sm:inline">Historical Trends</span>
            <span className="sm:hidden">Trends</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 relative flex overflow-hidden">
        
        {/* Mobile Sidebar Overlay */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/50 z-[2010] md:hidden backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div className={`
          absolute md:relative inset-y-0 left-0 w-80 max-w-[85vw] bg-white shadow-xl z-[2020] md:z-10 flex flex-col p-4 border-r border-slate-200 transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <div className="flex items-center justify-between mb-4 border-b pb-2">
            <h2 className="text-lg font-semibold text-slate-800">Filters & Controls</h2>
            <button 
              className="md:hidden text-slate-500 hover:text-slate-800 p-2 -mr-2" 
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          
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
