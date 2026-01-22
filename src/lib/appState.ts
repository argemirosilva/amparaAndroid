// ============================================
// AMPARA App State Machine
// ============================================
// Clear state management for the app lifecycle

export type AppStatus = 'normal' | 'recording' | 'panic';

export interface AppState {
  status: AppStatus;
  isAuthenticated: boolean;
  pendingUploads: number;
  recordingStartTime: number | null;
  panicStartTime: number | null;
  lastLocation: { lat: number; lng: number } | null;
}

export const initialAppState: AppState = {
  status: 'normal',
  isAuthenticated: false,
  pendingUploads: 0,
  recordingStartTime: null,
  panicStartTime: null,
  lastLocation: null,
};

// State persistence
const STATE_KEY = 'ampara_state';

export function saveState(state: Partial<AppState>): void {
  const current = loadState();
  const updated = { ...current, ...state };
  localStorage.setItem(STATE_KEY, JSON.stringify(updated));
}

export function loadState(): AppState {
  try {
    const saved = localStorage.getItem(STATE_KEY);
    if (saved) {
      return { ...initialAppState, ...JSON.parse(saved) };
    }
  } catch (error) {
    console.error('Error loading state:', error);
  }
  return initialAppState;
}

export function clearState(): void {
  localStorage.removeItem(STATE_KEY);
}

// Pending uploads queue
const PENDING_QUEUE_KEY = 'ampara_pending_queue';

export interface PendingUpload {
  id: string;
  fileName: string;
  fileSize: number;
  type: 'audio' | 'file';
  data: string; // Base64 encoded
  durationSeconds?: number; // Audio duration in seconds
  origemGravacao?: import('@/lib/types').OrigemGravacao; // Recording origin for backend routing
  createdAt: number;
  status: 'pending' | 'uploading' | 'failed';
  retryCount: number;
}

const MAX_PENDING_AGE_MS = 48 * 60 * 60 * 1000; // 48 hours in milliseconds

export function getPendingUploads(): PendingUpload[] {
  try {
    const saved = localStorage.getItem(PENDING_QUEUE_KEY);
    if (!saved) return [];
    
    const uploads: PendingUpload[] = JSON.parse(saved);
    const now = Date.now();
    
    // Filter out uploads older than 48 hours
    const validUploads = uploads.filter((upload) => {
      const age = now - upload.createdAt;
      return age < MAX_PENDING_AGE_MS;
    });
    
    // If we removed any, persist the cleaned list
    if (validUploads.length !== uploads.length) {
      localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(validUploads));
    }
    
    return validUploads;
  } catch {
    return [];
  }
}

export function addPendingUpload(upload: Omit<PendingUpload, 'id' | 'createdAt' | 'status' | 'retryCount'>): void {
  const uploads = getPendingUploads();
  const newUpload: PendingUpload = {
    ...upload,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    status: 'pending',
    retryCount: 0,
  };
  uploads.push(newUpload);
  localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(uploads));
}

export function updatePendingUpload(id: string, updates: Partial<PendingUpload>): void {
  const uploads = getPendingUploads();
  const index = uploads.findIndex((u) => u.id === id);
  if (index >= 0) {
    uploads[index] = { ...uploads[index], ...updates };
    localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(uploads));
  }
}

export function removePendingUpload(id: string): void {
  const uploads = getPendingUploads().filter((u) => u.id !== id);
  localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(uploads));
}

export function clearPendingUploads(): void {
  localStorage.removeItem(PENDING_QUEUE_KEY);
}
