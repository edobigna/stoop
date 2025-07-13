
import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { ToastType } from '../types';
import { HiOutlineInformationCircle, HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineXMark } from 'react-icons/hi2';

interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let toastCount = 0;

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = `toast-${toastCount++}`;
    setToasts(prevToasts => [...prevToasts, { id, message, type }]);
    setTimeout(() => {
      setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
    }, 5000);
  }, []);

  const removeToast = (id: string) => {
    setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-20 right-4 z-[100] space-y-3 w-full max-w-xs sm:max-w-sm"> {/* TopNavbar is h-16 (4rem), so top-20 (5rem) is appropriate */}
        {toasts.map(toast => {
          let bgColor = 'bg-gray-700';
          let textColor = 'text-white';
          let IconComponent: React.ElementType = HiOutlineInformationCircle;

          switch (toast.type) {
            case 'success':
              bgColor = 'bg-stoop-green'; // Changed from bg-green-500
              IconComponent = HiOutlineCheckCircle;
              break;
            case 'error':
              bgColor = 'bg-red-500';
              IconComponent = HiOutlineXCircle;
              break;
            case 'warning':
              bgColor = 'bg-yellow-500'; // Kept standard yellow for warnings
              IconComponent = HiOutlineInformationCircle; 
              break;
            case 'info':
              bgColor = 'bg-blue-500'; // Kept standard blue for info
              IconComponent = HiOutlineInformationCircle;
              break;
          }

          return (
            <div
              key={toast.id}
              className={`${bgColor} ${textColor} p-4 rounded-lg shadow-xl flex items-center justify-between animate-fadeInRight`}
            >
              <div className="flex items-center">
                <IconComponent className="w-5 h-5 mr-3 text-white" />
                <span>{toast.message}</span>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="ml-4 p-1 rounded-full hover:bg-black/20 transition-colors"
                aria-label="Close toast"
              >
                <HiOutlineXMark className="w-4 h-4 text-white" />
              </button>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes fadeInRight {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-fadeInRight {
          animation: fadeInRight 0.3s ease-out forwards;
        }
      `}</style>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
