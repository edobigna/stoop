
import firebase from 'firebase/compat/app';
import { auth, db, storage } from './firebase';
import {
    User, Ad, ChatMessage, ChatSession, AppNotification, Reservation,
    ReservationStatus, LocationCoords, FirestoreAdData,
    AdCreationData as FrontendAdCreationData,
    AdUpdateData as FrontendAdUpdateData,
    ChatSessionParticipant, FirebaseApiServiceType as IFirebaseApiServiceType, ReportReason
} from '../types';
import { DEFAULT_PROFILE_PHOTO } from '../constants';
import { getUserDisplayName } from '../utils/displayUtils';


const formatTimestamp = (timestamp: firebase.firestore.Timestamp | firebase.firestore.FieldValue | undefined | null ): string => {
  if (timestamp instanceof firebase.firestore.Timestamp) {
    return timestamp.toDate().toISOString();
  }
  if (timestamp === null || timestamp === undefined || timestamp instanceof firebase.firestore.FieldValue) {
    return new Date().toISOString();
  }
  return new Date(timestamp as any).toISOString();
};

const isValidId = (id: any, fieldName: string, throwOnError: boolean = true): id is string => {
  const valid = typeof id === 'string' && id.trim() !== '' && !id.includes('/') && !id.includes('..');
  if (!valid && throwOnError) {
    const errorMsg = `VALIDATION FAIL (Halting Operation): ${fieldName} ('${id}') is not a valid ID. Must be a non-empty string without '/' or '..'. Type received: ${typeof id}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  } else if (!valid) {
    console.warn(`VALIDATION WARNING (Operation Continuing): ${fieldName} ('${id}') is not a valid ID. Type received: ${typeof id}`);
  }
  return valid;
};


export const firebaseApi: IFirebaseApiServiceType = {
  // AUTHENTICATION
  login: async (email: string, pass: string): Promise<User | null> => {
    const userCredential = await auth.signInWithEmailAndPassword(email, pass);
    if (userCredential.user) {
      isValidId(userCredential.user.uid, "login.userCredential.user.uid");
      return firebaseApi.getUserById(userCredential.user.uid);
    }
    return null;
  },

  register: async (
    userData: Omit<User, 'id' | 'profilePhotoUrl'>,
    passwordInput: string,
    profilePhotoFile?: File | null
  ): Promise<User | null> => {
    const userCredential = await auth.createUserWithEmailAndPassword(userData.email, passwordInput);
    const firebaseUser = userCredential.user;

    if (firebaseUser) {
      isValidId(firebaseUser.uid, "register.firebaseUser.uid");
      let photoURL = DEFAULT_PROFILE_PHOTO;
      if (profilePhotoFile) {
        photoURL = await firebaseApi.uploadImage(profilePhotoFile, `profile_photos/${firebaseUser.uid}`);
      }

      await firebaseUser.updateProfile({
        displayName: `${userData.firstName} ${userData.lastName}`,
        photoURL: photoURL,
      });

      const newUser: User = {
        id: firebaseUser.uid,
        firstName: userData.firstName,
        lastName: userData.lastName,
        nickname: userData.nickname || undefined,
        email: firebaseUser.email || userData.email,
        profilePhotoUrl: photoURL,
      };
      await db.collection('users').doc(firebaseUser.uid).set(newUser);
      return newUser;
    }
    return null;
  },

  logout: async (): Promise<void> => {
    await auth.signOut();
  },

  // USER MANAGEMENT
  getUserById: async (userId: string): Promise<User | null> => {
    if (!isValidId(userId, "getUserById.userId", false)) {
      console.warn(`User ID '${userId}' is invalid. Attempting fallback to auth.currentUser.`);
      if (auth.currentUser && auth.currentUser.uid === userId) {
        const fbUser = auth.currentUser;
        const nameParts = fbUser.displayName?.split(" ") || [];
        return {
            id: fbUser.uid,
            firstName: nameParts[0] || 'Utente',
            lastName: nameParts.slice(1).join(' ') || '',
            nickname: undefined,
            email: fbUser.email || '',
            profilePhotoUrl: fbUser.photoURL || DEFAULT_PROFILE_PHOTO,
        };
      }
      return null;
    }
    const userDocRef = db.collection('users').doc(userId);
    const userDocSnap = await userDocRef.get();
    if (userDocSnap.exists) {
      const data = userDocSnap.data() as Omit<User, 'id'>;
      return {
        id: userDocSnap.id,
        firstName: data.firstName,
        lastName: data.lastName,
        nickname: data.nickname,
        email: data.email,
        profilePhotoUrl: data.profilePhotoUrl,
      };
    }
    if (auth.currentUser && auth.currentUser.uid === userId) {
        console.warn(`User ID: ${userId} not found in Firestore, but matches current auth user. Returning auth user data.`);
        const fbUser = auth.currentUser;
        const nameParts = fbUser.displayName?.split(" ") || [];
        return {
            id: fbUser.uid,
            firstName: nameParts[0] || 'Utente',
            lastName: nameParts.slice(1).join(' ') || '',
            nickname: undefined,
            email: fbUser.email || '',
            profilePhotoUrl: fbUser.photoURL || DEFAULT_PROFILE_PHOTO,
        };
    }
    console.warn(`User not found in Firestore for ID: ${userId}`);
    return null;
  },

  updateUserProfile: async (userId: string, updates: Partial<User>): Promise<User | null> => {
    isValidId(userId, "updateUserProfile.userId");
    const userDocRef = db.collection('users').doc(userId);
    const finalUpdates: Partial<Omit<User, 'id'>> = {...updates};
    if (updates.nickname === '' || updates.nickname === undefined || updates.nickname === null) {
        (finalUpdates as any).nickname = firebase.firestore.FieldValue.delete();
    }

    await userDocRef.set(finalUpdates, { merge: true });

    const currentUserAuth = auth.currentUser;
    if (currentUserAuth && currentUserAuth.uid === userId) {
      const authUpdates: { displayName?: string, photoURL?: string } = {};
      const currentDbUserSnap = await userDocRef.get();
      const dbUserData = currentDbUserSnap.data() as User | undefined;

      if (dbUserData) {
          authUpdates.displayName = `${dbUserData.firstName} ${dbUserData.lastName}`.trim();
      }

      if (updates.profilePhotoUrl) {
        authUpdates.photoURL = updates.profilePhotoUrl;
      }

      if (Object.keys(authUpdates).length > 0 &&
          (authUpdates.displayName !== currentUserAuth.displayName || authUpdates.photoURL !== currentUserAuth.photoURL)) {
        await currentUserAuth.updateProfile(authUpdates);
      }
    }
    return firebaseApi.getUserById(userId);
  },

  uploadImage: async (file: File, path: string): Promise<string> => {
    const safeFileNamePart = file.name.split('.').slice(0, -1).join('.').replace(/[^a-zA-Z0-9_.-]/g, '_');
    const extension = file.name.split('.').pop();
    const uniqueFileName = `${safeFileNamePart}_${Date.now()}.${extension}`;

    const storageRef = storage.ref(`${path}/${uniqueFileName}`);
    const snapshot = await storageRef.put(file);
    return snapshot.ref.getDownloadURL();
  },

  deleteImageByUrl: async (imageUrl: string): Promise<void> => {
    if (!imageUrl || !imageUrl.startsWith('https://firebasestorage.googleapis.com/')) {
        console.warn("URL immagine non valido o non di Firebase Storage:", imageUrl);
        return;
    }
    try {
        const imageRef = storage.refFromURL(imageUrl);
        await imageRef.delete();
    } catch (error: any) {
        if (error.code !== 'storage/object-not-found') {
            console.warn(`Impossibile eliminare l'immagine ${imageUrl} dallo storage:`, error);
        }
    }
  },

  getCompletedReservationsCountForUser: async (userId: string): Promise<number> => {
    isValidId(userId, "getCompletedReservationsCountForUser.userId");

    // This counts items a user has successfully received.
    const reservationsSnapshot = await db.collection('reservations')
      .where('requesterId', '==', userId)
      .where('status', '==', ReservationStatus.COMPLETED)
      .get();

    // This counts street finds a user has picked up.
    const streetFindsSnapshot = await db.collection('ads')
      .where('reservedByUserId', '==', userId)
      .where('isStreetFind', '==', true)
      .where('reservationStatus', '==', ReservationStatus.COMPLETED)
      .get();
      
    return reservationsSnapshot.size + streetFindsSnapshot.size;
  },

  // ADS
  _mapAdDataToAd: async (adDoc: firebase.firestore.QueryDocumentSnapshot | firebase.firestore.DocumentSnapshot): Promise<Ad> => {
    const adData = adDoc.data() as FirestoreAdData;
    isValidId(adData.userId, "_mapAdDataToAd.adData.userId", false);
    const user = await firebaseApi.getUserById(adData.userId);
    return {
      id: adDoc.id,
      userId: adData.userId,
      user: user || undefined,
      title: adData.title,
      description: adData.description,
      category: adData.category,
      images: adData.images || [],
      locationName: adData.locationName,
      gpsCoords: adData.gpsCoords ? { latitude: adData.gpsCoords.latitude, longitude: adData.gpsCoords.longitude } : undefined,
      postedAt: formatTimestamp(adData.postedAt),
      isReserved: adData.isReserved || false,
      reservedByUserId: adData.reservedByUserId,
      reservationStatus: adData.reservationStatus,
      tags: adData.tags || [],
      isStreetFind: adData.isStreetFind || false,
    };
  },

  getAds: async (): Promise<Ad[]> => {
    const adsCollectionRef = db.collection('ads');
    const querySnapshot = await adsCollectionRef.orderBy('postedAt', 'desc').get();

    const adsListPromises = querySnapshot.docs.map(doc => firebaseApi._mapAdDataToAd(doc));
    let allAds = await Promise.all(adsListPromises);
    
    // Filter out completed ads client-side. This ensures ads without a `reservationStatus` field are included.
    let adsList = allAds.filter(ad => ad.reservationStatus !== ReservationStatus.COMPLETED);

    // Client-side sort to ensure reserved (but not completed) are at the bottom
    adsList.sort((a, b) => {
        const aIsReserved = a.isReserved || false;
        const bIsReserved = b.isReserved || false;
        if (aIsReserved === bIsReserved) {
            return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
        }
        return aIsReserved ? 1 : -1;
    });
    return adsList;
  },

  getAdById: async (adId: string): Promise<Ad | null> => {
    isValidId(adId, "getAdById.adId");
    const adDocRef = db.collection('ads').doc(adId);
    const adDocSnap = await adDocRef.get();
    if (adDocSnap.exists) {
      return firebaseApi._mapAdDataToAd(adDocSnap);
    }
    return null;
  },

  getUserAds: async (userId: string): Promise<Ad[]> => {
    isValidId(userId, "getUserAds.userId");
    const adsCollectionRef = db.collection('ads');
    const querySnapshot = await adsCollectionRef.where('userId', '==', userId).orderBy('postedAt', 'desc').get();
    const adsListPromises = querySnapshot.docs.map(doc => firebaseApi._mapAdDataToAd(doc));
    return Promise.all(adsListPromises);
  },

  createAd: async (adData: FrontendAdCreationData): Promise<Ad | null> => {
    isValidId(adData.userId, "createAd.adData.userId");
    const adDocRef = db.collection('ads').doc();

    const firestoreWriteData: FirestoreAdData = {
      userId: adData.userId,
      title: adData.title,
      description: adData.description,
      category: adData.category,
      images: adData.images,
      locationName: adData.locationName,
      postedAt: firebase.firestore.FieldValue.serverTimestamp(),
      isReserved: false,
      tags: adData.tags && adData.tags.length > 0 ? adData.tags : [],
      isStreetFind: adData.isStreetFind || false,
    };

    if (adData.gpsCoords) {
      firestoreWriteData.gpsCoords = new firebase.firestore.GeoPoint(adData.gpsCoords.latitude, adData.gpsCoords.longitude);
    }

    await adDocRef.set(firestoreWriteData);
    const newAdSnap = await adDocRef.get();
    return firebaseApi._mapAdDataToAd(newAdSnap);
  },

  updateAd: async (
    adId: string,
    updates: FrontendAdUpdateData,
    newImageFiles: File[],
    currentImageUrls: string[],
    originalImageUrls: string[]
  ): Promise<Ad | null> => {
    isValidId(adId, "updateAd.adId");
    const adDocRef = db.collection('ads').doc(adId);

    const imagesToDeleteFromStorage = originalImageUrls.filter(
        originalUrl => !currentImageUrls.includes(originalUrl) && originalUrl.startsWith('https://firebasestorage.googleapis.com/')
    );
    for (const imageUrl of imagesToDeleteFromStorage) {
      await firebaseApi.deleteImageByUrl(imageUrl);
    }

    const uploadedNewImageUrls: string[] = [];
    if (newImageFiles.length > 0) {
        const adSnap = await adDocRef.get();
        if(!adSnap.exists) throw new Error("Annuncio non trovato per l'upload immagini.");
        const adData = adSnap.data() as FirestoreAdData;
        if(!adData || !isValidId(adData.userId, "updateAd.adData.userId (for image upload path)", false)) {
            throw new Error("Utente dell'annuncio non valido per l'upload immagini.");
        }

        for (const file of newImageFiles) {
            const newUrl = await firebaseApi.uploadImage(file, `ads_images/${adData.userId}/${adId}`);
            uploadedNewImageUrls.push(newUrl);
        }
    }

    const finalImageUrls = [
        ...currentImageUrls.filter(url => url.startsWith('https://firebasestorage.googleapis.com/')),
        ...uploadedNewImageUrls
    ];

    const firestoreUpdatePayload: { [key: string]: any } = { ...updates };
    firestoreUpdatePayload.images = finalImageUrls;
    firestoreUpdatePayload.isStreetFind = updates.isStreetFind === undefined ? false : updates.isStreetFind;
    firestoreUpdatePayload.tags = updates.tags && updates.tags.length > 0 ? updates.tags : firebase.firestore.FieldValue.delete();


    if (updates.hasOwnProperty('gpsCoords')) {
        if (updates.gpsCoords === null) { 
            firestoreUpdatePayload.gpsCoords = firebase.firestore.FieldValue.delete();
        } else if (updates.gpsCoords instanceof firebase.firestore.GeoPoint || updates.gpsCoords instanceof firebase.firestore.FieldValue) {
             firestoreUpdatePayload.gpsCoords = updates.gpsCoords;
        } else if (updates.gpsCoords) { 
             const coords = updates.gpsCoords as LocationCoords;
             firestoreUpdatePayload.gpsCoords = new firebase.firestore.GeoPoint(coords.latitude, coords.longitude);
        }
    }


    await adDocRef.update(firestoreUpdatePayload);
    return firebaseApi.getAdById(adId);
  },

  deleteAd: async (adId: string, userId: string): Promise<void> => {
    isValidId(adId, "deleteAd.adId");
    isValidId(userId, "deleteAd.userId");
    const adRef = db.collection('ads').doc(adId);
    const adSnap = await adRef.get();
    if (!adSnap.exists) throw new Error("Annuncio non trovato.");
    const adData = adSnap.data() as FirestoreAdData;
    if (adData.userId !== userId) throw new Error("Non autorizzato a eliminare questo annuncio.");

    if (adData.images && adData.images.length > 0) {
        for (const imageUrl of adData.images) {
            await firebaseApi.deleteImageByUrl(imageUrl);
        }
    }
    await adRef.delete();
  },

  // RESERVATIONS
  createReservation: async (adId: string, requesterId: string): Promise<void> => {
    isValidId(adId, "createReservation.adId");
    isValidId(requesterId, "createReservation.requesterId");

    const adRef = db.collection('ads').doc(adId);
    const adSnap = await adRef.get();
    if (!adSnap.exists) throw new Error("Annuncio non trovato.");
    const adData = adSnap.data() as FirestoreAdData;

    if (adData.isStreetFind) throw new Error("Gli oggetti trovati in strada non possono essere prenotati, solo ritirati.");
    if (adData.userId === requesterId) throw new Error("Non puoi prenotare il tuo stesso annuncio.");
    if (adData.isReserved) throw new Error("Questo annuncio è già stato prenotato.");

    const existingReservationQuery = await db.collection('reservations')
        .where('adId', '==', adId)
        .where('requesterId', '==', requesterId)
        .where('status', '==', ReservationStatus.PENDING)
        .limit(1).get();

    if (!existingReservationQuery.empty) {
        throw new Error("Hai già inviato una richiesta per questo oggetto.");
    }

    const requester = await firebaseApi.getUserById(requesterId);
    if (!requester) throw new Error("Utente richiedente non trovato.");

    const reservationRef = db.collection('reservations').doc();
    const newReservationData: Omit<Reservation, 'id' | 'requestedAt'> & { requestedAt: firebase.firestore.FieldValue } = {
      adId: adId,
      adTitle: adData.title,
      adMainImage: adData.images && adData.images.length > 0 ? adData.images[0] : '',
      requesterId: requesterId,
      requesterName: getUserDisplayName(requester),
      requesterProfilePhotoUrl: requester.profilePhotoUrl,
      ownerId: adData.userId,
      status: ReservationStatus.PENDING,
      requestedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    await reservationRef.set(newReservationData);

    isValidId(adData.userId, "createReservation.adData.userId (for notification)");
    const ownerNotification: Omit<AppNotification, 'id' | 'createdAt'> & {createdAt: firebase.firestore.FieldValue } = {
        userId: adData.userId,
        type: 'RESERVATION_REQUEST',
        title: `Nuova richiesta per "${adData.title}"`,
        message: `${getUserDisplayName(requester)} ha richiesto il tuo oggetto: "${adData.title}".`,
        relatedItemId: reservationRef.id,
        isRead: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        reservationDetails: {
            adId: adId,
            adTitle: adData.title,
            requesterName: getUserDisplayName(requester),
            reservationId: reservationRef.id,
        }
    };
    await db.collection('notifications').add(ownerNotification);
  },
  
  getReservationsForAd: async (adId: string): Promise<Reservation[]> => {
    isValidId(adId, "getReservationsForAd.adId");
    const reservationsQuery = await db.collection('reservations')
        .where('adId', '==', adId)
        .orderBy('requestedAt', 'asc')
        .get();
    
    return reservationsQuery.docs.map(doc => {
        const data = doc.data() as Omit<Reservation, 'id'|'requestedAt'> & {requestedAt: firebase.firestore.Timestamp};
        return {
            ...data,
            id: doc.id,
            requestedAt: formatTimestamp(data.requestedAt)
        };
    });
  },

  updateReservationStatus: async (reservationId: string, newStatus: ReservationStatus, currentUserId: string, originalNotificationId?: string): Promise<void> => {
    isValidId(reservationId, "updateReservationStatus.reservationId");
    isValidId(currentUserId, "updateReservationStatus.currentUserId");

    const reservationRef = db.collection('reservations').doc(reservationId);
    
    // --- Phase 1: Perform all necessary READS before creating the batch ---
    const reservationSnap = await reservationRef.get();
    if (!reservationSnap.exists) throw new Error("Prenotazione non trovata.");
    const reservationData = reservationSnap.data() as Reservation;

    if (reservationData.ownerId !== currentUserId) {
        throw new Error("Non autorizzato a modificare questa prenotazione.");
    }
    const adRef = db.collection('ads').doc(reservationData.adId);

    // --- Phase 2: Create batch and add all WRITE operations ---
    const batch = db.batch();

    // Mark original notification as read
    if (originalNotificationId && isValidId(originalNotificationId, "updateReservationStatus.originalNotificationId", false)) {
        const notifRef = db.collection('notifications').doc(originalNotificationId);
        batch.update(notifRef, { isRead: true });
    }

    if (newStatus === ReservationStatus.ACCEPTED) {
        // Additional reads for ACCEPTED case
        const otherReservationsQuery = db.collection('reservations')
            .where('adId', '==', reservationData.adId)
            .where('status', '==', ReservationStatus.PENDING);
        const otherReservationsSnap = await otherReservationsQuery.get();
        
        const sortedParticipantIds = [reservationData.ownerId, reservationData.requesterId].sort();
        const chatQuery = db.collection('chatSessions')
            .where('participantIds', '==', sortedParticipantIds)
            .where('adId', '==', reservationData.adId)
            .limit(1);
        const chatQuerySnapshot = await chatQuery.get();

        // --- Add writes to batch for ACCEPTED case ---
        batch.update(adRef, {
            isReserved: true,
            reservedByUserId: reservationData.requesterId,
            reservationStatus: ReservationStatus.ACCEPTED
        });

        let chatSessionId: string;
        if (!chatQuerySnapshot.empty) {
            const existingChatDoc = chatQuerySnapshot.docs[0];
            chatSessionId = existingChatDoc.id;
            batch.update(existingChatDoc.ref, {
                isClosed: false,
                closedByUserId: firebase.firestore.FieldValue.delete(),
                reservationWasAccepted: true
            });
        } else {
            const newChatRef = db.collection('chatSessions').doc();
            chatSessionId = newChatRef.id;
            batch.set(newChatRef, {
                participantIds: sortedParticipantIds, adId: reservationData.adId, adTitle: reservationData.adTitle,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(), isClosed: false, reservationWasAccepted: true,
            });
        }

        batch.update(reservationRef, { status: ReservationStatus.ACCEPTED, chatSessionId: chatSessionId });
        
        const acceptedNotifRef = db.collection('notifications').doc();
        batch.set(acceptedNotifRef, {
             userId: reservationData.requesterId, type: 'RESERVATION_ACCEPTED',
             title: `Prenotazione per "${reservationData.adTitle}" accettata!`,
             message: `La tua richiesta per "${reservationData.adTitle}" è stata accettata. Puoi ora chattare con il proprietario.`,
             relatedItemId: chatSessionId, isRead: false, createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });

        otherReservationsSnap.docs.forEach(doc => {
            if (doc.id !== reservationId) {
                batch.update(doc.ref, { status: ReservationStatus.DECLINED });
                const declinedNotifRef = db.collection('notifications').doc();
                batch.set(declinedNotifRef, {
                    userId: doc.data().requesterId, type: 'RESERVATION_DECLINED',
                    title: `Oggetto "${reservationData.adTitle}" non più disponibile`,
                    message: `L'oggetto "${reservationData.adTitle}" che avevi richiesto è stato assegnato ad un altro utente.`,
                    relatedItemId: reservationData.adId, isRead: false, createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                });
            }
        });

    } else if (newStatus === ReservationStatus.DECLINED) {
        batch.update(reservationRef, { status: ReservationStatus.DECLINED });
        const declinedNotifRef = db.collection('notifications').doc();
        batch.set(declinedNotifRef, {
            userId: reservationData.requesterId, type: 'RESERVATION_DECLINED',
            title: `Richiesta per "${reservationData.adTitle}" rifiutata`,
            message: `La tua richiesta per "${reservationData.adTitle}" è stata rifiutata dal proprietario.`,
            relatedItemId: reservationData.adId, isRead: false, createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
    }
    
    // --- Phase 3: Commit all writes atomically ---
    await batch.commit();
},


  claimStreetFind: async (adId: string, pickerUserId: string, adOwnerId: string, adTitle: string): Promise<Ad | null> => {
    isValidId(adId, "claimStreetFind.adId");
    isValidId(pickerUserId, "claimStreetFind.pickerUserId");
    isValidId(adOwnerId, "claimStreetFind.adOwnerId");

    const adRef = db.collection('ads').doc(adId);
    const adSnap = await adRef.get();
    if (!adSnap.exists) throw new Error("Annuncio non trovato.");
    const adData = adSnap.data() as FirestoreAdData;

    if (!adData.isStreetFind) throw new Error("Questo annuncio non è una segnalazione da strada.");
    if (adData.reservationStatus === ReservationStatus.COMPLETED) throw new Error("Questo oggetto è già stato ritirato.");

    await adRef.update({
        isReserved: true,
        reservedByUserId: pickerUserId,
        reservationStatus: ReservationStatus.COMPLETED,
    });

    const pickerUser = await firebaseApi.getUserById(pickerUserId);
    if (!pickerUser) throw new Error("Utente che ha ritirato l'oggetto non trovato.");

    const ownerNotification: Omit<AppNotification, 'id' | 'createdAt'> & {createdAt: firebase.firestore.FieldValue} = {
        userId: adOwnerId,
        type: 'STREET_FIND_PICKED_UP',
        title: `Oggetto "${adTitle}" ritirato!`,
        message: `${getUserDisplayName(pickerUser)} ha segnato il tuo oggetto "${adTitle}" come ritirato dalla strada.`,
        relatedItemId: adId,
        isRead: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    await db.collection('notifications').add(ownerNotification);

    return firebaseApi.getAdById(adId);
  },


  // CHAT
  _mapChatSessionData: async (doc: firebase.firestore.DocumentSnapshot): Promise<ChatSession> => {
    const data = doc.data() as any;
    if (!data || !Array.isArray(data.participantIds)) {
        throw new Error(`Dati sessione chat invalidi per ID: ${doc.id}`);
    }

    const participantsDataPromises = (data.participantIds as string[]).map(async (id): Promise<ChatSessionParticipant> => {
        isValidId(id, "_mapChatSessionData.participant.id", false);
        const user = await firebaseApi.getUserById(id);
        return user
            ? { id: user.id, firstName: user.firstName, lastName: user.lastName, nickname: user.nickname, profilePhotoUrl: user.profilePhotoUrl }
            : { id: id, firstName: 'Utente', lastName: 'Sconosciuto', profilePhotoUrl: DEFAULT_PROFILE_PHOTO };
      });
    const participantsData = await Promise.all(participantsDataPromises);

    return {
      id: doc.id,
      participantIds: data.participantIds,
      participants: participantsData,
      adId: data.adId,
      adTitle: data.adTitle,
      lastMessageText: data.lastMessageText,
      lastMessageTimestamp: data.lastMessageTimestamp ? formatTimestamp(data.lastMessageTimestamp) : undefined,
      createdAt: formatTimestamp(data.createdAt),
      isClosed: data.isClosed || false,
      closedByUserId: data.closedByUserId,
      reservationWasAccepted: data.reservationWasAccepted || false,
    };
  },

  createChatSession: async (participantIds: string[], adId: string, adTitle: string, reservationWasAccepted = false): Promise<ChatSession | null> => {
    if (participantIds.length !== 2) throw new Error("Le sessioni di chat devono avere due partecipanti.");
    isValidId(participantIds[0], "createChatSession.participantIds[0]");
    isValidId(participantIds[1], "createChatSession.participantIds[1]");
    isValidId(adId, "createChatSession.adId");

    const sortedParticipantIds = [...participantIds].sort();

    const querySnapshot = await db.collection('chatSessions')
      .where('participantIds', '==', sortedParticipantIds)
      .where('adId', '==', adId)
      .limit(1)
      .get();

    if (!querySnapshot.empty) {
      const existingSessionDoc = querySnapshot.docs[0];
      const existingSessionData = existingSessionDoc.data();
      if (reservationWasAccepted && !existingSessionData.reservationWasAccepted) {
        await existingSessionDoc.ref.update({ reservationWasAccepted: true, isClosed: false, closedByUserId: firebase.firestore.FieldValue.delete() });
      } else if (existingSessionData.isClosed && reservationWasAccepted) {
         await existingSessionDoc.ref.update({ isClosed: false, closedByUserId: firebase.firestore.FieldValue.delete() });
      }
      return firebaseApi._mapChatSessionData(existingSessionDoc);
    }

    const chatSessionRef = db.collection('chatSessions').doc();
    const newSessionData = {
      participantIds: sortedParticipantIds,
      adId: adId,
      adTitle: adTitle,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      isClosed: false,
      reservationWasAccepted: reservationWasAccepted,
    };
    await chatSessionRef.set(newSessionData);
    const newSessionSnap = await chatSessionRef.get();
    return firebaseApi._mapChatSessionData(newSessionSnap);
  },

  getChatSessionsStreamed: (userId: string, callback: (sessions: ChatSession[]) => void, onError: (error: Error) => void): (() => void) => {
    isValidId(userId, "getChatSessionsStreamed.userId");
    return db.collection('chatSessions')
      .where('participantIds', 'array-contains', userId)
      .orderBy('lastMessageTimestamp', 'desc')
      .onSnapshot(async snapshot => {
        try {
            const sessionsPromises = snapshot.docs.map(doc => firebaseApi._mapChatSessionData(doc));
            const sessions = await Promise.all(sessionsPromises);
            sessions.sort((a, b) => {
                const timeA = a.lastMessageTimestamp ? new Date(a.lastMessageTimestamp).getTime() : new Date(a.createdAt).getTime();
                const timeB = b.lastMessageTimestamp ? new Date(b.lastMessageTimestamp).getTime() : new Date(b.createdAt).getTime();
                return timeB - timeA;
            });
            callback(sessions);
        } catch (err) {
            onError(err as Error);
        }
      }, onError);
  },

  getChatSessionStreamedById: (chatId: string, currentUserId:string, callback: (session: ChatSession | null) => void, onError: (error: Error) => void): (() => void) => {
    isValidId(chatId, "getChatSessionStreamedById.chatId");
    isValidId(currentUserId, "getChatSessionStreamedById.currentUserId");
     return db.collection('chatSessions').doc(chatId)
        .onSnapshot(async doc => {
            if (doc.exists) {
                const session = await firebaseApi._mapChatSessionData(doc);
                if (session.participantIds.includes(currentUserId)) {
                    callback(session);
                } else {
                    callback(null);
                    onError(new Error("Accesso negato alla chat."));
                }
            } else {
                callback(null);
            }
        }, onError);
  },

  getChatMessagesStreamed: (chatId: string, currentUserId: string, callback: (messages: ChatMessage[]) => void, onError?: (error: Error) => void): (() => void) => {
    isValidId(chatId, "getChatMessagesStreamed.chatId");
    isValidId(currentUserId, "getChatMessagesStreamed.currentUserId");
    const chatSessionRef = db.collection('chatSessions').doc(chatId);

    chatSessionRef.get().then(sessionDoc => {
        if (!sessionDoc.exists || !(sessionDoc.data()?.participantIds as string[]).includes(currentUserId)) {
            if(onError) onError(new Error("Accesso negato o chat non trovata."));
            callback([]);
            return () => {}; // Should return unsubscribe function, even if empty.
        }
    }).catch(err => {
        if(onError) onError(err);
        callback([]);
        return () => {}; // Should return unsubscribe function.
    });

    return chatSessionRef.collection('messages')
      .orderBy('timestamp', 'asc')
      .limitToLast(100)
      .onSnapshot(async snapshot => {
        try {
            const messagesPromises = snapshot.docs.map(async doc => {
            const data = doc.data();
            isValidId(data.senderId, "getChatMessagesStreamed.data.senderId", false);
            return {
                id: doc.id,
                chatId: chatId,
                senderId: data.senderId,
                senderName: '...', // Name is not stored on message doc
                text: data.text,
                timestamp: formatTimestamp(data.timestamp),
                isSystemMessage: data.isSystemMessage || false
            } as ChatMessage;
            });
            const messages = await Promise.all(messagesPromises);
            callback(messages);
        } catch(err) {
            if(onError) onError(err as Error);
        }
      }, onError);
  },

  sendChatMessage: async (chatId: string, senderId: string, text: string): Promise<void> => {
    isValidId(chatId, "sendChatMessage.chatId");
    isValidId(senderId, "sendChatMessage.senderId");
    const messageData = {
      senderId: senderId,
      text: text,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    };
    await db.collection('chatSessions').doc(chatId).collection('messages').add(messageData);
    await db.collection('chatSessions').doc(chatId).update({
      lastMessageText: text,
      lastMessageTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
      isClosed: false,
      closedByUserId: firebase.firestore.FieldValue.delete()
    });

    const chatSessionSnap = await db.collection('chatSessions').doc(chatId).get();
    if (!chatSessionSnap.exists) return;

    const chatSession = await firebaseApi._mapChatSessionData(chatSessionSnap);
    const otherParticipant = chatSession.participants.find(p => p.id !== senderId);
    const sender = chatSession.participants.find(p => p.id === senderId);

    if (otherParticipant && sender && otherParticipant.id) {
        isValidId(otherParticipant.id, "sendChatMessage.otherParticipant.id (for notification)");
        const notification: Omit<AppNotification, 'id' | 'createdAt'> & {createdAt: firebase.firestore.FieldValue} = {
            userId: otherParticipant.id,
            type: 'NEW_MESSAGE',
            title: `Nuovo messaggio da ${getUserDisplayName(sender)}`,
            message: `Riguardo: "${chatSession.adTitle}"`,
            relatedItemId: chatId,
            isRead: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        };
        await db.collection('notifications').add(notification);
    }
  },

  closeChatSession: async (chatId: string, userIdClosing: string): Promise<void> => {
    isValidId(chatId, "closeChatSession.chatId");
    isValidId(userIdClosing, "closeChatSession.userIdClosing");
    const chatSessionRef = db.collection('chatSessions').doc(chatId);
    const sessionDoc = await chatSessionRef.get();
    if (!sessionDoc.exists) throw new Error("Chat non trovata.");

    const mappedSessionData = await firebaseApi._mapChatSessionData(sessionDoc);
    if (!mappedSessionData.participantIds.includes(userIdClosing)) {
        throw new Error("Non autorizzato a chiudere questa chat.");
    }

    await chatSessionRef.update({
      isClosed: true,
      closedByUserId: userIdClosing,
      lastMessageText: "Chat chiusa.",
      lastMessageTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });
  },

  completeExchangeAndCloseChat: async (chatId: string, userIdCompleting: string): Promise<void> => {
    isValidId(chatId, "completeExchangeAndCloseChat.chatId");
    isValidId(userIdCompleting, "completeExchangeAndCloseChat.userIdCompleting");

    const chatSessionRef = db.collection('chatSessions').doc(chatId);
    
    return db.runTransaction(async (transaction) => {
      const sessionDoc = await transaction.get(chatSessionRef);
      if (!sessionDoc.exists) throw new Error("Chat non trovata.");
      const sessionData = sessionDoc.data() as ChatSession;

      if (!sessionData.participantIds.includes(userIdCompleting)) {
        throw new Error("Non autorizzato a completare questo scambio.");
      }

      const adRef = db.collection('ads').doc(sessionData.adId);
      const adDoc = await transaction.get(adRef);
      if (!adDoc.exists) throw new Error("Annuncio associato non trovato.");

      // Find the reservation associated with this ad and accepted user.
      const reservationDocs = await db.collection('reservations')
                                .where('adId', '==', sessionData.adId)
                                .where('status', '==', ReservationStatus.ACCEPTED)
                                .limit(1).get();
      
      if (reservationDocs.empty) {
        console.warn(`Nessuna prenotazione ACCETTATA trovata per l'annuncio ${sessionData.adId} durante il completamento.`);
      }

      // Update Ad
      transaction.update(adRef, { reservationStatus: ReservationStatus.COMPLETED });

      // Update Reservation
      if (!reservationDocs.empty) {
        const reservationDoc = reservationDocs.docs[0];
        transaction.update(reservationDoc.ref, { status: ReservationStatus.COMPLETED });
      }

      // Update Chat
      const lastMessageText = "Scambio completato!";
      transaction.update(chatSessionRef, {
        isClosed: true,
        closedByUserId: userIdCompleting,
        lastMessageText: lastMessageText,
        lastMessageTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });

      // Add a system message to the chat
      const systemMessageRef = chatSessionRef.collection('messages').doc();
      transaction.set(systemMessageRef, {
        text: lastMessageText,
        senderId: 'system',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        isSystemMessage: true,
      });

      // Send notifications to both participants
      sessionData.participantIds.forEach(participantId => {
        const notificationRef = db.collection('notifications').doc();
        const notification: Omit<AppNotification, 'id' | 'createdAt'> & {createdAt: firebase.firestore.FieldValue} = {
            userId: participantId,
            type: 'EXCHANGE_COMPLETED',
            title: `Scambio per "${sessionData.adTitle}" completato!`,
            message: `Lo scambio per l'oggetto "${sessionData.adTitle}" è stato segnato come completato.`,
            relatedItemId: sessionData.adId,
            isRead: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        };
        transaction.set(notificationRef, notification);
      });
    });
  },

  // NOTIFICATIONS
   _mapNotificationData: (doc: firebase.firestore.DocumentSnapshot): AppNotification => {
    const data = doc.data() as any;
    return {
      id: doc.id,
      ...data,
      createdAt: formatTimestamp(data.createdAt),
    } as AppNotification;
  },

  getNotificationsStreamed: (userId: string, callback: (notifications: AppNotification[]) => void, onError: (error: Error) => void): (() => void) => {
    isValidId(userId, "getNotificationsStreamed.userId");
    return db.collection('notifications')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .onSnapshot(snapshot => {
        const notifications = snapshot.docs.map(firebaseApi._mapNotificationData);
        callback(notifications);
      }, onError);
  },

  getUnreadNotificationsCountStreamed: (userId: string, callback: (count: number) => void, onError?: (error: Error) => void): (() => void) => {
    isValidId(userId, "getUnreadNotificationsCountStreamed.userId");
    return db.collection('notifications')
      .where('userId', '==', userId)
      .where('isRead', '==', false)
      .onSnapshot(snapshot => {
        callback(snapshot.size);
      }, onError);
  },

  markNotificationAsRead: async (notificationId: string, userId: string): Promise<void> => {
    isValidId(notificationId, "markNotificationAsRead.notificationId");
    isValidId(userId, "markNotificationAsRead.userId", false);

    const notificationRef = db.collection('notifications').doc(notificationId);
    const snap = await notificationRef.get();
    if (snap.exists && snap.data()?.userId === userId) {
       await notificationRef.update({ isRead: true });
    } else if (snap.exists && snap.data()?.userId !== userId) {
        console.warn(`Attempt to mark notification ${notificationId} as read by user ${userId}, but it belongs to ${snap.data()?.userId}`);
    } else {
        console.warn(`Notification ${notificationId} not found for marking as read.`);
    }
  },

  createReport: async (adId: string, reporterId: string, adOwnerId: string, adTitle: string, reason: ReportReason, details: string): Promise<void> => {
    isValidId(adId, "createReport.adId");
    isValidId(reporterId, "createReport.reporterId");
    isValidId(adOwnerId, "createReport.adOwnerId");
    
    const reportRef = db.collection('reports').doc();
    const reportData = {
      adId,
      reporterId,
      adOwnerId,
      adTitle,
      reason,
      details,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'PENDING', // PENDING, REVIEWED, RESOLVED
    };
    await reportRef.set(reportData);

    // Send notifications
    const reporterNotification: Omit<AppNotification, 'id' | 'createdAt'> & { createdAt: firebase.firestore.FieldValue } = {
        userId: reporterId,
        type: 'AD_REPORTED_CONFIRMATION',
        title: `Segnalazione per "${adTitle}" inviata`,
        message: 'Grazie per averci aiutato a mantenere la community sicura. Esamineremo la tua segnalazione.',
        relatedItemId: adId,
        isRead: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    await db.collection('notifications').add(reporterNotification);
    
    // Notify owner unless it's a safety concern to avoid retaliation
    if (reason !== ReportReason.SAFETY_CONCERN) {
        const ownerNotification: Omit<AppNotification, 'id' | 'createdAt'> & { createdAt: firebase.firestore.FieldValue } = {
            userId: adOwnerId,
            type: 'OWNER_AD_REPORTED',
            title: `Il tuo annuncio "${adTitle}" è stato segnalato`,
            message: 'Un utente ha segnalato il tuo annuncio. Il nostro team lo esaminerà presto.',
            relatedItemId: adId,
            isRead: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        };
        await db.collection('notifications').add(ownerNotification);
    }
  },

  // LOCATION HELPERS
  getCurrentLocation: (): Promise<LocationCoords> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocalizzazione non supportata dal browser."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          // Mock address, replace with actual reverse geocoding if needed
          const address = `Lat: ${latitude.toFixed(4)}, Lon: ${longitude.toFixed(4)}`;
          resolve({ latitude, longitude, address });
        },
        (error) => {
          let message = "Errore sconosciuto GPS.";
          switch(error.code) {
            case error.PERMISSION_DENIED: message = "Permesso geolocalizzazione negato."; break;
            case error.POSITION_UNAVAILABLE: message = "Informazioni posizione non disponibili."; break;
            case error.TIMEOUT: message = "Timeout richiesta geolocalizzazione."; break;
          }
          reject(new Error(message));
        },
        { timeout: 10000, enableHighAccuracy: false }
      );
    });
  },

  geocodeAddress: async (address: string): Promise<LocationCoords | null> => {
    console.warn("geocodeAddress is a MOCK function. For real geocoding, integrate a proper service like Google Geocoding API or Nominatim (OpenStreetMap).");
    if (address.toLowerCase().includes("milano")) {
      return { latitude: 45.4642, longitude: 9.1900, address: `Simulato: ${address}` };
    } else if (address.toLowerCase().includes("roma")) {
      return { latitude: 41.9028, longitude: 12.4964, address: `Simulato: ${address}` };
    }
    return null;
  },
  
  getAddressSuggestions: async (query: string): Promise<{ description: string; latitude: number; longitude: number; }[]> => {
    console.warn("getAddressSuggestions is a MOCK function.");
    if (!query || query.trim().length < 3) return [];

    const mockResults = [
        { description: `Via ${query} 1, Milano, Italia`, latitude: 45.4642, longitude: 9.1900 },
        { description: `Piazza ${query}, Roma, Italia`, latitude: 41.9028, longitude: 12.4964 },
        { description: `Corso ${query}, Napoli, Italia`, latitude: 40.8518, longitude: 14.2681 },
    ];
    // Simple filter to make it look like it's working
    return mockResults.filter(r => r.description.toLowerCase().includes(query.toLowerCase()));
  },
};
