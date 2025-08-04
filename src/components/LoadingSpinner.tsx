
import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string; // Tailwind color class e.g., 'border-stoop-green'
  text?: string;
  fullPage?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  color = 'border-stoop-green',
  text,
  fullPage = false
}) => {
  const sizeClasses = {
    sm: 'h-6 w-6 border-2',
    md: 'h-10 w-10 border-t-4 border-b-4',
    lg: 'h-16 w-16 border-t-4 border-b-4',
  };

  const spinner = (
    <div className="flex flex-col items-center justify-center">
      <div 
        className={`animate-spin rounded-full ${sizeClasses[size]} ${color} border-solid`}
        style={{ borderTopColor: 'transparent', borderBottomColor: color !== 'border-stoop-green' ? 'transparent' : undefined }} // Ensures spinner effect with custom border color
      ></div>
      {text && <p className="mt-3 text-gray-600 text-sm">{text}</p>}
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 bg-gray-500 bg-opacity-25 flex items-center justify-center z-50">
        {spinner}
      </div>
    );
  }

  return spinner;
};

export default LoadingSpinner;
