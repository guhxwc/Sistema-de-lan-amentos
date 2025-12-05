
import React from 'react';

interface ThirdPartySummaryCardsProps {
  netProfit: number;
  balanceToPay: number;
}

const SummaryCard: React.FC<{ title: string; value: string; className: string }> = ({ title, value, className }) => (
  <div className={`p-4 rounded-lg shadow-sm ${className}`}>
    <h3 className="text-sm font-medium opacity-80">{title}</h3>
    <p className="text-2xl font-bold">{value}</p>
  </div>
);

export const ThirdPartySummaryCards: React.FC<ThirdPartySummaryCardsProps> = ({ netProfit, balanceToPay }) => {
  const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SummaryCard title="Lucro Líquido Total" value={formatCurrency(netProfit)} className="bg-sky-100 text-sky-800" />
      <SummaryCard title="Saldo a Pagar (Pendentes)" value={formatCurrency(balanceToPay)} className="bg-amber-100 text-amber-800" />
    </div>
  );
};
