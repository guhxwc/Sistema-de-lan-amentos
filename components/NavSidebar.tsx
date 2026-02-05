import React from 'react';
import type { View } from '../App';

interface NavSidebarProps {
  activeView: View;
  setActiveView: (view: View) => void;
}

const NavItem: React.FC<{
  label: string;
  icon: React.ReactElement<any>;
  isActive: boolean;
  onClick: () => void;
}> = ({ label, icon, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`group relative flex flex-col items-center justify-center w-20 h-20 mb-3 rounded-2xl transition-all duration-300 ease-out
      ${isActive 
        ? 'bg-sky-600 text-white shadow-lg shadow-sky-900/20 translate-x-1' 
        : 'text-slate-400 hover:bg-slate-800 hover:text-sky-400 hover:translate-x-1'
      }`}
    aria-label={label}
  >
    {isActive && (
       // Indicator dot
        <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-8 bg-sky-400 rounded-full shadow-[0_0_8px_rgba(56,189,248,0.6)]" />
    )}

    <div className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
        {React.cloneElement(icon, { 
            className: `h-7 w-7 ${isActive ? 'text-white' : 'currentColor'}` 
        })}
    </div>
    <span className={`text-[10px] font-bold mt-2 tracking-wide ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-sky-400'}`}>
        {label}
    </span>
  </button>
);

export const NavSidebar: React.FC<NavSidebarProps> = ({ activeView, setActiveView }) => {
  return (
    <nav className="w-28 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-6 z-50 h-full shadow-2xl shrink-0">
      <div className="mb-8 p-2">
        <div className="bg-gradient-to-br from-sky-500 to-sky-700 p-3.5 rounded-2xl shadow-lg shadow-sky-900/40 transform hover:scale-105 transition-transform duration-300 ring-1 ring-sky-400/30">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
      </div>

      <div className="flex-1 space-y-1 w-full px-3 flex flex-col items-center overflow-y-auto no-scrollbar">
        <NavItem
            label="Viagens"
            icon={
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h8a1 1 0 001-1z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 6h2a3 3 0 013 3v7h-2" />
                </svg>
            }
            isActive={activeView === 'trips'}
            onClick={() => setActiveView('trips')}
        />
        <NavItem
            label="Acertos"
            icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}
            isActive={activeView === 'settlements'}
            onClick={() => setActiveView('settlements')}
        />
        <NavItem
            label="Receber"
            icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            isActive={activeView === 'receivables'}
            onClick={() => setActiveView('receivables')}
        />
        <NavItem
            label="Notas"
            icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
            isActive={activeView === 'fiscalNotes'}
            onClick={() => setActiveView('fiscalNotes')}
        />
        <NavItem
            label="Terceiros"
            icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.084-1.284-.24-1.88M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.084-1.284.24-1.88" />
            </svg>}
            isActive={activeView === 'thirdPartyFreights'}
            onClick={() => setActiveView('thirdPartyFreights')}
        />
      </div>

      <div className="mt-auto w-full px-3 flex flex-col items-center">
         <NavItem
            label="Config"
            icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c-.94 1.543-.826 3.31 2.37 2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
            isActive={activeView === 'dashboard'}
            onClick={() => setActiveView('dashboard')}
        />
      </div>
    </nav>
  );
};