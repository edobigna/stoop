
import React, { useState } from 'react';
import AuthForm from '../components/AuthForm';
import { HiOutlineUserCircle } from 'react-icons/hi2';

const AuthPage: React.FC = () => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  const toggleMode = () => {
    setIsRegisterMode(prevMode => !prevMode);
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center bg-gradient-to-br from-stoop-green-light via-stoop-light to-white px-4 py-12 sm:px-6 lg:px-8"> {/* Adjusted min-height due to TopNavbar */}
      <div className="max-w-md w-full space-y-8 bg-white p-8 sm:p-10 rounded-2xl shadow-2xl border border-gray-200/80">
        <div>
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-stoop-green mb-6 shadow-md">
            <HiOutlineUserCircle className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-center text-3xl font-extrabold text-stoop-green-darker tracking-tight">
            {isRegisterMode ? 'Crea il tuo Account' : 'Accedi al tuo Account'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {isRegisterMode ? 'Unisciti alla community e inizia a condividere!' : 'Bentornato! Accedi per continuare.'}
          </p>
        </div>
        <AuthForm isRegisterMode={isRegisterMode} toggleMode={toggleMode} />
      </div>
    </div>
  );
};

export default AuthPage;
