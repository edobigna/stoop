import React, { useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { Ad, ReservationStatus, AdCardProps } from '../types'; 
import { DEFAULT_AD_IMAGE_PLACEHOLDER } from '../constants';
import { getUserDisplayName } from '../utils/displayUtils';
import { firebaseApi } from '../services/firebaseApi';
import { useToast } from '../contexts/ToastContext';
import { getDistanceFromLatLonInKm } from '../utils/geoUtils';
import LoadingSpinner from './LoadingSpinner';
import ReportModal from './ReportModal'; // Import ReportModal
import { 
    HiOutlinePencilSquare, HiOutlineXMark, HiOutlineMapPin, HiOutlineTag, 
    HiHandThumbUp, HiOutlineClock, HiOutlineFlag, HiOutlineBuildingOffice,
    HiOutlineQueueList
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
  const navigate = ReactRouterDOM.useNavigate();

  const [actionInProgress, setActionInProgress] = useState(false);
  const [isCheckingDistance, setIsCheckingDistance] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

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
      const updatedAdFromApi: Ad | null = await firebaseApi.createReservation(ad.id, currentUser.id);
      if (updatedAdFromApi) { 
        showToast(`Richiesta per "${updatedAdFromApi.title}" inviata!`, 'success'); 
        if (onAdUpdated) {
            onAdUpdated(updatedAdFromApi);
        }
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
      if (updatedAdDetails) {
        showToast(`Ti sei unito alla lista d'attesa per "${updatedAdDetails.title}"!`, 'success');
        if (onAdUpdated) {
            onAdUpdated(updatedAdDetails);
        }
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
        if (updatedAdDetails) {
          showToast(`Hai segnato "${updatedAdDetails.title}" come ritirato!`, 'success');
          if (onAdUpdated) {
              onAdUpdated(updatedAdDetails); // This might trigger removal from list if it's completed
          }
        }
      } else {
        showToast("Sei troppo distante (oltre 150m) per ritirare questo oggetto.", "warning");
        setIsCheckingDistance(false); // Ensure this is reset
      }
    } catch (err: any) { // Added err parameter here
        showToast(err.message || "Errore nel ritirare l'oggetto.", 'error');
    } finally {
        setIsCheckingDistance(false);
        setActionInProgress(false);
    }
  };

  const handleReportAd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUser) {
      showToast("Devi effettuare il login per segnalare un annuncio.", "info");
      navigate('/auth', { state: { from: `/ad/${ad.id}` } });
      return;
    }
    setIsReportModalOpen(true);
  };
  
  const renderUserActionArea = () => {
    if (!currentUser || isMyAd) return null;

    if (ad.isStreetFind) {
        if(ad.reservationStatus === ReservationStatus.COMPLETED) return null;
        return (
            <button
                onClick={handleClaimStreetFindFromCard}
                disabled={actionInProgress || isCheckingDistance}
                className="w-full mt-2 py-2 px-3 bg-stoop-green text-white text-xs font-semibold rounded-md hover:bg-stoop-green-dark transition-colors flex items-center justify-center shadow disabled:opacity-60"
                aria-label="Segna come ritirato"
            >
                {actionInProgress || isCheckingDistance ? <LoadingSpinner size="sm" color="border-white" /> : <><HiHandThumbUp className="w-4 h-4 mr-1.5" /> Oggetto Ritirato</>}
            </button>
        );
    }

    if (!ad.isReserved) { 
        return (
            <button
                onClick={handleReserveFromCard}
                disabled={actionInProgress}
                className="w-full mt-2 py-2 px-3 bg-stoop-green text-white text-xs font-semibold rounded-md hover:bg-stoop-green-dark transition-colors flex items-center justify-center shadow disabled:opacity-60"
                aria-label="Prenota oggetto"
            >
                {actionInProgress ? <LoadingSpinner size="sm" color="border-white" /> : <><HiOutlineClock className="w-4 h-4 mr-1.5" /> Prenota Oggetto</>}
            </button>
        );
    }
    
    // Ad is reserved, show status for current user if they are involved
    if (amITheCurrentReserver) {
        if (ad.reservationStatus === ReservationStatus.PENDING) {
            return <p className="mt-2 text-xs text-center text-yellow-700 bg-yellow-100 p-1.5 rounded-md border border-yellow-200">Richiesta inviata</p>;
        }
        if (ad.reservationStatus === ReservationStatus.ACCEPTED) {
            return <p className="mt-2 text-xs text-center text-stoop-green-darker bg-stoop-light p-1.5 rounded-md border border-stoop-green-light">Prenotazione accettata!</p>;
        }
    } else if (amIOnWaitingList) {
        return <p className="mt-2 text-xs text-center text-blue-700 bg-blue-100 p-1.5 rounded-md border border-blue-200">Sei in lista d'attesa</p>;
    } 
    // removed join waiting list button here
    
    return null;
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-lg overflow-hidden transition-all hover:shadow-xl border border-gray-200/70 flex flex-col">
        <ReactRouterDOM.Link to={`/ad/${ad.id}`} className="block relative group">
          <div className="w-full aspect-[4/3] sm:aspect-[16/10] md:aspect-[4/3] bg-gray-100 overflow-hidden">
            <img
              src={ad.images && ad.images.length > 0 ? ad.images[0] : DEFAULT_AD_IMAGE_PLACEHOLDER}
              alt={ad.title}
              className="w-full h-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
            />
          </div>
          {ad.isStreetFind && (
            <div className="absolute top-2 left-2 bg-blue-500 text-white text-[10px] px-2.5 py-1 rounded-full flex items-center shadow-md animate-pulse-slow" title="Oggetto trovato in strada">
              <HiOutlineBuildingOffice className="w-3.5 h-3.5 mr-1" />
              DA STRADA
            </div>
          )}
        </ReactRouterDOM.Link>
        <div className="p-4 flex-grow flex flex-col">
          <div className="flex justify-between items-start mb-1">
            <h3 className="text-lg font-semibold text-stoop-green-darker truncate hover:text-stoop-green flex-grow">
              <ReactRouterDOM.Link to={`/ad/${ad.id}`}>{ad.title}</ReactRouterDOM.Link>
            </h3>
            {currentUser && !isMyAd && (
              <button 
                onClick={handleReportAd} 
                className="ml-2 p-1 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                aria-label="Segnala annuncio"
                title="Segnala annuncio"
              >
                <HiOutlineFlag className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="text-xs text-gray-500 mb-1 flex items-center flex-wrap">
            <span>{ad.category} &bull; {ad.locationName}</span>
            {ad.distance !== undefined && ad.distance !== Infinity && (
              <span className="ml-2 flex items-center text-stoop-green-dark">
                <HiOutlineMapPin className="w-3 h-3 mr-0.5" /> 
                {ad.distance.toFixed(1)} km
              </span>
            )}
          </div>
          
          <p className="text-sm text-gray-700 mb-2 line-clamp-2">
            {ad.description}
          </p>
          
          <div className="flex items-center justify-between text-xs text-gray-500 mt-auto pt-2 border-t border-gray-100">
            <span>Pubblicato il: {postedDate}</span>
            {ad.user && (
              <ReactRouterDOM.Link to={`/profile/${ad.userId}`} className="hover:underline text-stoop-green-darker font-medium">
                {getUserDisplayName(ad.user)}
              </ReactRouterDOM.Link>
            )}
          </div>

          {ad.isReserved && !amITheCurrentReserver && !amIOnWaitingList && (
            <div className={`mt-2 text-center text-sm font-medium p-1.5 rounded-md border
              ${ad.reservationStatus === ReservationStatus.COMPLETED ? 'bg-gray-100 text-gray-600 border-gray-200/80'
               : ad.reservationStatus === ReservationStatus.PENDING ? 'bg-yellow-100 text-yellow-700 border-yellow-200/80' 
               : 'bg-stoop-light text-stoop-green-darker border-stoop-green-light/80'}`}>
              {ad.reservationStatus === ReservationStatus.PENDING ? "Richiesta in attesa" 
               : ad.reservationStatus === ReservationStatus.COMPLETED ? "Oggetto Ritirato" 
               : "Oggetto prenotato"}
            </div>
          )}

          {renderUserActionArea()}

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
        </div>
      </div>
      {isReportModalOpen && currentUser && ad && (
        <ReportModal
          adId={ad.id}
          adTitle={ad.title}
          adOwnerId={ad.userId} 
          reporterId={currentUser.id}
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
        />
      )}
      <style>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.03); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 2.5s infinite ease-in-out;
        }
        .line-clamp-2 {
            overflow: hidden;
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
        }
      `}</style>
    </>
  );
};

export default AdCard;
