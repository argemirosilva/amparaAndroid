import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as api from './api';

// Mock do fetch global
global.fetch = vi.fn();

// Mock do deviceId
vi.mock('./deviceId', () => ({
    getDeviceId: vi.fn(() => 'test-device-id'),
}));

// Mock do sessionService
vi.mock('@/services/sessionService', () => ({
    getSessionToken: vi.fn(() => 'test-token'),
    setSessionToken: vi.fn(),
    setRefreshToken: vi.fn(),
    setUserData: vi.fn(),
    getUserData: vi.fn(() => JSON.stringify({ email: 'test@example.com' })),
    clearSession: vi.fn(),
}));

describe('API Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Limpar localStorage mockado se necessário
        localStorage.clear();
    });

    it('deve formatar corretamente o payload de login', async () => {
        (fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ data: { access_token: 'new-token' }, error: null }),
        });

        await api.loginCustomizado('test@example.com', 'password123');

        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('mobile-api'),
            expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('"action":"loginCustomizado"'),
            })
        );

        const callBody = JSON.parse((fetch as any).mock.calls[0][1].body);
        expect(callBody.email).toBe('test@example.com');
        expect(callBody.senha).toBe('password123');
        expect(callBody.device_id).toBe('test-device-id');
    });

    it('deve incluir token de sessão em chamadas autenticadas', async () => {
        (fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ data: { success: true }, error: null }),
        });

        await api.acionarPanicoMobile(-23.55, -46.63);

        const callBody = JSON.parse((fetch as any).mock.calls[0][1].body);
        expect(callBody.session_token).toBe('test-token');
        expect(callBody.action).toBe('acionarPanicoMobile');
    });

    it('deve formatar corretamente o payload de GPS', async () => {
        (fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ data: { success: true }, error: null }),
        });

        await api.enviarLocalizacaoGPS(-23.55, -46.63, { bateria_percentual: 85 });

        const callBody = JSON.parse((fetch as any).mock.calls[0][1].body);
        expect(callBody.action).toBe('enviarLocalizacaoGPS');
        expect(callBody.latitude).toBe(-23.55);
        expect(callBody.longitude).toBe(-46.63);
        expect(callBody.bateria_percentual).toBe(85);
    });
});
