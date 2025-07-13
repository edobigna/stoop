import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Ad, LocationCoords } from '../types';
import { DEFAULT_AD_IMAGE_PLACEHOLDER } from '../constants';
import LoadingSpinner from './LoadingSpinner';
import { HiOutlineMapPin, HiOutlineArrowPath } from 'react-icons/hi2';

declare var L: any;

const createAdMarkerIconHTML = (imageUrl?: string, adTitle?: string, isStreetFind?: boolean): string => {
  const pinBaseColor = isStreetFind ? '#2563EB' : '#16A34A';
  const pinAccentColor = isStreetFind ? '#1D4ED8' : '#15803D';

  const defaultPinSVG = `<svg viewBox="0 0 20 20" fill="${pinBaseColor}" style="width: 18px; height: 18px; display: block; margin: auto;">
                          <path fill-rule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.145l.005-.002.007-.003.017-.008a5.706 5.706 0 00.419-.26.02.02 0 00.004-.004l.01-.007a10.932 10.932 0 001.428-1.269.029.029 0 00.002-.001 10.803 10.803 0 001.989-2.318C15.254 12.958 16 10.797 16 8.5A6.5 6.5 0 003.5 8.5c0 2.297.746 4.458 1.909 6.016.002.003.003.005.005.007a10.805 10.805 0 001.99 2.318.029.029 0 00.002.001 10.932 10.932 0 001.427 1.27l.01.007a.02.02 0 00.004.003h.001c.144.093.298.187.466.276l.017.008.007.003.005.002a5.746 5.746 0 00.28.145l.019.008.006.003zM10 11a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" clip-rule="evenodd" />
                        </svg>`;

  if (imageUrl) {
    return `
      <div style="
        width: 40px; 
        height: 40px;
        border-radius: 50% 50% 50% 0; 
        transform-origin: center bottom; 
        transform: rotate(-45deg) translateY(-12px) translateX(12px) ; 
        background-image: url('${imageUrl}');
        background-size: cover;
        background-position: center;
        border: 2px solid white;
        box-shadow: 0 2px 5px rgba(0,0,0,0.4), 0 0 0 2px ${pinAccentColor};
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      " title="${adTitle || ''}">
        <div style="transform: rotate(45deg); width: 141.42%; height: 141.42%; background-image: url('${imageUrl}'); background-size: cover; background-position: center;"></div>
      </div>
    `;
  }
  return `
    <div style="
      width: 36px; 
      height: 36px; 
      border-radius: 50% 50% 50% 0; 
      background-color: #F0F0F0; 
      transform-origin: center bottom;
      transform: rotate(-45deg) translateY(-10px) translateX(10px);
      border: 2px solid ${pinAccentColor}; 
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    " title="${adTitle || 'Oggetto disponibile'}">
      <div style="transform: rotate(45deg); color: ${pinBaseColor};">${defaultPinSVG}</div>
    </div>
  `;
};

interface MapDisplayProps {
  ads: Ad[];
  userLocation: LocationCoords | null;
  isLoading?: boolean;
  onCenterUser: () => void;
}

export interface MapDisplayHandle {
  invalidateMapSize: () => void;
}

