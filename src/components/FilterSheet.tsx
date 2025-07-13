
import React, { useState, useEffect, useMemo } from 'react';
import { HiOutlineXMark, HiCheck, HiOutlineMapPin, HiOutlineCalendarDays } from 'react-icons/hi2';
import { AD_CATEGORIES, AD_TYPE_FILTER_OPTIONS_CONST } from '../constants';
import LoadingSpinner from './LoadingSpinner';

export interface AppliedFilters {
  categories: string[];
  adTypes: string[];
  sortCriteria?: 'date_desc' | 'distance_asc';
}

// Exporting this as it's used by HomePage as well
export const AD_TYPE_OPTIONS = AD_TYPE_FILTER_OPTIONS_CONST;


interface FilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (filters: AppliedFilters) => void;
  onReset: () => void; // Callback for when filters are reset
  initialFilters: AppliedFilters;
  showAdTypeFilter?: boolean; // To show/hide ad type filter section
  showSortOptions?: boolean; // To show/hide sort options (e.g., hide for map view)
  isFetchingLocationForSort?: boolean;
  userLocationAvailable?: boolean;
  onRequestLocation?: () => void;
}

const FilterSheet: React.FC<FilterSheetProps> = ({
  isOpen,
  onClose,
  onApply,
  onReset,
  initialFilters,
  showAdTypeFilter = true,
  showSortOptions = false,
  isFetchingLocationForSort,
  userLocationAvailable,
  onRequestLocation,
}) => {
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialFilters.categories);
  const [selectedAdTypes, setSelectedAdTypes] = useState<string[]>(initialFilters.adTypes);
  const [selectedSortCriteria, setSelectedSortCriteria] = useState<'date_desc' | 'distance_asc'>(
    initialFilters.sortCriteria || 'date_desc'
  );

  // Sync local state with initialFilters when sheet opens or initialFilters change
  useEffect(() => {
    if (isOpen) {
      setSelectedCategories(initialFilters.categories);
      setSelectedAdTypes(initialFilters.adTypes);
      setSelectedSortCriteria(initialFilters.sortCriteria || 'date_desc');
    }
  }, [isOpen, initialFilters]);

  const handleCategoryToggle = (category: string) => {
    const newCategories = selectedCategories.includes(category)
      ? selectedCategories.filter(c => c !== category)
      : [...selectedCategories, category];
    setSelectedCategories(newCategories);
    // Apply immediately for categories
    onApply({ categories: newCategories, adTypes: selectedAdTypes, sortCriteria: selectedSortCriteria });
  };

  const handleAdTypeToggle = (adType: string) => {
    const newAdTypes = selectedAdTypes.includes(adType)
      ? selectedAdTypes.filter(t => t !== adType)
      : [...selectedAdTypes, adType];
    setSelectedAdTypes(newAdTypes);
    // Apply immediately for ad types
    onApply({ categories: selectedCategories, adTypes: newAdTypes, sortCriteria: selectedSortCriteria });
  };

  const handleSortChange = (criteria: 'date_desc' | 'distance_asc') => {
    setSelectedSortCriteria(criteria);
    // Apply immediately for sort criteria
    onApply({ categories: selectedCategories, adTypes: selectedAdTypes, sortCriteria: criteria });
  };

  const handleResetFiltersLocal = () => {
    // Determine the adTypes to reset to. If showAdTypeFilter is true,
    // use the initial adTypes if they exist, otherwise default to all ad types.
    // If showAdTypeFilter is false, just keep whatever initial adTypes were passed.
    const adTypesForReset = showAdTypeFilter
        ? (initialFilters.adTypes.length > 0 ? initialFilters.adTypes : AD_TYPE_OPTIONS.map(opt => opt.value))
        : initialFilters.adTypes;

    const resetFiltersState: AppliedFilters = {
      categories: [],
      adTypes: adTypesForReset,
      sortCriteria: 'date_desc', // Always reset sort to date_desc
    };
    
    setSelectedCategories(resetFiltersState.categories);
    setSelectedAdTypes(resetFiltersState.adTypes);
    setSelectedSortCriteria(resetFiltersState.sortCriteria || 'date_desc');
    
    onApply(resetFiltersState); // Apply the reset state
    if(onReset) onReset(); // Call the external onReset handler if provided
  };
  
  // Memoize constant arrays to prevent re-renders of list items if not necessary
  const memoizedCategories = useMemo(() => AD_CATEGORIES, []);
  const memoizedAdTypes = useMemo(() => AD_TYPE_OPTIONS, []);


  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-end"
      onClick={onClose} // Close on overlay click
      role="dialog"
      aria-modal="true"
      aria-labelledby="filter-sheet-title"
    >
      <div
        className="bg-white w-full max-w-screen-sm rounded-t-2xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh]" // Limit max height
        onClick={e => e.stopPropagation()} // Prevent closing when clicking inside
        style={{ animation: 'slideUp 0.3s ease-out forwards' }}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="w-10"> {/* Spacer for centering title or for a potential left-side action */}
             <button
                onClick={onClose}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
                aria-label="Chiudi filtri"
              >
                <HiOutlineXMark className="w-6 h-6" />
              </button>
          </div>
          <h2 id="filter-sheet-title" className="text-lg font-semibold text-gray-800 text-center">Filtri</h2>
          <button
            onClick={handleResetFiltersLocal}
            className="text-sm font-medium text-stoop-green hover:text-stoop-green-dark px-3 py-1.5 rounded-md hover:bg-stoop-green-light/50 transition-colors"
          >
            Reset
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-grow overflow-y-auto px-4 pt-4 pb-16 space-y-6"> {/* Increased pb-16 for bottom spacing */}
          {/* Categories Section */}
          <div>
            <h3 className="text-md font-semibold text-gray-700 mb-3">Categorie</h3>
            <div className="flex flex-wrap gap-2">
              {memoizedCategories.map(category => {
                const isSelected = selectedCategories.includes(category);
                return (
                  <button
                    key={category}
                    onClick={() => handleCategoryToggle(category)}
                    className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all duration-150 ease-in-out flex items-center
                                ${isSelected
                                  ? 'bg-stoop-green-light border-stoop-green-darker text-stoop-green-darker shadow-sm'
                                  : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                                }`}
                    aria-pressed={isSelected}
                  >
                    <span className={`w-4 h-4 mr-2 rounded border flex items-center justify-center
                                      ${isSelected ? 'bg-stoop-green-darker border-stoop-green-darker' : 'border-gray-400'}`}>
                      {isSelected && <HiCheck className="w-3 h-3 text-white" />}
                    </span>
                    {category}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ad Type Section (Conditional) */}
          {showAdTypeFilter && (
            <div>
              <h3 className="text-md font-semibold text-gray-700 mb-3">Tipo di Oggetto</h3>
              <div className="flex flex-wrap gap-2">
                {memoizedAdTypes.map(adType => {
                  const isSelected = selectedAdTypes.includes(adType.value);
                  return (
                    <button
                      key={adType.value}
                      onClick={() => handleAdTypeToggle(adType.value)}
                      className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all duration-150 ease-in-out flex items-center
                                  ${isSelected
                                    ? 'bg-stoop-green-light border-stoop-green-darker text-stoop-green-darker shadow-sm'
                                    : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                                  }`}
                      aria-pressed={isSelected}
                    >
                      <span className={`w-4 h-4 mr-2 rounded border flex items-center justify-center
                                        ${isSelected ? 'bg-stoop-green-darker border-stoop-green-darker' : 'border-gray-400'}`}>
                        {isSelected && <HiCheck className="w-3 h-3 text-white" />}
                      </span>
                      {adType.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sort Options Section (Conditional) */}
          {showSortOptions && (
            <div>
              <h3 className="text-md font-semibold text-gray-700 mb-3">Ordina per</h3>
              <div className="space-y-2">
                <button
                  onClick={() => handleSortChange('date_desc')}
                  className={`w-full px-3.5 py-2.5 rounded-lg border text-sm font-medium transition-all duration-150 ease-in-out flex items-center justify-start
                              ${selectedSortCriteria === 'date_desc'
                                ? 'bg-stoop-green-light border-stoop-green-darker text-stoop-green-darker shadow-sm'
                                : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                              }`}
                  aria-pressed={selectedSortCriteria === 'date_desc'}
                >
                  <HiOutlineCalendarDays className={`w-5 h-5 mr-2.5 ${selectedSortCriteria === 'date_desc' ? 'text-stoop-green-darker' : 'text-gray-500'}`} />
                  Più Recenti
                </button>
                <button
                  onClick={() => handleSortChange('distance_asc')}
                  disabled={isFetchingLocationForSort}
                  className={`w-full px-3.5 py-2.5 rounded-lg border text-sm font-medium transition-all duration-150 ease-in-out flex items-center justify-start
                              ${selectedSortCriteria === 'distance_asc'
                                ? 'bg-stoop-green-light border-stoop-green-darker text-stoop-green-darker shadow-sm'
                                : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                              }
                              ${isFetchingLocationForSort ? 'opacity-60 cursor-not-allowed' : ''}`}
                  aria-pressed={selectedSortCriteria === 'distance_asc'}
                >
                  {isFetchingLocationForSort ?
                    <LoadingSpinner size="sm" color="border-stoop-green-darker" text="Caricamento..." /> :
                    <HiOutlineMapPin className={`w-5 h-5 mr-2.5 ${selectedSortCriteria === 'distance_asc' ? 'text-stoop-green-darker' : 'text-gray-500'}`} />
                  }
                  Distanza Crescente
                </button>
                {selectedSortCriteria === 'distance_asc' && !userLocationAvailable && !isFetchingLocationForSort && onRequestLocation && (
                    <p className="text-xs text-yellow-700 mt-1.5 text-center bg-yellow-50 p-2 rounded-md border border-yellow-200">
                        Per ordinare per distanza, <button onClick={onRequestLocation} className="underline font-semibold hover:text-yellow-800">attiva la geolocalizzazione</button>.
                    </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer (optional, can be used for an Apply button if not applying immediately) */}
        <div className="p-2 border-t border-gray-200 sticky bottom-0 bg-white z-10">
          {/* Kept empty as per previous design, apply happens on interaction */}
        </div>
      </div>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default FilterSheet;
