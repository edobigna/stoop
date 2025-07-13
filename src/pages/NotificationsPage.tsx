import React, { useEffect, useState } from 'react';
import { AppNotification, ReservationStatus } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { firebaseApi } from '../services/firebaseApi';
import LoadingSpinner from '../components/LoadingSpinner';
import * as ReactRouterDOM from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import {
    HiOutlineListBullet, HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineNoSymbol,
    HiOutlineChatBubbleLeftEllipsis, HiOutlineInformationCircle,
    HiOutlineBellAlert, HiOutlineBellSlash, HiOutlineCheck, HiOutlineXMark, HiHandThumbUp,
    HiOutlineCheckBadge, HiOutlineFlag
} from 'react-icons/hi2';


const NotificationsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = ReactRouterDOM.useNavigate();
  const { showToast } = useToast();
  const [actionLoading, setActionLoading] = useState<{[key: string]: boolean}>({});

  useEffect(() => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubscribe = firebaseApi.getNotificationsStreamed(
      currentUser.id,
      (fetchedNotifications) => {
        setNotifications(fetchedNotifications);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Error fetching notifications:", err);
        setError("Impossibile caricare le notifiche.");
        showToast("Impossibile caricare le notifiche.", "error");
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser, showToast]);

  const handleNotificationClick = async (notification: AppNotification) => {
    if (currentUser && !notification.isRead) {
      try {
        await firebaseApi.markNotificationAsRead(notification.id, currentUser.id);
        // No need to manually update state, listener will refresh
      } catch (err) {
        console.error("Error marking notification as read:", err);
      }
    }

    if (notification.relatedItemId) {
      switch (notification.type) {
        case 'RESERVATION_REQUEST':
        case 'RESERVATION_DECLINED':
        case 'RESERVATION_CANCELLED':
          if (notification.reservationDetails?.adId) {
            navigate(`/ad/${notification.reservationDetails.adId}`);
          } else if (notification.type === 'RESERVATION_REQUEST' && notification.relatedItemId && notification.reservationDetails?.adId === undefined) {
             console.warn(`Navigating for ${notification.type}. AdId missing in reservationDetails. relatedItemId (reservationId): ${notification.relatedItemId}`);
          }
          else {
             console.warn("Reservation details or adId missing for navigation", notification);
          }
          break;
        case 'RESERVATION_ACCEPTED':
             navigate(`/chat/${notification.relatedItemId}`); // relatedItemId is chatId
          break;
        case 'NEW_MESSAGE':
          navigate(`/chat/${notification.relatedItemId}`);
          break;
        case 'STREET_FIND_PICKED_UP':
        case 'EXCHANGE_COMPLETED':
        case 'AD_REPORTED_CONFIRMATION':
        case 'OWNER_AD_REPORTED': // For owner, might go to ad or admin panel in future
             navigate(`/ad/${notification.relatedItemId}`);
             break;
        default:
          console.log("No specific navigation for notification type:", notification.type);
      }
    }
  };

  const handleAcceptReservation = async (notification: AppNotification, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser || !notification.reservationDetails?.reservationId) return;
    setActionLoading(prev => ({ ...prev, [notification.id]: true }));
    try {
      await firebaseApi.updateReservationStatus(
        notification.reservationDetails.reservationId,
        ReservationStatus.ACCEPTED,
        currentUser.id,
        notification.id
      );
      showToast('Prenotazione accettata con successo!', 'success');
    } catch (err: any) {
      showToast(`Errore nell'accettare la prenotazione: ${err.message || 'Errore Sconosciuto'}`, 'error');
    } finally {
      setActionLoading(prev => ({ ...prev, [notification.id]: false }));
    }
  };

  const handleDeclineReservation = async (notification: AppNotification, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser || !notification.reservationDetails?.reservationId) return;
    setActionLoading(prev => ({ ...prev, [notification.id]: true }));
    try {
      await firebaseApi.updateReservationStatus(
        notification.reservationDetails.reservationId,
        ReservationStatus.DECLINED,
        currentUser.id,
        notification.id
      );
      showToast('Prenotazione rifiutata.', 'info');
    } catch (err: any) {
      showToast(`Errore nel rifiutare la prenotazione: ${err.message || 'Errore Sconosciuto'}`, 'error');
    } finally {
      setActionLoading(prev => ({ ...prev, [notification.id]: false }));
    }
  };

  const getIconForNotification = (type: AppNotification['type']): React.ReactNode => {
    const iconBaseClass = "w-6 h-6";
    switch (type) {
      case 'RESERVATION_REQUEST': return <HiOutlineListBullet className={`${iconBaseClass} text-blue-500`} />;
      case 'RESERVATION_ACCEPTED': return <HiOutlineCheckCircle className={`${iconBaseClass} text-stoop-green`} />;
      case 'RESERVATION_DECLINED': return <HiOutlineXCircle className={`${iconBaseClass} text-red-500`} />;
      case 'RESERVATION_CANCELLED': return <HiOutlineNoSymbol className={`${iconBaseClass} text-yellow-500`} />;
      case 'NEW_MESSAGE': return <HiOutlineChatBubbleLeftEllipsis className={`${iconBaseClass} text-purple-500`} />;
      case 'STREET_FIND_PICKED_UP': return <HiHandThumbUp className={`${iconBaseClass} text-stoop-green`} />;
      case 'EXCHANGE_COMPLETED': return <HiOutlineCheckBadge className={`${iconBaseClass} text-stoop-green-darker`} />;
      case 'AD_REPORTED_CONFIRMATION': return <HiOutlineFlag className={`${iconBaseClass} text-orange-500`} />;
      case 'OWNER_AD_REPORTED': return <HiOutlineFlag className={`${iconBaseClass} text-red-600`} />;
      case 'GENERAL_INFO': return <HiOutlineInformationCircle className={`${iconBaseClass} text-gray-500`} />;
      default: return <HiOutlineBellAlert className={`${iconBaseClass} text-gray-400`} />;
    }
  };


  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-10rem)]">
        <LoadingSpinner size="lg" text="Caricamento notifiche..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 text-red-600 bg-red-50 rounded-lg shadow-md m-4" role="alert">
        <HiOutlineXCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold mb-2">Errore Notifiche</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-2 sm:px-4 py-6">
      <h1 className="text-4xl sm:text-5xl font-extrabold text-stoop-green-darker tracking-tight mb-8 text-center">
        Le Tue Notifiche
      </h1>
      {notifications.length === 0 ? (
        <div className="bg-white p-8 rounded-xl shadow-lg min-h-[300px] flex flex-col items-center justify-center text-center border border-gray-200/70">
          <HiOutlineBellSlash className="w-24 h-24 text-gray-300 mb-4" />
          <p className="text-xl text-gray-700 font-semibold">Nessuna Nuova Notifica</p>
          <p className="text-gray-500 mt-2">Le tue notifiche appariranno qui quando ci sono aggiornamenti.</p>
           <ReactRouterDOM.Link
            to="/" 
            className="mt-6 px-5 py-2.5 bg-stoop-green text-white font-semibold rounded-lg hover:bg-stoop-green-dark transition-colors text-sm shadow-md flex items-center"
          >
            Torna alla Home
          </ReactRouterDOM.Link>
        </div>
      ) : (
        <div className="bg-white shadow-xl rounded-xl border border-gray-200/70 overflow-hidden">
          <ul role="list" className="divide-y divide-gray-200">
            {notifications.map((notification) => (
              <li
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`p-4 hover:bg-stoop-green-light/30 transition-colors duration-150 ease-in-out cursor-pointer flex items-start space-x-4 ${
                  notification.isRead ? 'bg-gray-50/50 opacity-75' : 'bg-white'
                }`}
                aria-live="polite"
                aria-atomic="true"
              >
                <div className="flex-shrink-0 pt-1">
                    {getIconForNotification(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <p className={`text-sm font-semibold truncate ${notification.isRead ? 'text-gray-600' : 'text-stoop-green-darker'}`}>
                      {notification.title}
                    </p>
                    {!notification.isRead && (
                      <span className="ml-2 inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full bg-stoop-green" aria-label="Non letta"></span>
                    )}
                  </div>
                  <p className={`text-sm mt-0.5 ${notification.isRead ? 'text-gray-500' : 'text-gray-700'}`}>
                    {notification.message}
                  </p>
                  <p className="text-xs text-gray-400 mt-1.5">
                    {new Date(notification.createdAt).toLocaleString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {notification.type === 'RESERVATION_REQUEST' && !notification.isRead && currentUser?.id && notification.reservationDetails && (
                    <div className="mt-2.5 flex space-x-2">
                      <button
                        onClick={(e) => handleAcceptReservation(notification, e)}
                        disabled={actionLoading[notification.id]}
                        className="px-3 py-1.5 text-xs font-medium rounded-md text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 flex items-center shadow-sm transition-colors"
                        aria-label="Accetta prenotazione"
                      >
                        {actionLoading[notification.id] ? <LoadingSpinner size="sm" color="border-white"/> : <HiOutlineCheck className="w-4 h-4 mr-1" />} Accetta
                      </button>
                      <button
                        onClick={(e) => handleDeclineReservation(notification, e)}
                        disabled={actionLoading[notification.id]}
                        className="px-3 py-1.5 text-xs font-medium rounded-md text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 flex items-center shadow-sm transition-colors"
                        aria-label="Rifiuta prenotazione"
                      >
                        {actionLoading[notification.id] ? <LoadingSpinner size="sm" color="border-white"/> : <HiOutlineXMark className="w-4 h-4 mr-1" />} Rifiuta
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
