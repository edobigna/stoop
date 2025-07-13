import React, { useEffect, useRef } from 'react';
import { Ad } from '../types';

// This declaration is needed if 'L' is not globally available via a script tag in tests or other environments
// However, for the app, index.html includes Leaflet, so L should be available.
declare var L: any;

const createAdDetailMarkerIconHTML = (imageUrl?: string, adTitle?: string): string => {
  if (imageUrl) {
    return `
      <div style="
        width: 36px; 
        height: 36px;
        border-radius: 50%;
        background-image: url('${imageUrl}');
        background-size: cover;
        background-position: center;
        border: 3px solid white;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3), 0 0 0 2px #3a912d; /* stoop-green-darker approx */
      " title="${adTitle || ''}"></div>
    `;
  } else {
    // Using a generic location marker icon SVG path (similar to HiOutlineMapPin)
    const pinIconPathData = "M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm0 0V19.5m0-9c0-7.142-7.5-11.25-7.5-11.25S4.5 3.358 4.5 10.5c0 7.142 7.5 11.25 7.5 11.25s7.5-4.108 7.5-11.25z"; // Simplified path
    const adIconSVGContent = `<svg viewBox="0 0 24 24" fill="#3a912d" stroke="white" stroke-width="1" style="width: 20px; height: 20px; display: block; margin: auto;">
                                <path stroke-linecap="round" stroke-linejoin="round" d="${pinIconPathData}" />
                              </svg>`;
    return `
      <div style="
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background-color: white; 
        border: 3px solid #3a912d; 
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      " title="${adTitle || 'Posizione Oggetto'}">
        ${adIconSVGContent}
      </div>
    `;
  }
};


const AdDetailMap: React.FC<{ ad: Ad }> = ({ ad }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapInstance = useRef<any>(null);

  useEffect(() => {
    if (typeof L === 'undefined') {
      console.error("Leaflet (L) non è caricato!");
      // Potentially set an error state to inform the user
      return;
    }

    // Cleanup function for previous instance if ad changes or component unmounts
    const cleanupMap = () => {
      if (leafletMapInstance.current) {
        leafletMapInstance.current.remove();
        leafletMapInstance.current = null;
      }
    };
    
    if (mapRef.current && ad.gpsCoords) {
      cleanupMap(); // Clean up any existing map before initializing a new one

      const { latitude, longitude } = ad.gpsCoords;
      try {
        const map = L.map(mapRef.current).setView([latitude, longitude], 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        const adIconHTML = createAdDetailMarkerIconHTML(ad.images && ad.images.length > 0 ? ad.images[0] : undefined, ad.title);
        const adIcon = L.divIcon({ 
          html: adIconHTML, 
          className: 'custom-leaflet-div-icon', // Unique class for this specific divIcon type
          iconSize: [36, 36], 
          iconAnchor: [18, 18] // Centered
        });
        
        L.marker([latitude, longitude], { icon: adIcon, title: ad.locationName }).addTo(map)
          .bindPopup(`<b>${ad.title}</b><br>${ad.locationName}`)
          .openPopup();
          
        leafletMapInstance.current = map;
        
        // Invalidate size after a short delay to ensure map renders correctly in dynamic layouts
        const timer = setTimeout(() => {
          if (leafletMapInstance.current) { // Check if map instance still exists
            leafletMapInstance.current.invalidateSize();
          }
        }, 100);
        return () => clearTimeout(timer); // Clear timeout on cleanup
      } catch (mapError: any) {
        console.error("Errore durante l'inizializzazione della mappa Leaflet:", mapError);
        // Optionally set an error state here to inform the user in the UI
      }
    } else {
      cleanupMap(); // If no GPS coords, ensure any old map is cleaned up
    }
    
    return cleanupMap; // This cleanup runs when the component unmounts or 'ad' changes before re-running effect
  }, [ad]); // Rerun if ad changes

  if (!ad.gpsCoords) {
    return (
        <div className="mt-6 p-4 text-center bg-gray-100 rounded-lg border border-gray-200">
            <p className="text-gray-600">Posizione GPS non specificata per questo annuncio.</p>
        </div>
    );
  }

  return (
    <div className="mt-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-3">Posizione Approssimativa</h3>
      <div ref={mapRef} className="h-72 w-full rounded-xl shadow-lg border-2 border-stoop-green-light z-0" aria-label="Mappa della posizione dell'annuncio"></div>
       <style>{`
        .custom-leaflet-div-icon { /* This class is for the ad marker with image/default pin */
            background: transparent !important;
            border: none !important;
        }
        .leaflet-popup-content-wrapper {
            border-radius: 8px !important;
        }
        .leaflet-popup-content {
            margin: 10px !important;
            font-size: 0.875rem !important;
        }
       `}</style>
    </div>
  );
};

export default AdDetailMap;