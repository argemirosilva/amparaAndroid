/**
 * Location Service
 * Passive location monitoring to keep foreground service justified
 * Only tracks location when GPS is already active (minimal battery impact)
 */

import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

// ============================================
// Types
// ============================================

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface LocationState {
  lastLocation: LocationData | null;
  lastUpdateTime: number | null;
  isTracking: boolean;
  error: string | null;
}

// ============================================
// Configuration
// ============================================

const CONFIG = {
  UPDATE_INTERVAL_MS: 15 * 60 * 1000, // 15 minutes
  MIN_DISTANCE_METERS: 100, // Only update if moved 100m
  TIMEOUT_MS: 10000, // 10 seconds timeout
};

// ============================================
// State
// ============================================

let state: LocationState = {
  lastLocation: null,
  lastUpdateTime: null,
  isTracking: false,
  error: null,
};

let intervalId: NodeJS.Timeout | null = null;
let listeners: Array<(state: LocationState) => void> = [];

// ============================================
// Core Functions
// ============================================

/**
 * Get current location (passive mode)
 */
async function getCurrentLocation(): Promise<LocationData | null> {
  if (!Capacitor.isNativePlatform()) {
    console.log('[LocationService] Skipping - not native platform');
    return null;
  }

  try {
    console.log('[LocationService] Getting current location...');
    
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: false, // Use passive/network location (low battery)
      timeout: CONFIG.TIMEOUT_MS,
      maximumAge: 5 * 60 * 1000, // Accept cached location up to 5 minutes old
    });

    const locationData: LocationData = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp,
    };

    console.log('[LocationService] Location obtained', {
      lat: locationData.latitude.toFixed(6),
      lng: locationData.longitude.toFixed(6),
      accuracy: Math.round(locationData.accuracy),
    });

    return locationData;
  } catch (error) {
    console.warn('[LocationService] Error getting location:', error);
    return null;
  }
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Update location and notify listeners
 */
async function updateLocation(): Promise<void> {
  const location = await getCurrentLocation();

  if (!location) {
    state.error = 'Failed to get location';
    notifyListeners();
    return;
  }

  // Check if we moved enough to warrant an update
  if (state.lastLocation) {
    const distance = calculateDistance(
      state.lastLocation.latitude,
      state.lastLocation.longitude,
      location.latitude,
      location.longitude
    );

    if (distance < CONFIG.MIN_DISTANCE_METERS) {
      console.log('[LocationService] Location unchanged (distance:', Math.round(distance), 'm)');
      return;
    }

    console.log('[LocationService] Location changed by', Math.round(distance), 'm');
  }

  state.lastLocation = location;
  state.lastUpdateTime = Date.now();
  state.error = null;

  notifyListeners();
}

/**
 * Notify all listeners of state change
 */
function notifyListeners(): void {
  listeners.forEach((listener) => listener(state));
}

// ============================================
// Public API
// ============================================

/**
 * Start location tracking
 */
export function startLocationTracking(): void {
  if (intervalId) {
    console.warn('[LocationService] Already tracking');
    return;
  }

  console.log('[LocationService] Starting location tracking...');
  state.isTracking = true;

  // Get initial location
  updateLocation();

  // Schedule periodic updates
  intervalId = setInterval(() => {
    updateLocation();
  }, CONFIG.UPDATE_INTERVAL_MS);
}

/**
 * Stop location tracking
 */
export function stopLocationTracking(): void {
  console.log('[LocationService] Stopping location tracking...');

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  state.isTracking = false;
}

/**
 * Get current location state
 */
export function getLocationState(): LocationState {
  return { ...state };
}

/**
 * Subscribe to location updates
 */
export function subscribeToLocation(
  listener: (state: LocationState) => void
): () => void {
  listeners.push(listener);

  // Return unsubscribe function
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

/**
 * Force an immediate location update
 */
export function forceLocationUpdate(): void {
  console.log('[LocationService] Force update requested');
  updateLocation();
}
