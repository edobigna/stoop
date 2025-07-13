import React from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import TopNavbar from './components/TopNavbar'; 
import BottomNavbar from './components/Navbar'; 

// Page imports
import HomePage from './pages/HomePage';
import AuthPage from './pages/AuthPage';
import PostAdPage from './pages/PostAdPage';
import EditAdPage from './pages/EditAdPage';
import AdDetailPage from './pages/AdDetailPage';
import ProfilePage from './pages/ProfilePage';
import ChatSystemPage from './pages/ChatSystemPage';
import NotificationsPage from './pages/NotificationsPage';
import MapViewPage from './pages/MapViewPage'; // Import MapViewPage
import TermsPage from './pages/TermsPage'; 
import ProtectedRoute from './components/ProtectedRoute';


const AppLayout: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50"> 
      <TopNavbar /> 
      {/* pt-16 for TopNavbar (h-16), pb-16 for BottomNavbar (h-16) */}
      <main className="flex-grow container mx-auto px-0 sm:px-0"> {/* Reduced horizontal padding to be handled by page content if needed */}
        <ReactRouterDOM.Outlet /> 
      </main>
      <BottomNavbar /> 
    </div>
  );
};


const App: React.FC = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <ReactRouterDOM.HashRouter>
          <ReactRouterDOM.Routes>
            <ReactRouterDOM.Route path="/" element={<AppLayout />}>
              <ReactRouterDOM.Route index element={<HomePage />} /> 
              <ReactRouterDOM.Route path="auth" element={<AuthPage />} />
              <ReactRouterDOM.Route path="terms" element={<TermsPage />} /> 
              <ReactRouterDOM.Route path="ad/:adId" element={<AdDetailPage />} />
              <ReactRouterDOM.Route path="map-view" element={<MapViewPage />} /> {/* Route for MapViewPage */}
              
              {/* Protected Routes */}
              <ReactRouterDOM.Route element={<ProtectedRoute />}>
                <ReactRouterDOM.Route path="post" element={<PostAdPage />} />
                <ReactRouterDOM.Route path="edit-ad/:adId" element={<EditAdPage />} />
                <ReactRouterDOM.Route path="profile" element={<ProfilePage viewOwnProfile />} />
                <ReactRouterDOM.Route path="profile/:userId" element={<ProfilePage />} />
                <ReactRouterDOM.Route path="chat" element={<ChatSystemPage />} />
                <ReactRouterDOM.Route path="chat/:chatId" element={<ChatSystemPage />} />
                <ReactRouterDOM.Route path="notifications" element={<NotificationsPage />} />
              </ReactRouterDOM.Route>
              
              {/* Catch-all for 404 */}
              <ReactRouterDOM.Route path="*" element={
                <div className="text-center p-10 pt-20"> {/* Added pt-20 to account for TopNavbar */}
                  <h1 className="text-3xl font-bold text-stoop-green-darker">404 - Pagina Non Trovata</h1>
                  <p className="text-gray-600 mt-2">La pagina che stai cercando non esiste.</p>
                </div>
              } />
            </ReactRouterDOM.Route>
          </ReactRouterDOM.Routes>
        </ReactRouterDOM.HashRouter>
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;