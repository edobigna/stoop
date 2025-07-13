
import { ReportReason } from './types';

export const DEFAULT_PROFILE_PHOTO = 'https://picsum.photos/seed/defaultuser/200/200';
export const DEFAULT_PROFILE_PHOTO_ALT = 'Default profile photo';
export const DEFAULT_AD_IMAGE_PLACEHOLDER = 'https://picsum.photos/seed/defaultad/400/300';
export const DEFAULT_AD_IMAGE_PLACEHOLDER_ALT = 'Ad image placeholder';

export const AD_CATEGORIES: string[] = [
  "Mobili", "Elettronica", "Abbigliamento", "Libri", "Casalinghi", 
  "Giocattoli", "Sport", "Fai da te", "Piante & Giardino", "Altro"
];

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: ReportReason.SPAM, label: "Contenuto spam o irrilevante" },
  { value: ReportReason.OFFENSIVE, label: "Contenuto offensivo o inappropriato" },
  { value: ReportReason.NOT_FREE, label: "Oggetto non gratuito / Richiesta di denaro" },
  { value: ReportReason.MISLEADING, label: "Informazioni false o ingannevoli sull'oggetto" },
  { value: ReportReason.SOLD_ELSEWHERE, label: "Oggetto non più disponibile / Già dato via" },
  { value: ReportReason.SAFETY_CONCERN, label: "Problema di sicurezza (es. incontro, oggetto)" },
  { value: ReportReason.OTHER, label: "Altro (specificare nei dettagli)" },
];

export const AD_TYPE_FILTER_OPTIONS_CONST = [
  { label: "Da Utenti", value: "user" },
  { label: "Da Strada", value: "street" },
];

// The ICONS object and helper functions (createIcon, createSolidIcon)
// have been removed as the application now uses react-icons/hi2.
// Individual components should import icons directly from 'react-icons/hi2'.
// Example: import { HiOutlineHome } from 'react-icons/hi2';
