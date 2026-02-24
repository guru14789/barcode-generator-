
import { BarcodeEntry } from '../types';
import { db } from './firebase';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  where
} from "firebase/firestore";

const COLLECTION_NAME = 'barcodes';
const USERS_COLLECTION = 'users';

export const storageService = {
  syncUser: async (user: any): Promise<void> => {
    if (!user || !user.email) return;
    try {
      await setDoc(doc(db, USERS_COLLECTION, user.email), {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        lastLogin: Date.now()
      }, { merge: true });
    } catch (error) {
      console.error('Failed to sync user to Firestore:', error);
    }
  },

  getHistory: async (userId?: string): Promise<BarcodeEntry[]> => {
    try {
      if (!userId) {
        // Return empty or restricted history for anonymous users if preferred
        // For now, keep as is but prioritize userId if provided
        const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => doc.data() as BarcodeEntry);
      }

      const q = query(
        collection(db, COLLECTION_NAME),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as BarcodeEntry);
    } catch (error) {
      console.error('Failed to load history from Firestore:', error);
      return [];
    }
  },

  saveEntry: async (entry: BarcodeEntry): Promise<void> => {
    try {
      // Use entry.id as document ID for easy lookup and uniqueness
      await setDoc(doc(db, COLLECTION_NAME, String(entry.id)), entry);
    } catch (error) {
      console.error('Failed to save entry to Firestore:', error);
    }
  },

  deleteEntry: async (id: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, String(id)));
    } catch (error) {
      console.error('Failed to delete entry from Firestore:', error);
      throw error;
    }
  },

  clearHistory: async (userId?: string): Promise<void> => {
    try {
      let q;
      if (userId) {
        q = query(collection(db, COLLECTION_NAME), where('userId', '==', userId));
      } else {
        q = query(collection(db, COLLECTION_NAME));
      }
      const querySnapshot = await getDocs(q);
      const deletePromises = querySnapshot.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Failed to clear history from Firestore:', error);
    }
  }
};
