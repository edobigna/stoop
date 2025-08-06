
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ReservationStatus, AdCardProps } from '../types'; // AdCardProps imported from types
import { DEFAULT_AD_IMAGE_PLACEHOLDER } from '../constants';
import { getUserDisplayName } from '../utils/displayUtils';
import { firebaseApi } from '../services/firebaseApi';
import { useToast } from '../contexts/ToastContext';
import { getDistanceFromLatLonInKm } from '../utils/geoUtils';
import LoadingSpinner from './LoadingSpinner';
import { 
    HiOutlinePencilSquare, HiOutlineXMark, HiOutlineMapPin, 
    HiHandThumbUp, HiOutlineClock, HiOutlineQueueList 
} from 'react-icons/hi2';

const AdCard: React.FC<AdCardProps> = ({ 
    ad, 
    currentUser, 
    showEditButton = false,
    showDeleteButton = false,
    onDeleteAd,
    onEditAd,
    onAdUpdated
}) => {
  const postedDate = new Date(ad.postedAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
  const isMyAd = currentUser?.id === ad.userId;
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [actionInProgress, setActionInProgress] = useState(false);
  const [isCheckingDistance, setIsCheckingDistance] = useState(false);

  const amITheCurrentReserver = ad.isReserved && ad.reservedByUserId === currentUser?.id;
  const amIOnWaitingList = currentUser && ad.waitingListUserIds?.includes(currentUser.id);


  const handleReserveFromCard = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUser) {
      showToast("Devi effettuare il login per prenotare.", "info");
      navigate('/auth', { state: { from: `/ad/${ad.id}` } });
      return;
    }
    if (!ad || actionInProgress || ad.isStreetFind) return;
    setActionInProgress(true);
    try {
      const updatedAdDetails = await firebaseApi.createReservation(ad.id, currentUser.id);
      if (updatedAdDetails && onAdUpdated) {
        showToast(`Richiesta per "${updatedAdDetails.title}" inviata!`, 'success');
        onAdUpdated(updatedAdDetails);
      } else if (updatedAdDetails === null && !onAdUpdated) { // Handle case where onAdUpdated might not be provided but action succeeded
        showToast(`Richiesta per "${ad.title}" inviata!`, 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Errore prenotazione.', 'error');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleJoinWaitingListFromCard = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUser) {
      showToast("Devi effettuare il login per unirti alla lista.", "info");
      navigate('/auth', { state: { from: `/ad/${ad.id}` } });
      return;
    }
    if (!ad || actionInProgress || ad.isStreetFind) return;
    setActionInProgress(true);
    try {
      const updatedAdDetails = await firebaseApi.joinWaitingList(ad.id, currentUser.id);
      if (updatedAdDetails && onAdUpdated) {
        showToast(`Ti sei unito alla lista d'attesa per "${updatedAdDetails.title}"!`, 'success');
        onAdUpdated(updatedAdDetails);
      }
    } catch (err: any) {
      showToast(err.message || "Errore lista d'attesa.", 'error');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleClaimStreetFindFromCard = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUser) {
      showToast("Devi effettuare il login per ritirare l'oggetto.", "info");
      navigate('/auth', { state: { from: `/ad/${ad.id}` } });
      return;
    }
    if (!ad || !ad.isStreetFind || !ad.gpsCoords || actionInProgress) {
        if (!ad.gpsCoords && ad.isStreetFind) showToast("Coordinate GPS mancanti per questo annuncio.", "error");
        return;
    }
    
    setActionInProgress(true);
    setIsCheckingDistance(true);
    try {
      const userCoords = await firebaseApi.getCurrentLocation();
      const distance = getDistanceFromLatLonInKm(userCoords.latitude, userCoords.longitude, ad.gpsCoords.latitude, ad.gpsCoords.longitude);
      
      if (distance * 1000 <= 150) { 
        setIsCheckingDistance(false); 
        const updatedAdDetails = await firebaseApi.claimStreetFind(ad.id, currentUser.id, ad.userId, ad.title);
        if (updatedAdDetails && onAdUpdated) {
          showToast(`Hai segnato "${updatedAdDetails.title}" come ritirato!`, 'success');
          onAdUpdated(updatedAdDetails);
        }
      } else {
        showToast("Sei troppo distante (oltre 150m) per ritirare questo oggetto.", "warning");
        setIsCheckingDistance(false);
        setActionInProgress(false); 
      }
    } catch (err: any) {
      showToast(err.message || "Errore nel ritirare l'oggetto.", 'error');
      setIsCheckingDistance(false);
      setActionInProgress(false); 
    } 
  };


  const renderActionButtons = () => {
    if (!currentUser || isMyAd) return null;

    // --- Street Find Item Logic ---
    if (ad.isStreetFind) {
        if (ad.reservationStatus === ReservationStatus.COMPLETED) {
             return (
                <button
                    disabled
                    className="w-full mt-2 py-2 px-3 bg-gray-300 text-gray-600 text-xs font-semibold rounded-md flex items-center justify-center shadow"
                >
                    <HiHandThumbUp className="w-4 h-4 mr-1.5" /> Oggetto Ritirato
                </button>
            );
        }
        return (
            <button
                onClick={handleClaimStreetFindFromCard}
                disabled={actionInProgress || isCheckingDistance}
                className="w-full mt-2 py-2 px-3 bg-stoop-green text-white text-xs font-semibold rounded-md hover:bg-stoop-green-dark transition-colors flex items-center justify-center shadow disabled:opacity-60"
            >
                {actionInProgress || isCheckingDistance ? <LoadingSpinner size="sm" color="border-white" /> : <><HiHandThumbUp className="w-4 h-4 mr-1.5" /> Ritira Oggetto</>}
            </button>
        );
    }

    // --- Regular Item Logic ---
    if (ad.reservationStatus === ReservationStatus.COMPLETED) {
        return (
            <button
                disabled
                className="w-full mt-2 py-2 px-3 bg-gray-300 text-gray-600 text-xs font-semibold rounded-md flex items-center justify-center shadow"
            >
                Oggetto Consegnato
            </button>
        );
    }

    if (amITheCurrentReserver) {
        if (ad.reservationStatus === ReservationStatus.PENDING) {
            return (
                <button disabled className="w-full mt-2 py-2 px-3 bg-orange-100 text-orange-700 text-xs font-semibold rounded-md flex items-center justify-center border border-orange-200">
                    Richiesta Inviata
                </button>
            );
        }
        if (ad.reservationStatus === ReservationStatus.ACCEPTED) {
            return (
                <button disabled className="w-full mt-2 py-2 px-3 bg-green-100 text-green-700 text-xs font-semibold rounded-md flex items-center justify-center border border-green-200">
                    Prenotazione Accettata
                </button>
            );
        }
    }

    if (amIOnWaitingList) {
        return (
            <button disabled className="w-full mt-2 py-2 px-3 bg-blue-100 text-blue-700 text-xs font-semibold rounded-md flex items-center justify-center border border-blue-200">
                Sei in Lista d'Attesa
            </button>
        );
    }

    if (!ad.isReserved) {
        return (
            <button
                onClick={handleReserveFromCard}
                disabled={actionInProgress}
                className="w-full mt-2 py-2 px-3 bg-stoop-green text-white text-xs font-semibold rounded-md hover:bg-stoop-green-dark transition-colors flex items-center justify-center shadow disabled:opacity-60"
            >
                {actionInProgress ? <LoadingSpinner size="sm" color="border-white" /> : <><HiOutlineClock className="w-4 h-4 mr-1.5" /> Prenota Oggetto</>}
            </button>
        );
    }
    
    if (ad.isReserved) {
        return (
            <button
                onClick={handleJoinWaitingListFromCard}
                disabled={actionInProgress}
                className="w-full mt-2 py-2 px-3 bg-gray-500 text-white text-xs font-semibold rounded-md hover:bg-gray-600 transition-colors flex items-center justify-center shadow disabled:opacity-60"
            >
                {actionInProgress ? <LoadingSpinner size="sm" color="border-white" /> : <><HiOutlineQueueList className="w-4 h-4 mr-1.5" /> Unisciti Lista d'Attesa</>}
            </button>
        );
    }

    return null;
  };


  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden transition-all hover:shadow-xl border border-gray-200/70 flex flex-row h-full">
      {/* --- Image Section (Left) --- */}
      <div className="relative w-32 sm:w-40 flex-shrink-0">
        <Link to={`/ad/${ad.id}`} className="block w-full h-full group">
          <img
            src={ad.images && ad.images.length > 0 ? ad.images[0] : DEFAULT_AD_IMAGE_PLACEHOLDER}
            alt={ad.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </Link>
        {ad.isStreetFind && (
          <div className="absolute top-2 left-2 bg-stoop-green-darker/80 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center shadow">
            <HiOutlineMapPin className="w-3 h-3 mr-1" />
            DA STRADA
          </div>
        )}
      </div>
      
      {/* --- Content Section (Right) --- */}
      <div className="p-3 sm:p-4 flex-1 flex flex-col">
        {/* Top Content */}
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-stoop-green-darker mb-1 truncate hover:text-stoop-green">
            <Link to={`/ad/${ad.id}`}>{ad.title}</Link>
          </h3>
          <div className="text-xs text-gray-500 mb-1 flex items-center flex-wrap">
            <span>{ad.category} &bull; {ad.locationName}</span>
            {ad.distance !== undefined && ad.distance !== Infinity && (
              <span className="ml-2 flex items-center text-stoop-green-dark">
                <HiOutlineMapPin className="w-3 h-3 mr-0.5" /> 
                {ad.distance.toFixed(1)} km
              </span>
            )}
          </div>
          <p className="text-sm text-gray-700 mt-1 hidden sm:block line-clamp-2">
            {ad.description}
          </p>
        </div>
        
        {/* Bottom Content (pushed down) */}
        <div className="mt-auto">
          
          {!isMyAd && renderActionButtons()}

          {(showEditButton || showDeleteButton) && isMyAd && (
              <div className="mt-3 flex gap-2">
                  {showEditButton && onEditAd && (
                      <button 
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEditAd(ad.id);}}
                          className="flex-1 text-xs py-1.5 px-2 border border-stoop-green text-stoop-green rounded-md hover:bg-stoop-green-light transition-colors flex items-center justify-center"
                      >
                          <HiOutlinePencilSquare className="w-3.5 h-3.5 mr-1" /> Modifica
                      </button>
                  )}
                  {showDeleteButton && onDeleteAd && (
                       <button 
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteAd(ad.id);}}
                          className="flex-1 text-xs py-1.5 px-2 border border-red-400 text-red-500 rounded-md hover:bg-red-50 transition-colors flex items-center justify-center"
                      >
                          <HiOutlineXMark className="w-3.5 h-3.5 mr-1" /> Elimina
                      </button>
                  )}
              </div>
          )}
          
          <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100 mt-2">
            <span>{postedDate}</span>
            {ad.user && (
              <Link to={`/profile/${ad.userId}`} className="hover:underline text-stoop-green font-medium">
                {getUserDisplayName(ad.user)}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdCard;
