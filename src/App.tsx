import React, { useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./pages/Login";
import { HomePage } from "./pages/Home";
import { initializeSession, isAuthenticated, reloadSession, clearSession } from '@/services/sessionService';
import { validateSessionToken } from '@/lib/api_validate_token';
import { initializeConfigService } from '@/services/configService';
import { startPingService, stopPingService } from '@/services/connectivityService';
import { initializeBackgroundStateManager } from '@/services/backgroundStateManager';
import { PanicActivePage } from "./pages/PanicActive";
import { RecordingPage } from "./pages/Recording";
import { PendingPage } from "./pages/Pending";
import { UploadPage } from "./pages/Upload";

import { AudioTriggerDebugPage } from "./pages/AudioTriggerDebug";
import IconSelector from "./pages/IconSelector";
import AboutPage from "./pages/About";
import SettingsPage from "./pages/Settings";
import NotFound from "./pages/NotFound";
import { PanicProvider } from "./contexts/PanicContext";
import { PermissionGuard } from "./components/PermissionGuard";

const queryClient = new QueryClient();

const App = () => {
  // Start with null to indicate "loading" state
  const [authState, setAuthState] = useState<boolean | null>(null);
  const [servicesInitialized, setServicesInitialized] = useState(false);

  // Initialize session service and check auth
  useEffect(() => {
    const initAuth = async () => {
      try {
        console.log('[App] Initializing session service...');
        
        // Initialize the session service (loads from native storage)
        await initializeSession();
        
        // Initialize background state manager (monitors app visibility)
        initializeBackgroundStateManager();
        
        // Check if authenticated
        const authenticated = isAuthenticated();
        console.log('[App] Authentication status:', authenticated);
        
        // If authenticated, validate token with server
        if (authenticated) {
          console.log('[App] Validating session token with server...');
          const isTokenValid = await validateSessionToken();
          
          if (!isTokenValid) {
            console.log('[App] Token is invalid, forcing logout');
            await clearSession();
            setAuthState(false);
            return;
          }
          
          console.log('[App] Token is valid');
        }
        
        setAuthState(authenticated);
      } catch (e) {
        console.error('[App] Session initialization failed:', e);
        setAuthState(false);
      }
    };
    
    initAuth();
  }, []);

  // Initialize background services after authentication
  useEffect(() => {
    if (authState === true && !servicesInitialized) {
      console.log('[App] User authenticated, initializing background services...');
      
      const initServices = async () => {
        try {
          // Initialize config service (loads from cache immediately)
          await initializeConfigService();
          
          // Start connectivity monitoring
          startPingService();
          
          setServicesInitialized(true);
          console.log('[App] Background services initialized');
        } catch (error) {
          console.error('[App] Failed to initialize background services:', error);
        }
      };
      
      initServices();
    } else if (authState === false && servicesInitialized) {
      // User logged out, stop services
      console.log('[App] User logged out, stopping background services...');
      stopPingService();
      setServicesInitialized(false);
    }
  }, [authState, servicesInitialized]);

  // Reload session when app becomes visible (Android lifecycle)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('[App] App became visible, reloading session...');
        const authenticated = await reloadSession();
        console.log('[App] Reload result:', authenticated, 'Current state:', authState);
        
        // Always update state to force re-render, even if value seems the same
        // This handles cases where Android killed and restarted the WebView
        console.log('[App] Force updating auth state to:', authenticated);
        setAuthState(authenticated);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const handleLoginSuccess = () => {
    console.log('[App] Login success, updating auth state');
    setAuthState(true);
  };

  const handleLogout = async () => {
    console.log('[App] Logout requested, clearing session');
    await clearSession();
    setAuthState(false);
  };

  // Loading state while checking auth
  if (authState === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <PermissionGuard>
          <BrowserRouter>
            {!authState ? (
            <Routes>
              <Route path="/" element={<LoginPage onLoginSuccess={handleLoginSuccess} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          ) : (
            <PanicProvider>
              <Routes>
                <Route path="/" element={<HomePage onLogout={handleLogout} />} />
                <Route path="/panic-active" element={<PanicActivePage />} />
                <Route path="/recording" element={<RecordingPage />} />
                <Route path="/pending" element={<PendingPage />} />
                <Route path="/upload" element={<UploadPage />} />

                <Route path="/audio-trigger-debug" element={<AudioTriggerDebugPage />} />
                <Route path="/icon-selector" element={<IconSelector />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </PanicProvider>
          )}
          </BrowserRouter>
        </PermissionGuard>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
