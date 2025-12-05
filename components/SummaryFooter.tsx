
import React from 'react';
import { Card, CardContent, CardHeader } from './ui/Card';

interface SummaryFooterProps {
  calculations: {
    totalFreights: number;
    totalExpenses: number;
    totalDieselCost: number;
    profit: number;
    distance: number;
    averageKmL: number;
    averagePricePerLiter: number;
  };
}

const SummaryItem: React.FC<{ label: string; value: string; colorClass: string; className?: string }> = ({ label, value, colorClass, className = '' }) => (
  <div className={`p-4 rounded-xl flex flex-col items-center justify-center text-center border ${colorClass} ${className}`}>
    <span className="text-xs font-bold uppercase tracking-wide opacity-70 mb-1">{label}</span>
    <span className="font-bold text-xl md:text-2xl">{value}</span>
  </div>
);

export const SummaryFooter: React.FC<SummaryFooterProps> = ({ calculations }) => {
  const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  
  return (
    <Card className="border-t-4 border-t-sky-600 shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-2">
             <div className="p-2 bg-sky-100 rounded-lg text-sky-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2-2v14a2 2 0 002 2z" />
                </svg>
             </div>
             Resumo Financeiro da Viagem
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryItem 
            label="Total Fretes" 
            value={formatCurrency(calculations.totalFreights)} 
            colorClass="bg-slate-50 border-slate-100 text-slate-800" 
          />
          <SummaryItem 
            label="Despesas" 
            value={formatCurrency(calculations.totalExpenses)} 
            colorClass="bg-red-50 border-red-100 text-red-800" 
          />
          <SummaryItem 
            label="Diesel" 
            value={formatCurrency(calculations.totalDieselCost)} 
            colorClass="bg-amber-50 border-amber-100 text-amber-800" 
          />
          <SummaryItem 
            label="Lucro Líquido" 
            value={formatCurrency(calculations.profit)} 
            colorClass={`${calculations.profit >= 0 ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-red-50 border-red-100 text-red-700"} border-2`}
            className="sm:row-span-2 md:row-span-2 sm:h-full !text-3xl"
          />
          
           <SummaryItem 
            label="Distância Percorrida" 
            value={`${calculations.distance.toLocaleString('pt-BR')} km`} 
            colorClass="bg-white border-slate-100 text-slate-600" 
            className="!text-lg"
          />
          <SummaryItem 
            label="Média de Consumo" 
            value={`${calculations.averageKmL.toFixed(2)} km/L`} 
            colorClass="bg-white border-slate-100 text-slate-600"
             className="!text-lg"
          />
           <SummaryItem 
            label="Preço Médio Diesel" 
            value={formatCurrency(calculations.averagePricePerLiter)} 
            colorClass="bg-white border-slate-100 text-slate-600" 
             className="!text-lg"
          />
        </div>
      </CardContent>
    </Card>
  );
};
