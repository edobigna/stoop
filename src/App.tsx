import React from 'react';
import { HashRouter, Routes, Route, Outlet } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import TopNavbar from './components/TopNavbar';
import ProtectedRoute from './components/ProtectedRoute';

// Page imports
import HomePage from './pages/HomePage';
import AuthPage from './pages/AuthPage';
import PostAdPage from './pages/PostAdPage';
import EditAdPage from './pages/EditAdPage';
import AdDetailPage from './pages/AdDetailPage';
import ProfilePage from './pages/ProfilePage';
import ChatSystemPage from './pages/ChatSystemPage';
import NotificationsPage from './pages/NotificationsPage'; // Ensured relative path

const AppLayout: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <TopNavbar />
      <main className="flex-grow container mx-auto pb-8"> {/* Adjusted padding */}
        <Outlet /> {/* Nested routes will render here */}
      </main>
    </div>
  );
};


const App: React.FC = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<HomePage />} />
              <Route path="auth" element={<AuthPage />} />
              <Route path="ad/:adId" element={<AdDetailPage />} />
              
              {/* Protected Routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="post" element={<PostAdPage />} />
                <Route path="edit-ad/:adId" element={<EditAdPage />} />
                <Route path="profile" element={<ProfilePage viewOwnProfile />} />
                <Route path="profile/:userId" element={<ProfilePage />} />
                <Route path="chat" element={<ChatSystemPage />} />
                <Route path="chat/:chatId" element={<ChatSystemPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
              </Route>
              
              {/* Catch-all for 404 */}
              <Route path="*" element={
                <div className="text-center p-10">
                  <h1 className="text-3xl font-bold text-stoop-green-darker">404 - Pagina Non Trovata</h1>
                  <p className="text-gray-600 mt-2">La pagina che stai cercando non esiste.</p>
                </div>
              } />
            </Route>
          </Routes>
        </HashRouter>
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;
