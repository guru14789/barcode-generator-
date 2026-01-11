
export interface BarcodeEntry {
  id: string; // The 9-digit code
  createdAt: number;
  label?: string;
  format: 'CODE128';
}

export interface AppState {
  history: BarcodeEntry[];
  currentCode: BarcodeEntry | null;
}
