import { useState } from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
  onSearch: (postcode: string) => void;
}

export default function SearchBar({ onSearch }: SearchBarProps) {
  const [postcode, setPostcode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (postcode.trim()) {
      onSearch(postcode.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative flex items-center">
      <input
        type="text"
        placeholder="Search Postcode..."
        value={postcode}
        onChange={(e) => setPostcode(e.target.value)}
        className="w-[140px] sm:w-40 md:w-64 pl-4 pr-10 py-2 min-h-[44px] bg-white border-2 border-blue-500 rounded-lg text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20 shadow-sm"
      />
      <button 
        type="submit" 
        className="absolute right-3 text-blue-600 hover:text-blue-800 transition-colors"
      >
        <Search className="h-5 w-5 stroke-[2.5]" />
      </button>
    </form>
  );
}
