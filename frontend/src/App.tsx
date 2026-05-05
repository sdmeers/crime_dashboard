import { useState, useEffect } from 'react';
import MapComponent from './components/Map';
import SearchBar from './components/SearchBar';
import TimeSlider from './components/TimeSlider';
import LayerControls from './components/LayerControls';
import Overview from './components/Overview';
import { Shield, Menu, X, Map as MapIcon, BarChart3 } from 'lucide-react';

export default function App() {
  const [selectedMonth, setSelectedMonth] = useState('');
  const [latestMonth, setLatestMonth] = useState('');
  const [layers, setLayers] = useState({
    crimes: true,
    stops: false,
    outcomes: false,
    heatmap: false,
    activeAnalytic: 'none'
  });
  const [zoom, setZoom] = useState(6);
  const [searchLocation, setSearchLocation] = useState<{center: [number, number], zoom: number, timestamp: number} | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'map' | 'overview'>('overview');

  useEffect(() => {
    // Fetch last updated month
    fetch(`${import.meta.env.VITE_API_BASE_URL}/api/last-updated`)
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
      <header className="bg-slate-900 text-white pt-3 md:pt-4 px-3 md:px-4 shadow-md flex items-end justify-between z-[2000] border-b border-slate-200">
        <div className="flex items-center pb-2 md:pb-3">
          {activeTab === 'map' && (
            <button 
              className="md:hidden p-1 mr-1 text-slate-300 hover:text-white"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>
          )}
          <Shield className="h-5 w-5 md:h-6 md:w-6 text-blue-400 shrink-0" />
          <h1 className="text-base md:text-xl font-bold tracking-tight hidden md:block mr-8">UK Crime Dashboard</h1>
        </div>
          
        {/* Tabs */}
        <div className="flex space-x-1 flex-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-t border-x ${
              activeTab === 'overview' ? 'bg-slate-100 text-slate-900 border-slate-200 z-10' : 'bg-slate-800 text-slate-400 border-transparent hover:bg-slate-700 hover:text-white'
            }`}
            style={{ marginBottom: activeTab === 'overview' ? '-1px' : '0' }}
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">National Overview</span>
            <span className="sm:hidden">Overview</span>
          </button>
          <button
            onClick={() => setActiveTab('map')}
            className={`flex items-center px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-t border-x ${
              activeTab === 'map' ? 'bg-slate-100 text-slate-900 border-slate-200 z-10' : 'bg-slate-800 text-slate-400 border-transparent hover:bg-slate-700 hover:text-white'
            }`}
            style={{ marginBottom: activeTab === 'map' ? '-1px' : '0' }}
          >
            <MapIcon className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Interactive Map</span>
            <span className="sm:hidden">Map</span>
          </button>
        </div>
        <div className="flex items-center space-x-2 md:space-x-4 justify-end pb-2 md:pb-3 ml-2">
          {activeTab === 'map' ? <SearchBar onSearch={handleSearch} /> : <div className="min-h-[44px]"></div>}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 relative flex overflow-hidden">
        
        {activeTab === 'overview' ? (
          <Overview />
        ) : (
          <>
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

              <div className="mt-auto pt-6 pb-2 text-xs text-slate-500 text-center">
                <a 
                  href="https://www.police.uk/pu/contact-us/what-and-how-to-report/what-report/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-blue-600 underline underline-offset-2 transition-colors"
                >
                  View Crime Definitions
                </a>
              </div>
            </div>

            {/* Map Area */}
            <div className="flex-1 relative">
              <MapComponent 
                searchLocation={searchLocation}
                zoom={zoom}
                layers={layers}
                selectedMonth={selectedMonth}
                onBoundsChange={() => {}}
                onZoomChange={setZoom}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
