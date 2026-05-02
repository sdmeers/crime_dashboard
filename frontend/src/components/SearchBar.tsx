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
        placeholder="Enter postcode..."
        value={postcode}
        onChange={(e) => setPostcode(e.target.value)}
        className="w-full sm:w-32 md:w-48 pl-3 pr-10 py-2 min-h-[44px] bg-slate-800 border border-slate-700 rounded-md text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button 
        type="submit" 
        className="absolute right-2 text-slate-400 hover:text-white"
      >
        <Search className="h-4 w-4" />
      </button>
    </form>
  );
}
