import React, { useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./pages/Login";
import { HomePage } from "./pages/Home";
import { initializeSession, isAuthenticated, reloadSession, clearSession } from '@/services/sessionService';
import { PanicActivePage } from "./pages/PanicActive";
import { RecordingPage } from "./pages/Recording";
import { PendingPage } from "./pages/Pending";
import { UploadPage } from "./pages/Upload";
import { SchedulePage } from "./pages/Schedule";
import { AudioTriggerDebugPage } from "./pages/AudioTriggerDebug";
import NotFound from "./pages/NotFound";
import { PanicProvider } from "./contexts/PanicContext";
import { PermissionGuard } from "./components/PermissionGuard";

const queryClient = new QueryClient();

const App = () => {
  // Start with null to indicate "loading" state
  const [authState, setAuthState] = useState<boolean | null>(null);

  // Initialize session service and check auth
  useEffect(() => {
    const initAuth = async () => {
      try {
        console.log('[App] Initializing session service...');
        
        // Initialize the session service (loads from native storage)
        await initializeSession();
        
        // Check if authenticated
        const authenticated = isAuthenticated();
        console.log('[App] Authentication status:', authenticated);
        
        setAuthState(authenticated);
      } catch (e) {
        console.error('[App] Session initialization failed:', e);
        setAuthState(false);
      }
    };
    
    initAuth();
  }, []);

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
                <Route path="/schedule" element={<SchedulePage />} />
                <Route path="/audio-trigger-debug" element={<AudioTriggerDebugPage />} />
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
