
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
    className={`group relative flex items-center w-full p-3 mb-2 rounded-xl transition-all duration-200 ease-in-out
      ${isActive 
        ? 'bg-sky-600 text-white shadow-lg shadow-sky-900/20' 
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    aria-label={label}
  >
    {/* Icon Container */}
    <div className={`p-2 rounded-lg transition-colors ${isActive ? 'bg-white/20' : 'bg-slate-800 group-hover:bg-slate-700'}`}>
        {React.cloneElement(icon as React.ReactElement<any>, { className: `h-6 w-6 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}` })}
    </div>
    
    {/* Label (Hidden on small screens if we wanted, but let's keep it for a "site" feel) */}
    <span className={`ml-3 text-sm font-semibold tracking-wide ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>
        {label}
    </span>

    {/* Active Indicator */}
    {isActive && (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-sky-400 rounded-l-full shadow-[0_0_10px_rgba(56,189,248,0.5)]" />
    )}
  </button>
);

export const NavSidebar: React.FC<NavSidebarProps> = ({ activeView, setActiveView }) => {
  return (
    <nav className="w-64 bg-slate-900 flex flex-col h-full border-r border-slate-800 shadow-2xl z-50 flex-shrink-0 transition-all duration-300">
      {/* Brand / Logo Area */}
      <div className="h-20 flex items-center px-6 border-b border-slate-800/50 bg-slate-900">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-900/50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            </div>
            <div>
                <h1 className="text-white font-bold text-lg leading-tight tracking-tight">LOGÍSTICA</h1>
                <p className="text-xs text-sky-500 font-semibold tracking-widest uppercase">Express</p>
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1 custom-scrollbar">
        <div className="mb-2 px-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Operacional</div>
        
        <NavItem
            label="Viagens"
            icon={
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
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
            label="A Receber"
            icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            isActive={activeView === 'receivables'}
            onClick={() => setActiveView('receivables')}
        />
        
        <div className="mt-6 mb-2 px-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Fiscal & Terceiros</div>
        
        <NavItem
            label="Notas Fiscais"
            icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
            isActive={activeView === 'fiscalNotes'}
            onClick={() => setActiveView('fiscalNotes')}
        />
        <NavItem
            label="Fretes Terceiros"
            icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.084-1.284-.24-1.88M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.084-1.284.24-1.88" />
            </svg>}
            isActive={activeView === 'thirdPartyFreights'}
            onClick={() => setActiveView('thirdPartyFreights')}
        />
      </div>

      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
         <NavItem
            label="Configurações"
            icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c-.94 1.543-.826 3.31 2.37 2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
            isActive={activeView === 'dashboard'}
            onClick={() => setActiveView('dashboard')}
        />
        <div className="mt-4 px-3 text-[10px] text-slate-600 text-center">
            v1.2.0 • Sistema Seguro
        </div>
      </div>
    </nav>
  );
};
