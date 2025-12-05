
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className }) => {
  return (
    <div className={`bg-white rounded-2xl shadow-md shadow-slate-200/50 border border-slate-200 ${className}`}>
      {children}
    </div>
  );
};

interface CardHeaderProps {
    children: React.ReactNode;
    action?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ children, action }) => {
    return (
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-3 tracking-tight">{children}</h2>
            {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
    );
}

interface CardContentProps {
    children: React.ReactNode;
    className?: string;
}

export const CardContent: React.FC<CardContentProps> = ({ children, className }) => {
    return <div className={`p-6 ${className}`}>{children}</div>
}
