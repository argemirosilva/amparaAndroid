import { describe, it, expect, vi, beforeEach } from 'vitest';
import { audioTriggerSingleton } from './audioTriggerSingleton';

// Mock minimalista de dependências
vi.mock('@/utils/configStorage', () => ({
    getFullConfig: vi.fn(() => ({})),
    saveConfig: vi.fn(),
    saveServerConfig: vi.fn(),
}));

describe('AudioTriggerSingleton - Estado e Métricas', () => {
    beforeEach(() => {
        audioTriggerSingleton.reset();
    });

    it('deve gerenciar listeners de estado corretamente', () => {
        const listener = vi.fn();
        audioTriggerSingleton.addStateListener(listener);

        // Simular mudança de métricas nativas que deve disparar o listener
        audioTriggerSingleton.setNativeMetrics({
            rmsDb: -15,
            score: 0.9,
            state: 'DISCUSSION_DETECTED'
        });

        expect(listener).toHaveBeenCalled();
        const metrics = audioTriggerSingleton.getMetrics();
        expect(metrics?.loudDb).toBe(-15);
        expect(metrics?.discussionOn).toBe(true);

        audioTriggerSingleton.removeStateListener(listener);
    });

    it('deve refletir o estado de captura', () => {
        // Como o start() real depende do navigator.mediaDevices, 
        // testamos apenas o estado inicial e o reset
        expect(audioTriggerSingleton.getIsCapturing()).toBe(false);
        audioTriggerSingleton.reset();
        expect(audioTriggerSingleton.getState()).toBe('IDLE');
    });
});
