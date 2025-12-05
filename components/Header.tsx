
import React from 'react';
import { Button } from './ui/Button';

interface HeaderProps {
    onNewTrip: () => void;
    onSaveTrip: () => void;
    onFillExample: () => void;
    onGeneratePDF: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onNewTrip, onSaveTrip, onFillExample, onGeneratePDF }) => {
    return (
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 transition-all duration-300">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-20">
                    <div className="flex items-center gap-4">
                        {/* Ícone decorativo */}
                         <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center border border-sky-200 shadow-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-sky-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none">
                                Gestão de Viagens
                            </h1>
                            <p className="text-xs text-slate-500 font-semibold mt-1 uppercase tracking-wide">Painel Operacional</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="hidden md:flex gap-2">
                            <Button onClick={onFillExample} variant="ghost" size="sm">Exemplo</Button>
                        </div>
                        <div className="h-8 w-px bg-slate-200 mx-2 hidden md:block"></div>
                        <Button onClick={onNewTrip} variant="secondary">Nova Viagem</Button>
                        <Button onClick={onGeneratePDF} variant="secondary" className="hidden sm:flex items-center gap-2">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                             PDF
                        </Button>
                        <Button onClick={onSaveTrip} variant="primary" className="px-8 shadow-lg shadow-sky-600/20">Salvar</Button>
                    </div>
                </div>
            </div>
        </header>
    );
};
