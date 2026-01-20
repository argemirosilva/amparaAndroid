import React from 'react';
import { cn } from '@/lib/utils';

interface ConnectionStatusProps {
  isOnline: boolean;
  className?: string;
}

export function ConnectionStatus({ isOnline, className }: ConnectionStatusProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1",
        className
      )}
      title={isOnline ? "Conectado" : "Desconectado"}
    >
      <span
        className={cn(
          "w-2 h-2 rounded-full transition-colors",
          isOnline ? "bg-success animate-pulse" : "bg-destructive animate-pulse"
        )}
      />
      <span className="text-[10px] text-muted-foreground">
        {isOnline ? "Online" : "Offline"}
      </span>
    </div>
  );
}
