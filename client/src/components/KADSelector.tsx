import { useState, useEffect, useRef, useId } from 'react';
import { useTranslation } from 'next-i18next';
import api from '@/utils/api';
import Icon from '@/components/ui/Icon';
import Spinner from '@/components/ui/Spinner';

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
  /** Optional id for the search input, so an external <label htmlFor> can point at it. */
  id?: string;
}

/**
 * Searchable picker for Greek activity codes (KAD).
 * Selected codes show as removable chips; the first one is the primary activity.
 */
const KADSelector = ({
  selectedKADs,
  onKADsChange,
  maxSelections = 5,
  placeholder,
  className = '',
  id,
}: KADSelectorProps) => {
  const { t } = useTranslation('common');
  const autoId = useId();
  const inputId = id || `kad${autoId}`;
  const listId = `${inputId}-list`;

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KAD[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const atLimit = selectedKADs.length >= maxSelections;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
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
        setSearchError(false);
        return;
      }

      setIsLoading(true);
      setSearchError(false);
      try {
        const response = await api.get(`/api/kads/search/${encodeURIComponent(searchQuery)}?limit=10`);
        if (response.data.success) {
          // Filter out already selected KADs
          const selectedCodes = selectedKADs.map((kad) => kad.code);
          const filteredResults = response.data.data.filter(
            (kad: KAD) => !selectedCodes.includes(kad.code)
          );
          setSearchResults(filteredResults);
          setActiveIndex(filteredResults.length ? 0 : -1);
        }
      } catch (error) {
        console.error('Error searching KADs:', error);
        setSearchResults([]);
        setSearchError(true);
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
      setActiveIndex(-1);
      searchRef.current?.focus();
    }
  };

  const handleKADRemove = (kadToRemove: KAD) => {
    onKADsChange(selectedKADs.filter((kad) => kad.code !== kadToRemove.code));
  };

  const handleInputFocus = () => {
    setIsDropdownOpen(searchQuery.length >= 2);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsDropdownOpen(true);
      setActiveIndex((i) => Math.min(searchResults.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      if (isDropdownOpen && activeIndex >= 0 && searchResults[activeIndex]) {
        e.preventDefault();
        handleKADSelect(searchResults[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      if (isDropdownOpen) {
        e.stopPropagation();
        setIsDropdownOpen(false);
      }
    }
  };

  const showPanel = isDropdownOpen && searchQuery.length >= 2;

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      {/* Selected KADs */}
      {selectedKADs.length > 0 && (
        <ul className="mb-2.5 flex flex-wrap gap-1.5" aria-label={t('kad.selected')}>
          {selectedKADs.map((kad, index) => (
            <li
              key={kad.code}
              className="inline-flex max-w-full items-center gap-2 rounded-full border border-line-strong bg-surface py-1 pl-3 pr-1 text-[0.8125rem] text-ink-2"
              title={kad.description}
            >
              <span className="num font-semibold text-ink">{kad.code}</span>
              <span className="max-w-[14rem] truncate sm:max-w-[18rem]">{kad.description}</span>
              {index === 0 && <span className="badge badge-info py-0 text-2xs">{t('kad.primary')}</span>}
              <button
                type="button"
                onClick={() => handleKADRemove(kad)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-sunken hover:text-danger"
                aria-label={t('kad.remove', { code: kad.code })}
              >
                <Icon name="x" size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Search Input */}
      <div className="relative">
        <Icon
          name="search"
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          ref={searchRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showPanel && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          autoComplete="off"
          value={searchQuery}
          onChange={handleSearchChange}
          onFocus={handleInputFocus}
          onKeyDown={onKeyDown}
          placeholder={atLimit ? t('kad.maxReached', { max: maxSelections }) : placeholder || t('kad.searchPlaceholder')}
          disabled={atLimit}
          className="input pl-9 pr-9"
        />
        {isLoading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
            <Spinner size={15} />
          </span>
        )}
      </div>

      {/* Results panel (absolute, above sibling content; parents have no overflow clipping) */}
      {showPanel && (
        <div className="popover absolute inset-x-0 top-full z-50 mt-1.5 overflow-hidden">
          {searchResults.length > 0 ? (
            <ul id={listId} role="listbox" className="max-h-72 overflow-y-auto p-1">
              {searchResults.map((kad, index) => {
                const active = index === activeIndex;
                return (
                  <li
                    key={kad.code}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={active}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleKADSelect(kad);
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`cursor-pointer rounded px-3 py-2.5 transition-colors ${active ? 'bg-sunken' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="num text-sm font-semibold text-ink">{kad.code}</span>
                      <span className="badge badge-neutral py-0 text-2xs">
                        {t('kad.sectionShort', { section: kad.section })}
                      </span>
                      {kad.isPopular && (
                        <span className="badge badge-warning py-0 text-2xs">
                          <Icon name="star" size={11} />
                          {t('kad.popular')}
                        </span>
                      )}
                      <span className="num ml-auto text-xs text-muted">
                        {t('kad.vatShort', { rate: kad.vatRate })}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-ink-2">{kad.description}</p>
                    {kad.category && <p className="mt-0.5 text-xs text-muted">{kad.category}</p>}
                  </li>
                );
              })}
            </ul>
          ) : !isLoading ? (
            <p id={listId} className="px-4 py-3.5 text-center text-sm text-muted">
              {searchError ? t('kad.searchFailed') : t('kad.noResults', { query: searchQuery })}
            </p>
          ) : (
            <p id={listId} className="px-4 py-3.5 text-center text-sm text-muted">
              {t('common.loading')}
            </p>
          )}
        </div>
      )}

      {/* Helper text */}
      <p className="hint">
        {t('kad.helper', { max: maxSelections })}
        {selectedKADs.length > 0 && (
          <span className="num ml-1.5">({selectedKADs.length}/{maxSelections})</span>
        )}
      </p>
    </div>
  );
};

export default KADSelector;
