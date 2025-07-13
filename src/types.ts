import firebase from 'firebase/compat/app';

export enum ReportReason {
  SPAM = 'SPAM',
  OFFENSIVE = 'OFFENSIVE',
  NOT_FREE = 'NOT_FREE',
  MISLEADING = 'MISLEADING',
  SOLD_ELSEWHERE = 'SOLD_ELSEWHERE',
  SAFETY_CONCERN = 'SAFETY_CONCERN',
  OTHER = 'OTHER',
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  nickname?: string;
  email: string;
  profilePhotoUrl?: string;
}

export interface LocationCoords {
  latitude: number;
  longitude: number;
  address?: string;
}

export enum ReservationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

// How Ad data is stored in Firestore
export interface FirestoreAdData {
  userId: string;
  title: string;
  description: string;
  category: string;
  images: string[];
  locationName: string;
  gpsCoords?: firebase.firestore.GeoPoint;
  postedAt: firebase.firestore.Timestamp | firebase.firestore.FieldValue;
  isReserved?: boolean;
  reservedByUserId?: string;
  reservationStatus?: ReservationStatus;
  waitingListUserIds?: string[];
  tags?: string[];
  isStreetFind?: boolean;
}

// How Ad data is used in the frontend
export interface Ad extends Omit<FirestoreAdData, 'postedAt' | 'gpsCoords' | 'userId'> {
  id: string;
  userId: string; // Ensure userId is directly on Ad, not just from Omit
  user?: User;
  postedAt: string; // Transformed from Timestamp to ISOString
  gpsCoords?: LocationCoords; // Transformed from GeoPoint
  distance?: number; // For sorting by distance
}

export interface Reservation {
  id: string;
  adId: string;
  adTitle: string;
  adMainImage?: string;
  requesterId: string;
  requesterName: string;
  ownerId: string;
  status: ReservationStatus;
  requestedAt: string; // ISOString
  chatSessionId?: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderProfilePhotoUrl?: string;
  text: string;
  timestamp: string; // ISOString
  isSystemMessage?: boolean;
}

export interface ChatSessionParticipant {
  id: string;
  firstName: string;
  lastName: string;
  nickname?: string;
  profilePhotoUrl?: string;
}

export interface ChatSession {
  id: string;
  participantIds: string[];
  participants: ChatSessionParticipant[];
  adId: string;
  adTitle: string;
  lastMessageText?: string;
  lastMessageTimestamp?: string; // ISOString
  createdAt: string; // ISOString
  isClosed: boolean;
  closedByUserId?: string;
  reservationWasAccepted?: boolean;
  reservationId?: string; // Link back to the reservation
}

export interface AppNotification {
  id: string;
  userId: string;
  type:
    | 'RESERVATION_REQUEST'
    | 'RESERVATION_ACCEPTED'
    | 'RESERVATION_DECLINED'
    | 'RESERVATION_CANCELLED'
    | 'NEW_MESSAGE'
    | 'WAITING_LIST_JOINED'
    | 'PROMOTED_FROM_WAITING_LIST'
    | 'OWNER_WAITING_LIST_UPDATE'
    | 'STREET_FIND_PICKED_UP'
    | 'EXCHANGE_COMPLETED'
    | 'AD_REPORTED_CONFIRMATION'
    | 'OWNER_AD_REPORTED'
    | 'GENERAL_INFO';
  title: string;
  message: string;
  relatedItemId?: string; // Can be adId, chatId, reservationId etc.
  isRead: boolean;
  createdAt: string; // ISOString
  reservationDetails?: {
    adId: string;
    adTitle: string;
    requesterName: string;
    reservationId: string;
  };
}


export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface AdCreationData {
  userId: string;
  title: string;
  description: string;
  category: string;
  images: string[];
  locationName: string;
  gpsCoords?: LocationCoords;
  tags?: string[];
  isStreetFind?: boolean;
}

// AdUpdateData allows updating a subset of FirestoreAdData fields.
// Fields like userId, postedAt are immutable.
// Reservation-related fields (isReserved, reservedByUserId, etc.) are typically managed by specific functions.
// images and gpsCoords are handled specially.
export type AdUpdateData = Partial<Pick<FirestoreAdData, 'title' | 'description' | 'category' | 'locationName' | 'tags' | 'isStreetFind'>> & {
  gpsCoords?: firebase.firestore.GeoPoint | firebase.firestore.FieldValue | LocationCoords | null; // Allow LocationCoords for easier frontend use, null for deletion
  // images are handled by passing newImageFiles and currentImageUrls to firebaseApi.updateAd
};


