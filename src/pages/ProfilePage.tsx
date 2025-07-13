import React, { useEffect, useState, FormEvent, ChangeEvent, useCallback } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { User, Ad } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { firebaseApi } from '../services/firebaseApi';
import AdCard from '../components/AdCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { DEFAULT_PROFILE_PHOTO, DEFAULT_PROFILE_PHOTO_ALT } from '../constants';
import { getUserDisplayName } from '../utils/displayUtils';
import { useToast } from '../contexts/ToastContext';
import {
    HiOutlineCamera, HiOutlineCheckCircle, HiOutlinePencilSquare,
    HiOutlineArchiveBoxXMark, HiOutlinePlusCircle, HiOutlineUserCircle, HiOutlineXCircle,
    HiOutlineCube, HiOutlineBuildingOffice, HiOutlineArchiveBoxArrowDown
} from 'react-icons/hi2';

interface ProfilePageProps {
  viewOwnProfile?: boolean;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ viewOwnProfile }) => {
  const { userId: paramsUserId } = ReactRouterDOM.useParams<{ userId?: string }>();
  const { currentUser, logout, updateCurrentUser: updateAuthContextUser } = useAuth();
  const navigate = ReactRouterDOM.useNavigate();
  const { showToast } = useToast();

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [userAds, setUserAds] = useState<Ad[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAds, setIsLoadingAds] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true); // For collected items
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editNickname, setEditNickname] = useState('');
  const [editProfilePhotoFile, setEditProfilePhotoFile] = useState<File | null>(null);
  const [editProfilePhotoPreview, setEditProfilePhotoPreview] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const [collectedItemsCount, setCollectedItemsCount] = useState(0);

  const targetUserId = viewOwnProfile ? currentUser?.id : paramsUserId;
  const isOwnProfile = viewOwnProfile || (currentUser?.id === targetUserId);

  const fetchProfileData = useCallback(async () => {
    if (!targetUserId) {
      setError("ID utente non trovato.");
      setIsLoading(false);
      setIsLoadingAds(false);
      setIsLoadingStats(false);
      setProfileUser(null);
      return;
    }

    setIsLoading(true);
    setIsLoadingAds(true);
    setIsLoadingStats(true);
    setError(null);

    try {
      const userPromise = firebaseApi.getUserById(targetUserId);
      const adsPromise = firebaseApi.getUserAds(targetUserId);
      const collectedCountPromise = isOwnProfile ? firebaseApi.getCompletedReservationsCountForUser(targetUserId) : Promise.resolve(0);

      const [user, ads, collectedCount] = await Promise.all([userPromise, adsPromise, collectedCountPromise]);
      
      if (!user) {
        setError("Utente non trovato.");
        setProfileUser(null);
      } else {
        setProfileUser(user);
        setEditFirstName(user.firstName);
        setEditLastName(user.lastName);
        setEditNickname(user.nickname || '');
        setEditProfilePhotoPreview(user.profilePhotoUrl || DEFAULT_PROFILE_PHOTO);
      }
      setIsLoading(false);

      setUserAds(ads);
      setIsLoadingAds(false);

      if (isOwnProfile) {
        setCollectedItemsCount(collectedCount);
      }
      setIsLoadingStats(false);

    } catch (err: any) {
      const message = err.message || "Caricamento dati profilo fallito.";
      setError(message);
      showToast(message, 'error');
      console.error(err);
      setProfileUser(null);
      setIsLoading(false);
      setIsLoadingAds(false);
      setIsLoadingStats(false);
    }
  }, [targetUserId, showToast, isOwnProfile]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);


  const handleLogout = async () => {
    setIsSaving(true);
    try {
        await logout();
        showToast('Logout effettuato con successo!', 'success');
        navigate('/auth');
    } catch(err: any) {
        console.error("Logout fallito:", err);
        showToast(err.message || "Logout fallito. Riprova.", 'error');
    } finally {
        setIsSaving(false);
    }
  };

  const handleEditPhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setEditProfilePhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
          setEditProfilePhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
        setEditProfilePhotoFile(null);
        setEditProfilePhotoPreview(profileUser?.profilePhotoUrl || DEFAULT_PROFILE_PHOTO);
    }
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!profileUser || !isOwnProfile || !editFirstName.trim() || !editLastName.trim()) {
        showToast("Nome e cognome non possono essere vuoti.", 'error');
        return;
    }
    setIsSaving(true);

    try {
      let newPhotoUrl = profileUser.profilePhotoUrl;
      if (editProfilePhotoFile) {
        newPhotoUrl = await firebaseApi.uploadImage(editProfilePhotoFile, `profile_photos/${profileUser.id}`);
      }

      const updates: Partial<User> = {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        nickname: editNickname.trim() || undefined,
      };
      if (newPhotoUrl !== profileUser.profilePhotoUrl || (editProfilePhotoFile && newPhotoUrl)) {
        updates.profilePhotoUrl = newPhotoUrl;
      }

      const updatedUser = await firebaseApi.updateUserProfile(profileUser.id, updates);

      if (updatedUser) {
        setProfileUser(updatedUser);
        if (currentUser?.id === updatedUser.id) {
          updateAuthContextUser(updatedUser);
        }
        setIsEditing(false);
        setEditProfilePhotoFile(null);
        showToast("Profilo aggiornato con successo!", 'success');
      } else {
        showToast("Salvataggio profilo fallito. Riprova.", 'error');
      }
    } catch (err: any) {
      showToast(err.message || "Si è verificato un errore imprevisto durante il salvataggio del profilo.", 'error');
      console.error("SaveProfile Error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAd = async (adId: string) => {
    if (!currentUser || currentUser.id !== profileUser?.id) {
      showToast("Non autorizzato a eliminare questo annuncio.", 'error');
      return;
    }
    if (window.confirm("Sei sicuro di voler eliminare questo annuncio? L'azione è irreversibile.")) {
      setIsLoadingAds(true); 
      try {
        await firebaseApi.deleteAd(adId, currentUser.id);
        setUserAds(prevAds => prevAds.filter(ad => ad.id !== adId));
        showToast("Annuncio eliminato con successo.", 'success');
      } catch (err: any) {
        showToast(`Errore durante l'eliminazione dell'annuncio: ${err.message || 'Errore sconosciuto'}`, 'error');
        console.error("DeleteAd Error:", err);
      } finally {
        setIsLoadingAds(false); 
      }
    }
  };

  const handleEditAd = (adId: string) => {
    navigate(`/edit-ad/${adId}`);
  };

  const handleAdUpdatedOnProfilePage = (updatedAd: Ad) => {
    setUserAds(prevAds => prevAds.map(ad => ad.id === updatedAd.id ? updatedAd : ad));
  };


  useEffect(() => {
    const currentPreview = editProfilePhotoPreview;
    return () => {
      if (currentPreview && currentPreview.startsWith('blob:')) {
         URL.revokeObjectURL(currentPreview);
      }
    };
  }, [editProfilePhotoPreview]);


  const displayedName = getUserDisplayName(profileUser);
  const adsPostedCount = userAds.length;
  const streetFindsCount = userAds.filter(ad => ad.isStreetFind).length;

  if (isLoading && !profileUser) return <LoadingSpinner fullPage text="Caricamento profilo..." />;

  if (error && !profileUser && !isLoading) return (
    <div className="text-center p-8 text-red-600 bg-red-50 rounded-lg shadow-md m-4" role="alert">
        <HiOutlineXCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold mb-2">Errore Caricamento Profilo</h3>
        <p>{error}</p>
    </div>
  );
  if (!profileUser && !isLoading) return (
    <div className="text-center p-8 text-gray-600 bg-white rounded-lg shadow-md m-4">
        <HiOutlineUserCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p>Profilo utente non trovato o impossibile da caricare.</p>
    </div>
  );
  if (!profileUser) return null;

  const StatCard: React.FC<{icon: React.ElementType, value: string | number, label: string, colorClass: string, isLoading?: boolean}> = 
  ({icon: Icon, value, label, colorClass, isLoading: statLoading}) => (
    <div className={`bg-opacity-20 p-2.5 rounded-lg text-center shadow-sm border ${colorClass}-border ${colorClass}-bg-light`}>
      <Icon className={`w-5 h-5 ${colorClass}-text mx-auto mb-0.5`} />
      <p className={`text-lg font-bold ${colorClass}-text`}>{statLoading ? '...' : value}</p>
      <p className="text-xs text-gray-600 whitespace-nowrap">{label}</p>
    </div>
  );


  return (
    <div className="container mx-auto px-2 sm:px-4 py-6">
      <div className="max-w-3xl mx-auto bg-white p-5 sm:p-8 rounded-2xl shadow-xl border border-gray-200/70">
        {isEditing && isOwnProfile ? (
          <form onSubmit={handleSaveProfile} className="space-y-6">
            <h2 className="text-2xl font-semibold text-stoop-green-darker text-center mb-6">Modifica il Tuo Profilo</h2>
            <div className="text-center">
              <label htmlFor="editProfilePhotoInput" className="cursor-pointer group inline-block relative">
                <img
                    src={editProfilePhotoPreview}
                    alt="Modifica Profilo"
                    className="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-stoop-green-light group-hover:border-stoop-green transition-colors duration-200 shadow-lg mx-auto"
                />
                <div className="absolute inset-0 rounded-full bg-black bg-opacity-0 group-hover:bg-opacity-40 flex items-center justify-center transition-all duration-200">
                    <HiOutlineCamera className="w-8 h-8 text-white opacity-0 group-hover:opacity-100" />
                </div>
                <input id="editProfilePhotoInput" type="file" accept="image/*" onChange={handleEditPhotoChange} className="hidden" aria-label="Modifica foto profilo" />
              </label>
            </div>
            <div>
              <label htmlFor="editFirstName" className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
              <input id="editFirstName" type="text" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="editLastName" className="block text-sm font-medium text-gray-700 mb-1">Cognome *</label>
              <input id="editLastName" type="text" value={editLastName} onChange={(e) => setEditLastName(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="editNickname" className="block text-sm font-medium text-gray-700 mb-1">Nickname (Opzionale)</label>
              <input id="editNickname" type="text" value={editNickname} onChange={(e) => setEditNickname(e.target.value)} placeholder="Il tuo alias" />
            </div>
            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 pt-2">
              <button type="submit" disabled={isSaving} className="flex-1 flex items-center justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-semibold text-white bg-stoop-green hover:bg-stoop-green-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-stoop-green-dark disabled:opacity-60 transition-opacity">
                {isSaving ? <LoadingSpinner size="sm" color="border-white" /> : <HiOutlineCheckCircle className="w-5 h-5 mr-2" />}
                {isSaving ? 'Salvataggio...' : 'Salva Modifiche'}
              </button>
              <button type="button" onClick={() => { setIsEditing(false); setEditFirstName(profileUser.firstName); setEditLastName(profileUser.lastName); setEditNickname(profileUser.nickname || ''); setEditProfilePhotoPreview(profileUser.profilePhotoUrl || DEFAULT_PROFILE_PHOTO); setEditProfilePhotoFile(null);}}
                      className="flex-1 flex items-center justify-center py-2.5 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-stoop-green transition-colors">
                Annulla
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="text-center mb-6">
                <img
                    src={profileUser.profilePhotoUrl || DEFAULT_PROFILE_PHOTO}
                    alt={`Profilo di ${displayedName}` || DEFAULT_PROFILE_PHOTO_ALT}
                    className="w-32 h-32 sm:w-36 sm:h-36 rounded-full object-cover border-4 border-stoop-green-light shadow-xl mx-auto mb-4"
                />
                <h1 className="text-3xl sm:text-4xl font-bold text-stoop-green-darker tracking-tight">
                  {displayedName}
                </h1>
                {profileUser.nickname && <p className="text-gray-500 text-md">({profileUser.firstName} {profileUser.lastName})</p>}
                <p className="text-gray-500 text-sm mt-1">{profileUser.email}</p>
            </div>

             <div className={`grid ${isOwnProfile ? 'grid-cols-3' : 'grid-cols-2'} gap-2.5 mb-8`}>
                <StatCard icon={HiOutlineCube} value={adsPostedCount} label="Pubblicati" colorClass="stoop-green" isLoading={isLoadingAds}/>
                <StatCard icon={HiOutlineBuildingOffice} value={streetFindsCount} label="Da Strada" colorClass="blue" isLoading={isLoadingAds}/>
                {isOwnProfile && (
                    <StatCard icon={HiOutlineArchiveBoxArrowDown} value={collectedItemsCount} label="Raccolti" colorClass="purple" isLoading={isLoadingStats}/>
                )}
            </div>


            {isOwnProfile && (
              <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4 mb-10">
                  <button onClick={() => setIsEditing(true)}
                          className="py-2.5 px-6 bg-stoop-green text-white font-semibold rounded-lg hover:bg-stoop-green-dark transition-colors shadow-md flex items-center justify-center animate-pulse-on-hover"
                          aria-label="Modifica profilo">
                    <HiOutlinePencilSquare className="w-5 h-5 mr-2" /> Modifica Profilo
                  </button>
                  <button onClick={handleLogout} disabled={isSaving}
                          className="py-2.5 px-6 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors shadow-md flex items-center justify-center disabled:opacity-60 animate-pulse-on-hover"
                          aria-label="Esci">
                    {isSaving ? <LoadingSpinner size="sm" color="border-white" /> : 'Esci'}
                  </button>
              </div>
            )}
          </>
        )}

        <div className="mt-10 pt-8 border-t border-gray-200">
          <h2 className="text-2xl font-semibold text-stoop-green-darker mb-6 text-center">
            {isOwnProfile ? "I Tuoi Oggetti Pubblicati" : `Oggetti di ${displayedName}`}
            {!isLoadingAds && userAds.length > 0 && ` (${userAds.length})`}
          </h2>
          {isLoadingAds ? (
            <div className="text-center py-4"><LoadingSpinner text="Caricamento oggetti..." /></div>
          ) : userAds.length === 0 ? (
            <div className="text-center text-gray-500 py-10 bg-gray-50 rounded-lg border border-gray-200/70 min-h-[200px] flex flex-col justify-center items-center">
                <HiOutlineArchiveBoxXMark className="mx-auto text-gray-300 w-16 h-16 mb-4" />
                <p className="font-medium text-lg">
                  {isOwnProfile ? "Non hai ancora pubblicato nessun oggetto." : `${displayedName} non ha ancora pubblicato nessun oggetto.`}
                </p>
                {isOwnProfile &&
                  <button
                    onClick={() => navigate('/post')}
                    className="mt-4 px-5 py-2.5 bg-stoop-green text-white font-semibold rounded-lg hover:bg-stoop-green-dark transition-colors text-sm shadow-md flex items-center justify-center animate-pulse-on-hover"
                  >
                    <HiOutlinePlusCircle className="w-4 h-4 mr-2 inline-block" /> Pubblica il tuo primo oggetto
                  </button>
                }
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
              {userAds.map(ad => (
                <AdCard
                    key={ad.id}
                    ad={ad}
                    currentUser={currentUser}
                    showEditButton={isOwnProfile}
                    showDeleteButton={isOwnProfile}
                    onDeleteAd={isOwnProfile ? handleDeleteAd : undefined}
                    onEditAd={isOwnProfile ? handleEditAd : undefined}
                    onAdUpdated={handleAdUpdatedOnProfilePage}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <style>{`
        .animate-pulse-on-hover:hover:not(:disabled) { /* Add :not(:disabled) */
          animation: pulse 1s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: .85; transform: scale(1.02); }
        }
        .stoop-green-text { color: #3A912D; }
        .stoop-green-border { border-color: #A2D5AB; }
        .stoop-green-bg-light { background-color: #F0FFF0; }

        .blue-text { color: #2563EB; }
        .blue-border { border-color: #93C5FD; }
        .blue-bg-light { background-color: #EFF6FF; }
        
        .purple-text { color: #7C3AED; }
        .purple-border { border-color: #C4B5FD; }
        .purple-bg-light { background-color: #F5F3FF; }
      `}</style>
    </div>
  );
};

export default ProfilePage;
