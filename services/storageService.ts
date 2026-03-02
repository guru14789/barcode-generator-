
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
        return [];
      }

      // Query from user's specific subcollection
      const q = query(
        collection(db, USERS_COLLECTION, userId, COLLECTION_NAME),
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
      // Save in user's specific subcollection
      await setDoc(doc(db, USERS_COLLECTION, entry.userId, COLLECTION_NAME, String(entry.id)), entry);
    } catch (error) {
      console.error('Failed to save entry to Firestore:', error);
    }
  },

  deleteEntry: async (userId: string, id: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, USERS_COLLECTION, userId, COLLECTION_NAME, String(id)));
    } catch (error) {
      console.error('Failed to delete entry from Firestore:', error);
      throw error;
    }
  },

  clearHistory: async (userId: string): Promise<void> => {
    try {
      const q = query(collection(db, USERS_COLLECTION, userId, COLLECTION_NAME));
      const querySnapshot = await getDocs(q);
      const deletePromises = querySnapshot.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Failed to clear history from Firestore:', error);
    }
  }
};
