import React from 'react';
import amparaLogo from '@/assets/ampara-logo.png';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ className = '', size = 'md' }: LogoProps) {
  const sizes = {
    sm: 'w-12 h-12',
    md: 'w-20 h-20',
    lg: 'w-48 h-48',
  };

  return (
    <div className={`relative ${sizes[size]} ${className}`}>
      <img 
        src={amparaLogo} 
        alt="Ampara" 
        className="w-full h-full object-contain"
      />
    </div>
  );
}

export function LogoText({ className = '' }: { className?: string }) {
  return (
    <h1 className={`text-4xl font-bold tracking-wider text-gradient ${className}`}>
      AMPARA
    </h1>
  );
}

export function LogoWithText({ className = '', size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <Logo size={size} />
    </div>
  );
}
