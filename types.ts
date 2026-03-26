
export interface BarcodeEntry {
  id: string; // The 9-digit code
  createdAt: number;
  label?: string;
  format: 'CODE128';
  userId?: string;
}

export interface AppState {
  history: BarcodeEntry[];
  currentCode: BarcodeEntry | null;
}
