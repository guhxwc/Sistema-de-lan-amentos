
import React from 'react';
import { ProcessedCte } from '../../types';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';

interface CteInboxModalProps {
  ctes: ProcessedCte[];
  onSelect: (cte: ProcessedCte) => void;
  onClose: () => void;
  onDelete: (id: string) => void;
  loading: boolean;
}

export const CteInboxModal: React.FC<CteInboxModalProps> = ({ ctes, onSelect, onClose, onDelete, loading }) => {
  const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatDate = (dateStr: string) => {
      if (!dateStr) return '-';
      return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-5xl bg-white animate-in fade-in-0 zoom-in-95 flex flex-col max-h-[90vh]">
        <CardHeader>
          <div className="flex justify-between items-center w-full">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sky-100 rounded-lg text-sky-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Caixa de Entrada XML (E-mail)</h2>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">CT-es processados automaticamente</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden flex flex-col p-0">
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <p className="text-sm text-slate-600">
              Estes CT-es foram detectados automaticamente no seu e-mail de integração. Clique em um item para preencher o formulário de Contas a Receber.
            </p>
          </div>
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                 <svg className="animate-spin h-10 w-10 text-sky-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-slate-500 font-medium">Buscando CT-es do e-mail...</span>
              </div>
            ) : ctes.length > 0 ? (
              <table className="w-full text-sm text-left text-slate-500">
                <thead className="text-xs text-slate-700 uppercase bg-slate-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3">Recebido</th>
                    <th className="px-6 py-3">Emissão</th>
                    <th className="px-6 py-3">Cliente</th>
                    <th className="px-6 py-3">Nº CT-e</th>
                    <th className="px-6 py-3">Rota</th>
                    <th className="px-6 py-3 text-right">Valor</th>
                    <th className="px-6 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ctes.map((cte) => (
                    <tr key={cte.id} className="bg-white hover:bg-sky-50 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400">
                        {formatDate(cte.received_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-600">
                        {formatDate(cte.emission_date)}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900">
                        {cte.client_name}
                      </td>
                      <td className="px-6 py-4">
                         <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-mono text-xs">{cte.cte_number}</span>
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <div className="flex flex-col">
                            <span className="text-slate-500">De: {cte.origin}</span>
                            <span className="text-slate-500">Para: {cte.destination}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-sky-700">
                        {formatCurrency(cte.total_value)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                           <Button size="sm" onClick={() => onSelect(cte)}>Preencher</Button>
                           <Button size="sm" variant="danger" onClick={() => onDelete(cte.id)}>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                           </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-slate-900">Caixa de entrada vazia</h3>
                  <p className="text-slate-500 max-w-xs mx-auto mt-1">
                    Não encontramos novos XMLs de CT-e no e-mail de integração.
                  </p>
              </div>
            )}
          </div>
        </CardContent>
        <div className="p-4 border-t border-slate-200 flex justify-between items-center bg-slate-50 rounded-b-2xl">
            <span className="text-xs text-slate-400">Total: {ctes.length} item(ns) pendente(s)</span>
            <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
        </div>
      </Card>
    </div>
  );
};
