import React, { useState, FormEvent, ChangeEvent } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { firebaseApi } from '../services/firebaseApi';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { User } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { HiOutlineUserCircle, HiOutlineCamera } from 'react-icons/hi2';

interface AuthFormProps {
  isRegisterMode: boolean;
  toggleMode: () => void;
}

const AuthForm: React.FC<AuthFormProps> = ({ isRegisterMode, toggleMode }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nickname, setNickname] = useState('');
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { updateCurrentUser } = useAuth(); 
  const { showToast } = useToast();
  const navigate = ReactRouterDOM.useNavigate();

  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfilePhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
        setProfilePhotoFile(null);
        setProfilePhotoPreview(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (isRegisterMode) {
      if (password !== confirmPassword) {
        setError("Le password non coincidono.");
        setIsLoading(false);
        return;
      }
      if (!firstName.trim() || !lastName.trim()) {
        setError("Nome e Cognome sono obbligatori.");
        setIsLoading(false);
        return;
      }
      if (!acceptedTerms) {
        setError("Devi accettare i Termini e Condizioni per registrarti.");
        setIsLoading(false);
        return;
      }
      try {
        const userData: Omit<User, 'id' | 'profilePhotoUrl'> = { 
            email, 
            firstName: firstName.trim(), 
            lastName: lastName.trim(),
            nickname: nickname.trim() || undefined,
        };
        const newUser = await firebaseApi.register(userData, password, profilePhotoFile);
        if (newUser) {
          updateCurrentUser(newUser);
          showToast('Registrazione avvenuta con successo!', 'success');
          navigate('/');
        }
      } catch (err: any) {
        let specificError = "Errore durante la registrazione. Riprova.";
        switch (err.code) {
            case 'auth/email-already-in-use':
                specificError = "Questa email è già registrata. Prova a fare il login.";
                break;
            case 'auth/invalid-email':
                specificError = "L'indirizzo email non è valido.";
                break;
            case 'auth/weak-password':
                specificError = "La password è troppo debole. Deve contenere almeno 6 caratteri.";
                break;
            default:
                if (err.message) specificError = err.message;
        }
        setError(specificError);
        showToast(specificError, 'error');
      }
    } else { // Login mode
      try {
        const user = await firebaseApi.login(email, password);
        if (user) {
          updateCurrentUser(user);
          showToast('Login effettuato con successo!', 'success');
          navigate('/');
        } else {
           // firebaseApi.login now throws specific errors or a generic one.
           // This else block might not be reached if firebaseApi.login always throws.
           const genericError = "Credenziali non valide o utente non trovato.";
           setError(genericError); 
           showToast(genericError, 'error');
        }
      } catch (err: any) {
        let specificError = "Errore durante il login. Riprova.";
        // Firebase Auth errors for login often come with a 'auth/...' code.
        // err.message might be more user-friendly if provided by firebaseApi.login for specific cases.
        if(err.message && (err.message.includes("Email o password non corretti") || err.message.includes("Nessun account trovato") || err.message.includes("Password errata"))) {
            specificError = err.message;
        } else {
            switch (err.code) {
                case 'auth/user-not-found': // Should be caught by invalid-credential now
                case 'auth/wrong-password': // Should be caught by invalid-credential now
                case 'auth/invalid-credential':
                    specificError = "Email o password non corretti. Riprova.";
                    break;
                case 'auth/invalid-email':
                    specificError = "Formato email non valido.";
                    break;
                case 'auth/user-disabled':
                    specificError = "Questo account utente è stato disabilitato.";
                    break;
                default:
                    if (err.message) specificError = err.message;
            }
        }
        setError(specificError);
        showToast(specificError, 'error');
      }
    }
    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <p className="text-red-500 text-sm bg-red-100 p-3 rounded-md animate-shake" role="alert">{error}</p>}
      
      {isRegisterMode && (
        <>
          <div className="text-center mb-4">
            <label htmlFor="profilePhotoInput" className="cursor-pointer group inline-block relative">
              {profilePhotoPreview ? (
                <img
                  src={profilePhotoPreview}
                  alt="Anteprima Profilo"
                  className="w-24 h-24 rounded-full object-cover border-2 border-stoop-green group-hover:border-stoop-green-dark transition-colors duration-200 shadow-sm mx-auto"
                />
              ) : (
                <div className="w-24 h-24 rounded-full border-2 border-dashed border-gray-300 group-hover:border-stoop-green-dark flex items-center justify-center mx-auto transition-colors duration-200 shadow-sm p-2">
                  <HiOutlineUserCircle className="w-16 h-16 text-gray-400" />
                </div>
              )}
              {profilePhotoPreview && (
                <div className="absolute inset-0 rounded-full bg-black bg-opacity-0 group-hover:bg-opacity-30 flex items-center justify-center transition-all duration-200">
                  <HiOutlineCamera className="w-8 h-8 text-white opacity-0 group-hover:opacity-100" />
                </div>
              )}
              <input id="profilePhotoInput" type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" aria-label="Carica foto profilo" />
            </label>
            {!profilePhotoPreview && <p className="text-xs text-gray-500 mt-1">Carica foto (Opzionale)</p>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
              <input id="firstName" type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">Cognome *</label>
              <input id="lastName" type="text" value={lastName} onChange={e => setLastName(e.target.value)} required />
            </div>
          </div>
           <div>
            <label htmlFor="nickname" className="block text-sm font-medium text-gray-700 mb-1">Nickname (Opzionale)</label>
            <input id="nickname" type="text" value={nickname} onChange={e => setNickname(e.target.value)} placeholder="Il tuo alias pubblico" />
          </div>
        </>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
        <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
        <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
      </div>

      {isRegisterMode && (
        <>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">Conferma Password *</label>
            <input id="confirmPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
          </div>
          <div className="flex items-center">
            <input
              id="terms"
              name="terms"
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="h-4 w-4 text-stoop-green border-gray-300 rounded focus:ring-stoop-green focus:ring-offset-0"
              aria-describedby="terms-description"
            />
            <label htmlFor="terms" id="terms-description" className="ml-2 block text-xs sm:text-sm text-gray-700">
              Accetto i{' '}
              <a href="#/terms" target="_blank" rel="noopener noreferrer" className="font-medium text-stoop-green hover:text-stoop-green-dark underline">
                Termini e Condizioni
              </a>
            </label>
          </div>
        </>
      )}

      <button
        type="submit"
        disabled={isLoading || (isRegisterMode && !acceptedTerms)}
        className="w-full py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-stoop-green hover:bg-stoop-green-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-stoop-green-dark disabled:opacity-70 transition-all flex items-center justify-center"
      >
        {isLoading ? <LoadingSpinner size="sm" color="border-white" /> : (isRegisterMode ? 'Registrati' : 'Login')}
      </button>

      <p className="text-center text-sm text-gray-600">
        {isRegisterMode ? "Hai già un account? " : "Non hai un account? "}
        <button type="button" onClick={toggleMode} className="font-medium text-stoop-green hover:text-stoop-green-dark underline">
          {isRegisterMode ? "Effettua il Login" : "Registrati Ora"}
        </button>
      </p>
      <style>{`
        /* Apply global input styles from index.css, no need to repeat here if they are sufficient */
        /* Specific animation for error messages */
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </form>
  );
};

export default AuthForm;
