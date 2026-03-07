
import React, { useState, useMemo } from 'react';
import type { ReceivableFreight } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface ReceivableRowProps {
  freight: ReceivableFreight;
  isSelected: boolean;
  onToggleSelect: () => void;
  onDelete: (id: string) => void;
  onEdit: (freight: ReceivableFreight) => void;
  onUpdate: (freight: ReceivableFreight) => void;
}

const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
};

const checkIsOverdue = (dueDateStr: string, pendingValue: number) => {
    if (!dueDateStr || pendingValue <= 0.01) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [year, month, day] = dueDateStr.split('-').map(Number);
    const dueDate = new Date(year, month - 1, day);
    
    return dueDate < today;
};

const getStatus = (totalValue: number, paidValue: number, isOverdue: boolean): { text: string, color: string } => {
    if (paidValue >= totalValue && totalValue > 0) return { text: 'Pago', color: 'bg-emerald-100 text-emerald-800' };
    if (isOverdue) return { text: 'Vencido', color: 'bg-red-100 text-red-800' };
    if (paidValue > 0) return { text: 'Parcial', color: 'bg-blue-100 text-blue-800' };
    return { text: 'Pendente', color: 'bg-amber-100 text-amber-800' };
};

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const ReceivableRow: React.FC<ReceivableRowProps> = ({ freight, isSelected, onToggleSelect, onDelete, onEdit, onUpdate }) => {
  // Use numeric state, but input component handles format
  const [paidInput, setPaidInput] = useState<string | number>(freight.paid_value === '' ? '' : freight.paid_value);

  const totalVal = Number(freight.total_value) || 0;
  const paidVal = Number(freight.paid_value) || 0;
  
  const pendingValue = useMemo(() => totalVal - paidVal, [totalVal, paidVal]);
  const isOverdue = useMemo(() => checkIsOverdue(freight.due_date, pendingValue), [freight.due_date, pendingValue]);
  const isPaid = totalVal > 0 && paidVal >= totalVal;
  
  const status = useMemo(() => getStatus(totalVal, paidVal, isOverdue), [totalVal, paidVal, isOverdue]);

  const handleSavePaidValue = () => {
    onUpdate({ ...freight, paid_value: paidInput === '' ? 0 : (typeof paidInput === 'string' ? parseFloat(paidInput) : paidInput) || 0 });
  };

  const handleDeliveryDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdate({ ...freight, delivery_date: e.target.value });
  };

  let rowBgClass = 'bg-white hover:bg-slate-50';
  if (isSelected) {
      rowBgClass = 'bg-sky-50 hover:bg-sky-100/50';
  } else if (isOverdue) {
      rowBgClass = 'bg-red-50 hover:bg-red-100/70';
  } else if (isPaid) {
      rowBgClass = 'bg-emerald-50 hover:bg-emerald-100/70';
  }

  return (
    <tr 
        className={`border-b transition-colors duration-200 ${rowBgClass}`}
        style={{ borderLeft: `4px solid ${freight.row_color || 'transparent'}` }}
    >
        <td className="px-4 py-2 w-4">
            <div className="flex items-center">
                <input 
                    id={`checkbox-row-${freight.id}`} 
                    type="checkbox" 
                    className="w-4 h-4 text-sky-600 bg-gray-100 border-gray-300 rounded focus:ring-sky-500 cursor-pointer"
                    checked={isSelected}
                    onChange={onToggleSelect}
                />
            </div>
        </td>
        <td className="px-4 py-2 whitespace-nowrap">{formatDate(freight.date)}</td>
        <td className={`px-4 py-2 whitespace-nowrap font-medium ${isOverdue ? 'text-red-700 font-bold' : ''}`}>{formatDate(freight.due_date)}</td>
        <td className="px-4 py-2 font-medium text-slate-900">{freight.client}</td>
        <td className="px-4 py-2">{freight.origin}</td>
        <td className="px-4 py-2">{freight.destination}</td>
        <td className="px-4 py-2">{freight.cte}</td>
        <td className="px-4 py-2 whitespace-nowrap">{formatCurrency(totalVal)}</td>
        <td className="px-4 py-2">
            <div className="flex items-center gap-2">
                <Input 
                    label="" 
                    id={`paid-${freight.id}`} 
                    currency
                    value={paidInput} 
                    onChange={e => setPaidInput(Number(e.target.value))}
                    className={`!py-1.5 bg-white/80 ${isOverdue ? 'border-red-200 focus:border-red-400 focus:ring-red-200' : ''}`}
                />
                <Button onClick={handleSavePaidValue} size="sm" variant={isOverdue ? 'danger' : 'primary'}>Salvar</Button>
            </div>
        </td>
        <td className={`px-4 py-2 whitespace-nowrap font-semibold ${isOverdue ? 'text-red-700' : ''}`}>{formatCurrency(pendingValue)}</td>
        <td className="px-4 py-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>{status.text}</span>
        </td>
        <td className="px-4 py-2">
             <div className="relative group">
                 <input
                    type="date"
                    className={`
                        px-3 py-2 
                        border-2 ${freight.delivery_date ? 'border-emerald-400 bg-emerald-50 text-emerald-900 font-bold' : 'border-slate-300 bg-white text-slate-700 font-medium'}
                        rounded-lg text-sm 
                        focus:border-sky-500 focus:ring-4 focus:ring-sky-500/20 focus:bg-white
                        outline-none w-40 transition-all duration-200 shadow-sm
                    `}
                    value={freight.delivery_date || ''}
                    onChange={handleDeliveryDateChange}
                    title="Data de Entrega"
                 />
             </div>
        </td>
        <td className="px-4 py-2">
            <div className="flex items-center gap-2">
                <Button onClick={() => onEdit(freight)} size="sm" variant="outline">Editar</Button>
                <Button onClick={() => onDelete(freight.id)} size="sm" variant="danger">Excluir</Button>
            </div>
        </td>
    </tr>
  );
};
