
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Ad, LocationCoords } from '../types';
import { firebaseApi } from '../services/firebaseApi';
import AdCard from '../components/AdCard';
import LoadingSpinner from '../components/LoadingSpinner';
import MapDisplay from '../components/MapDisplay';
import FilterSheet, { AppliedFilters } from '../components/FilterSheet';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { 
    HiOutlineXCircle, HiOutlineArchiveBoxXMark, HiOutlinePlusCircle, 
    HiOutlineAdjustmentsHorizontal, HiOutlineViewColumns, HiOutlineMap
} from 'react-icons/hi2';
import { getDistanceFromLatLonInKm } from '../utils/geoUtils';
import { useToast } from '../contexts/ToastContext';


const HomePage: React.FC = () => {
  const [ads, setAds] = useState<Ad[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>({
    categories: [],
    adTypes: ['user', 'street'],
    sortCriteria: 'date_desc',
  });
  
  const [userLocation, setUserLocation] = useState<LocationCoords | null>(null);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

  const getPathOrAuth = (path: string) => {
    if (path === '/post' && !currentUser) {
      return '/auth';
    }
    return path;
  };

  const fetchAdsAndLocation = useCallback(async () => {
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

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        },
        () => {
          console.warn("Geolocation permission denied. Some features might not work as expected.");
        }
      );
    }
  }, []);

  useEffect(() => {
    fetchAdsAndLocation();
  }, [fetchAdsAndLocation]);

  const handleRequestLocation = useCallback(async () => {
    if (isFetchingLocation) return;
    setIsFetchingLocation(true);
    try {
      const coords = await firebaseApi.getCurrentLocation();
      setUserLocation(coords);
      showToast("Posizione ottenuta.", "success");
    } catch (err: any) {
      showToast(`Impossibile ottenere la posizione: ${err.message}.`, "warning");
      if(appliedFilters.sortCriteria === 'distance_asc') {
        setAppliedFilters(prev => ({ ...prev, sortCriteria: 'date_desc' }));
      }
    } finally {
      setIsFetchingLocation(false);
    }
  }, [isFetchingLocation, showToast, appliedFilters.sortCriteria]);

  useEffect(() => {
    if (appliedFilters.sortCriteria === 'distance_asc' && !userLocation && !isFetchingLocation) {
      handleRequestLocation();
    }
  }, [appliedFilters.sortCriteria, userLocation, isFetchingLocation, handleRequestLocation]);
  
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

    if (appliedFilters.categories.length > 0) {
      processedAds = processedAds.filter(ad => appliedFilters.categories.includes(ad.category));
    }

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
      // The main sorting by date and reservation status is handled in firebaseApi.getAds()
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

    return processedAds;
  }, [ads, searchTerm, appliedFilters, userLocation]);

  const mapAds = useMemo(() => sortedAndFilteredAds.filter(ad => ad.gpsCoords), [sortedAndFilteredAds]);

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
    <div className="container mx-auto px-2 sm:px-4 py-6">
      <header className="mb-6 text-center">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-stoop-green-darker tracking-tight">
          Cosa ti serve oggi?
        </h1>
      </header>
      
      <div className="mb-4 p-3 bg-white rounded-xl shadow-md border border-gray-200/70 sticky top-16 z-30 space-y-3">
        <div className="flex gap-3 items-stretch">
          <input
            type="text"
            id="search"
            placeholder="Cerca per titolo, descrizione, tag..."
            className="w-2/3 flex-grow px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-stoop-green focus:border-stoop-green transition-colors"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Cerca annunci"
          />
           <Link 
              to={getPathOrAuth("/post")} 
              className="w-1/3 flex items-center justify-center px-4 py-2.5 bg-stoop-green text-white font-semibold rounded-lg hover:bg-stoop-green-dark transition-colors text-sm shadow-md"
            >
              <HiOutlinePlusCircle className="w-5 h-5 mr-2 inline-block" /> Pubblica
            </Link>
        </div>
        <div className="flex justify-between items-center border-t border-gray-200 pt-3">
            <button onClick={() => setIsFilterSheetOpen(true)} className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-stoop-green-dark px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors">
                <HiOutlineAdjustmentsHorizontal className="w-5 h-5" />
                <span>Filtri & Ordina</span>
            </button>
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button 
                    onClick={() => setViewMode('list')} 
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${viewMode === 'list' ? 'bg-white text-stoop-green-darker shadow' : 'text-gray-500 hover:text-gray-800'}`}
                    aria-pressed={viewMode === 'list'}
                >
                    <HiOutlineViewColumns className="w-5 h-5" />
                </button>
                 <button 
                    onClick={() => setViewMode('map')} 
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${viewMode === 'map' ? 'bg-white text-stoop-green-darker shadow' : 'text-gray-500 hover:text-gray-800'}`}
                    aria-pressed={viewMode === 'map'}
                >
                    <HiOutlineMap className="w-5 h-5" />
                </button>
            </div>
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
        onRequestLocation={handleRequestLocation}
      />

      {viewMode === 'list' ? (
        <>
        {!isLoading && sortedAndFilteredAds.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-md border border-gray-200/70 min-h-[300px] flex flex-col justify-center items-center mt-6">
              <HiOutlineArchiveBoxXMark className="mx-auto text-gray-300 w-20 h-20 mb-4" />
              <p className="text-xl text-gray-700 font-semibold">Nessun Annuncio Trovato</p>
              <p className="text-gray-500 mt-2">Prova a modificare i filtri o il criterio di ricerca.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {sortedAndFilteredAds.map(ad => (
              <AdCard 
                key={ad.id} 
                ad={ad} 
                currentUser={currentUser}
              />
            ))}
          </div>
        )}
        </>
      ) : (
        <div className="h-[calc(100vh-22rem)] rounded-lg overflow-hidden shadow-lg border-2 border-stoop-green-light">
           <MapDisplay
            ads={mapAds}
            userLocation={userLocation}
            isLoading={isLoading}
            onCenterUser={handleRequestLocation}
          />
        </div>
      )}
    </div>
  );
};

export default HomePage;
