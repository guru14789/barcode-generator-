
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  cache: {
    type: 'indexeddb',
    synchronizeTabs: true
  }
});
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Sign in anonymously to allow Firestore access if rules require authentication
// IMPORTANT: You must enable 'Anonymous' provider in Firebase Console > Authentication > Sign-in method
signInAnonymously(auth).catch((error) => {
  if (error.code === 'auth/configuration-not-found') {
    console.warn(
      "Firebase Anonymous Auth is not enabled. If your Firestore rules require authentication, " +
      "please enable the 'Anonymous' provider in your Firebase Console (Authentication > Sign-in method)."
    );
  } else {
    console.error("Firebase Auth Error:", error.code, error.message);
  }
});

let analytics = null;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

export { db, auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged };
export type { User };
