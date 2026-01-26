import React, { useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./pages/Login";
import { HomePage } from "./pages/Home";
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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Check auth on mount and listen for storage changes
  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('ampara_token');
      console.log('[App] Checking auth, token value:', token ? 'EXISTS' : 'NULL');
      setIsAuthenticated(!!token);
    };
    
    // Give WebView some time to initialize storage on Android 15
    const timer = setTimeout(() => {
      console.log('[App] Running delayed auth check...');
      checkAuth();
    }, 800);
    
    window.addEventListener('storage', checkAuth);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('storage', checkAuth);
    };
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('ampara_token');
    setIsAuthenticated(false);
  };

  // Loading state while checking auth
  if (isAuthenticated === null) {
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
            {!isAuthenticated ? (
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
