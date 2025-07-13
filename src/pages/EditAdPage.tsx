import React, { useState, FormEvent, ChangeEvent, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import firebase from 'firebase/compat/app'; 
import 'firebase/compat/firestore'; 
import { LocationCoords, Ad, FirestoreAdData } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { firebaseApi } from '../services/firebaseApi'; 
import { DEFAULT_AD_IMAGE_PLACEHOLDER, AD_CATEGORIES } from '../constants';
import { useToast } from '../contexts/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { HiOutlineSparkles, HiOutlineCamera, HiOutlineXMark, HiOutlineMapPin } from 'react-icons/hi2';


const EditAdPage: React.FC = () => {
  const { adId } = useParams<{ adId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [originalAd, setOriginalAd] = useState<Ad | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [locationName, setLocationName] = useState('');
  
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]); 
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]); 
  const [imagePreviews, setImagePreviews] = useState<string[]>([]); 

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingAd, setIsFetchingAd] = useState(true);
  const [gpsCoords, setGpsCoords] = useState<LocationCoords | null>(null); 
  const [isFetchingGps, setIsFetchingGps] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false); 
  const [tagsInput, setTagsInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isStreetFind, setIsStreetFind] = useState(false); 

  const [suggestions, setSuggestions] = useState<{ description: string; latitude: number; longitude: number; }[]>([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const locationInputContainerRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<number | null>(null);

  const fetchAdDetails = useCallback(async () => {
    if (!adId) { 
        showToast("Annuncio non specificato.", "error");
        navigate('/');
        return;
    }
    setIsFetchingAd(true);
    try {
      const ad = await firebaseApi.getAdById(adId);
      if (!ad) {
        showToast("Annuncio non trovato.", "error");
        navigate('/');
        return;
      }
      if (ad.userId !== currentUser!.id) { 
        showToast("Non sei autorizzato a modificare questo annuncio.", "error");
        navigate('/');
        return;
      }
      setOriginalAd(ad);
      setTitle(ad.title);
      setDescription(ad.description);
      setCategory(ad.category || '');
      setLocationName(ad.locationName);
      setGpsCoords(ad.gpsCoords || null);
      setTags(ad.tags || []);
      setTagsInput((ad.tags || []).join(', '));
      setIsStreetFind(ad.isStreetFind || false); 
      
      setExistingImageUrls(ad.images || []); 
      setImagePreviews(ad.images || []);    
      setNewImageFiles([]);                 
    } catch (error: any) {
      showToast(`Errore nel caricamento dell'annuncio: ${error.message}`, "error");
      navigate('/');
    } finally {
      setIsFetchingAd(false);
    }
  }, [adId, navigate, showToast, currentUser]); 

  useEffect(() => {
    if (currentUser) { 
        fetchAdDetails();
    }
  }, [fetchAdDetails, currentUser]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (locationInputContainerRef.current && !locationInputContainerRef.current.contains(event.target as Node)) {
            setShowSuggestions(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }
    };
  }, []);

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      const currentTotalImagesDisplayed = imagePreviews.length; 
      const additionalImagesCount = filesArray.length;

      if (currentTotalImagesDisplayed + additionalImagesCount > 5) {
        showToast(`Puoi avere un massimo di 5 immagini in totale. Attualmente ne hai ${currentTotalImagesDisplayed}.`, 'error');
        return; 
      }
      
      const newFilesToAdd = filesArray.slice(0, 5 - currentTotalImagesDisplayed);
      setNewImageFiles(prev => [...prev, ...newFilesToAdd]);

      const newPreviewsToAdd = newFilesToAdd.map(file => URL.createObjectURL(file));
      setImagePreviews(prev => [...prev, ...newPreviewsToAdd]); 
    }
  };

  const removeImage = (indexToRemoveInPreviews: number) => {
    const previewUrlToRemove = imagePreviews[indexToRemoveInPreviews];
  
    const isExistingStorageUrl = existingImageUrls.includes(previewUrlToRemove) && previewUrlToRemove.startsWith('https://firebasestorage.googleapis.com/');
  
    if (isExistingStorageUrl) {
      setExistingImageUrls(prevUrls => prevUrls.filter(url => url !== previewUrlToRemove));
    } else { 
      if (previewUrlToRemove.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrlToRemove);
      }
      let blobCount = 0;
      let fileIndexToRemove = -1;
      for(let i=0; i <= indexToRemoveInPreviews; i++) {
        if(imagePreviews[i].startsWith('blob:')) {
          if (i === indexToRemoveInPreviews) { 
            fileIndexToRemove = blobCount;
          }
          blobCount++;
        }
      }
      if (fileIndexToRemove !== -1) {
        setNewImageFiles(prevFiles => prevFiles.filter((_, i) => i !== fileIndexToRemove));
      } else {
        console.warn("Could not accurately determine new file index for removal from blob URL.");
      }
    }
    setImagePreviews(prevPreviews => prevPreviews.filter((_, i) => i !== indexToRemoveInPreviews));
  };
  

  const handleFetchGps = async () => {
    setIsFetchingGps(true);
    setGpsCoords(null); 
    try {
        const coords = await firebaseApi.getCurrentLocation();
        setGpsCoords(coords);
        if (!locationName.trim() && coords.address) {
            setLocationName(coords.address);
        } else if (!locationName.trim() && !coords.address) {
             setLocationName(`${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`);
        }
        showToast("Posizione GPS ottenuta!", 'success');
    } catch(err: any) {
        showToast(`Impossibile ottenere la posizione GPS: ${err.message}`, 'error');
        if (originalAd && originalAd.gpsCoords) setGpsCoords(originalAd.gpsCoords);
    } finally {
        setIsFetchingGps(false);
    }
  };

  const handleGeocodeAddress = async () => {
    if (!locationName.trim()) {
        showToast("Inserisci un indirizzo nel campo 'Nome Luogo' prima di verificarlo.", 'info');
        return;
    }
    setIsGeocoding(true);
    setGpsCoords(null); 
    try {
        const result = await firebaseApi.geocodeAddress(locationName.trim());
        if (result) {
            setGpsCoords(result);
            showToast(`Indirizzo trovato! Coordinate GPS: ${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}`, 'success');
        } else {
            showToast("Indirizzo non trovato. Prova a essere più specifico o usa il GPS del dispositivo.", 'error');
            if (originalAd && originalAd.gpsCoords) setGpsCoords(originalAd.gpsCoords);
        }
    } catch (err: any) {
        showToast(`Errore nella verifica dell'indirizzo: ${err.message || 'Errore sconosciuto'}`, 'error');
        if (originalAd && originalAd.gpsCoords) setGpsCoords(originalAd.gpsCoords);
    } finally {
        setIsGeocoding(false);
    }
  };

  const handleLocationNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocationName(value);
    setGpsCoords(null);

    if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
    }

    if (value.length < 3) {
        setSuggestions([]);
        return;
    }

    debounceTimeoutRef.current = window.setTimeout(async () => {
        setIsFetchingSuggestions(true);
        try {
            const results = await firebaseApi.getAddressSuggestions(value);
            setSuggestions(results);
        } catch (error) {
            console.error("Failed to fetch address suggestions:", error);
            setSuggestions([]);
        } finally {
            setIsFetchingSuggestions(false);
        }
    }, 400);
  };

  const handleSuggestionClick = (suggestion: { description: string; latitude: number; longitude: number; }) => {
      setLocationName(suggestion.description);
      setGpsCoords({
          latitude: suggestion.latitude,
          longitude: suggestion.longitude,
          address: suggestion.description
      });
      setSuggestions([]);
      setShowSuggestions(false);
  };

  const handleTagsInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newTagsInput = event.target.value;
    setTagsInput(newTagsInput);
    const processedTags = newTagsInput
      .split(',')
      .map(tag => tag.trim().toLowerCase().replace(/\s+/g, '-')) 
      .filter(tag => tag !== '');
    setTags(processedTags);
  };

  const removeTag = (indexToRemove: number) => {
    const newTagsArray = tags.filter((_, index) => index !== indexToRemove);
    setTags(newTagsArray);
    setTagsInput(newTagsArray.join(', '));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser || !originalAd) { showToast("Errore: Utente o annuncio originale non valido.", 'error'); return; }
    if (imagePreviews.length === 0) { showToast("Carica almeno un'immagine.", 'error'); return; }
    if (!title.trim() || !description.trim() || !locationName.trim() || !category) {
        showToast("Titolo, descrizione, categoria e nome del luogo sono obbligatori.", 'error'); return;
    }
    if (isStreetFind && !gpsCoords) {
      showToast("Per una segnalazione da strada, è necessario fornire le coordinate GPS.", "error");
      return;
    }

    setIsSubmitting(true);

    try {
      const updatePayload: Partial<FirestoreAdData> & {isStreetFind?: boolean} = { 
        title: title.trim(),
        description: description.trim(),
        category: category,
        locationName: locationName.trim(),
        tags: tags.filter(tag => tag.length > 0),
        isStreetFind: isStreetFind, 
      };

      if (gpsCoords) { 
        updatePayload.gpsCoords = new firebase.firestore.GeoPoint(gpsCoords.latitude, gpsCoords.longitude);
      } else { 
        if (originalAd.gpsCoords) { 
          (updatePayload as any).gpsCoords = firebase.firestore.FieldValue.delete();
        }
      }
      
      const keptExistingUrls = imagePreviews.filter(url => originalAd.images?.includes(url) && url.startsWith('https://firebasestorage.googleapis.com/'));

      const updatedAd = await firebaseApi.updateAd(
        originalAd.id, 
        updatePayload, 
        newImageFiles, 
        keptExistingUrls, 
        originalAd.images || [] 
      );

      if (updatedAd) {
        showToast("Annuncio aggiornato con successo!", 'success');
        navigate(`/ad/${updatedAd.id}`); 
      } else {
        showToast("Aggiornamento annuncio fallito. Riprova.", 'error');
      }
    } catch (err: any) {
      showToast(err.message || "Si è verificato un errore imprevisto durante l'aggiornamento dell'annuncio.", 'error');
      console.error("EditAd Error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  useEffect(() => {
    const blobPreviewsToClean = imagePreviews.filter(p => p.startsWith('blob:'));
    return () => {
      blobPreviewsToClean.forEach(preview => {
        URL.revokeObjectURL(preview);
      });
    };
  }, [imagePreviews]);

  if (isFetchingAd || !originalAd) {
    return <LoadingSpinner fullPage text="Caricamento annuncio..." />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl sm:text-5xl font-extrabold text-stoop-green-darker tracking-tight mb-8 text-center">Modifica Annuncio</h1>
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto bg-white p-6 sm:p-8 rounded-xl shadow-xl space-y-6 border border-gray-200/70">
        
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Titolo</label>
          <input id="title" type="text" value={title} onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)} required />
        </div>

        <div>
           <div className="flex justify-between items-center mb-1">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">Descrizione</label>
            <button 
              type="button" 
              onClick={() => showToast("Funzionalità AI non attiva (costi API).", "info")} 
              className="text-xs text-stoop-green hover:text-stoop-green-dark disabled:opacity-50 p-1 rounded flex items-center"
              title="Suggerisci descrizione (Funzionalità AI non attiva)"
              disabled 
            >
              <HiOutlineSparkles className="w-4 h-4 mr-1" /> Suggerisci
            </button>
          </div>
          <textarea id="description" value={description} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)} rows={4} required />
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
          <select 
            id="category" 
            value={category} 
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setCategory(e.target.value)} 
            required 
            className="bg-white"
          >
            <option value="" disabled>Seleziona una categoria</option>
            {AD_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Immagini (max 5, {imagePreviews.length} selezionate)</label>
          <div className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 ${imagePreviews.length >= 5 ? 'border-gray-200 bg-gray-50' : 'border-gray-300 border-dashed hover:border-stoop-green'} rounded-md transition-colors`}>
            <div className="space-y-1 text-center">
              <HiOutlineCamera className="mx-auto h-12 w-12 text-gray-400" />
              <div className="flex text-sm text-gray-600">
                <label htmlFor="file-upload" className={`relative cursor-pointer bg-white rounded-md font-medium text-stoop-green hover:text-stoop-green-dark focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-stoop-green ${imagePreviews.length >= 5 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <span>Aggiungi immagini</span>
                  <input id="file-upload" name="file-upload" type="file" multiple accept="image/*" onChange={handleImageChange} className="sr-only" disabled={imagePreviews.length >= 5} />
                </label>
                {imagePreviews.length < 5 && <p className="pl-1">o trascina e rilascia</p>}
              </div>
              <p className="text-xs text-gray-500">PNG, JPG, GIF. Max 5 immagini totali.</p>
               {imagePreviews.length >= 5 && <p className="text-xs text-orange-500 mt-1">Massimo 5 immagini raggiunto.</p>}
            </div>
          </div>
          {imagePreviews.length > 0 && (
            <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {imagePreviews.map((previewSrc: string, index: number) => {
                return (
                    <div key={`${previewSrc}-${index}`} className="relative group aspect-square">
                    <img src={previewSrc || DEFAULT_AD_IMAGE_PLACEHOLDER} alt={`Anteprima ${index + 1}`} className="w-full h-full object-cover rounded-md border border-gray-200 shadow-sm" />
                    <button type="button" onClick={() => removeImage(index)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all focus:opacity-100" aria-label={`Rimuovi immagine ${index + 1}`}>
                        <HiOutlineXMark className="w-3.5 h-3.5" />
                    </button>
                    </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
            <input
                type="checkbox"
                id="isStreetFindEdit"
                checked={isStreetFind}
                onChange={(e) => setIsStreetFind(e.target.checked)}
                className="h-4 w-4 text-stoop-green border-gray-300 rounded focus:ring-stoop-green"
            />
            <label htmlFor="isStreetFindEdit" className="text-sm font-medium text-gray-700">
                Segnalazione da strada (oggetto trovato per terra)
            </label>
        </div>
         {isStreetFind && (
          <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded-md border border-orange-200">
            Per le segnalazioni da strada, le coordinate GPS sono obbligatorie.
          </p>
        )}


        <div>
          <div className="flex justify-between items-center mb-1">
            <label htmlFor="tags" className="block text-sm font-medium text-gray-700">Tag (Opzionale, separati da virgola)</label>
            <button 
              type="button" 
              onClick={() => showToast("Funzionalità AI non attiva (costi API).", "info")} 
              className="text-xs text-stoop-green hover:text-stoop-green-dark disabled:opacity-50 p-1 rounded flex items-center"
              title="Suggerisci tag (Funzionalità AI non attiva)"
              disabled 
            >
              <HiOutlineSparkles className="w-4 h-4 mr-1" /> Suggerisci
            </button>
          </div>
          <input 
            id="tags" 
            type="text" 
            value={tagsInput} 
            onChange={handleTagsInputChange}
            placeholder="libro, cucina, esterno"
          />
          {tags.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {tags.map((tag, index) => (
                <span key={index} className="bg-stoop-green-light text-stoop-green-darker text-xs font-semibold px-2.5 py-1.5 rounded-full flex items-center shadow-sm">
                  {tag}
                  <button type="button" onClick={() => removeTag(index)} className="ml-2 text-stoop-green-darker hover:text-stoop-green-dark focus:outline-none bg-transparent border-none p-0" aria-label={`Rimuovi tag ${tag}`}>
                    <HiOutlineXMark className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
        
        <div className="space-y-2">
            <div className="relative" ref={locationInputContainerRef}>
                <label htmlFor="locationName" className="block text-sm font-medium text-gray-700 mb-1">Nome Luogo (es. "Panchina Parco Centrale" o "Via Roma 10, Milano")</label>
                <div className="flex items-center gap-2">
                    <input 
                        id="locationName" 
                        type="text" 
                        value={locationName} 
                        onChange={handleLocationNameChange}
                        onFocus={() => setShowSuggestions(true)}
                        required 
                        className="flex-grow" 
                        placeholder="Inizia a digitare un indirizzo..."
                        autoComplete="off"
                    />
                    <button type="button" onClick={handleGeocodeAddress} disabled={isGeocoding || !locationName.trim()} className="location-button" title="Verifica questo indirizzo per ottenere coordinate GPS">
                        {isGeocoding ? (<LoadingSpinner size="sm" color="border-stoop-green" />) : 'Verifica'}
                    </button>
                </div>
                 { showSuggestions && (isFetchingSuggestions || suggestions.length > 0) && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-lg shadow-xl z-20 max-h-60 overflow-y-auto">
                        {isFetchingSuggestions ? (
                            <div className="p-4 flex items-center justify-center text-gray-500">
                                <LoadingSpinner size="sm" />
                                <span className="ml-2 text-sm">Ricerca...</span>
                            </div>
                        ) : (
                            <ul role="listbox">
                            {suggestions.map((suggestion, index) => (
                                <li
                                key={index}
                                onClick={() => handleSuggestionClick(suggestion)}
                                className="px-4 py-3 hover:bg-stoop-green-light/50 cursor-pointer flex items-center"
                                role="option"
                                aria-selected={false}
                                >
                                <HiOutlineMapPin className="w-5 h-5 mr-3 text-gray-400 flex-shrink-0" />
                                <span className="text-sm text-gray-700">{suggestion.description}</span>
                                </li>
                            ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>

            <button type="button" onClick={handleFetchGps} disabled={isFetchingGps} className="w-full flex items-center justify-center py-2.5 px-4 border border-stoop-green text-stoop-green rounded-md shadow-sm text-sm font-medium hover:bg-stoop-green-light focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-stoop-green disabled:opacity-60 transition-colors">
                {isFetchingGps ? (<LoadingSpinner size="sm" color="border-stoop-green" />) : <HiOutlineMapPin className="w-5 h-5 mr-2" />}
                {isFetchingGps ? 'Ricerca GPS...' : (gpsCoords ? `GPS Attuale: ${gpsCoords.latitude.toFixed(4)}, ${gpsCoords.longitude.toFixed(4)} (Aggiorna)` : 'Ottieni/Aggiorna Posizione GPS (Opzionale)')}
            </button>
             <div className="text-xs text-center">
                {gpsCoords && (!isFetchingGps && !isGeocoding) && <span className="text-green-700">GPS impostato. {gpsCoords.address ? `Indirizzo approssimativo: ${gpsCoords.address}`: ''}</span>}
                {!gpsCoords && (!isFetchingGps && !isGeocoding) && originalAd?.gpsCoords && <span className="text-gray-500">L'annuncio ha già coordinate GPS. Clicca sopra per aggiornarle o verifica l'indirizzo.</span>}
                {!gpsCoords && (!isFetchingGps && !isGeocoding) && !originalAd?.gpsCoords && <span className="text-gray-500">Nessuna coordinata GPS impostata.</span>}
                {(isFetchingGps || isGeocoding) && <span className="text-gray-500">Aggiornamento GPS in corso...</span>}
             </div>
             {gpsCoords && (
                <button type="button" onClick={() => { setGpsCoords(null); showToast("Coordinate GPS rimosse (salva per confermare).", "info");}} className="text-xs text-red-500 hover:text-red-700 underline block mx-auto mt-1">
                    Rimuovi coordinate GPS
                </button>
             )}
        </div>


        <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button type="submit" disabled={isSubmitting || imagePreviews.length === 0} className="flex-1 flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-semibold text-white bg-stoop-green hover:bg-stoop-green-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-stoop-green-dark disabled:opacity-60 transition-opacity">
                {isSubmitting ? <LoadingSpinner size="sm" color="border-white" /> : 'Salva Modifiche'}
            </button>
            <button type="button" onClick={() => navigate(originalAd ? `/ad/${originalAd.id}`: '/')} className="flex-1 flex justify-center py-3 px-4 border border-gray-300 rounded-md shadow-sm text-base font-semibold text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-stoop-green transition-colors">
                Annulla
            </button>
        </div>
      </form>
      <style>{`
        .location-button {
            padding: 0.625rem 1rem;
            border: 1px solid #3a912d;
            color: #3a912d;
            border-radius: 0.375rem;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            font-size: 0.875rem; /* text-sm */
            font-weight: 500; /* font-medium */
            transition: background-color 0.15s ease-in-out, color 0.15s ease-in-out;
            white-space: nowrap;
        }
        .location-button:hover:not(:disabled) {
            background-color: #e6f7e2; /* stoop-green-light approx */
        }
        .location-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default EditAdPage;