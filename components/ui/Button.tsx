
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', size = 'md', className, ...props }) => {
  const baseClasses = 'inline-flex items-center justify-center font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95';

  const variantClasses = {
    primary: 'bg-sky-600 text-white hover:bg-sky-700 shadow-md shadow-sky-600/20 hover:shadow-lg hover:shadow-sky-600/30 focus:ring-4 focus:ring-sky-500/30 border border-transparent',
    secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 shadow-sm',
    outline: 'bg-transparent text-slate-600 border border-slate-300 hover:bg-slate-50 hover:text-sky-700 hover:border-sky-300',
    danger: 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 hover:border-red-200 focus:ring-4 focus:ring-red-500/20',
    ghost: 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs rounded-lg',
    md: 'px-5 py-2.5 text-sm rounded-xl',
    lg: 'px-6 py-3.5 text-base rounded-xl',
  };

  const classes = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    className
  ].join(' ');

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
};
