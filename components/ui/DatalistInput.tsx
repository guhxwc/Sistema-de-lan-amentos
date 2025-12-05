
import React from 'react';

interface DatalistInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  options: string[];
}

export const DatalistInput: React.FC<DatalistInputProps> = ({ label, id, options, className, ...props }) => {
  const dataListId = id ? `${id}-list` : undefined;
  return (
    <div className="w-full group">
      <label htmlFor={id} className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5 ml-1">
        {label}
      </label>
      <input
        id={id}
        list={dataListId}
        className={`w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 
        transition-all duration-200 ease-in-out shadow-sm
        focus:outline-none focus:bg-white focus:border-sky-600 focus:ring-4 focus:ring-sky-500/10
        hover:border-slate-400
        sm:text-sm ${className}`}
        {...props}
      />
      {dataListId && (
        <datalist id={dataListId}>
          {options.map((option, index) => (
            <option key={index} value={option} />
          ))}
        </datalist>
      )}
    </div>
  );
};
