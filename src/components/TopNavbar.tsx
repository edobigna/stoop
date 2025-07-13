import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { firebaseApi } from '../services/firebaseApi';
import { HiOutlineBell} from 'react-icons/hi2';

const TopNavbar: React.FC = () => {
  const { currentUser } = useAuth();
  const location = useLocation();
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

  return (
    <header className="bg-stoop-green-darker shadow-md sticky top-0 z-50 h-16 flex items-center">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex items-center justify-between h-full">
          {/* Logo/App Name */}
          <Link to="/" className="flex-shrink-0 text-3xl font-bold text-white tracking-tight" aria-label="Homepage">
            stoop
          </Link>

          {/* Right Aligned Actions */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {currentUser ? (
              <>
                <Link to="/notifications" className={`${iconButtonClasses('/notifications')} relative`} aria-label="Notifiche">
                  <HiOutlineBell className="w-6 h-6" />
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 ring-1 ring-stoop-green-darker justify-center items-center text-white text-[8px] font-bold">
                        </span>
                    </span>
                  )}
                </Link>
              </>
            ) : (
                <Link to="/auth" className="text-sm font-semibold text-white bg-stoop-green hover:bg-stoop-green-dark transition-colors px-4 py-2 rounded-lg">
                    Login / Registrati
                </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopNavbar;
