import React from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { ChatSession } from '../types';
import { DEFAULT_PROFILE_PHOTO, DEFAULT_PROFILE_PHOTO_ALT } from '../constants';
import { getUserDisplayName } from '../utils/displayUtils';
import { HiLockClosed } from 'react-icons/hi2';

interface ChatListItemProps {
  chatSession: ChatSession;
  currentUserId: string;
  isSelected: boolean;
}

const ChatListItem: React.FC<ChatListItemProps> = ({ chatSession, currentUserId, isSelected }) => {
  const otherParticipant = chatSession.participants.find(p => p.id !== currentUserId);
  const lastMessageDate = chatSession.lastMessageTimestamp ? new Date(chatSession.lastMessageTimestamp) : new Date(chatSession.createdAt);
  const otherParticipantName = getUserDisplayName(otherParticipant);

  let displayLastMessage = chatSession.lastMessageText;
  if (chatSession.isClosed) {
    displayLastMessage = "Chat chiusa.";
  } else if (!displayLastMessage) {
    displayLastMessage = `Chat per: "${chatSession.adTitle}"`;
  }

  return (
    <ReactRouterDOM.Link
      to={`/chat/${chatSession.id}`}
      className={`flex items-center p-3.5 hover:bg-stoop-green-light/70 transition-colors duration-150 ease-in-out
                  ${isSelected ? 'bg-stoop-green-light border-r-4 border-stoop-green' : 'border-b border-gray-200/80'}
                  ${chatSession.isClosed ? 'opacity-70' : ''}`}
      aria-current={isSelected ? "page" : undefined}
    >
      <img
        src={otherParticipant?.profilePhotoUrl || DEFAULT_PROFILE_PHOTO}
        alt={otherParticipantName || DEFAULT_PROFILE_PHOTO_ALT}
        className="w-11 h-11 rounded-full object-cover mr-3 border border-gray-200"
      />
      <div className="flex-1 overflow-hidden">
        <div className="flex justify-between items-center">
          <h3 className={`font-semibold truncate ${isSelected ? 'text-stoop-green-darker' : 'text-gray-800'}`}>
            {otherParticipantName || 'Utente Sconosciuto'}
            {chatSession.isClosed && <HiLockClosed className="w-3 h-3 ml-1.5 inline-block text-gray-500" />}
          </h3>
          <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
            {lastMessageDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <p className={`text-sm truncate ${isSelected ? 'text-gray-700' : 'text-gray-600'}`}>
          {displayLastMessage}
        </p>
      </div>
    </ReactRouterDOM.Link>
  );
};

export default ChatListItem;
