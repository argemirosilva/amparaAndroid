import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { VoiceRecorder } from 'capacitor-voice-recorder';

export type PermissionStatus = 'granted' | 'denied' | 'prompt';

export interface PermissionsState {
  microphone: PermissionStatus;
  location: PermissionStatus;
}

class PermissionsService {
  private isNative = Capacitor.isNativePlatform();
  private microphoneCacheKey = 'ampara_microphone_permission';

  private getCachedMicrophonePermission(): PermissionStatus | null {
    const cached = localStorage.getItem(this.microphoneCacheKey);
    if (cached === 'granted' || cached === 'denied' || cached === 'prompt') {
      return cached;
    }
    return null;
  }

  private setCachedMicrophonePermission(status: PermissionStatus) {
    localStorage.setItem(this.microphoneCacheKey, status);
  }

  updateMicrophonePermission(status: PermissionStatus) {
    if (this.isNative) {
      this.setCachedMicrophonePermission(status);
    }
  }

  /**
   * Check all required permissions
   */
  async checkAll(): Promise<PermissionsState> {
    const [microphone, location] = await Promise.all([
      this.checkMicrophone(),
      this.checkLocation(),
    ]);

    return { microphone, location };
  }

  /**
   * Check microphone permission status
   */
  async checkMicrophone(): Promise<PermissionStatus> {
    try {
      if (this.isNative) {
        const cached = this.getCachedMicrophonePermission();
        if (cached) {
          return cached;
        }
        if (navigator.mediaDevices?.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const hasLabeledInput = devices.some(
            (device) => device.kind === 'audioinput' && device.label
          );
          if (hasLabeledInput) {
            this.setCachedMicrophonePermission('granted');
            return 'granted';
          }
        }
      }

      if (!navigator.permissions) {
        // Fallback: try to access microphone to check permission
        return 'prompt';
      }

      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      const mapped = this.mapPermissionState(result.state);
      if (this.isNative) {
        this.setCachedMicrophonePermission(mapped);
      }
      return mapped;
    } catch (error) {
      console.warn('Error checking microphone permission:', error);
      return 'prompt';
    }
  }

  /**
   * Check location permission status
   */
  async checkLocation(): Promise<PermissionStatus> {
    try {
      if (this.isNative) {
        const status = await Geolocation.checkPermissions();
        return this.mapCapacitorPermission(status.location);
      }

      // Web fallback
      if (!navigator.permissions) {
        return 'prompt';
      }

      const result = await navigator.permissions.query({ name: 'geolocation' });
      return this.mapPermissionState(result.state);
    } catch (error) {
      console.warn('Error checking location permission:', error);
      return 'prompt';
    }
  }

  /**
   * Request microphone permission
   */
  async requestMicrophone(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop tracks immediately after getting permission
      stream.getTracks().forEach(track => track.stop());
      if (this.isNative) {
        this.setCachedMicrophonePermission('granted');
      }
      return true;
    } catch (error) {
      console.error('Microphone permission denied:', error);
      if (this.isNative) {
        this.setCachedMicrophonePermission('denied');
      }
      return false;
    }
  }

  /**
   * Request location permission
   */
  async requestLocation(): Promise<boolean> {
    try {
      if (this.isNative) {
        const status = await Geolocation.requestPermissions();
        return status.location === 'granted';
      }

      // Web fallback - request by trying to get position
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(true),
          () => resolve(false),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
    } catch (error) {
      console.error('Location permission denied:', error);
      return false;
    }
  }

  /**
   * Request all required permissions
   */
  async requestAll(): Promise<PermissionsState> {
    // Request in sequence to avoid overwhelming the user
    await this.requestMicrophone();
    await this.requestLocation();
    
    // Check final state
    return this.checkAll();
  }

  /**
   * Open app settings (for when permissions are permanently denied)
   */
  async openSettings(): Promise<void> {
    if (this.isNative) {
      // On native, we can try to open app settings
      // This requires additional plugin, for now show instructions
      console.log('Please open app settings manually');
    }
  }

  /**
   * Check if all required permissions are granted
   */
  hasAllRequired(state: PermissionsState): boolean {
    return state.microphone === 'granted' && state.location === 'granted';
  }

  /**
   * Map Web Permission API state to our status
   */
  private mapPermissionState(state: PermissionState): PermissionStatus {
    switch (state) {
      case 'granted':
        return 'granted';
      case 'denied':
        return 'denied';
      case 'prompt':
      default:
        return 'prompt';
    }
  }

  /**
   * Map Capacitor permission status to our status
   */
  private mapCapacitorPermission(status: string): PermissionStatus {
    switch (status) {
      case 'granted':
        return 'granted';
      case 'denied':
        return 'denied';
      case 'prompt':
      case 'prompt-with-rationale':
      default:
        return 'prompt';
    }
  }
}

export const permissionsService = new PermissionsService();
