/**
 * Connectivity Service
 * Manages ping/healthcheck with timeout, retry, and exponential backoff
 */

import { pingMobile } from '@/lib/api';
import { ensureCriticalDataAvailable, isAppInBackground } from './backgroundStateManager';
import { clearSession } from './sessionService';

// ============================================
// Types
// ============================================

export interface ConnectivityState {
  isOnline: boolean;
  lastSuccessfulPing: string | null;
  lastLatencyMs: number;
  consecutiveFailures: number;
  nextPingScheduledAt: string | null;
}

export interface ConnectivityMetrics {
  totalPings: number;
  successfulPings: number;
  failedPings: number;
  averageLatencyMs: number;
}

// ============================================
// Configuration
// ============================================

const CONFIG = {
  PING_INTERVAL_MS: 30000, // 30 seconds
  PING_TIMEOUT_MS: 5000, // 5 seconds
  MAX_RETRY_DELAY_MS: 60000, // 1 minute max backoff
  MAX_CONSECUTIVE_FAILURES_BEFORE_OFFLINE: 3,
};

// ============================================
// State
// ============================================

let state: ConnectivityState = {
  isOnline: false,
  lastSuccessfulPing: null,
  lastLatencyMs: -1,
  consecutiveFailures: 0,
  nextPingScheduledAt: null,
};

let metrics: ConnectivityMetrics = {
  totalPings: 0,
  successfulPings: 0,
  failedPings: 0,
  averageLatencyMs: 0,
};

let pingIntervalId: NodeJS.Timeout | null = null;
let retryTimeoutId: NodeJS.Timeout | null = null;
let listeners: Array<(state: ConnectivityState) => void> = [];

// ============================================
// Core Functions
// ============================================

/**
 * Execute a single ping with timeout
 */
async function executePing(): Promise<void> {
  const startTime = Date.now();
  
  console.log('[ConnectivityService] Executing ping...');
  metrics.totalPings++;
  
  // Ensure critical data (token, config) is loaded before ping
  // This is crucial when app is in background and memory may be cleared
  if (isAppInBackground()) {
    console.log('[ConnectivityService] App in background, ensuring data available...');
    const dataAvailable = await ensureCriticalDataAvailable();
    if (!dataAvailable) {
      console.error('[ConnectivityService] Critical data not available, skipping ping');
      handlePingFailure('Critical data not available (background)', Date.now() - startTime);
      return;
    }
  }
  
  try {
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Ping timeout')), CONFIG.PING_TIMEOUT_MS);
    });
    
    // Race between ping and timeout
    const result = await Promise.race([
      pingMobile(),
      timeoutPromise
    ]) as Awaited<ReturnType<typeof pingMobile>>;
    
    const latency = Date.now() - startTime;
    
    // Check for session expiration (HTTP 401 with session_expired flag)
    if (result.data && result.data.session_expired === true) {
      console.error('[ConnectivityService] Session expired detected (flag)! Triggering logout...');
      await handleSessionExpired();
      return;
    }
    
    // Check for session expiration by error message
    if (result.error) {
      const errorMsg = JSON.stringify(result.error);
      if (errorMsg.includes('Sessão expirada') || errorMsg.includes('inválida') || errorMsg.includes('SESSION_EXPIRED')) {
        console.error('[ConnectivityService] Session expired detected (message)! Triggering logout...');
        await handleSessionExpired();
        return;
      }
      handlePingFailure('API error: ' + errorMsg, latency);
    } else if (!result.data) {
      handlePingFailure('API error: No data', latency);
    } else {
      handlePingSuccess(latency, result.data);
    }
    
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
    console.error('[ConnectivityService] Ping exception:', errorMsg);
    handlePingFailure(errorMsg, latency);
  }
}

/**
 * Handle successful ping
 */
function handlePingSuccess(latencyMs: number, data: any): void {
  console.log('[ConnectivityService] Ping success', { latency_ms: latencyMs });
  
  // Se tinha retry pendente/ativo, libera também
  if (retryTimeoutId) {
    clearTimeout(retryTimeoutId);
    retryTimeoutId = null;
  }

  state.isOnline = true;
  state.lastSuccessfulPing = new Date().toISOString();
  state.lastLatencyMs = latencyMs;
  state.consecutiveFailures = 0;
  state.nextPingScheduledAt = new Date(Date.now() + CONFIG.PING_INTERVAL_MS).toISOString();
  
  metrics.successfulPings++;
  updateAverageLatency(latencyMs);
  
  notifyListeners();
}

