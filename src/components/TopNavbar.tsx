import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { firebaseApi } from '../services/firebaseApi';
import { DEFAULT_PROFILE_PHOTO } from '../constants';
import { 
    HiOutlineChatBubbleLeftEllipsis, HiOutlineBell, 
    HiOutlineUserCircle, HiUserCircle 
} from 'react-icons/hi2';

const TopNavbar: React.FC = () => {
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    if (currentUser) {
      unsubscribe = firebaseApi.getUnreadNotificationsCountStreamed(
        currentUser.id,
        (count) => {
          setUnreadNotificationsCount(count);
        },
        (error) => {
          console.error("Error fetching unread notifications count for TopNavbar:", error);
          setUnreadNotificationsCount(0);
        }
      );
    } else {
      setUnreadNotificationsCount(0);
    }
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentUser]);

  const iconButtonClasses = (path?: string) => {
    let baseClasses = "p-2 rounded-full transition-colors duration-150 ease-in-out ";
    if (path && location.pathname === path) {
      baseClasses += "bg-stoop-green text-white"; // Active state for current page
    } else {
      baseClasses += "text-white hover:bg-stoop-green"; // Default/hover state
    }
    return baseClasses;
  };
  
  const handleProfileClick = () => {
    if (currentUser) {
        navigate('/profile');
    } else {
        navigate('/auth');
    }
  };

  return (
    <header className="bg-stoop-green-darker shadow-md sticky top-0 z-50 h-16 flex items-center">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex items-center justify-between h-full">
          {/* Logo/App Name */}
          <Link to="/" className="flex-shrink-0 text-3xl font-bold text-white tracking-tight" aria-label="Homepage">
            stoop
          </Link>

          {/* Right Aligned Icons & Profile */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {currentUser && (
              <>
                <Link to="/chat" className={iconButtonClasses('/chat')} aria-label="Chat">
                  <HiOutlineChatBubbleLeftEllipsis className="w-6 h-6" />
                </Link>
                <Link to="/notifications" className={`${iconButtonClasses('/notifications')} relative`} aria-label="Notifiche">
                  <HiOutlineBell className="w-6 h-6" />
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 ring-1 ring-stoop-green-darker justify-center items-center text-white text-[8px] font-bold">
                           {/* Display content for badge can be added here if needed, e.g., count up to '9+' */}
                        </span>
                    </span>
                  )}
                </Link>
              </>
            )}
            {/* Profile Icon/Link */}
            <button 
                onClick={handleProfileClick} 
                className={`${iconButtonClasses(currentUser ? (location.pathname.startsWith('/profile') ? '/profile' : undefined ): '/auth')} ml-1`} 
                aria-label={currentUser ? "Profilo utente" : "Login o Registrazione"}
            >
              {currentUser ? (
                <img
                  src={currentUser.profilePhotoUrl || DEFAULT_PROFILE_PHOTO}
                  alt="User profile"
                  className="h-9 w-9 rounded-full object-cover border-2 border-stoop-green-light group-hover:border-white transition-colors"
                />
              ) : (
                 location.pathname === '/auth' ? <HiUserCircle className="w-7 h-7" /> : <HiOutlineUserCircle className="w-7 h-7" />
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopNavbar;
