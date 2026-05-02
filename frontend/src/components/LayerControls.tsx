interface LayerControlsProps {
  layers: {
    crimes: boolean;
    stops: boolean;
    outcomes: boolean;
    heatmap: boolean;
    crimeChart: boolean;
    outcomeChart: boolean;
  };
  onChange: (layers: any) => void;
}

export default function LayerControls({ layers, onChange }: LayerControlsProps) {
  const toggleLayer = (key: string) => {
    onChange({ ...layers, [key]: !layers[key as keyof typeof layers] });
  };

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-3">Map Layers</label>
      <div className="space-y-3">
        <label className="flex items-center space-x-3 cursor-pointer">
          <input 
            type="checkbox" 
            checked={layers.crimes}
            onChange={() => toggleLayer('crimes')}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
          />
          <span className="text-sm font-medium text-slate-900">Street Crimes</span>
        </label>
        
        <label className="flex items-center space-x-3 cursor-pointer">
          <input 
            type="checkbox" 
            checked={layers.stops}
            onChange={() => toggleLayer('stops')}
            className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-600"
          />
          <span className="text-sm font-medium text-slate-900">Stop and Searches</span>
        </label>
        
        <label className="flex items-center space-x-3 cursor-pointer">
          <input 
            type="checkbox" 
            checked={layers.outcomes}
            onChange={() => toggleLayer('outcomes')}
            className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-600"
          />
          <span className="text-sm font-medium text-slate-900">Street Outcomes</span>
        </label>
        
        <label className="flex items-center space-x-3 cursor-pointer">
          <input 
            type="checkbox" 
            checked={layers.heatmap}
            onChange={() => toggleLayer('heatmap')}
            className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-600"
          />
          <span className="text-sm font-medium text-slate-900">Crime Heatmap</span>
        </label>
      </div>

      <label className="block text-sm font-medium text-slate-700 mb-3 mt-6">Analytics Overlays</label>
      <div className="space-y-3">
        <label className="flex items-center space-x-3 cursor-pointer">
          <input 
            type="checkbox" 
            checked={layers.crimeChart}
            onChange={() => toggleLayer('crimeChart')}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
          />
          <span className="text-sm font-medium text-slate-900">Crime Types Chart</span>
        </label>
        
        <label className="flex items-center space-x-3 cursor-pointer">
          <input 
            type="checkbox" 
            checked={layers.outcomeChart}
            onChange={() => toggleLayer('outcomeChart')}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
          />
          <span className="text-sm font-medium text-slate-900">Crimes by Outcome</span>
        </label>
      </div>
    </div>
  );
}
