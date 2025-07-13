import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';
import { firebaseConfig } from './firebaseConfig'; 

let app: firebase.app.App;
let authInstance: firebase.auth.Auth;
let dbInstance: firebase.firestore.Firestore;
let storageInstance: firebase.storage.Storage;

try {
  if (!firebase.apps.length) {
    app = firebase.initializeApp(firebaseConfig);
  } else {
    app = firebase.app(); 
  }
  authInstance = firebase.auth();
  dbInstance = firebase.firestore();
  storageInstance = firebase.storage();
} catch (error) {
  console.error("Error initializing Firebase:", error);
  console.error("Please ensure you have populated services/firebaseConfig.ts with your actual Firebase project configuration.");
  // In a real app, you might want to display a user-friendly message or halt execution.
  // For this exercise, we'll re-throw to make it visible in console.
  throw error; 
}

// Export the initialized instances
export { app, authInstance as auth, dbInstance as db, storageInstance as storage };