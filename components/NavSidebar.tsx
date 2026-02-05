import React from 'react';
import type { View } from '../App';

interface NavSidebarProps {
  activeView: View;
  setActiveView: (view: View) => void;
}

const NavItem: React.FC<{
  label: string;
  icon: React.ReactElement;
  isActive: boolean;
  onClick: () => void;
}> = ({ label, icon, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`group relative flex flex-col items-center justify-center w-20 h-20 mb-3 rounded-2xl transition-all duration-300 ease-out
      ${isActive 
        ? 'bg-white text-sky-600 shadow-lg shadow-slate-300/40 translate-x-2' 
        : 'text-slate-500 hover:bg-white/60 hover:text-sky-700 hover:translate-x-1'
      }`}
    aria-label={label}
    title={label}
  >
    {/* Active Indicator */}
    {isActive && (
        <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-sky-600 rounded-r-full" />
    )}

    <div className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
        {icon}
    </div>
    <span className={`text-[10px] font-bold mt-2 tracking-wide ${isActive ? 'text-sky-700' : 'text-slate-400 group-hover:text-sky-700'}`}>
        {label}
    </span>
  </button>
);

export const NavSidebar: React.FC<NavSidebarProps> = ({ activeView, setActiveView }) => {
  return (
    <nav className="w-28 bg-slate-200/50 border-r border-slate-300/50 flex flex-col items-center py-6 z-50 backdrop-blur-sm h-full">
      <div className="mb-10 p-2">
        <div className="bg-gradient-to-br from-sky-600 to-sky-800 p-3.5 rounded-2xl shadow-xl shadow-sky-700/20 transform hover:scale-105 transition-transform duration-300 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <p className="text-[10px] font-bold text-center text-slate-400 mt-2 tracking-wider">LOGÍSTICA</p>
      </div>

      <div className="flex-1 space-y-1 w-full px-3 flex flex-col items-center overflow-y-auto no-scrollbar py-2">
        <NavItem
            label="Viagens"
            icon={
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2-2v14a2 2 0 002 2z" /></svg>}
            isActive={activeView === 'settlements'}
            onClick={() => setActiveView('settlements')}
        />
        <NavItem
            label="Receber"
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            isActive={activeView === 'receivables'}
            onClick={() => setActiveView('receivables')}
        />
        <NavItem
            label="Notas"
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
            isActive={activeView === 'fiscalNotes'}
            onClick={() => setActiveView('fiscalNotes')}
        />
        <NavItem
            label="Terceiros"
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.084-1.284-.24-1.88M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.084-1.284.24-1.88" />
            </svg>}
            isActive={activeView === 'thirdPartyFreights'}
            onClick={() => setActiveView('thirdPartyFreights')}
        />
      </div>

      <div className="mt-auto w-full px-3 flex flex-col items-center pt-4 border-t border-slate-300/30">
         <NavItem
            label="Config"
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c-.94 1.543-.826 3.31 2.37 2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
            isActive={activeView === 'dashboard'}
            onClick={() => setActiveView('dashboard')}
        />
      </div>
    </nav>
  );
};