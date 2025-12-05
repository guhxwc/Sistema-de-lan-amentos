import React from 'react';

interface SummaryCardsProps {
  totalFreights: number;
  totalValue: number;
  totalReceived: number;
  totalPending: number;
}

const SummaryCard: React.FC<{ title: string; value: string; className: string }> = ({ title, value, className }) => (
  <div className={`p-4 rounded-lg shadow-sm ${className}`}>
    <h3 className="text-sm font-medium opacity-80">{title}</h3>
    <p className="text-2xl font-bold">{value}</p>
  </div>
);

export const SummaryCards: React.FC<SummaryCardsProps> = ({ totalFreights, totalValue, totalReceived, totalPending }) => {
  const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <SummaryCard title="Total de Fretes" value={String(totalFreights)} className="bg-slate-100 text-slate-800" />
      <SummaryCard title="Valor Total" value={formatCurrency(totalValue)} className="bg-slate-100 text-slate-800" />
      <SummaryCard title="Total Recebido" value={formatCurrency(totalReceived)} className="bg-slate-200 text-slate-800" />
      <SummaryCard title="Total Pendente" value={formatCurrency(totalPending)} className="bg-amber-100 text-amber-800" />
    </div>
  );
};