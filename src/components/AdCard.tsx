
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ReservationStatus, AdCardProps } from '../types';
import { DEFAULT_AD_IMAGE_PLACEHOLDER } from '../constants';
import { getUserDisplayName } from '../utils/displayUtils';
import { firebaseApi } from '../services/firebaseApi';
import { useToast } from '../contexts/ToastContext';
import LoadingSpinner from './LoadingSpinner';
import { 
    HiOutlinePencilSquare, HiOutlineXMark, HiOutlineMapPin,
    HiOutlineClock
} from 'react-icons/hi2';

const AdCard: React.FC<AdCardProps> = ({ 
    ad, 
    currentUser, 
    showEditButton = false,
    showDeleteButton = false,
    onDeleteAd,
    onEditAd
}) => {
  const postedDate = new Date(ad.postedAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  const isMyAd = currentUser?.id === ad.userId;
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [actionInProgress, setActionInProgress] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

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
      await firebaseApi.createReservation(ad.id, currentUser.id);
      showToast(`Richiesta per "${ad.title}" inviata!`, 'success');
      setRequestSent(true);
    } catch (err: any) {
      showToast(err.message || 'Errore prenotazione.', 'error');
    } finally {
      setActionInProgress(false);
    }
  };

  const renderActionButtons = () => {
    if (!currentUser || isMyAd || ad.reservationStatus === ReservationStatus.COMPLETED) return null;

    if (ad.isStreetFind) return null; // Street find actions are on detail page

    if (ad.isReserved) {
      return (
        <div className="mt-2 text-center text-sm font-medium p-1.5 rounded-md border bg-green-100 text-green-700 border-green-200/80">
          Oggetto prenotato
        </div>
      );
    } else {
       if (requestSent) {
        return (
            <button disabled className="w-full mt-2 py-2 px-3 bg-orange-100 text-orange-700 text-xs font-semibold rounded-md border border-orange-200/80 flex items-center justify-center shadow">
                Richiesta inviata
            </button>
        );
       }
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
         {ad.isReserved && !ad.isStreetFind && (
            <div className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 text-[10px] px-2 py-0.5 rounded-full flex items-center shadow font-semibold">
               PRENOTATO
            </div>
        )}
      </div>
      
      {/* --- Content Section (Right) --- */}
      <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between">
        {/* Top Content */}
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-stoop-green-darker mb-1 truncate hover:text-stoop-green">
            <Link to={`/ad/${ad.id}`}>{ad.title}</Link>
          </h3>
          <div className="text-xs text-gray-500 mb-1 flex items-center flex-wrap">
            <span>{ad.category} &bull; {ad.locationName}</span>
          </div>
          <p className="text-sm text-gray-700 mt-1 hidden sm:block line-clamp-2">
            {ad.description}
          </p>
        </div>
        
        {/* Bottom Content */}
        <div className="mt-2">
          {!isMyAd && renderActionButtons()}

          {(showEditButton || showDeleteButton) && isMyAd && (
              <div className="mt-2 flex gap-2">
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
              <Link to={`/profile/${ad.userId}`} className="hover:underline text-stoop-green font-medium truncate">
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
