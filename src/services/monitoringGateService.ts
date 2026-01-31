/**
 * Monitoring Gate Service - Single Source of Truth
 * 
 * This service is the ONLY place that determines if the app is within a monitoring period.
 * All detection, recording, and UI logic must check this gate before proceeding.
 * 
 * IMPORTANT: Audio capture for keep-alive (ping) is SEPARATE from monitoring detection.
 * - Keep-alive: runs 24/7 to maintain app alive and server connection
 * - Monitoring: only active during configured periods, triggers detection/recording
 */

import type { MonitoringPeriod } from '@/lib/types';

export interface MonitoringGateStatus {
  /** Is currently within a monitoring period? */
  isWithinPeriod: boolean;
  /** Current active period (if any) */
  currentPeriod: MonitoringPeriod | null;
  /** Index of current period in today's list */
  currentPeriodIndex: number | null;
  /** Next period today (if any) */
  nextPeriodToday: MonitoringPeriod | null;
  /** Are there any periods configured for today? */
  hasPeriodsToday: boolean;
}

/**
 * Parse time string "HH:MM" to minutes since midnight
 */
function parseTimeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// Throttle logs to prevent spam (max 1 log per 3 seconds)
let lastLogTime = 0;
const LOG_THROTTLE_MS = 3000;

/**
 * Check if current time is within a monitoring period
 * 
 * @param now - Current date/time
 * @param periods - List of monitoring periods for today
 * @returns Monitoring gate status
 */
export function getMonitoringGateStatus(
  now: Date,
  periods: MonitoringPeriod[]
): MonitoringGateStatus {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const shouldLog = Date.now() - lastLogTime > LOG_THROTTLE_MS;
  
  if (shouldLog) {
    console.log('[MonitoringGate] Checking status:', {
      currentTime: `${now.getHours()}:${now.getMinutes()}`,
      currentMinutes,
      periodsCount: periods.length,
      periods: periods.map(p => `${p.inicio}-${p.fim}`)
    });
    lastLogTime = Date.now();
  }
  
  // Check if within any period
  for (let i = 0; i < periods.length; i++) {
    const period = periods[i];
    const startMinutes = parseTimeToMinutes(period.inicio);
    const endMinutes = parseTimeToMinutes(period.fim);
    
    // Removed verbose per-period logging
    
    if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
      // Found active period
      if (shouldLog) {
        console.log('[MonitoringGate] ✅ WITHIN PERIOD!');
      }
      return {
        isWithinPeriod: true,
        currentPeriod: period,
        currentPeriodIndex: i,
        nextPeriodToday: null,
        hasPeriodsToday: periods.length > 0,
      };
    }
  }
  
  // Not within any period - find next period today
  let nextPeriod: MonitoringPeriod | null = null;
  for (const period of periods) {
    const startMinutes = parseTimeToMinutes(period.inicio);
    if (startMinutes > currentMinutes) {
      nextPeriod = period;
      break;
    }
  }
  
  return {
    isWithinPeriod: false,
    currentPeriod: null,
    currentPeriodIndex: null,
    nextPeriodToday: nextPeriod,
    hasPeriodsToday: periods.length > 0,
  };
}

/**
 * Simple check: is within monitoring period?
 * Use this for quick boolean checks in components/services.
 */
export function isWithinMonitoringPeriod(
  now: Date,
  periods: MonitoringPeriod[]
): boolean {
  const status = getMonitoringGateStatus(now, periods);
  return status.isWithinPeriod;
}

/**
 * Log monitoring gate decision (for debugging)
 */
export function logMonitoringGate(
  context: string,
  status: MonitoringGateStatus
): void {
  console.log(`[MonitoringGate] ${context}:`, {
    isWithinPeriod: status.isWithinPeriod,
    currentPeriod: status.currentPeriod?.inicio + '-' + status.currentPeriod?.fim,
    nextPeriodToday: status.nextPeriodToday?.inicio + '-' + status.nextPeriodToday?.fim,
    hasPeriodsToday: status.hasPeriodsToday,
  });
}
