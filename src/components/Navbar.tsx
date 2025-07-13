import React from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
    HiOutlineHome, HiHome, 
    HiOutlineMapPin, HiMapPin, 
    HiOutlinePlusCircle, HiPlusCircle,
    HiOutlineChatBubbleLeftRight, HiChatBubbleLeftRight,
    HiOutlineUserCircle, HiUserCircle
} from 'react-icons/hi2';

interface NavItemProps {
  to: string;
  iconOutline: React.ElementType;
  iconSolid: React.ElementType;
  label: string;
}

const NavItem: React.FC<NavItemProps> = ({ to, iconOutline: IconOutline, iconSolid: IconSolid, label }) => {
  const location = ReactRouterDOM.useLocation();
  // For Profile, consider active if path starts with /profile
  const isActive = label === "Profilo" ? location.pathname.startsWith(to) : location.pathname === to;


  return (
    <ReactRouterDOM.NavLink
      to={to}
      aria-label={label}
      className={
        `flex flex-col items-center justify-center flex-1 py-3 px-2 sm:py-4 transition-colors duration-150 ease-in-out relative group
         ${isActive ? 'text-white' : 'text-stoop-light hover:text-white'}`
      }
    >
      {isActive ? <IconSolid className="w-7 h-7" /> : <IconOutline className="w-7 h-7" />}
    </ReactRouterDOM.NavLink>
  );
};

const BottomNavbar: React.FC = () => {
  const { currentUser } = useAuth();
  const location = ReactRouterDOM.useLocation();
  const isPostActive = location.pathname === '/post';

  const getPathOrAuth = (path: string) => {
    if ((path === '/post' || path === '/chat' || path === '/profile' || path.startsWith('/profile/')) && !currentUser) {
      return '/auth';
    }
    return path;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-stoop-green-darker border-t border-stoop-green shadow-top-nav z-40 h-16">
      <div className="container mx-auto max-w-screen-sm h-full">
        <div className="flex justify-around items-center h-full relative">
          <NavItem 
            to="/"
            label="Home" 
            iconOutline={HiOutlineHome} 
            iconSolid={HiHome} 
          />
          <NavItem 
            to="/map-view" 
            label="Mappa" 
            iconOutline={HiOutlineMapPin} 
            iconSolid={HiMapPin} 
          />
          
          {/* Special Post Button - Central element */}
          <div className="flex-shrink-0 -translate-y-5"> {/* Removed order-first sm:order-none */}
            <ReactRouterDOM.Link
              to={getPathOrAuth("/post")}
              aria-label="Pubblica un annuncio"
              className={`flex items-center justify-center w-16 h-16 rounded-full shadow-lg transform transition-all duration-150 ease-in-out
                          ${isPostActive ? 'bg-stoop-light text-stoop-green-darker scale-105' : 'bg-stoop-green-light text-stoop-green-darker hover:bg-stoop-light'}`}
            >
              {isPostActive ? <HiPlusCircle className="w-9 h-9" /> : <HiOutlinePlusCircle className="w-9 h-9" />}
            </ReactRouterDOM.Link>
          </div>
          
          <NavItem 
            to={getPathOrAuth("/chat")}
            label="Chat" 
            iconOutline={HiOutlineChatBubbleLeftRight} 
            iconSolid={HiChatBubbleLeftRight} 
          />
           <NavItem 
            to={getPathOrAuth(currentUser ? "/profile" : "/auth")} // Ensure /profile is protected
            label="Profilo" 
            iconOutline={HiOutlineUserCircle} 
            iconSolid={HiUserCircle} 
          />
        </div>
      </div>
      <style>{`
        .shadow-top-nav {
          box-shadow: 0 -2px 6px rgba(0, 0, 0, 0.1);
        }
        .flex > .flex-shrink-0 { 
            flex-basis: auto; 
        }
      `}</style>
    </nav>
  );
};

export default BottomNavbar;
