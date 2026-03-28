
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
    if (!user || !user.uid) return;
    try {
      await setDoc(doc(db, USERS_COLLECTION, user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        lastLogin: Date.now()
      }, { merge: true });

      // Migrate any old data stored under email ID to new UID structure
      if (user.email && user.email !== user.uid) {
        const oldBarcodesRef = collection(db, USERS_COLLECTION, user.email, COLLECTION_NAME);
        const oldSnapshot = await getDocs(oldBarcodesRef);
        
        if (!oldSnapshot.empty) {
          console.log(`Starting migration for ${user.email} -> ${user.uid}`);
          for (const docSnapshot of oldSnapshot.docs) {
            const data = docSnapshot.data() as BarcodeEntry;
            // Update user ID in record to new UID
            const migratedData = { ...data, userId: user.uid };
            // Save to new location
            await setDoc(doc(db, USERS_COLLECTION, user.uid, COLLECTION_NAME, String(data.id)), migratedData);
            // Remove old record
            await deleteDoc(docSnapshot.ref);
          }
          // Optionally delete the user profile stored under email
          await deleteDoc(doc(db, USERS_COLLECTION, user.email));
          console.log(`Migration complete for ${user.email}`);
        }
      }
    } catch (error) {
      console.error('Failed to sync user/migrate data in Firestore:', error);
    }
  },

  getHistory: async (uid?: string): Promise<BarcodeEntry[]> => {
    try {
      if (!uid) {
        return [];
      }

      // Query from user's specific subcollection
      const q = query(
        collection(db, USERS_COLLECTION, uid, COLLECTION_NAME),
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
  },

  updateEntry: async (userId: string, id: string, updates: Partial<BarcodeEntry>): Promise<void> => {
    try {
      await setDoc(doc(db, USERS_COLLECTION, userId, COLLECTION_NAME, String(id)), updates, { merge: true });
    } catch (error) {
      console.error('Failed to update entry in Firestore:', error);
      throw error;
    }
  }
};
