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
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, pass);
        if (userCredential.user) {
        isValidId(userCredential.user.uid, "login.userCredential.user.uid");
        return firebaseApi.getUserById(userCredential.user.uid);
        }
        return null;
    } catch(error: any) {
        if(error.code === 'auth/invalid-credential') {
            throw new Error("Email o password non corretti. Riprova.");
        }
        throw new Error("Si è verificato un errore durante il login.");
    }
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
      console.warn(`User ID '${userId}' is invalid.`);
      return null;
    }
    const userDocRef = db.collection('users').doc(userId);
    const userDocSnap = await userDocRef.get();
    if (userDocSnap.exists) {
      const data = userDocSnap.data() as Omit<User, 'id'>;
      return { id: userDocSnap.id, ...data };
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

  // ADS
  _mapAdDataToAd: async (adDoc: firebase.firestore.QueryDocumentSnapshot | firebase.firestore.DocumentSnapshot): Promise<Ad | null> => {
    const adData = adDoc.data() as FirestoreAdData;
    if(adData.reservationStatus === ReservationStatus.COMPLETED) {
        return null;
    }

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
      waitingListUserIds: adData.waitingListUserIds || [],
      tags: adData.tags || [],
      isStreetFind: adData.isStreetFind || false,
    };
  },

  getAds: async (): Promise<Ad[]> => {
    const adsCollectionRef = db.collection('ads');
    const querySnapshot = await adsCollectionRef
      .where('reservationStatus', '!=', ReservationStatus.COMPLETED)
      .orderBy('reservationStatus') 
      .orderBy('postedAt', 'desc')
      .get();
    
    const adsListPromises = querySnapshot.docs.map(doc => firebaseApi._mapAdDataToAd(doc));
    const adsList = (await Promise.all(adsListPromises)).filter((ad): ad is Ad => ad !== null);
    
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
    const adsListPromises = querySnapshot.docs.map(async doc => {
        const adData = doc.data() as FirestoreAdData;
        const user = await firebaseApi.getUserById(adData.userId);
        return {
          id: doc.id,
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
          waitingListUserIds: adData.waitingListUserIds || [],
          tags: adData.tags || [],
          isStreetFind: adData.isStreetFind || false,
        };
    });
    return Promise.all(adsListPromises);
  },

   getCompletedReservationsCountForUser: async (userId: string): Promise<number> => {
    isValidId(userId, "getCompletedReservationsCountForUser.userId");

    const givenAwaySnapshot = await db.collection('ads')
      .where('userId', '==', userId)
      .where('reservationStatus', '==', ReservationStatus.COMPLETED)
      .get();

    const pickedUpSnapshot = await db.collection('ads')
      .where('reservedByUserId', '==', userId)
      .where('reservationStatus', '==', ReservationStatus.COMPLETED)
      .get();
      
    const completedAdIds = new Set<string>();
    givenAwaySnapshot.forEach(doc => completedAdIds.add(doc.id));
    pickedUpSnapshot.forEach(doc => completedAdIds.add(doc.id));

    return completedAdIds.size;
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
      waitingListUserIds: [],
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

    if (!adData.isStreetFind && adData.isReserved && adData.reservationStatus === ReservationStatus.ACCEPTED) {
        throw new Error("Impossibile eliminare un annuncio con una prenotazione attiva accettata.");
    }

    if (adData.images && adData.images.length > 0) {
        for (const imageUrl of adData.images) {
            await firebaseApi.deleteImageByUrl(imageUrl);
        }
    }
    await adRef.delete();
  },

  // RESERVATIONS
  createReservation: async (adId: string, requesterId: string): Promise<Ad | null> => {
    isValidId(adId, "createReservation.adId");
    isValidId(requesterId, "createReservation.requesterId");

    const adRef = db.collection('ads').doc(adId);
    const requesterRef = db.collection('users').doc(requesterId);

    await db.runTransaction(async (transaction) => {
      // --- ALL READS FIRST ---
      const adSnap = await transaction.get(adRef);
      const requesterSnap = await transaction.get(requesterRef);

      if (!adSnap.exists) throw new Error("Annuncio non trovato.");
      if (!requesterSnap.exists) throw new Error("Utente richiedente non trovato.");

      const adData = adSnap.data() as FirestoreAdData;
      const requester = { id: requesterSnap.id, ...requesterSnap.data() } as User;

      // --- VALIDATION ---
      if (adData.isStreetFind) throw new Error("Gli oggetti trovati in strada non possono essere prenotati, solo ritirati.");
      if (adData.userId === requesterId) throw new Error("Non puoi prenotare il tuo stesso annuncio.");
      if (adData.isReserved) {
        throw new Error("Questo annuncio è già stato prenotato o ha una richiesta in sospeso. Prova ad unirti alla lista d'attesa.");
      }

      // --- ALL WRITES LAST ---
      const reservationRef = db.collection('reservations').doc();
      const newReservationData: Omit<Reservation, 'id' | 'requestedAt'> & { requestedAt: firebase.firestore.FieldValue } = {
        adId: adId,
        adTitle: adData.title,
        adMainImage: adData.images && adData.images.length > 0 ? adData.images[0] : '',
        requesterId: requesterId,
        requesterName: getUserDisplayName(requester),
        ownerId: adData.userId,
        status: ReservationStatus.PENDING,
        requestedAt: firebase.firestore.FieldValue.serverTimestamp(),
      };
      transaction.set(reservationRef, newReservationData);
      
      transaction.update(adRef, {
        isReserved: true,
        reservedByUserId: requesterId,
        reservationStatus: ReservationStatus.PENDING
      });

      const ownerNotificationRef = db.collection('notifications').doc();
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
      transaction.set(ownerNotificationRef, ownerNotification);
    });

    return firebaseApi.getAdById(adId);
  },
  
  joinWaitingList: async (adId: string, userId: string): Promise<Ad | null> => {
    isValidId(adId, "joinWaitingList.adId");
    isValidId(userId, "joinWaitingList.userId");

    const adRef = db.collection('ads').doc(adId);
    const userRef = db.collection('users').doc(userId);

    await db.runTransaction(async (transaction) => {
      // --- ALL READS FIRST ---
      const adSnap = await transaction.get(adRef);
      const userSnap = await transaction.get(userRef);

      if (!adSnap.exists) throw new Error("Annuncio non trovato.");
      if (!userSnap.exists) throw new Error("Utente non trovato.");

      const adData = adSnap.data() as FirestoreAdData;
      const user = { id: userSnap.id, ...userSnap.data() } as User;

      // --- VALIDATION ---
      if (adData.isStreetFind) throw new Error("Non è possibile unirsi alla lista d'attesa per oggetti trovati in strada.");
      if (adData.userId === userId) throw new Error("Non puoi metterti in lista d'attesa per il tuo annuncio.");
      if (adData.reservedByUserId === userId) throw new Error("Hai già una richiesta attiva per questo annuncio.");
      if (adData.waitingListUserIds?.includes(userId)) throw new Error("Sei già in lista d'attesa.");
      if (adData.reservationStatus === ReservationStatus.COMPLETED) throw new Error("Questo oggetto è già stato consegnato/ritirato.");
      if (!adData.isReserved) throw new Error("Questo oggetto non è ancora prenotato, puoi effettuare una prenotazione diretta.");

      // --- ALL WRITES LAST ---
      transaction.update(adRef, {
        waitingListUserIds: firebase.firestore.FieldValue.arrayUnion(userId)
      });

      const joinerNotificationRef = db.collection('notifications').doc();
      const joinerNotification: Omit<AppNotification, 'id' | 'createdAt'> & {createdAt: firebase.firestore.FieldValue} = {
        userId: userId,
        type: 'WAITING_LIST_JOINED',
        title: `Ti sei unito alla lista d'attesa per "${adData.title}"`,
        message: `Sei stato aggiunto alla lista d'attesa. Ti avviseremo se diventi il prossimo in linea.`,
        relatedItemId: adId,
        isRead: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      };
      transaction.set(joinerNotificationRef, joinerNotification);

      const ownerNotificationRef = db.collection('notifications').doc();
      const ownerNotification: Omit<AppNotification, 'id' | 'createdAt'> & {createdAt: firebase.firestore.FieldValue} = {
        userId: adData.userId,
        type: 'OWNER_WAITING_LIST_UPDATE',
        title: `Nuovo utente in lista d'attesa per "${adData.title}"`,
        message: `${getUserDisplayName(user)} si è unito alla lista d'attesa per il tuo oggetto: "${adData.title}".`,
        relatedItemId: adId,
        isRead: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      };
      transaction.set(ownerNotificationRef, ownerNotification);
    });

    return firebaseApi.getAdById(adId);
  },

  updateReservationStatus: async (reservationId: string, newStatus: ReservationStatus, currentUserId: string, originalNotificationId?: string): Promise<Reservation | null> => {
    isValidId(reservationId, "updateReservationStatus.reservationId");
    isValidId(currentUserId, "updateReservationStatus.currentUserId");

    const reservationRef = db.collection('reservations').doc(reservationId);

    // Perform the chat query OUTSIDE the transaction to avoid the typing issue with transaction.get(query)
    let existingChatDocId: string | null = null;
    if (newStatus === ReservationStatus.ACCEPTED) {
        // We need the reservation data to build the query, so we do an initial read here.
        // It will be re-read inside the transaction for consistency.
        const initialReservationSnap = await reservationRef.get();
        if (initialReservationSnap.exists) {
            const initialReservationData = initialReservationSnap.data() as Reservation;
            const sortedParticipantIds = [initialReservationData.ownerId, initialReservationData.requesterId].sort();
            const chatQuery = db.collection('chatSessions')
                .where('participantIds', '==', sortedParticipantIds)
                .where('adId', '==', initialReservationData.adId)
                .limit(1);
            const chatQuerySnapshot = await chatQuery.get();
            if (!chatQuerySnapshot.empty) {
                existingChatDocId = chatQuerySnapshot.docs[0].id;
            }
        }
    }
    
    await db.runTransaction(async (transaction) => {
        // --- TRANSACTION READS ---
        const reservationSnap = await transaction.get(reservationRef);
        if (!reservationSnap.exists) throw new Error("Prenotazione non trovata.");
        const reservationData = reservationSnap.data() as Reservation;

        const adRef = db.collection('ads').doc(reservationData.adId);
        const adSnap = await transaction.get(adRef);
        if (!adSnap.exists) throw new Error("Annuncio correlato non trovato.");
        const adData = adSnap.data() as FirestoreAdData;
        
        let nextRequesterSnap: firebase.firestore.DocumentSnapshot | null = null;
        const adWaitingList = adData.waitingListUserIds || [];
        if (newStatus === ReservationStatus.DECLINED && adWaitingList.length > 0) {
            const nextUserId = adWaitingList[0];
            const nextRequesterRef = db.collection('users').doc(nextUserId);
            nextRequesterSnap = await transaction.get(nextRequesterRef);
        }

        // Re-read chat document inside transaction if it was found
        if (existingChatDocId) {
            const chatDocRef = db.collection('chatSessions').doc(existingChatDocId);
            await transaction.get(chatDocRef); // This ensures the transaction is aware of the chat doc's state
        }
        
        // --- VALIDATION ---
        if (reservationData.ownerId !== currentUserId) {
          throw new Error("Non autorizzato a modificare questa prenotazione.");
        }

        // --- TRANSACTION WRITES ---
        transaction.update(reservationRef, { status: newStatus });

        if (originalNotificationId && isValidId(originalNotificationId, "updateReservationStatus.originalNotificationId", false)) {
            const notifRef = db.collection('notifications').doc(originalNotificationId);
            transaction.update(notifRef, { isRead: true });
        }

        let adUpdate: { [key: string]: any } = { reservationStatus: newStatus };
        let notificationType: AppNotification['type'] | null = null;
        let notificationTitle = '';
        let notificationMessage = '';
        let notificationRelatedItemId: string | undefined;

        if (newStatus === ReservationStatus.ACCEPTED) {
          adUpdate.isReserved = true;
          adUpdate.reservedByUserId = reservationData.requesterId;
          
          let chatSessionId: string;
            if (existingChatDocId) {
                const existingChatDocRef = db.collection('chatSessions').doc(existingChatDocId);
                chatSessionId = existingChatDocRef.id;
                transaction.update(existingChatDocRef, {
                    isClosed: false,
                    closedByUserId: firebase.firestore.FieldValue.delete(),
                    reservationWasAccepted: true,
                    reservationId: reservationId,
                });
            } else {
                const newChatRef = db.collection('chatSessions').doc();
                chatSessionId = newChatRef.id;
                const sortedParticipantIds = [reservationData.ownerId, reservationData.requesterId].sort();
                transaction.set(newChatRef, {
                    participantIds: sortedParticipantIds,
                    adId: reservationData.adId,
                    adTitle: reservationData.adTitle,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    isClosed: false,
                    reservationWasAccepted: true,
                    reservationId: reservationId,
                });
            }

          notificationRelatedItemId = chatSessionId;
          transaction.update(reservationRef, { chatSessionId: chatSessionId });
          
          notificationType = 'RESERVATION_ACCEPTED';
          notificationTitle = `Prenotazione per "${reservationData.adTitle}" accettata!`;
          notificationMessage = `La tua richiesta per "${reservationData.adTitle}" è stata accettata. Puoi ora chattare con il proprietario.`;

        } else if (newStatus === ReservationStatus.DECLINED) {
            if (nextRequesterSnap && nextRequesterSnap.exists) {
                const nextUserId = adWaitingList[0];
                const remainingWaitingList = adWaitingList.slice(1);
                const nextRequester = { id: nextRequesterSnap.id, ...nextRequesterSnap.data() } as User;
                
                const newReservationRef = db.collection('reservations').doc();
                const newReservationData: Omit<Reservation, 'id' | 'requestedAt'> & { requestedAt: firebase.firestore.FieldValue } = {
                    adId: reservationData.adId, adTitle: adData.title, adMainImage: adData.images?.[0] || '',
                    requesterId: nextUserId, requesterName: getUserDisplayName(nextRequester),
                    ownerId: adData.userId, status: ReservationStatus.PENDING,
                    requestedAt: firebase.firestore.FieldValue.serverTimestamp(),
                };
                transaction.set(newReservationRef, newReservationData);

                adUpdate = {
                    isReserved: true,
                    reservedByUserId: nextUserId,
                    reservationStatus: ReservationStatus.PENDING,
                    waitingListUserIds: remainingWaitingList,
                };

                const ownerNotifRef = db.collection('notifications').doc();
                transaction.set(ownerNotifRef, {
                    userId: adData.userId, type: 'PROMOTED_FROM_WAITING_LIST',
                    title: `Nuova richiesta da lista d'attesa`,
                    message: `${getUserDisplayName(nextRequester)} è ora il primo in coda per "${adData.title}".`,
                    relatedItemId: newReservationRef.id, isRead: false, createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    reservationDetails: { adId: reservationData.adId, adTitle: adData.title, requesterName: getUserDisplayName(nextRequester), reservationId: newReservationRef.id }
                });

            } else {
                adUpdate = {
                    isReserved: false,
                    reservedByUserId: firebase.firestore.FieldValue.delete(),
                    reservationStatus: firebase.firestore.FieldValue.delete(),
                    waitingListUserIds: firebase.firestore.FieldValue.delete(),
                };
            }

            notificationType = 'RESERVATION_DECLINED';
            notificationTitle = `Prenotazione per "${reservationData.adTitle}" rifiutata`;
            notificationMessage = `La tua richiesta per "${reservationData.adTitle}" è stata rifiutata.`;
            notificationRelatedItemId = reservationData.adId;
        }

        transaction.update(adRef, adUpdate);

        if (notificationType && notificationRelatedItemId) {
          isValidId(reservationData.requesterId, "updateReservationStatus.requesterId (for notification)");
          const requesterNotificationRef = db.collection('notifications').doc();
          const requesterNotification: Omit<AppNotification, 'id' | 'createdAt'> & {createdAt: firebase.firestore.FieldValue} = {
            userId: reservationData.requesterId,
            type: notificationType,
            title: notificationTitle,
            message: notificationMessage,
            relatedItemId: notificationRelatedItemId,
            isRead: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            reservationDetails: { adId: reservationData.adId, adTitle: reservationData.adTitle, requesterName: reservationData.requesterName, reservationId: reservationId }
          };
          transaction.set(requesterNotificationRef, requesterNotification);
        }
    });

    const updatedReservationSnap = await reservationRef.get();
    if(!updatedReservationSnap.exists) return null;
    const updatedData = updatedReservationSnap.data() as Omit<Reservation, 'id'>;
    return { ...updatedData, id: updatedReservationSnap.id, requestedAt: formatTimestamp(updatedData.requestedAt as any) };
  },

  claimStreetFind: async (adId: string, pickerUserId: string, adOwnerId: string, adTitle: string): Promise<Ad | null> => {
    isValidId(adId, "claimStreetFind.adId");
    isValidId(pickerUserId, "claimStreetFind.pickerUserId");
    isValidId(adOwnerId, "claimStreetFind.adOwnerId");
    
    const adRef = db.collection('ads').doc(adId);
    const pickerUserRef = db.collection('users').doc(pickerUserId);

    await db.runTransaction(async (transaction) => {
        // --- ALL READS FIRST ---
        const adSnap = await transaction.get(adRef);
        const pickerUserSnap = await transaction.get(pickerUserRef);

        if (!adSnap.exists) throw new Error("Annuncio non trovato.");
        if (!pickerUserSnap.exists) throw new Error("Utente che ha ritirato l'oggetto non trovato.");

        const adData = adSnap.data() as FirestoreAdData;
        const pickerUser = { id: pickerUserSnap.id, ...pickerUserSnap.data() } as User;

        // --- VALIDATION ---
        if (!adData.isStreetFind) throw new Error("Questo annuncio non è una segnalazione da strada.");
        if (adData.reservationStatus === ReservationStatus.COMPLETED) throw new Error("Questo oggetto è già stato ritirato.");

        // --- ALL WRITES LAST ---
        transaction.update(adRef, {
            isReserved: true,
            reservedByUserId: pickerUserId,
            reservationStatus: ReservationStatus.COMPLETED,
        });

        const ownerNotificationRef = db.collection('notifications').doc();
        const ownerNotification: Omit<AppNotification, 'id' | 'createdAt'> & {createdAt: firebase.firestore.FieldValue} = {
            userId: adOwnerId,
            type: 'STREET_FIND_PICKED_UP',
            title: `Oggetto "${adTitle}" ritirato!`,
            message: `${getUserDisplayName(pickerUser)} ha segnato il tuo oggetto "${adTitle}" come ritirato dalla strada.`,
            relatedItemId: adId,
            isRead: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        };
        transaction.set(ownerNotificationRef, ownerNotification);
    });

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
      reservationId: data.reservationId,
    };
  },

  createChatSession: async (participantIds: string[], adId: string, adTitle: string, reservationId?: string, reservationWasAccepted = false): Promise<ChatSession | null> => {
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
      const updates: { [key:string]: any } = {};

      if (reservationWasAccepted && !existingSessionData.reservationWasAccepted) {
        updates.reservationWasAccepted = true;
      }
      if (existingSessionData.isClosed) {
         updates.isClosed = false;
         updates.closedByUserId = firebase.firestore.FieldValue.delete();
      }
      if(Object.keys(updates).length > 0) {
        await existingSessionDoc.ref.update(updates);
      }
      return firebaseApi._mapChatSessionData(existingSessionDoc);
    }

    const chatSessionRef = db.collection('chatSessions').doc();
    const newSessionData: { [key:string]: any } = {
      participantIds: sortedParticipantIds,
      adId: adId,
      adTitle: adTitle,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      isClosed: false,
      reservationWasAccepted: reservationWasAccepted,
    };
    if (reservationId) {
        newSessionData.reservationId = reservationId;
    }
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
            let sessions = await Promise.all(sessionsPromises);
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

    // Initial check for access
    chatSessionRef.get().then(sessionDoc => {
        if (!sessionDoc.exists || !(sessionDoc.data()?.participantIds as string[]).includes(currentUserId)) {
            if(onError) onError(new Error("Accesso negato o chat non trovata."));
            callback([]);
            return () => {};
        }
    }).catch(err => {
        if(onError) onError(err);
        callback([]);
        return () => {};
    });

    return chatSessionRef.collection('messages')
      .orderBy('timestamp', 'asc')
      .limitToLast(100)
      .onSnapshot(async snapshot => {
        try {
            const messagesPromises = snapshot.docs.map(async doc => {
            const data = doc.data();
            const sender = data.isSystemMessage ? null : await firebaseApi.getUserById(data.senderId);
            return {
                id: doc.id,
                chatId: chatId,
                senderId: data.senderId,
                senderName: sender ? getUserDisplayName(sender) : 'Sistema',
                senderProfilePhotoUrl: sender?.profilePhotoUrl || DEFAULT_PROFILE_PHOTO,
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
    
    await db.runTransaction(async (transaction) => {
        const sessionDoc = await transaction.get(chatSessionRef);
        if (!sessionDoc.exists) throw new Error("Chat non trovata.");

        const mappedSessionData = await firebaseApi._mapChatSessionData(sessionDoc);
        if (!mappedSessionData.participantIds.includes(userIdClosing)) {
            throw new Error("Non autorizzato a chiudere questa chat.");
        }

        const systemMessage = "Chat chiusa dall'utente. Non è più possibile inviare messaggi.";
        const messageData = {
            senderId: 'system',
            text: systemMessage,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            isSystemMessage: true,
        };
        const newMessageRef = chatSessionRef.collection('messages').doc();
        transaction.set(newMessageRef, messageData);
        
        transaction.update(chatSessionRef, {
            isClosed: true,
            closedByUserId: userIdClosing,
            lastMessageText: systemMessage,
            lastMessageTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
        });
    });
  },
  
  completeExchangeAndCloseChat: async (chatId: string, userIdCompleting: string): Promise<void> => {
    isValidId(chatId, "completeExchangeAndCloseChat.chatId");
    isValidId(userIdCompleting, "completeExchangeAndCloseChat.userIdCompleting");
    const chatSessionRef = db.collection('chatSessions').doc(chatId);

    await db.runTransaction(async (transaction) => {
        const sessionDoc = await transaction.get(chatSessionRef);
        if (!sessionDoc.exists) throw new Error("Chat non trovata.");
        
        const chatData = sessionDoc.data() as ChatSession;
        if (!chatData.participantIds.includes(userIdCompleting)) {
            throw new Error("Non autorizzato a completare questo scambio.");
        }

        const adRef = db.collection('ads').doc(chatData.adId);
        const adSnap = await transaction.get(adRef);
        if (!adSnap.exists) throw new Error("Annuncio associato non trovato.");

        // Update ad to COMPLETED
        transaction.update(adRef, { reservationStatus: ReservationStatus.COMPLETED });

        // Add system message
        const systemMessage = "Scambio completato! Questa chat è stata chiusa.";
        const messageData = {
            senderId: 'system',
            text: systemMessage,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            isSystemMessage: true,
        };
        const newMessageRef = chatSessionRef.collection('messages').doc();
        transaction.set(newMessageRef, messageData);

        // Update and close chat
        transaction.update(chatSessionRef, {
            isClosed: true,
            closedByUserId: userIdCompleting,
            lastMessageText: systemMessage,
            lastMessageTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
        });

        // Send notifications
        const otherParticipantId = chatData.participantIds.find(id => id !== userIdCompleting);
        const completer = await firebaseApi.getUserById(userIdCompleting);
        if (otherParticipantId && completer) {
            const notifRef = db.collection('notifications').doc();
            const notification: Omit<AppNotification, 'id' | 'createdAt'> & {createdAt: firebase.firestore.FieldValue} = {
                userId: otherParticipantId,
                type: 'EXCHANGE_COMPLETED',
                title: `Scambio per "${chatData.adTitle}" completato`,
                message: `${getUserDisplayName(completer)} ha segnato lo scambio come completato.`,
                relatedItemId: chatData.adId,
                isRead: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            };
            transaction.set(notifRef, notification);
        }
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
  
  // REPORTS
  createReport: async (adId: string, reporterId: string, adOwnerId: string, adTitle: string, reason: ReportReason, details: string): Promise<void> => {
    isValidId(adId, "createReport.adId");
    isValidId(reporterId, "createReport.reporterId");

    const reportRef = db.collection('reports').doc();
    await reportRef.set({
      adId,
      adTitle,
      reporterId,
      adOwnerId,
      reason,
      details,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'new' // 'new', 'in_review', 'resolved'
    });
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
          resolve({ latitude, longitude });
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

  getAddressSuggestions: async (query: string): Promise<{ description: string; latitude: number; longitude: number; }[]> => {
    if (query.length < 3) return [];
    
    const endpoint = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&countrycodes=it&limit=5`;

    try {
      const response = await fetch(endpoint, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Stoop/1.0 (stoop-app.web.app)',
        }
      });
      if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.statusText}`);
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        return [];
      }
      return data.map(item => ({
        description: item.display_name,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
      }));
    } catch (error) {
      console.error("Error fetching address suggestions from Nominatim:", error);
      return [];
    }
  },

  geocodeAddress: async (address: string): Promise<LocationCoords | null> => {
    if (!address.trim()) return null;

    const endpoint = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=jsonv2&countrycodes=it&limit=1`;
    
    try {
      const response = await fetch(endpoint, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Stoop/1.0 (stoop.web.app)',
        }
      });
       if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.statusText}`);
      }
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        const result = data[0];
        return {
          latitude: parseFloat(result.lat),
          longitude: parseFloat(result.lon),
          address: result.display_name,
        };
      }
      return null;
    } catch (error) {
      console.error(`Error geocoding address "${address}" with Nominatim:`, error);
      return null;
    }
  },
};