/**
 * Handle failed ping
 */
function handlePingFailure(error: string, latencyMs: number): void {
  console.warn('[ConnectivityService] Ping failed:', error, '| latency:', latencyMs, 'ms');
  
  state.consecutiveFailures++;
  state.lastLatencyMs = latencyMs;
  
  metrics.failedPings++;
  
  // Only mark as offline after multiple consecutive failures
  if (state.consecutiveFailures >= CONFIG.MAX_CONSECUTIVE_FAILURES_BEFORE_OFFLINE) {
    state.isOnline = false;
    console.warn('[ConnectivityService] Marked as offline after', state.consecutiveFailures, 'failures');
  }
  
  // Schedule retry with exponential backoff
  scheduleRetryWithBackoff();
  
  notifyListeners();
}

/**
 * Schedule next ping with exponential backoff
 */
function scheduleRetryWithBackoff(): void {
  // Clear any existing retry timeout
  if (retryTimeoutId) {
    clearTimeout(retryTimeoutId);
  }
  
  // Calculate delay: 2^failures * 1000ms, capped at MAX_RETRY_DELAY_MS
  const delay = Math.min(
    Math.pow(2, state.consecutiveFailures) * 1000,
    CONFIG.MAX_RETRY_DELAY_MS
  );
  
  state.nextPingScheduledAt = new Date(Date.now() + delay).toISOString();
  
  console.log('[ConnectivityService] Retry scheduled', { 
    attempt: state.consecutiveFailures, 
    delay_ms: delay 
  });
  
  retryTimeoutId = setTimeout(() => {
    // IMPORTANTÍSSIMO: libera o “modo retry” antes de pingar
    retryTimeoutId = null;
    executePing();
  }, delay);
}

/**
 * Handle session expiration (401 from backend)
 */
async function handleSessionExpired(): Promise<void> {
  console.error('[ConnectivityService] Session expired! Stopping ping service and clearing session...');
  
  // 1. Stop ping service immediately
  stopPingService();
  
  // 2. Clear session token from all storages
  await clearSession();
  
  // 3. Dispatch custom event for app to handle (redirect to login)
  window.dispatchEvent(new CustomEvent('session-expired', {
    detail: { source: 'connectivity-service' }
  }));
}

/**
 * Update average latency metric
 */
function updateAverageLatency(newLatency: number): void {
  const totalSuccessful = metrics.successfulPings;
  const currentAvg = metrics.averageLatencyMs;
  
  // Incremental average calculation
  metrics.averageLatencyMs = ((currentAvg * (totalSuccessful - 1)) + newLatency) / totalSuccessful;
}

/**
 * Notify all listeners of state change
 */
function notifyListeners(): void {
  listeners.forEach(listener => listener(state));
}

// ============================================
// Public API
// ============================================

/**
 * Start the ping service
 */
export function startPingService(): void {
  if (pingIntervalId) {
    console.warn('[ConnectivityService] Service already running');
    return;
  }
  
  console.log('[ConnectivityService] Starting service...');
  
  // Execute first ping immediately
  executePing();
  
  // Schedule regular pings
  pingIntervalId = setInterval(() => {
    // Only execute if we're not in a retry backoff
    if (!retryTimeoutId) {
      executePing();
    }
  }, CONFIG.PING_INTERVAL_MS);
}

/**
 * Stop the ping service
 */
export function stopPingService(): void {
  console.log('[ConnectivityService] Stopping service...');
  
  if (pingIntervalId) {
    clearInterval(pingIntervalId);
    pingIntervalId = null;
  }
  
  if (retryTimeoutId) {
    clearTimeout(retryTimeoutId);
    retryTimeoutId = null;
  }
}

/**
 * Get current connectivity state
 */
export function getConnectivityState(): ConnectivityState {
  return { ...state };
}

/**
 * Get connectivity metrics
 */
export function getConnectivityMetrics(): ConnectivityMetrics {
  return { ...metrics };
}

/**
 * Subscribe to connectivity state changes
 */
export function subscribeToConnectivity(listener: (state: ConnectivityState) => void): () => void {
  listeners.push(listener);
  
  // Return unsubscribe function
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

/**
 * Force an immediate ping (useful for manual testing)
 */
export function forcePing(): void {
  console.log('[ConnectivityService] Force ping requested');
  executePing();
}

/**
 * Reset metrics (useful for testing)
 */
export function resetMetrics(): void {
  metrics = {
    totalPings: 0,
    successfulPings: 0,
    failedPings: 0,
    averageLatencyMs: 0,
  };
}
