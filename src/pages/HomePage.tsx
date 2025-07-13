import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Ad, LocationCoords } from '../types';
import { firebaseApi } from '../services/firebaseApi';
import AdCard from '../components/AdCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import * as ReactRouterDOM from 'react-router-dom';
import { 
    HiOutlineXCircle, HiOutlineArchiveBoxXMark, HiOutlinePlusCircle, 
    HiOutlineAdjustmentsHorizontal 
} from 'react-icons/hi2';
import { getDistanceFromLatLonInKm } from '../utils/geoUtils';
import { useToast } from '../contexts/ToastContext';
import FilterSheet, { AppliedFilters } from '../components/FilterSheet';


const HomePage: React.FC = () => {
  const [ads, setAds] = useState<Ad[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>({
    categories: [],
    adTypes: ['user', 'street'],
    sortCriteria: 'date_desc',
  });
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  
  const [userLocation, setUserLocation] = useState<LocationCoords | null>(null);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  

  useEffect(() => {
    const fetchAds = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const fetchedAds = await firebaseApi.getAds();
        setAds(fetchedAds);
      } catch (e: any) {
        setError(e.message || "Errore nel caricamento degli annunci.");
        console.error("HomePage fetchAds error:", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAds();
  }, []);

  const handleRequestLocationAndSort = useCallback(async () => {
    if (isFetchingLocation) return;
    setIsFetchingLocation(true);
    try {
      const coords = await firebaseApi.getCurrentLocation();
      setUserLocation(coords);
      showToast("Posizione ottenuta per l'ordinamento.", "success");
    } catch (err: any) {
      showToast(`Impossibile ottenere la posizione: ${err.message}. L'ordinamento per distanza non è attivo.`, "warning");
      setAppliedFilters(prev => ({ ...prev, sortCriteria: 'date_desc' }));
    } finally {
      setIsFetchingLocation(false);
    }
  }, [isFetchingLocation, showToast]);

  useEffect(() => {
    if (appliedFilters.sortCriteria === 'distance_asc' && !userLocation && !isFetchingLocation) {
      handleRequestLocationAndSort();
    }
  }, [appliedFilters.sortCriteria, userLocation, isFetchingLocation, handleRequestLocationAndSort]);

  const handleAdUpdated = (updatedAd: Ad) => {
    setAds(prevAds => prevAds.map(ad => ad.id === updatedAd.id ? updatedAd : ad));
  };

  const handleApplyFilters = (newFilters: AppliedFilters) => {
    setAppliedFilters(newFilters);
  };

  const handleResetFilters = () => {
    setAppliedFilters({
      categories: [],
      adTypes: ['user', 'street'],
      sortCriteria: 'date_desc'
    });
  };

  const sortedAndFilteredAds = useMemo(() => {
    let processedAds = ads.filter(ad => {
        const searchTermLower = searchTerm.toLowerCase();
        if (searchTermLower === '') return true;
        return ad.title.toLowerCase().includes(searchTermLower) || 
               ad.description.toLowerCase().includes(searchTermLower) ||
               (ad.tags && ad.tags.some(tag => tag.toLowerCase().includes(searchTermLower)));
    });

    // Filter by category
    if (appliedFilters.categories.length > 0) {
      processedAds = processedAds.filter(ad => appliedFilters.categories.includes(ad.category));
    }

    // Filter by ad type
    const adTypesToFilterBy = appliedFilters.adTypes;
    if (adTypesToFilterBy.length === 0) {
      processedAds = [];
    } else {
      processedAds = processedAds.filter(ad => {
        const isUserAd = !ad.isStreetFind && adTypesToFilterBy.includes("user");
        const isStreetAd = ad.isStreetFind && adTypesToFilterBy.includes("street");
        return isUserAd || isStreetAd;
      });
    }

    if (appliedFilters.sortCriteria === 'date_desc') {
      processedAds.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
    } else if (appliedFilters.sortCriteria === 'distance_asc' && userLocation) {
      processedAds = processedAds
        .map(ad => ({
          ...ad,
          distance: ad.gpsCoords 
            ? getDistanceFromLatLonInKm(userLocation.latitude, userLocation.longitude, ad.gpsCoords.latitude, ad.gpsCoords.longitude)
            : Infinity,
        }))
        .sort((a, b) => a.distance - b.distance);
    }
    
    // Reserved ads (not COMPLETED) should appear after non-reserved ads, then sorted by main criteria
    processedAds.sort((a, b) => {
        const aIsReservedNotCompleted = a.isReserved && a.reservationStatus !== 'COMPLETED';
        const bIsReservedNotCompleted = b.isReserved && b.reservationStatus !== 'COMPLETED';

        if (aIsReservedNotCompleted && !bIsReservedNotCompleted) return 1;
        if (!aIsReservedNotCompleted && bIsReservedNotCompleted) return -1;
        return 0; // Keep original sort order from above if both have same reservation status
    });


    return processedAds;
  }, [ads, searchTerm, appliedFilters, userLocation]);


  if (isLoading && ads.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center h-[calc(100vh-8rem)] text-center p-8">
        <LoadingSpinner size="lg" text="Caricamento annunci..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 text-red-600 bg-red-50 rounded-lg shadow-md m-4" role="alert">
        <HiOutlineXCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold mb-2">Errore Caricamento Annunci</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-0 sm:px-0 py-0"> {/* Adjusted padding */}
      <header className="my-6 text-center">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-stoop-green-darker tracking-tight">
          Scopri Oggetti Unici!
        </h1>
        <p className="mt-3 text-lg text-gray-600 max-w-2xl mx-auto">
          Trova tesori gratuiti nella tua comunità o condividi ciò che non usi più.
        </p>
      </header>
      
      <div className="mb-6 p-3 bg-white rounded-xl shadow-md border border-gray-200/70 sticky top-16 z-30">
        <div className="flex gap-2 items-center">
          <div className="flex-grow">
            <label htmlFor="search" className="sr-only">Cerca annunci</label>
            <input
              type="text"
              id="search"
              placeholder="Cerca per titolo, descrizione, tag..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-stoop-green focus:border-stoop-green transition-colors"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Cerca annunci"
            />
          </div>
          <button
            onClick={() => setIsFilterSheetOpen(true)}
            className="flex-shrink-0 p-3 bg-stoop-green text-white hover:bg-stoop-green-dark rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-stoop-green-dark focus:ring-offset-1"
            aria-haspopup="true"
            aria-expanded={isFilterSheetOpen}
            aria-label="Apri filtri"
          >
            <HiOutlineAdjustmentsHorizontal className="w-6 h-6" />
          </button>
        </div>
      </div>
      
      <FilterSheet
        isOpen={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        initialFilters={appliedFilters}
        showSortOptions={true}
        showAdTypeFilter={true}
        isFetchingLocationForSort={isFetchingLocation}
        userLocationAvailable={!!userLocation}
        onRequestLocation={handleRequestLocationAndSort}
      />

      {isLoading && sortedAndFilteredAds.length === 0 && ( 
        <div className="flex flex-col justify-center items-center h-[calc(100vh-18rem)] text-center p-8">
            <LoadingSpinner size="lg" text="Caricamento annunci..." />
        </div>
      )}

      {!isLoading && sortedAndFilteredAds.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-md border border-gray-200/70 min-h-[300px] flex flex-col justify-center items-center">
            <HiOutlineArchiveBoxXMark className="mx-auto text-gray-300 w-20 h-20 mb-4" />
            <p className="text-xl text-gray-700 font-semibold">Nessun Annuncio Trovato</p>
            <p className="text-gray-500 mt-2">Prova a modificare i filtri o il criterio di ordinamento.</p>
            {currentUser && (
                 <ReactRouterDOM.Link 
                    to="/post" 
                    className="mt-6 px-5 py-2.5 bg-stoop-green text-white font-semibold rounded-lg hover:bg-stoop-green-dark transition-colors text-sm shadow-md flex items-center"
                  >
                    <HiOutlinePlusCircle className="w-4 h-4 mr-2 inline-block" /> Pubblica un Oggetto
                  </ReactRouterDOM.Link>
            )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5 px-2 sm:px-0">
          {sortedAndFilteredAds.map(ad => (
            <AdCard 
              key={ad.id} 
              ad={ad} 
              currentUser={currentUser} 
              onAdUpdated={handleAdUpdated}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default HomePage;
