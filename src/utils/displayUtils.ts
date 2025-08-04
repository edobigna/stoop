import { User } from '../types'; // Corrected import path

export const getUserDisplayName = (user: Partial<Pick<User, 'firstName' | 'lastName' | 'nickname'>> | null | undefined): string => {
  if (!user) return 'Utente Sconosciuto';
  if (user.nickname && user.nickname.trim() !== '') return user.nickname;
  
  const firstName = user.firstName || 'Utente';
  // Ensure lastName is a string before calling charAt
  const lastNameInitial = user.lastName && typeof user.lastName === 'string' && user.lastName.length > 0 
    ? ` ${user.lastName.charAt(0)}.` 
    : '';
  
  return `${firstName}${lastNameInitial}`.trim();
};
