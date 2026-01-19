// ============================================
// AMPARA API Configuration
// ============================================
// Configure your API endpoints here

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://your-api.com/api';

// Auth endpoints
export const AUTH_ENDPOINTS = {
  login: `${API_BASE_URL}/auth/login`,
  logout: `${API_BASE_URL}/auth/logout`,
  forgotPassword: `${API_BASE_URL}/auth/forgot-password`,
  refreshToken: `${API_BASE_URL}/auth/refresh`,
};

// Panic endpoints
export const PANIC_ENDPOINTS = {
  activate: `${API_BASE_URL}/panic/activate`,
  deactivate: `${API_BASE_URL}/panic/deactivate`,
  status: `${API_BASE_URL}/panic/status`,
};

// Recording endpoints
export const RECORDING_ENDPOINTS = {
  startSession: `${API_BASE_URL}/recording/start`,
  uploadSegment: `${API_BASE_URL}/recording/segment`,
  endSession: `${API_BASE_URL}/recording/end`,
};

// Location endpoints
export const LOCATION_ENDPOINTS = {
  update: `${API_BASE_URL}/location/update`,
};

// File upload endpoints
export const UPLOAD_ENDPOINTS = {
  file: `${API_BASE_URL}/upload/file`,
  pending: `${API_BASE_URL}/upload/pending`,
};

// ============================================
// API Helper Functions
// ============================================

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

export async function apiRequest<T>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<{ data: T | null; error: string | null }> {
  const { method = 'GET', body, headers = {} } = options;
  
  const token = localStorage.getItem('ampara_token');
  
  try {
    const response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { data: null, error: errorData.message || 'Request failed' };
    }

    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    console.error('API Error:', error);
    return { data: null, error: 'Network error. Check your connection.' };
  }
}

// Upload file with progress
export async function uploadFileWithProgress(
  file: File,
  onProgress: (progress: number) => void
): Promise<{ success: boolean; error: string | null }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const progress = Math.round((e.loaded / e.total) * 100);
        onProgress(progress);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ success: true, error: null });
      } else {
        resolve({ success: false, error: 'Upload failed' });
      }
    });

    xhr.addEventListener('error', () => {
      resolve({ success: false, error: 'Network error' });
    });

    const token = localStorage.getItem('ampara_token');
    xhr.open('POST', UPLOAD_ENDPOINTS.file);
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    xhr.send(formData);
  });
}

// Upload audio segment (for real-time recording)
export async function uploadAudioSegment(
  sessionId: string,
  segmentData: Blob,
  segmentIndex: number
): Promise<{ success: boolean; error: string | null }> {
  const formData = new FormData();
  formData.append('session_id', sessionId);
  formData.append('segment_index', segmentIndex.toString());
  formData.append('audio', segmentData, `segment_${segmentIndex}.webm`);

  try {
    const token = localStorage.getItem('ampara_token');
    const response = await fetch(RECORDING_ENDPOINTS.uploadSegment, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      return { success: false, error: 'Segment upload failed' };
    }

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: 'Network error' };
  }
}
