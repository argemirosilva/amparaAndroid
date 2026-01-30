/**
 * Permission Flow State - Gate Global
 * 
 * Controla se o app está em fluxo de permissões (onboarding, system dialogs, etc.)
 * Enquanto isInPermissionFlow=true, NENHUM audio trigger pode iniciar.
 */

type PermissionFlowListener = () => void;

interface PermissionMissing {
  audio: boolean;
  location: boolean;
  exactAlarm: boolean;
  batteryOpt: boolean;
}

interface PermissionFlowStateData {
  isInPermissionFlow: boolean;
  missing: PermissionMissing;
  lastUpdatedAt: number;
}

class PermissionFlowStateManager {
  private state: PermissionFlowStateData = {
    isInPermissionFlow: false,
    missing: {
      audio: false,
      location: false,
      exactAlarm: false,
      batteryOpt: false,
    },
    lastUpdatedAt: 0,
  };

  private listeners: Set<PermissionFlowListener> = new Set();
  private initialized = false;

  init() {
    if (this.initialized) {
      console.log('[PermissionFlowState] Already initialized, skipping');
      return;
    }

    console.log('[PermissionFlowState] 🔧 Initializing...');
    this.initialized = true;
    this.state.lastUpdatedAt = Date.now();
  }

  setState(partial: Partial<PermissionFlowStateData>) {
    const prev = { ...this.state };
    
    this.state = {
      ...this.state,
      ...partial,
      lastUpdatedAt: Date.now(),
    };

    console.log('[PermissionFlowState] 📊 State updated:', {
      isInPermissionFlow: this.state.isInPermissionFlow,
      missing: this.state.missing,
    });

    // Notify listeners if isInPermissionFlow changed
    if (prev.isInPermissionFlow !== this.state.isInPermissionFlow) {
      console.log(`[PermissionFlowState] 🔄 Flow state changed: ${prev.isInPermissionFlow} → ${this.state.isInPermissionFlow}`);
      this.notifyListeners();
    }
  }

  getState(): Readonly<PermissionFlowStateData> {
    return { ...this.state };
  }

  isInFlow(): boolean {
    return this.state.isInPermissionFlow;
  }

  setInFlow(value: boolean, reason?: string) {
    console.log(`[PermissionFlowState] ${value ? '🚫' : '✅'} setInFlow(${value})${reason ? ` - ${reason}` : ''}`);
    this.setState({ isInPermissionFlow: value });
  }

  setMissing(missing: Partial<PermissionMissing>) {
    this.setState({
      missing: {
        ...this.state.missing,
        ...missing,
      },
    });
  }

  subscribe(listener: PermissionFlowListener): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('[PermissionFlowState] Error in listener:', error);
      }
    });
  }

  reset() {
    console.log('[PermissionFlowState] 🔄 Resetting state');
    this.state = {
      isInPermissionFlow: false,
      missing: {
        audio: false,
        location: false,
        exactAlarm: false,
        batteryOpt: false,
      },
      lastUpdatedAt: Date.now(),
    };
    this.notifyListeners();
  }
}

// Singleton instance
export const PermissionFlowState = new PermissionFlowStateManager();
