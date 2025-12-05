
import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  children: React.ReactNode;
}

export const Select: React.FC<SelectProps> = ({ label, id, children, className, ...props }) => {
  return (
    <div className="w-full group">
      <label htmlFor={id} className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5 ml-1">
        {label}
      </label>
      <div className="relative">
        <select
            id={id}
            className={`w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 appearance-none
            transition-all duration-200 ease-in-out cursor-pointer shadow-sm
            focus:outline-none focus:bg-white focus:border-sky-600 focus:ring-4 focus:ring-sky-500/10
            hover:border-slate-400
            sm:text-sm ${className}`}
            {...props}
        >
            {children}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
        </div>
      </div>
    </div>
  );
};
