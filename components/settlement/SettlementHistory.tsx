
import React from 'react';
import type { Settlement } from '../../types';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';

interface SettlementHistoryProps {
  history: Settlement[];
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
}

export const SettlementHistory: React.FC<SettlementHistoryProps> = ({ 
  history, 
  onView, 
  onEdit, 
  onDelete, 
  onClear,
  selectedIds,
  onToggleSelect,
  onSelectAll
}) => {
  const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    // Garante tratamento seguro mesmo se vier timestamp ISO
    const [year, month, dayPart] = dateString.split('-');
    const day = dayPart ? dayPart.substring(0, 2) : ''; 
    return `${day}/${month}/${year}`;
  };

  const allSelected = history.length > 0 && history.every(item => selectedIds.includes(item.id));

  const handleHeaderCheckboxChange = () => {
    if (allSelected) {
      onSelectAll([]);
    } else {
      onSelectAll(history.map(item => item.id));
    }
  };

  return (
    <Card>
      <CardHeader action={
        <div className="flex gap-2">
            <Button variant="danger" size="sm" onClick={onClear}>Limpar Histórico</Button>
        </div>
      }>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-sky-600" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
        Histórico de Acertos
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-500">
                <thead className="text-xs text-slate-700 uppercase bg-slate-100">
                    <tr>
                        <th scope="col" className="p-4">
                            <div className="flex items-center">
                                <input 
                                    id="checkbox-all" 
                                    type="checkbox" 
                                    className="w-4 h-4 text-sky-600 bg-gray-100 border-gray-300 rounded focus:ring-sky-500 focus:ring-2"
                                    checked={allSelected}
                                    onChange={handleHeaderCheckboxChange}
                                />
                                <label htmlFor="checkbox-all" className="sr-only">checkbox</label>
                            </div>
                        </th>
                        <th scope="col" className="px-6 py-3">Data</th>
                        <th scope="col" className="px-6 py-3">Motorista</th>
                        <th scope="col" className="px-6 py-3">Comissões</th>
                        <th scope="col" className="px-6 py-3">Total Créditos</th>
                        <th scope="col" className="px-6 py-3">Saldo Final</th>
                        <th scope="col" className="px-6 py-3 text-right">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    {history.map(item => {
                        const totalCommissions = (item.commissions || []).reduce((acc, c) => acc + (Number(c.value) || 0), 0);
                        const totalAdditions = (item.additions || []).reduce((acc, c) => acc + (Number(c.value) || 0), 0);
                        const totalCredits = totalCommissions + totalAdditions;
                        const isSelected = selectedIds.includes(item.id);

                        return (
                            <tr key={item.id} className={`bg-white border-b hover:bg-slate-50 ${isSelected ? 'bg-sky-50' : ''}`}>
                                <td className="w-4 p-4">
                                    <div className="flex items-center">
                                        <input 
                                            id={`checkbox-${item.id}`} 
                                            type="checkbox" 
                                            className="w-4 h-4 text-sky-600 bg-gray-100 border-gray-300 rounded focus:ring-sky-500 focus:ring-2"
                                            checked={isSelected}
                                            onChange={() => onToggleSelect(item.id)}
                                        />
                                        <label htmlFor={`checkbox-${item.id}`} className="sr-only">checkbox</label>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">{formatDate(item.date)}</td>
                                <td className="px-6 py-4 font-medium text-slate-900">{item.driver}</td>
                                <td className="px-6 py-4 text-slate-600 whitespace-nowrap">{formatCurrency(totalCommissions)}</td>
                                <td className="px-6 py-4 text-sky-700 font-medium whitespace-nowrap">{formatCurrency(totalCredits)}</td>
                                <td className={`px-6 py-4 font-semibold whitespace-nowrap ${item.final_balance >= 0 ? 'text-slate-800' : 'text-red-600'}`}>{formatCurrency(item.final_balance)}</td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex gap-2 justify-end">
                                        <Button size="sm" variant="ghost" onClick={() => onView(item.id)}>Ver</Button>
                                        <Button size="sm" variant="outline" onClick={() => onEdit(item.id)}>Editar</Button>
                                        <Button size="sm" variant="danger" onClick={() => onDelete(item.id)}>Excluir</Button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
        {history.length === 0 && <p className="text-slate-500 text-center py-8">Nenhum acerto salvo no histórico.</p>}
      </CardContent>
    </Card>
  );
};
