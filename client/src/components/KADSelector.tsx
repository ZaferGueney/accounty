import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'next-i18next';
import api from '@/utils/api';

interface KAD {
  _id: string;
  code: string;
  description: string;
  descriptionEN?: string;
  category: string;
  section: string;
  isPopular: boolean;
  vatRate: number;
}

interface KADSelectorProps {
  selectedKADs: KAD[];
  onKADsChange: (kads: KAD[]) => void;
  maxSelections?: number;
  placeholder?: string;
  className?: string;
}

const KADSelector = ({ 
  selectedKADs, 
  onKADsChange, 
  maxSelections = 5,
  placeholder = "Search and select activity codes...",
  className = "" 
}: KADSelectorProps) => {
  const { t } = useTranslation('common');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KAD[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search KADs with debouncing
  useEffect(() => {
    const searchKADs = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const response = await api.get(`/api/kads/search/${encodeURIComponent(searchQuery)}?limit=10`);
        if (response.data.success) {
          // Filter out already selected KADs
          const selectedCodes = selectedKADs.map(kad => kad.code);
          const filteredResults = response.data.data.filter(
            (kad: KAD) => !selectedCodes.includes(kad.code)
          );
          setSearchResults(filteredResults);
        }
      } catch (error) {
        console.error('Error searching KADs:', error);
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchKADs, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, selectedKADs]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setIsDropdownOpen(true);
  };

  const handleKADSelect = (kad: KAD) => {
    if (selectedKADs.length < maxSelections) {
      onKADsChange([...selectedKADs, kad]);
      setSearchQuery('');
      setIsDropdownOpen(false);
      setSearchResults([]);
    }
  };

  const handleKADRemove = (kadToRemove: KAD) => {
    onKADsChange(selectedKADs.filter(kad => kad.code !== kadToRemove.code));
  };

  const handleInputFocus = () => {
    setIsDropdownOpen(searchQuery.length >= 2 && searchResults.length > 0);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Selected KADs */}
      {selectedKADs.length > 0 && (
        <div className="mb-3">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Selected Activity Codes:
          </label>
          <div className="flex flex-wrap gap-2">
            {selectedKADs.map((kad) => (
              <div
                key={kad.code}
                className="inline-flex items-center bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full text-sm"
              >
                <span className="font-mono mr-2">{kad.code}</span>
                <span className="max-w-32 truncate mr-2">{kad.description}</span>
                <button
                  type="button"
                  onClick={() => handleKADRemove(kad)}
                  className="ml-1 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-1 transition-colors"
                  aria-label={`Remove ${kad.code}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <input
          ref={searchRef}
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          onFocus={handleInputFocus}
          placeholder={selectedKADs.length >= maxSelections 
            ? `Maximum ${maxSelections} codes selected` 
            : placeholder
          }
          disabled={selectedKADs.length >= maxSelections}
          className={`w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-xl 
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            bg-white dark:bg-slate-700 text-slate-900 dark:text-white
            ${selectedKADs.length >= maxSelections ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        />
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* Search icon */}
        {!isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400">
            🔍
          </div>
        )}
      </div>

      {/* Dropdown Results */}
      {isDropdownOpen && searchResults.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-xl shadow-lg max-h-64 overflow-y-auto"
        >
          {searchResults.map((kad) => (
            <button
              key={kad.code}
              type="button"
              onClick={() => handleKADSelect(kad)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-slate-700 border-b border-gray-100 dark:border-slate-700 last:border-b-0 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-mono text-sm bg-gray-100 dark:bg-slate-600 px-2 py-1 rounded">
                      {kad.code}
                    </span>
                    <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                      {kad.section}
                    </span>
                    {kad.isPopular && (
                      <span className="text-xs">⭐</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-900 dark:text-white font-medium mb-1">
                    {kad.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {kad.category}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      VAT: {kad.vatRate}%
                    </p>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {isDropdownOpen && searchQuery.length >= 2 && searchResults.length === 0 && !isLoading && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-xl shadow-lg p-4 text-center"
        >
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            No activity codes found for "{searchQuery}"
          </p>
        </div>
      )}

      {/* Helper text */}
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        You can select up to {maxSelections} activity codes. Type at least 2 characters to search.
        {selectedKADs.length > 0 && (
          <span className="ml-2">
            ({selectedKADs.length}/{maxSelections} selected)
          </span>
        )}
      </p>
    </div>
  );
};

export default KADSelector;