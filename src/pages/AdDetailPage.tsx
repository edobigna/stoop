import React, { useEffect, useState, useCallback } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { Ad, ReservationStatus } from '../types';
import { firebaseApi } from '../services/firebaseApi';
import { db } from '../services/firebase'; // Added db import
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { DEFAULT_PROFILE_PHOTO, DEFAULT_PROFILE_PHOTO_ALT, DEFAULT_AD_IMAGE_PLACEHOLDER_ALT } from '../constants';
import ImageCarousel from '../components/ImageCarousel';
import AdDetailMap from '../components/AdDetailMap';
import LoadingSpinner from '../components/LoadingSpinner';
import ReportModal from '../components/ReportModal';
import { getUserDisplayName } from '../utils/displayUtils';
import { getDistanceFromLatLonInKm } from '../utils/geoUtils';
import {
    HiOutlineXCircle, HiOutlineTag,
    HiOutlineChatBubbleLeftEllipsis, HiOutlinePencilSquare, HiHandThumbUp,
    HiOutlineFlag, HiOutlineBuildingOffice // Added HiOutlineBuildingOffice
} from 'react-icons/hi2';


const AdDetailPage: React.FC = () => {
  const { adId } = ReactRouterDOM.useParams<{ adId: string }>();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const navigate = ReactRouterDOM.useNavigate();

  const [ad, setAd] = useState<Ad | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [isTooFar, setIsTooFar] = useState<boolean | null>(null);
  const [isCheckingDistance, setIsCheckingDistance] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const fetchAd = useCallback(async () => {
    if (!adId) {
      setError("ID annuncio non specificato.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const fetchedAd = await firebaseApi.getAdById(adId);
      if (!fetchedAd) { 
        setError("Annuncio non trovato o non più disponibile.");
        showToast("Annuncio non trovato o già ritirato.", "info");
        setAd(null); 
      } else {
        setAd(fetchedAd);
      }
    } catch (e: any) {
      setError(String(e?.message || "Errore nel caricamento dell'annuncio."));
      console.error("Ad Detail Page fetchAd error:", e);
      showToast(String(e?.message || "Errore nel caricamento dell'annuncio."), "error");
    } finally {
      setIsLoading(false);
    }
  }, [adId, showToast]);

  useEffect(() => {
    fetchAd();
  }, [fetchAd]);

  const checkUserDistance = useCallback(async () => {
    if (!ad || !ad.gpsCoords || !ad.isStreetFind || !currentUser || ad.userId === currentUser.id) {
      setIsTooFar(null);
      return;
    }
    setIsCheckingDistance(true);
    try {
      const currentPosition = await firebaseApi.getCurrentLocation();
      const distance = getDistanceFromLatLonInKm(
        currentPosition.latitude,
        currentPosition.longitude,
        ad.gpsCoords.latitude,
        ad.gpsCoords.longitude
      );
      setIsTooFar(distance * 1000 > 150); // Convert km to meters
    } catch (err: any) {
      console.error("Error getting user location for distance check:", err);
      showToast("Impossibile verificare la tua posizione per il ritiro.", "warning");
      setIsTooFar(true); // Assume too far if location fails
    } finally {
      setIsCheckingDistance(false);
    }
  }, [ad, currentUser, showToast]);

  useEffect(() => {
    if (ad && ad.isStreetFind && currentUser && ad.userId !== currentUser.id && ad.reservationStatus !== ReservationStatus.COMPLETED) {
      checkUserDistance();
    }
  }, [ad, currentUser, checkUserDistance]);


  const handleReserve = async () => {
    if (!currentUser || !ad || !ad.id || actionInProgress) return;
    setActionInProgress(true);
    try {
      const updatedAdFromApi = await firebaseApi.createReservation(ad.id, currentUser.id);
      if (updatedAdFromApi) {
        showToast(`Richiesta di prenotazione per "${updatedAdFromApi.title}" inviata!`, 'success');
        fetchAd();
      }
    } catch (e: any) {
      showToast(`Errore nella prenotazione: ${e.message || 'Errore sconosciuto'}`, 'error');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleClaimStreetFind = async () => {
    if (!currentUser || !ad || !ad.id || !ad.user || actionInProgress || isTooFar === true || isTooFar === null) {
      if (isTooFar) showToast("Sei troppo distante per ritirare questo oggetto.", "warning");
      return;
    }
    setActionInProgress(true);
    try {
      const updatedAdFromApi = await firebaseApi.claimStreetFind(ad.id, currentUser.id, ad.userId, ad.title);
      if (updatedAdFromApi) {
        showToast(`Hai segnato "${updatedAdFromApi.title}" come ritirato!`, 'success');
        navigate('/');
      }
    } catch (e: any) {
      showToast(`Errore nel ritirare l'oggetto: ${e.message || 'Errore sconosciuto'}`, 'error');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleStartChat = async () => {
    if (!currentUser || !ad || !ad.user || !ad.reservedByUserId || actionInProgress) return;

    let participantIdsForChat: string[];
    let reservationIdForChat: string | undefined;

    if (ad.reservationStatus === ReservationStatus.ACCEPTED) {
        const reservations = await db.collection('reservations')
          .where('adId', '==', ad.id)
          .where('status', '==', ReservationStatus.ACCEPTED)
          .where('requesterId', '==', ad.reservedByUserId) 
          .limit(1).get();

        if (!reservations.empty) {
            reservationIdForChat = reservations.docs[0].id;
        } else {
            console.warn("No matching ACCEPTED reservation found to link chat to for ad:", ad.id);
        }
    }


    if (currentUser.id === ad.userId) { // Current user is the ad owner
        participantIdsForChat = [currentUser.id, ad.reservedByUserId];
    } else if (currentUser.id === ad.reservedByUserId) { // Current user is the reserver
        participantIdsForChat = [currentUser.id, ad.userId];
    } else {
        showToast("Non puoi avviare una chat per questo annuncio.", "info");
        return;
    }

    setActionInProgress(true);
    try {
        const chatSession = await firebaseApi.createChatSession(
          participantIdsForChat, 
          ad.id, 
          ad.title, 
          reservationIdForChat, 
          true 
        ); 
        if (chatSession) {
            navigate(`/chat/${chatSession.id}`);
        } else {
            showToast("Impossibile avviare o trovare la chat.", "error");
        }
    } catch(e: any) {
        showToast(`Errore chat: ${e.message || 'Sconosciuto'}`, 'error');
    } finally {
        setActionInProgress(false);
    }
  };


  if (isLoading) {
    return <LoadingSpinner fullPage text="Caricamento annuncio..." />;
  }

  if (error || !ad) { // If ad is null (not found or completed), show error
    return (
      <div className="text-center p-8 text-red-600 bg-red-50 rounded-lg shadow-md m-4" role="alert">
        <HiOutlineXCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold mb-2">Errore Annuncio</h3>
        <p>{error || "Annuncio non disponibile."}</p>
        <ReactRouterDOM.Link to="/" className="mt-4 inline-block px-4 py-2 bg-stoop-green text-white rounded hover:bg-stoop-green-dark">
            Torna alla Home
        </ReactRouterDOM.Link>
      </div>
    );
  }

  const userDisplayName = getUserDisplayName(ad.user);
  const postedDate = new Date(ad.postedAt).toLocaleDateString('it-IT', { year: 'numeric', month: 'long', day: 'numeric' });
  const isMyAd = currentUser?.id === ad.userId;
  const amITheCurrentReserver = ad.isReserved && ad.reservedByUserId === currentUser?.id;
  const amIOnWaitingList = currentUser && ad.waitingListUserIds?.includes(currentUser.id);

  let reservationInfoText = null;
  if (ad.isReserved) {
    if (ad.reservationStatus === ReservationStatus.PENDING) reservationInfoText = "Prenotazione in attesa";
    else if (ad.reservationStatus === ReservationStatus.ACCEPTED) reservationInfoText = "Oggetto prenotato";
    else if (ad.reservationStatus === ReservationStatus.DECLINED) reservationInfoText = "Prenotazione rifiutata";
    else if (ad.reservationStatus === ReservationStatus.CANCELLED) reservationInfoText = "Prenotazione annullata";
    
    if (reservationInfoText && amITheCurrentReserver) reservationInfoText += " (La tua richiesta)";
    else if (reservationInfoText && isMyAd && ad.reservedByUserId) reservationInfoText += " (Oggetto riservato)";
  }


  return (
    <>
    <div className="container mx-auto px-2 sm:px-4 py-6">
      <div className="bg-white shadow-xl rounded-xl overflow-hidden max-w-3xl mx-auto border border-gray-200/70">
        <ImageCarousel images={ad.images} altText={ad.title || DEFAULT_AD_IMAGE_PLACEHOLDER_ALT} className="w-full h-64 sm:h-80 md:h-96" />

        <div className="p-5 sm:p-8">
          {ad.isStreetFind && (
            <div className="mb-4 p-3 bg-blue-100 border border-blue-300 rounded-lg text-sm text-blue-700 flex items-center shadow-sm">
              <HiOutlineBuildingOffice className="w-5 h-5 mr-2 flex-shrink-0 text-blue-600" />
              <span>Questo oggetto è stato segnalato come <strong>trovato in strada</strong>.</span>
            </div>
          )}
          <div className="flex justify-between items-start">
            <h1 className="text-2xl sm:text-3xl font-bold text-stoop-green-darker mb-2 flex-grow" id="ad-detail-title">{ad.title}</h1>
            {currentUser && !isMyAd && ( // Show report button if logged in and not my ad
                <button
                    onClick={() => setIsReportModalOpen(true)}
                    className="ml-4 p-2 text-gray-500 hover:text-red-600 rounded-full hover:bg-red-50 transition-colors"
                    aria-label="Segnala questo annuncio"
                    title="Segnala annuncio"
                >
                    <HiOutlineFlag className="w-5 h-5" />
                </button>
            )}
          </div>

          <div className="mb-4 text-sm text-gray-500">
            Pubblicato il {postedDate} in <span className="font-medium text-gray-700">{ad.locationName}</span>
             &bull; Categoria: <span className="font-medium text-gray-700">{ad.category}</span>
          </div>

          {ad.user && !ad.isStreetFind && (
            <div className="mb-6 p-3 bg-gray-50 rounded-lg border border-gray-200/80">
              <p className="text-sm text-gray-600 mb-1">Offerto da:</p>
              <ReactRouterDOM.Link to={`/profile/${ad.userId}`} className="flex items-center group">
                <img
                  src={ad.user.profilePhotoUrl || DEFAULT_PROFILE_PHOTO}
                  alt={userDisplayName || DEFAULT_PROFILE_PHOTO_ALT}
                  className="w-10 h-10 rounded-full object-cover mr-3 border-2 border-stoop-green-light"
                />
                <div>
                  <span className="text-md font-semibold text-stoop-green-dark group-hover:underline">{userDisplayName}</span>
                  {ad.user.nickname && <span className="text-xs text-gray-500 block">{ad.user.firstName} {ad.user.lastName}</span>}
                </div>
              </ReactRouterDOM.Link>
            </div>
          )}
           {ad.user && ad.isStreetFind && (
            <div className="mb-6 p-3 bg-gray-50 rounded-lg border border-gray-200/80">
              <p className="text-sm text-gray-600 mb-1">Segnalato da:</p>
              <ReactRouterDOM.Link to={`/profile/${ad.userId}`} className="flex items-center group">
                <img
                  src={ad.user.profilePhotoUrl || DEFAULT_PROFILE_PHOTO}
                  alt={getUserDisplayName(ad.user) || DEFAULT_PROFILE_PHOTO_ALT}
                  className="w-10 h-10 rounded-full object-cover mr-3 border-2 border-stoop-green-light"
                />
                <div>
                  <span className="text-md font-semibold text-stoop-green-dark group-hover:underline">{getUserDisplayName(ad.user)}</span>
                </div>
              </ReactRouterDOM.Link>
            </div>
          )}


          <h2 className="text-xl font-semibold text-gray-800 mb-2">Descrizione</h2>
          <p className="text-gray-700 mb-6 whitespace-pre-wrap">{ad.description}</p>

          {ad.tags && ad.tags.length > 0 && (
            <div className="mb-6">
              <h3 className="text-md font-semibold text-gray-800 mb-2">Tags:</h3>
              <div className="flex flex-wrap gap-2">
                {ad.tags.map((tag, index) => (
                  <span key={index} className="text-sm bg-stoop-green-light text-stoop-green-darker px-3 py-1 rounded-full font-medium flex items-center">
                    <HiOutlineTag className="w-3.5 h-3.5 mr-1.5 opacity-70" /> {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {reservationInfoText && (
              <div className={`p-3 my-4 text-sm rounded-md text-center font-medium
                ${ad.reservationStatus === ReservationStatus.PENDING ? 'bg-yellow-100 text-yellow-700 border border-yellow-300' : ''}
                ${ad.reservationStatus === ReservationStatus.ACCEPTED ? 'bg-stoop-light text-stoop-green-darker border border-stoop-green-light/80' : ''}
                ${(ad.reservationStatus === ReservationStatus.DECLINED || ad.reservationStatus === ReservationStatus.CANCELLED) ? 'bg-blue-100 text-blue-700 border border-blue-300' : ''}
              `}>
                {reservationInfoText}
              </div>
            )}
            
            {amIOnWaitingList && (
                 <p className="text-sm text-center text-blue-700 font-medium bg-blue-100 p-3 rounded-md border border-blue-200">Sei in lista d'attesa per questo oggetto.</p>
            )}

          {!isMyAd && currentUser && (
            <div className="mt-6 space-y-3">
              {ad.isStreetFind && (
                <>
                  <button
                    onClick={handleClaimStreetFind}
                    disabled={actionInProgress || isCheckingDistance || isTooFar === true || isTooFar === null}
                    className="w-full bg-stoop-green text-white font-bold py-3 px-4 rounded-lg hover:bg-stoop-green-dark focus:outline-none focus:ring-2 focus:ring-stoop-green-dark focus:ring-opacity-50 transition duration-150 ease-in-out text-base flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed animate-pulse-on-hover"
                    aria-label="Ritira oggetto da strada"
                  >
                    {actionInProgress || isCheckingDistance ? <LoadingSpinner size="sm" color="border-white" /> : <><HiHandThumbUp className="w-5 h-5 mr-2" /> Oggetto Ritirato</>}
                  </button>
                  {isCheckingDistance && <p className="text-xs text-center text-gray-500 mt-1">Verifica della distanza in corso...</p>}
                  {isTooFar === true && !isCheckingDistance && (
                    <p className="text-xs text-center text-red-500 mt-1">
                      Devi essere entro 150m per segnarlo come ritirato.
                      <button onClick={checkUserDistance} className="ml-1 underline hover:text-red-700">Riprova a verificare</button>
                    </p>
                  )}
                   {isTooFar === false && !isCheckingDistance && (
                    <p className="text-xs text-center text-stoop-green-dark mt-1">
                      Sei abbastanza vicino per ritirare l'oggetto!
                    </p>
                  )}
                </>
              )}

              {!ad.isStreetFind && !ad.isReserved && (
                <button
                  onClick={handleReserve}
                  disabled={actionInProgress}
                  className="w-full bg-stoop-green text-white font-bold py-3 px-4 rounded-lg hover:bg-stoop-green-dark focus:outline-none focus:ring-2 focus:ring-stoop-green-dark focus:ring-opacity-50 transition duration-150 ease-in-out text-base flex items-center justify-center disabled:opacity-60 animate-pulse-on-hover"
                >
                  {actionInProgress ? <LoadingSpinner size="sm" color="border-white" /> : 'Prenota Oggetto'}
                </button>
              )}

              {!ad.isStreetFind && ( (amITheCurrentReserver && ad.reservationStatus === ReservationStatus.ACCEPTED) ||
                  (isMyAd && ad.isReserved && ad.reservationStatus === ReservationStatus.ACCEPTED && ad.reservedByUserId )
               ) && (
                <button
                  onClick={handleStartChat}
                  disabled={actionInProgress}
                  className="w-full bg-stoop-green text-white font-semibold py-3 px-4 rounded-lg hover:bg-stoop-green-dark focus:outline-none focus:ring-2 focus:ring-stoop-green-dark focus:ring-opacity-50 transition duration-150 ease-in-out text-base flex items-center justify-center disabled:opacity-60 animate-pulse-on-hover"
                >
                   {actionInProgress ? <LoadingSpinner size="sm" color="border-white" /> : <><HiOutlineChatBubbleLeftEllipsis className="w-5 h-5 mr-2 inline-block" /> Vai alla Chat</>}
                </button>
               )}
            </div>
          )}
           {isMyAd && (
             <div className="mt-6 text-center">
                 <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-md border border-gray-200">Questo è un tuo annuncio.</p>
                 <ReactRouterDOM.Link 
                    to={`/edit-ad/${ad.id}`}
                    className="mt-2 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-stoop-green hover:bg-stoop-green-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-stoop-green animate-pulse-on-hover"
                  >
                    <HiOutlinePencilSquare className="w-4 h-4 mr-2" /> Modifica Annuncio
                </ReactRouterDOM.Link>
             </div>
           )}
          {ad && ad.gpsCoords && <AdDetailMap key={ad.id || 'ad-map'} ad={ad} />}
        </div>
      </div>
    </div>
    {isReportModalOpen && currentUser && ad && ( // Ensure ad is not null for ReportModal
      <ReportModal
        adId={ad.id}
        adTitle={ad.title}
        adOwnerId={ad.userId} // Pass owner ID
        reporterId={currentUser.id}
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
      />
    )}
     <style>{`
        .animate-pulse-on-hover:hover:not(:disabled) {
          animation: pulse 1.2s infinite ease-in-out;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -2px rgba(0,0,0,.1); }
          50% { transform: scale(1.02); box-shadow: 0 10px 15px -3px rgba(0,0,0,.1),0 4px 6px -4px rgba(0,0,0,.1); }
        }
      `}</style>
    </>
  );
};

export default AdDetailPage;