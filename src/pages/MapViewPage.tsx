import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Ad, LocationCoords, ReservationStatus } from '../types'; 
import { firebaseApi } from '../services/firebaseApi';
import LoadingSpinner from '../components/LoadingSpinner';
import { HiOutlineAdjustmentsHorizontal } from 'react-icons/hi2'; 
import FilterSheet, { AppliedFilters as SheetAppliedFilters } from '../components/FilterSheet';
import MapDisplay, { MapDisplayHandle } from '../components/MapDisplay';

const MapViewPage: React.FC = () => {
  const [allAds, setAllAds] = useState<Ad[]>([]);
  const [filteredMapAds, setFilteredMapAds] = useState<Ad[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<LocationCoords | null>(null);
  const [isFetchingUserLocation, setIsFetchingUserLocation] = useState(false);
  const mapDisplayRef = useRef<MapDisplayHandle>(null);

  const [appliedFilters, setAppliedFilters] = useState<SheetAppliedFilters>(() => {
    let initialFilters: SheetAppliedFilters = {
      categories: [],
      adTypes: ['user', 'street'], 
      sortCriteria: 'date_desc'
    };
    return initialFilters;
  });
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    setIsFetchingUserLocation(true);
    setError(null);
    try {
      const fetchedAdsFromApi = await firebaseApi.getAds(); 
      const adsWithCoords = fetchedAdsFromApi.filter(ad => ad.gpsCoords && ad.reservationStatus !== ReservationStatus.COMPLETED);
      setAllAds(adsWithCoords);

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
            setIsFetchingUserLocation(false);
          },
          () => {
            console.warn("Geolocation permission denied or unavailable. Map will not auto-center.");
            setIsFetchingUserLocation(false);
          },
          { timeout: 10000, enableHighAccuracy: false }
        );
      } else {
        setIsFetchingUserLocation(false);
      }
    } catch (e: any) {
      setError(e.message || "Errore nel caricamento degli annunci.");
      setIsFetchingUserLocation(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Apply filters to ads
  useEffect(() => {
    let processedAds = allAds;

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
    
    setFilteredMapAds(processedAds);
  }, [appliedFilters, allAds]);
  
  // Invalidate map size after filter sheet closes to ensure it renders correctly
  useEffect(() => {
    if(!isFilterSheetOpen && mapDisplayRef.current) {
        const timer = setTimeout(() => mapDisplayRef.current?.invalidateMapSize(), 350); // After animation
        return () => clearTimeout(timer);
    }
  }, [isFilterSheetOpen]);

  const handleApplyFilters = (newFilters: SheetAppliedFilters) => {
    setAppliedFilters(newFilters);
  };

  const handleResetFilters = () => {
    setAppliedFilters({ categories: [], adTypes: ['user', 'street'], sortCriteria: 'date_desc' });
  };
  
  const handleCenterOnUserRequest = useCallback(async () => {
    if (isFetchingUserLocation) return;
    setIsFetchingUserLocation(true);
    try {
        const coords = await firebaseApi.getCurrentLocation();
        setUserLocation(coords);
    } catch (err: any) {
        console.warn("Could not get user location on request:", err);
    } finally {
        setIsFetchingUserLocation(false);
    }
  }, [isFetchingUserLocation]);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <header className="text-center my-4 px-2">
         <h1 className="text-3xl sm:text-4xl font-extrabold text-stoop-green-darker tracking-tight">
          Esplora sulla Mappa
        </h1>
      </header>
      
      <div className="p-3 bg-white rounded-xl shadow-md border border-gray-200/70 mb-3 z-10 mx-2 sm:mx-0 sticky top-16 flex items-center justify-between">
        <p className="text-sm text-gray-600 flex-grow">
          {isLoading ? <LoadingSpinner size="sm" text="Caricamento..." /> :
           `${filteredMapAds.length} oggetti trovati.`
          }
          {error && <span className="text-red-500 text-xs ml-2">{error}</span>}
        </p>
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

      <div className="flex-grow w-full z-0 relative">
          <MapDisplay
            ref={mapDisplayRef}
            ads={filteredMapAds}
            userLocation={userLocation}
            isLoading={isLoading}
            onCenterUser={handleCenterOnUserRequest}
          />
      </div>
      
      <FilterSheet
        isOpen={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        initialFilters={appliedFilters}
        showAdTypeFilter={true}
        showSortOptions={false}
      />
    </div>
  );
};

export default MapViewPage;
