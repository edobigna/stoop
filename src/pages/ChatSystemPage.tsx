
import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChatSession, ChatMessage, User } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { firebaseApi } from '../services/firebaseApi';
import { DEFAULT_PROFILE_PHOTO, DEFAULT_PROFILE_PHOTO_ALT } from '../constants';
import { getUserDisplayName } from '../utils/displayUtils';
import { useToast } from '../contexts/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import ChatListItem from '../components/ChatListItem';
import {
    HiOutlineArrowLeft, HiLockClosed, HiOutlineXCircle,
    HiOutlineChatBubbleOvalLeft, HiOutlineChatBubbleLeftEllipsis, HiOutlinePaperAirplane,
    HiOutlineCheckBadge // For complete exchange button
} from 'react-icons/hi2';


type UnsubscribeFn = () => void;

interface ChatViewProps {
  chatId: string;
  currentUser: User;
  onChatClosedOrCompleted: (closedChatSession: ChatSession, actionType: 'closed' | 'completed') => void;
}
const ChatView: React.FC<ChatViewProps> = ({ chatId, currentUser, onChatClosedOrCompleted }) => {
  const [sessionDetails, setSessionDetails] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoadingDetails, setIsLoadingDetails] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const messagesUnsubscribeRef = useRef<UnsubscribeFn | null>(null);

  const otherParticipant = sessionDetails?.participants.find(p => p.id !== currentUser.id);
  const otherParticipantName = getUserDisplayName(otherParticipant);

  useEffect(() => {
    setIsLoadingDetails(true);
    setError(null);
    setSessionDetails(null);
    setMessages([]);

    if (messagesUnsubscribeRef.current) {
      messagesUnsubscribeRef.current();
      messagesUnsubscribeRef.current = null;
    }

    let sessionUnsubscribe: UnsubscribeFn | null = null;

    sessionUnsubscribe = firebaseApi.getChatSessionStreamedById(chatId, currentUser.id,
      (details) => {
        if (!details) {
          setError("Chat non trovata o accesso negato.");
          setSessionDetails(null);
          setIsLoadingDetails(false);
          return;
        }
        setSessionDetails(details);

        if (!messagesUnsubscribeRef.current && details) {
            messagesUnsubscribeRef.current = firebaseApi.getChatMessagesStreamed(details.id, currentUser.id, (newMessages: ChatMessage[]) => {
              setMessages(newMessages);
            }, (msgErr) => {
                console.error("Error streaming messages:", msgErr);
                showToast("Errore nel caricamento dei messaggi.", "error");
            });
        }
        setIsLoadingDetails(false);
      },
      (err) => {
        console.error("Errore nel caricare i dettagli della sessione chat", err);
        setError("Errore nel caricamento della sessione chat.");
        showToast("Errore nel caricamento della sessione chat.", 'error');
        setIsLoadingDetails(false);
      }
    );

    return () => {
      if (sessionUnsubscribe) sessionUnsubscribe();
      if (messagesUnsubscribeRef.current) {
        messagesUnsubscribeRef.current();
        messagesUnsubscribeRef.current = null;
      }
    };
  }, [chatId, currentUser.id, showToast]);

  useEffect(() => {
    if (messages.length > 0) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !sessionDetails || sessionDetails.isClosed || isSending) return;
    setIsSending(true);
    const tempText = newMessage.trim();
    setNewMessage('');

    try {
      await firebaseApi.sendChatMessage(sessionDetails.id, currentUser.id, tempText);
    } catch (err: any) {
      console.error("Invio messaggio fallito", err);
      setNewMessage(tempText);
      showToast(`Impossibile inviare il messaggio: ${err.message || 'Errore sconosciuto'}`, 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleCompleteExchange = async () => {
    if (!sessionDetails || sessionDetails.isClosed || !currentUser || isProcessingAction) return;
    if (window.confirm("Sei sicuro di voler segnare questo scambio come completato? La chat verrà chiusa.")) {
        setIsProcessingAction(true);
        try {
            await firebaseApi.completeExchangeAndCloseChat(sessionDetails.id, currentUser.id);
            showToast("Scambio completato e chat chiusa.", 'success');
            onChatClosedOrCompleted(sessionDetails, 'completed');
            // The sessionDetails state will update via the listener, causing a re-render.
        } catch (err: any) {
            console.error("Errore nel completare lo scambio:", err);
            showToast(`Impossibile completare lo scambio: ${err.message || 'Errore sconosciuto'}`, 'error');
        } finally {
            setIsProcessingAction(false);
        }
    }
  };

  const handleCloseChat = async () => {
    if (!sessionDetails || sessionDetails.isClosed || !currentUser || isProcessingAction) return;
    if (window.confirm("Sei sicuro di voler chiudere questa chat? Nessuno potrà più inviare messaggi. Per segnare lo scambio come avvenuto, usa 'Completa Scambio'.")) {
        setIsProcessingAction(true);
        try {
            await firebaseApi.closeChatSession(sessionDetails.id, currentUser.id);
            showToast("Chat chiusa.", 'info');
            onChatClosedOrCompleted(sessionDetails, 'closed');
        } catch (err: any) {
            console.error("Chiusura chat fallita:", err);
            showToast(`Impossibile chiudere la chat: ${err.message || 'Errore sconosciuto'}`, 'error');
        } finally {
            setIsProcessingAction(false);
        }
    }
  };


  if (isLoadingDetails && !sessionDetails) {
    return <div className="flex-1 flex items-center justify-center p-4 bg-white"><LoadingSpinner text="Caricamento chat..." /></div>;
  }
  if (error && !sessionDetails) {
    return <div className="flex-1 flex flex-col items-center justify-center p-4 bg-white text-red-600" role="alert">
        <HiOutlineXCircle className="w-12 h-12 text-red-400 mb-3" />
        <p className="font-semibold">Errore caricamento chat</p>
        <p className="text-sm">{error}</p>
    </div>;
  }
  if (!sessionDetails && !isLoadingDetails) {
    return <div className="flex-1 flex items-center justify-center p-4 bg-white"><p className="text-gray-500">Chat non trovata o accesso negato.</p></div>;
  }

  if (!sessionDetails) return null;

  return (
    <div className="flex-1 flex flex-col bg-white h-full overflow-hidden">
      <header className="p-3.5 border-b border-gray-200 bg-gray-50/90 backdrop-blur-sm flex items-center space-x-3 z-10 flex-shrink-0">
        <button onClick={() => navigate('/chat')} className="md:hidden p-1.5 text-gray-600 hover:text-stoop-green-dark rounded-full hover:bg-gray-200/70 transition-colors" aria-label="Torna alla lista chat">
          <HiOutlineArrowLeft className="w-5 h-5" />
        </button>
        <img src={otherParticipant?.profilePhotoUrl || DEFAULT_PROFILE_PHOTO} alt={otherParticipantName || DEFAULT_PROFILE_PHOTO_ALT} className="w-10 h-10 rounded-full object-cover border border-gray-200" />
        <div className="flex-1 overflow-hidden">
          <h2 className="font-semibold text-base text-gray-800">{otherParticipantName || 'Chat'}</h2>
          <Link to={`/ad/${sessionDetails.adId}`} className="text-xs text-gray-500 hover:text-stoop-green hover:underline truncate block max-w-[150px] sm:max-w-xs">
            Oggetto: "{sessionDetails.adTitle}"
          </Link>
        </div>
        {!sessionDetails.isClosed && sessionDetails.reservationWasAccepted && (
          <button
              onClick={handleCompleteExchange}
              disabled={isProcessingAction}
              className="text-xs text-stoop-green-darker hover:text-white font-medium py-1.5 px-3 rounded-md border border-stoop-green hover:bg-stoop-green transition-colors flex items-center"
              title="Segna scambio come completato e chiudi chat"
          >
            {isProcessingAction ? <LoadingSpinner size="sm"/> : <HiOutlineCheckBadge className="w-4 h-4 mr-1"/>} Completa
          </button>
        )}
        {!sessionDetails.isClosed && (
            <button
                onClick={handleCloseChat}
                disabled={isProcessingAction}
                className="text-xs text-red-600 hover:text-red-800 font-medium py-1.5 px-2.5 rounded-md border border-red-300 hover:bg-red-50 transition-colors ml-2"
                title="Chiudi la chat permanentemente"
            >
                 {isProcessingAction ? <LoadingSpinner size="sm"/> : 'Chiudi'}
            </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-gradient-to-br from-stoop-green-light/10 via-stoop-light to-white">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${
              msg.isSystemMessage ? 'justify-center' : (msg.senderId === currentUser.id ? 'justify-end' : 'justify-start')
            }`}>
            <div className={`max-w-[80%] sm:max-w-[70%] lg:max-w-[60%] px-3.5 py-2 rounded-2xl shadow-sm ${
                msg.isSystemMessage
                ? 'bg-gray-200 text-gray-600 text-xs italic text-center'
                : msg.senderId === currentUser.id
                    ? 'bg-stoop-green text-white rounded-br-lg'
                    : 'bg-gray-100 text-gray-800 rounded-bl-lg border border-gray-200/70'
            }`}>
              <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
              {!msg.isSystemMessage && (
                <p className={`text-xs mt-1 ${msg.senderId === currentUser.id ? 'text-stoop-green-light opacity-90 text-right' : 'text-gray-500 text-left'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
         {sessionDetails.isClosed && (
            <div className="text-center py-4">
                <p className="text-sm text-gray-500 bg-gray-100 p-2 rounded-md inline-block">
                    <HiLockClosed className="w-4 h-4 inline-block mr-1.5 align-text-bottom" />
                    {sessionDetails.lastMessageText || "Questa chat è stata chiusa."}
                </p>
            </div>
        )}
      </div>

      {!sessionDetails.isClosed && (
        <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-200 bg-gray-50/90 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Scrivi un messaggio..."
              className="flex-1 p-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-stoop-green focus:border-transparent outline-none text-sm shadow-sm"
              disabled={isSending || sessionDetails.isClosed}
              aria-label="Testo del messaggio"
            />
            <button
              type="submit"
              disabled={isSending || !newMessage.trim() || sessionDetails.isClosed}
              className="p-3 bg-stoop-green text-white rounded-full hover:bg-stoop-green-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-stoop-green-dark shadow-md"
              aria-label="Invia messaggio"
            >
              {isSending ? <LoadingSpinner size="sm" color="border-white" /> : <HiOutlinePaperAirplane className="w-5 h-5" />}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};


const ChatSystemPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { chatId } = useParams<{ chatId?: string }>();
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [errorList, setErrorList] = useState<string|null>(null);
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) return;
    setIsLoadingList(true);
    setErrorList(null);

    const unsubscribe: UnsubscribeFn = firebaseApi.getChatSessionsStreamed(currentUser.id,
      (sessions) => {
        setChatSessions(sessions);
        setIsLoadingList(false);
      },
      (error) => {
        console.error("Errore nel caricamento delle sessioni chat:", error);
        const message = "Errore nel caricamento delle sessioni chat.";
        setErrorList(message);
        showToast(message, 'error');
        setIsLoadingList(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser, showToast]);

  const handleChatClosedOrCompleted = (closedSession: ChatSession, actionType: 'closed' | 'completed') => {
    if (actionType === 'completed') {
        showToast(`Scambio per "${closedSession.adTitle}" completato e chat chiusa.`, 'success');
    } else {
        showToast(`Chat per "${closedSession.adTitle}" chiusa.`, 'info');
    }
    // The session list will update via listener.
    // If the currently viewed chat is the one that got closed/completed,
    // you might want to navigate away or clear the detailed view.
    if (chatId === closedSession.id) {
        // navigate('/chat'); // Example: navigate back to the chat list
    }
  };


  if (!currentUser) return <p className="p-4 text-center text-gray-600">Effettua il login per visualizzare le chat.</p>;

  const showChatList = !chatId || window.innerWidth < 768;
  const mainContentHeight = "h-[calc(100vh-4rem-4rem)]"; // TopNavbar (4rem) + BottomNavbar (4rem)

  return (
    <div className={`flex ${mainContentHeight}`}>
      {(showChatList || window.innerWidth >= 768) && (
        <aside className={`bg-gray-50 border-r border-gray-200/80 flex flex-col
                         ${chatId && window.innerWidth < 768 ? 'hidden' : 'w-full md:w-[320px] lg:w-[360px]'}
                         transition-all duration-300 ease-in-out overflow-y-auto`}
                         aria-label="Lista chat"
        >
          <header className="p-4 border-b border-gray-200/80 sticky top-0 bg-gray-50/90 backdrop-blur-sm z-10">
            <h2 className="text-xl font-semibold text-stoop-green-darker tracking-tight">Conversazioni</h2>
          </header>
          {isLoadingList ? (
            <div className="p-6 text-center text-gray-500"><LoadingSpinner text="Caricamento chat..." /></div>
          ) : errorList && chatSessions.length === 0 ? (
             <div className="p-6 text-center text-red-500" role="alert">
                <HiOutlineXCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                <p className="font-medium">Errore Caricamento</p>
                {errorList}
             </div>
          ) : chatSessions.length === 0 ? (
            <div className="p-6 text-center text-gray-500 flex flex-col items-center justify-center h-full">
              <HiOutlineChatBubbleLeftEllipsis className="mx-auto text-gray-300 w-20 h-20 mb-4" />
              <p className="font-medium text-lg">Nessuna chat attiva.</p>
              <p className="text-sm mt-1">Le chat appaiono qui quando una prenotazione viene accettata.</p>
              <button
                  onClick={() => navigate('/')}
                  className="mt-4 px-4 py-2 bg-stoop-green text-white text-sm rounded-lg hover:bg-stoop-green-dark transition-colors"
              >
                  Esplora oggetti
              </button>
            </div>
          ) : (
            <nav className="flex-1">
              {chatSessions.map(session => (
                <ChatListItem
                  key={session.id}
                  chatSession={session}
                  currentUserId={currentUser.id}
                  isSelected={session.id === chatId}
                />
              ))}
            </nav>
          )}
        </aside>
      )}

      <section className={`flex-1 ${!chatId && window.innerWidth < 768 ? 'hidden' : 'flex' }`} aria-live="polite">
        {chatId && currentUser ? (
          <ChatView
            chatId={chatId}
            currentUser={currentUser}
            onChatClosedOrCompleted={handleChatClosedOrCompleted}
          />
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center bg-white">
            <div className="text-center">
              <HiOutlineChatBubbleOvalLeft className="w-24 h-24 text-gray-300 mb-4" />
              <p className="text-xl text-gray-500">Seleziona una chat per iniziare a messaggiare</p>
              <p className="text-sm text-gray-400 mt-1">Oppure iniziane una nuova da una prenotazione accettata.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default ChatSystemPage;
