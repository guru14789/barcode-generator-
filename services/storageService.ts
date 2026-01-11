
import { BarcodeEntry } from '../types';

const STORAGE_KEY = 'barcodegen_history_v1';

export const storageService = {
  getHistory: (): BarcodeEntry[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Failed to load history:', error);
      return [];
    }
  },

  saveEntry: (entry: BarcodeEntry): void => {
    try {
      const history = storageService.getHistory();
      // Ensure no duplicates in storage
      const filtered = history.filter(e => String(e.id) !== String(entry.id));
      const updated = [entry, ...filtered];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save entry:', error);
    }
  },

  deleteEntry: (id: string): BarcodeEntry[] => {
    try {
      const history = storageService.getHistory();
      const updated = history.filter(e => String(e.id) !== String(id));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    } catch (error) {
      console.error('Failed to delete entry:', error);
      return storageService.getHistory();
    }
  },

  clearHistory: (): void => {
    localStorage.removeItem(STORAGE_KEY);
  }
};
