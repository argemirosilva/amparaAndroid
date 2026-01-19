import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ className = '', size = 'md' }: LogoProps) {
  const sizes = {
    sm: 'w-12 h-12',
    md: 'w-20 h-20',
    lg: 'w-32 h-32',
  };

  return (
    <div className={`relative ${sizes[size]} ${className}`}>
      {/* Shield shape with gradient */}
      <svg
        viewBox="0 0 100 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <defs>
          <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(270, 70%, 55%)" />
            <stop offset="100%" stopColor="hsl(330, 70%, 55%)" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        
        {/* Shield outline with glow */}
        <path
          d="M50 5 L90 20 L90 60 C90 85 70 105 50 115 C30 105 10 85 10 60 L10 20 L50 5Z"
          fill="url(#shieldGradient)"
          filter="url(#glow)"
          opacity="0.9"
        />
        
        {/* Inner shield detail */}
        <path
          d="M50 15 L80 27 L80 58 C80 78 65 95 50 103 C35 95 20 78 20 58 L20 27 L50 15Z"
          fill="hsl(270, 50%, 12%)"
          opacity="0.8"
        />
        
        {/* Heart symbol inside shield */}
        <path
          d="M50 75 C35 60 30 50 35 42 C40 34 50 36 50 45 C50 36 60 34 65 42 C70 50 65 60 50 75Z"
          fill="url(#shieldGradient)"
          opacity="0.9"
        />
        
        {/* Hand holding / protecting gesture */}
        <path
          d="M30 70 Q35 80 50 85 Q65 80 70 70"
          stroke="url(#shieldGradient)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        />
      </svg>
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

export function LogoWithText({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <Logo size="lg" />
      <LogoText />
    </div>
  );
}