const MapDisplay = forwardRef<MapDisplayHandle, MapDisplayProps>(({ ads, userLocation, isLoading, onCenterUser }, ref) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userLocationMarkerRef = useRef<any>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const defaultCenter: LocationCoords = { latitude: 41.9028, longitude: 12.4964 };
  const defaultZoom = 6;

  useImperativeHandle(ref, () => ({
    invalidateMapSize: () => {
      if (leafletMapInstance.current) {
        leafletMapInstance.current.invalidateSize();
      }
    }
  }));

  // Initialize map
  useEffect(() => {
    if (typeof L === 'undefined') return;

    if (mapRef.current && !leafletMapInstance.current) {
      const map = L.map(mapRef.current, {
          center: [defaultCenter.latitude, defaultCenter.longitude],
          zoom: defaultZoom,
          tap: true, 
      });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd', maxZoom: 20,
      }).addTo(map);
      leafletMapInstance.current = map;

      requestAnimationFrame(() => {
        if (leafletMapInstance.current) {
          leafletMapInstance.current.invalidateSize();
        }
      });

      if (mapRef.current && !resizeObserverRef.current) {
        resizeObserverRef.current = new ResizeObserver(() => {
          if (leafletMapInstance.current) {
            leafletMapInstance.current.invalidateSize();
          }
        });
        resizeObserverRef.current.observe(mapRef.current);
      }
    }
  }, []);

  // Center map on user location when it becomes available
  useEffect(() => {
    if (leafletMapInstance.current && userLocation) {
        leafletMapInstance.current.setView([userLocation.latitude, userLocation.longitude], 13, { animate: true });
    }
  }, [userLocation]);

  // Update Ad Markers
  useEffect(() => {
    if (!leafletMapInstance.current || !ads) return;

    markersRef.current.forEach(marker => leafletMapInstance.current.removeLayer(marker));
    markersRef.current = [];

    ads.forEach(ad => {
      if (ad.gpsCoords) {
        const adIconHTML = createAdMarkerIconHTML(ad.images && ad.images.length > 0 ? ad.images[0] : undefined, ad.title, ad.isStreetFind);
        const adIcon = L.divIcon({
          html: adIconHTML, className: 'custom-mapview-div-icon',
          iconSize: [40, 40], iconAnchor: [20, 40], popupAnchor: [0, -42]
        });

        const popupContent = `
          <div style="width: 200px; font-family: 'DM Sans', sans-serif; line-height: 1.4;">
            <img src="${ad.images && ad.images.length > 0 ? ad.images[0] : DEFAULT_AD_IMAGE_PLACEHOLDER}" alt="${ad.title.replace(/"/g, '&quot;')}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 6px 6px 0 0;">
            <div style="padding: 10px;">
              <h3 style="font-size: 0.95rem; font-weight: 600; margin: 0 0 5px 0; color: #2E7D32; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${ad.title.replace(/"/g, '&quot;')}">${ad.title}</h3>
              <p style="font-size: 0.75rem; color: #666; margin: 0 0 8px 0;">${ad.category}${ad.isStreetFind ? ' <span style="background-color: #EFF6FF; color: #1D4ED8; padding: 2px 5px; border-radius: 4px; font-size: 0.7rem; font-weight:500;">DA STRADA</span>' : ''}</p>
              <a href="javascript:void(0);"
                 data-href="#/ad/${ad.id}"
                 style="display: block; text-align: center; padding: 8px 10px; background-color: #50C878; color: white; border-radius: 4px; text-decoration: none; font-size: 0.8rem; font-weight: 500; transition: background-color 0.2s;"
                 onmouseover="this.style.backgroundColor='#3A912D'"
                 onmouseout="this.style.backgroundColor='#50C878'"
                 onclick="window.location.hash = this.getAttribute('data-href');"
              >Vedi Dettagli</a>
            </div>
          </div>
        `;
        const marker = L.marker([ad.gpsCoords.latitude, ad.gpsCoords.longitude], { icon: adIcon, title: ad.title })
          .addTo(leafletMapInstance.current)
          .bindPopup(popupContent);
        markersRef.current.push(marker);
      }
    });
  }, [ads]);

  // Update User Location Marker
  useEffect(() => {
    if (!leafletMapInstance.current) return;

    if (userLocation) {
      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.setLatLng([userLocation.latitude, userLocation.longitude]);
      } else {
        userLocationMarkerRef.current = L.circleMarker([userLocation.latitude, userLocation.longitude], {
          radius: 8, fillColor: "#3B82F6", color: "#1D4ED8", weight: 2, opacity: 1, fillOpacity: 0.7, interactive: false
        }).addTo(leafletMapInstance.current).bindTooltip("La tua posizione attuale", { sticky: true });
      }
    } else {
      if (userLocationMarkerRef.current) {
        leafletMapInstance.current.removeLayer(userLocationMarkerRef.current);
        userLocationMarkerRef.current = null;
      }
    }
  }, [userLocation]);

  const handleCenterOnUser = () => {
    if (userLocation && leafletMapInstance.current) {
        leafletMapInstance.current.setView([userLocation.latitude, userLocation.longitude], 14, {animate: true});
    } else {
        onCenterUser();
    }
  };

  const handleResetZoom = () => {
    if (!leafletMapInstance.current) return;
    if (markersRef.current.length > 0) {
      const group = new L.featureGroup(markersRef.current);
      leafletMapInstance.current.fitBounds(group.getBounds().pad(0.2), {maxZoom: 16, animate: true});
    } else {
      leafletMapInstance.current.setView([defaultCenter.latitude, defaultCenter.longitude], defaultZoom, {animate: true});
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col">
      {isLoading && <div className="absolute inset-0 bg-white/70 z-20 flex items-center justify-center"><LoadingSpinner size="lg" text="Caricamento..." /></div>}
      <div ref={mapRef} className="flex-grow w-full min-h-[200px] rounded-lg shadow-inner z-0" aria-label="Mappa degli annunci disponibili"></div>
      <div className="absolute bottom-4 right-4 z-10 flex flex-col space-y-2">
        <button
          onClick={handleCenterOnUser}
          className="bg-white p-2.5 rounded-full shadow-lg text-stoop-green-darker hover:bg-gray-100 transition-colors"
          aria-label="Centra sulla tua posizione"
          title="Centra sulla tua posizione"
        >
          <HiOutlineMapPin className="w-6 h-6" />
        </button>
        <button
          onClick={handleResetZoom}
          className="bg-white p-2.5 rounded-full shadow-lg text-stoop-green-darker hover:bg-gray-100 transition-colors"
          aria-label="Mostra tutti / Zoom iniziale"
          title="Mostra tutti / Zoom iniziale"
        >
          <HiOutlineArrowPath className="w-6 h-6" />
        </button>
      </div>
      <style>{`
        .custom-mapview-div-icon { background: transparent !important; border: none !important; }
        .leaflet-popup-content-wrapper { border-radius: 8px !important; box-shadow: 0 2px 10px rgba(0,0,0,0.15) !important; }
        .leaflet-popup-content { margin: 0 !important; font-size: 0.875rem !important; min-width: 200px !important; }
        .leaflet-popup-tip { background: white !important; box-shadow: none !important; }
        .leaflet-container a.leaflet-popup-close-button { padding: 8px 8px 0 0 !important; color: #777 !important; }
        .leaflet-container a.leaflet-popup-close-button:hover { color: #333 !important; }
        .leaflet-touch .leaflet-bar button {
            width: 34px !important;
            height: 34px !important;
            line-height: 34px !important;
        }
        .leaflet-touch .leaflet-bar button span {
            font-size: 20px !important;
        }
      `}</style>
    </div>
  );
});

export default MapDisplay;
