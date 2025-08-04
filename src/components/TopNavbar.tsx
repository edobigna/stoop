import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { firebaseApi } from '../services/firebaseApi';
import { DEFAULT_PROFILE_PHOTO } from '../constants';
import { 
    HiOutlineChatBubbleLeftEllipsis, HiOutlineBell, 
    HiOutlineUserCircle, HiUserCircle 
} from 'react-icons/hi2';

const Navbar: React.FC = () => {
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
          console.error("Error fetching unread notifications count:", error);
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

  const getPathOrAuth = (path: string) => {
    if (!currentUser) return '/auth';
    return path;
  };
  
  const handleProfileClick = () => {
    navigate(getPathOrAuth('/profile'));
  };

  return (
    <header className="bg-stoop-green-darker shadow-md sticky top-0 z-50 h-16 flex items-center">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex items-center justify-between h-full">
          {/* Logo */}
          <Link to="/" className="flex-shrink-0 text-3xl font-bold text-white tracking-tight" aria-label="Homepage">
            stoop
          </Link>

          {/* Icons */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {currentUser ? (
              <>
                <Link to={getPathOrAuth("/chat")} aria-label="Messaggi">
                  <HiOutlineChatBubbleLeftEllipsis className="w-7 h-7 text-stoop-light hover:text-white transition-colors" />
                </Link>
                <Link to={getPathOrAuth("/notifications")} className="relative" aria-label="Notifiche">
                  <HiOutlineBell className="w-7 h-7 text-stoop-light hover:text-white transition-colors" />
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute top-0 right-0 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 ring-1 ring-stoop-green-darker"></span>
                    </span>
                  )}
                </Link>
                <button 
                    onClick={handleProfileClick} 
                    className="ml-2 rounded-full ring-2 ring-transparent hover:ring-stoop-green-light transition-all" 
                    aria-label="Profilo utente"
                >
                  <img
                    src={currentUser.profilePhotoUrl || DEFAULT_PROFILE_PHOTO}
                    alt="User profile"
                    className="h-9 w-9 rounded-full object-cover"
                  />
                </button>
              </>
            ) : (
                <button 
                    onClick={handleProfileClick} 
                    aria-label="Login o Registrazione"
                >
                    {location.pathname === '/auth' ? <HiUserCircle className="w-8 h-8 text-white" /> : <HiOutlineUserCircle className="w-8 h-8 text-stoop-light hover:text-white" />}
                </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
