interface TimeSliderProps {
  selectedMonth: string;
  latestMonth: string;
  onChange: (month: string) => void;
}

export default function TimeSlider({ selectedMonth, latestMonth, onChange }: TimeSliderProps) {
  // Generate last 12 months based on latestMonth
  const generateMonths = () => {
    if (!latestMonth) return [];
    
    const [yearStr, monthStr] = latestMonth.split('-');
    let year = parseInt(yearStr);
    let month = parseInt(monthStr);
    
    const months = [];
    for (let i = 0; i < 12; i++) {
      const formattedMonth = month.toString().padStart(2, '0');
      months.push(`${year}-${formattedMonth}`);
      
      month--;
      if (month === 0) {
        month = 12;
        year--;
      }
    }
    return months;
  };

  const months = generateMonths();

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">Time Period</label>
      <select 
        value={selectedMonth}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
      >
        {months.length === 0 && <option value="">Loading...</option>}
        {months.map(m => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
    </div>
  );
}
