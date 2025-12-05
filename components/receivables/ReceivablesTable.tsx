
import React from 'react';
import type { ReceivableFreight } from '../../types';
import { Card, CardContent } from '../ui/Card';
import { ReceivableRow } from './ReceivableRow';

interface ReceivablesTableProps {
  freights: ReceivableFreight[];
  selectedFreights: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (selectAll: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (freight: ReceivableFreight) => void;
  onUpdate: (freight: ReceivableFreight) => void;
}

export const ReceivablesTable: React.FC<ReceivablesTableProps> = ({ 
  freights, 
  selectedFreights,
  onToggleSelect,
  onToggleSelectAll,
  onDelete, 
  onEdit, 
  onUpdate 
}) => {
    const allSelected = freights.length > 0 && selectedFreights.size === freights.length;

    return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-500">
            <thead className="text-xs text-slate-700 uppercase bg-slate-100">
              <tr>
                <th scope="col" className="px-4 py-3 w-4">
                  <div className="flex items-center">
                    <input 
                      id="checkbox-all-receivables" 
                      type="checkbox" 
                      className="w-4 h-4 text-sky-600 bg-gray-100 border-gray-300 rounded focus:ring-sky-500 cursor-pointer"
                      checked={allSelected}
                      onChange={(e) => onToggleSelectAll(e.target.checked)}
                    />
                  </div>
                </th>
                <th scope="col" className="px-4 py-3">Data</th>
                <th scope="col" className="px-4 py-3">Vencimento</th>
                <th scope="col" className="px-4 py-3 min-w-[150px]">Cliente</th>
                <th scope="col" className="px-4 py-3">Origem</th>
                <th scope="col" className="px-4 py-3">Destino</th>
                <th scope="col" className="px-4 py-3">CT-e</th>
                <th scope="col" className="px-4 py-3">Valor Total</th>
                <th scope="col" className="px-4 py-3 min-w-[200px]">Pago</th>
                <th scope="col" className="px-4 py-3">Pendente</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3 min-w-[150px]">Ações</th>
              </tr>
            </thead>
            <tbody>
              {freights.map(freight => (
                <ReceivableRow 
                    key={freight.id}
                    freight={freight}
                    isSelected={selectedFreights.has(freight.id)}
                    onToggleSelect={() => onToggleSelect(freight.id)}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    onUpdate={onUpdate}
                />
              ))}
            </tbody>
          </table>
        </div>
        {freights.length === 0 && <p className="text-slate-500 text-center py-8">Nenhum frete encontrado.</p>}
      </CardContent>
    </Card>
  );
};
