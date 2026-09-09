
import React from 'react';
import type { ThirdPartyFreight } from '../../types';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';

interface ThirdPartyFreightsTableProps {
  freights: ThirdPartyFreight[];
  selectedFreights: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (selectAll: boolean) => void;
  onEdit: (freight: ThirdPartyFreight) => void;
  onDelete: (id: string) => void;
  onSetAsPaid: (id: string) => void;
  onViewDetails?: (freight: ThirdPartyFreight) => void;
}

const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
};

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const ThirdPartyFreightsTable: React.FC<ThirdPartyFreightsTableProps> = ({ 
  freights, 
  selectedFreights,
  onToggleSelect,
  onToggleSelectAll,
  onEdit, 
  onDelete, 
  onSetAsPaid,
  onViewDetails
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
                      id="checkbox-all-tp" 
                      type="checkbox" 
                      className="w-4 h-4 text-sky-600 bg-gray-100 border-gray-300 rounded focus:ring-sky-500"
                      checked={allSelected}
                      onChange={(e) => onToggleSelectAll(e.target.checked)}
                    />
                    <label htmlFor="checkbox-all-tp" className="sr-only">checkbox</label>
                  </div>
                </th>
                <th scope="col" className="px-4 py-3">Motorista/Placa</th>
                <th scope="col" className="px-4 py-3">Data</th>
                <th scope="col" className="px-4 py-3">Rota</th>
                <th scope="col" className="px-4 py-3">Frete Empresa</th>
                <th scope="col" className="px-4 py-3">Frete Pago</th>
                <th scope="col" className="px-4 py-3">Pedágio</th>
                <th scope="col" className="px-4 py-3">Adiantamento</th>
                <th scope="col" className="px-4 py-3">Saldo a Pagar</th>
                <th scope="col" className="px-4 py-3">Lucro Líquido</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {freights.map(freight => {
                const paidVal = Number(freight.paid_freight_value) || 0;
                const advanceVal = Number(freight.advance_payment) || 0;
                const companyVal = Number(freight.company_freight_value) || 0;
                const tollVal = Number(freight.toll_value) || 0;

                // Saldo = Frete Pago - Adiantamento (Pedágio não entra no saldo)
                const balanceToPay = paidVal - advanceVal;
                
                // Lucro = Receita Empresa - (Pago ao Motorista + Pedágio)
                // O pedágio continua descontando do lucro da empresa
                const netProfit = companyVal - (paidVal + tollVal);

                const isSelected = selectedFreights.has(freight.id);
                
                let rowBaseClass = 'bg-white hover:bg-slate-50';
                if (isSelected) {
                    rowBaseClass = 'bg-sky-50 hover:bg-sky-100/50';
                } else if (freight.status === 'Pago') {
                    rowBaseClass = 'bg-emerald-50 hover:bg-emerald-100/50';
                }
                
                return (
                    <tr 
                        key={freight.id} 
                        className={`border-b transition-colors duration-200 cursor-pointer ${rowBaseClass}`}
                        onDoubleClick={() => onViewDetails?.(freight)}
                    >
                        <td className="px-4 py-2 w-4">
                            <div className="flex items-center">
                                <input 
                                    id={`checkbox-tp-${freight.id}`} 
                                    type="checkbox" 
                                    className="w-4 h-4 text-sky-600 bg-gray-100 border-gray-300 rounded focus:ring-sky-500"
                                    checked={isSelected}
                                    onChange={() => onToggleSelect(freight.id)}
                                />
                                <label htmlFor={`checkbox-tp-${freight.id}`} className="sr-only">checkbox</label>
                            </div>
                        </td>
                        <td className="px-4 py-2">
                            <div className="font-medium text-slate-900">{freight.driver}</div>
                            <div className="text-xs text-slate-500">{freight.license_plate}</div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">{formatDate(freight.date)}</td>
                        <td className="px-4 py-2">
                            <div>{freight.origin}</div>
                            <div className="text-xs text-slate-500">→ {freight.destination}</div>
                        </td>
                        <td className="px-4 py-2">{formatCurrency(companyVal)}</td>
                        <td className="px-4 py-2">{formatCurrency(paidVal)}</td>
                        <td className="px-4 py-2 text-slate-600">{tollVal > 0 ? formatCurrency(tollVal) : '-'}</td>
                        <td className="px-4 py-2">{formatCurrency(advanceVal)}</td>
                        <td className={`px-4 py-2 font-semibold ${balanceToPay < 0 ? 'text-red-600' : ''}`}>{formatCurrency(balanceToPay)}</td>
                        <td className={`px-4 py-2 font-semibold ${netProfit < 0 ? 'text-red-600' : 'text-sky-800'}`}>{formatCurrency(netProfit)}</td>
                        <td className="px-4 py-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${freight.status === 'Pago' ? 'bg-emerald-100 text-emerald-800' : freight.status === 'Parcial' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                                {freight.status}
                            </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                            <div className="flex gap-2 justify-end">
                                {freight.status !== 'Pago' && (
                                  <Button onClick={() => onSetAsPaid(freight.id)} size="sm" variant="primary">
                                      Pagar
                                  </Button>
                                )}
                                <Button onClick={() => onEdit(freight)} size="sm" variant="outline">Editar</Button>
                                <Button onClick={() => onDelete(freight.id)} size="sm" variant="danger">Excluir</Button>
                            </div>
                        </td>
                    </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {freights.length === 0 && <p className="text-slate-500 text-center py-8">Nenhum frete terceirizado encontrado.</p>}
      </CardContent>
    </Card>
  );
};