export interface AdCardProps {
  ad: Ad;
  currentUser: User | null;
  showEditButton?: boolean;
  showDeleteButton?: boolean;
  onDeleteAd?: (adId: string) => void;
  onEditAd?: (adId: string) => void;
  onAdUpdated?: (updatedAd: Ad) => void;
}


// This defines the full contract for the firebaseApi service.
export interface FirebaseApiServiceType {
  login: (email: string, pass: string) => Promise<User | null>;
  register: (userData: Omit<User, 'id' | 'profilePhotoUrl'>, passwordInput: string, profilePhotoFile?: File | null) => Promise<User | null>;
  logout: () => Promise<void>;
  getUserById: (userId: string) => Promise<User | null>;
  updateUserProfile: (userId: string, updates: Partial<User>) => Promise<User | null>;
  uploadImage: (file: File, path: string) => Promise<string>;
  deleteImageByUrl: (imageUrl: string) => Promise<void>;
  
  _mapAdDataToAd: (adDoc: firebase.firestore.QueryDocumentSnapshot | firebase.firestore.DocumentSnapshot) => Promise<Ad | null>;
  getAds: () => Promise<Ad[]>;
  getAdById: (adId: string) => Promise<Ad | null>;
  getUserAds: (userId: string) => Promise<Ad[]>;
  getCompletedReservationsCountForUser: (userId: string) => Promise<number>;
  createAd: (adData: AdCreationData) => Promise<Ad | null>;
  updateAd: (adId: string, updates: AdUpdateData, newImageFiles: File[], currentImageUrls: string[], originalImageUrls: string[]) => Promise<Ad | null>;
  deleteAd: (adId: string, userId: string) => Promise<void>;
  
  createReservation: (adId: string, requesterId: string) => Promise<Ad | null>;
  updateReservationStatus: (reservationId: string, newStatus: ReservationStatus, currentUserId: string, originalNotificationId?: string) => Promise<Reservation | null>;
  joinWaitingList: (adId: string, userId: string) => Promise<Ad | null>;
  claimStreetFind: (adId: string, pickerUserId: string, adOwnerId: string, adTitle: string) => Promise<Ad | null>;
  
  _mapChatSessionData: (doc: firebase.firestore.DocumentSnapshot) => Promise<ChatSession>;
  createChatSession: (participantIds: string[], adId: string, adTitle: string, reservationId?: string, reservationWasAccepted?: boolean) => Promise<ChatSession | null>;
  getChatSessionsStreamed: (userId: string, callback: (sessions: ChatSession[]) => void, onError: (error: Error) => void) => () => void;
  getChatSessionStreamedById: (chatId: string, currentUserId:string, callback: (session: ChatSession | null) => void, onError: (error: Error) => void) => () => void;
  getChatMessagesStreamed: (chatId: string, currentUserId: string, callback: (messages: ChatMessage[]) => void, onError?: (error: Error) => void) => () => void;
  sendChatMessage: (chatId: string, senderId: string, text: string) => Promise<void>;
  closeChatSession: (chatId: string, userIdClosing: string) => Promise<void>;
  completeExchangeAndCloseChat: (chatId: string, userIdCompleting: string) => Promise<void>;
  
  _mapNotificationData: (doc: firebase.firestore.DocumentSnapshot) => AppNotification;
  getNotificationsStreamed: (userId: string, callback: (notifications: AppNotification[]) => void, onError: (error: Error) => void) => () => void;
  getUnreadNotificationsCountStreamed: (userId: string, callback: (count: number) => void, onError?: (error: Error) => void) => () => void;
  markNotificationAsRead: (notificationId: string, userId: string) => Promise<void>;
  
  createReport: (adId: string, reporterId: string, adOwnerId: string, adTitle: string, reason: ReportReason, details: string) => Promise<void>;

  getCurrentLocation: () => Promise<LocationCoords>;
  geocodeAddress: (address: string) => Promise<LocationCoords | null>;
  getAddressSuggestions: (query: string) => Promise<{ description: string; latitude: number; longitude: number; }[]>;
}