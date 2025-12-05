
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const Input: React.FC<InputProps> = ({ label, id, className, ...props }) => {
  return (
    <div className="w-full group">
      <label htmlFor={id} className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5 ml-1">
        {label}
      </label>
      <input
        id={id}
        className={`w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 
        transition-all duration-200 ease-in-out shadow-sm
        focus:outline-none focus:bg-white focus:border-sky-600 focus:ring-4 focus:ring-sky-500/10
        hover:border-slate-400
        sm:text-sm ${className}`}
        {...props}
      />
    </div>
  );
};

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
}

export const Textarea: React.FC<TextareaProps> = ({ label, id, className, ...props }) => {
    return (
        <div className="w-full">
            <label htmlFor={id} className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5 ml-1">
                {label}
            </label>
            <textarea
                id={id}
                className={`w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 
                transition-all duration-200 ease-in-out shadow-sm
                focus:outline-none focus:bg-white focus:border-sky-600 focus:ring-4 focus:ring-sky-500/10
                hover:border-slate-400
                sm:text-sm ${className}`}
                {...props}
            />
        </div>
    );
};
