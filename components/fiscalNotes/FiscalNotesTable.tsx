
import React from 'react';
import type { FiscalNote } from '../../types';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';

interface FiscalNotesTableProps {
  notes: FiscalNote[];
  selectedNotes: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (selectAll: boolean) => void;
  onToggleStatus: (id: string) => void;
  onToggleClientDelivered: (id: string) => void;
  onEdit: (note: FiscalNote) => void;
}

const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
};

export const FiscalNotesTable: React.FC<FiscalNotesTableProps> = ({ 
  notes, 
  selectedNotes,
  onToggleSelect,
  onToggleSelectAll,
  onToggleStatus, 
  onToggleClientDelivered,
  onEdit
}) => {
  const allSelected = notes.length > 0 && selectedNotes.size === notes.length;

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
                      id="checkbox-all" 
                      type="checkbox" 
                      className="w-4 h-4 text-sky-600 bg-gray-100 border-gray-300 rounded focus:ring-sky-500"
                      checked={allSelected}
                      onChange={(e) => onToggleSelectAll(e.target.checked)}
                    />
                    <label htmlFor="checkbox-all" className="sr-only">checkbox</label>
                  </div>
                </th>
                <th scope="col" className="px-6 py-3">Empresa</th>
                <th scope="col" className="px-6 py-3">Carregamento</th>
                <th scope="col" className="px-6 py-3">Nº NF</th>
                <th scope="col" className="px-6 py-3">Status Entrega</th>
                <th scope="col" className="px-6 py-3 text-center">Entregue ao Cliente</th>
                <th scope="col" className="px-6 py-3">Local Entrega</th>
                <th scope="col" className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {notes.map(note => (
                <tr key={note.id} className={`bg-white border-b hover:bg-slate-50 ${selectedNotes.has(note.id) ? 'bg-sky-50' : ''}`}>
                  <td className="px-4 py-4 w-4">
                    <div className="flex items-center">
                      <input 
                        id={`checkbox-table-${note.id}`} 
                        type="checkbox" 
                        className="w-4 h-4 text-sky-600 bg-gray-100 border-gray-300 rounded focus:ring-sky-500"
                        checked={selectedNotes.has(note.id)}
                        onChange={() => onToggleSelect(note.id)}
                      />
                      <label htmlFor={`checkbox-table-${note.id}`} className="sr-only">checkbox</label>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900">{note.company}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{formatDate(note.shipping_date)}</td>
                  <td className="px-6 py-4">{note.nf_number}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${note.status === 'Entregue' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {note.status}
                        </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {note.client_delivered ? (
                         <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 border border-teal-200">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Sim
                        </span>
                    ) : (
                        <span className="text-slate-400 text-xs font-medium">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">{note.delivery_location}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex gap-2 justify-end">
                      <Button 
                        onClick={() => onToggleClientDelivered(note.id)} 
                        size="sm" 
                        variant={note.client_delivered ? "primary" : "outline"}
                        className={note.client_delivered ? "!bg-teal-600 !border-teal-600 hover:!bg-teal-700" : ""}
                        title={note.client_delivered ? "Desmarcar entrega ao cliente" : "Marcar como entregue ao cliente"}
                      >
                         {note.client_delivered ? (
                             <div className="flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                Entregue ao Cliente
                             </div>
                         ) : 'Entregue ao Cliente'}
                      </Button>
                      <Button onClick={() => onToggleStatus(note.id)} size="sm" variant={note.status === 'Pendente' ? 'primary' : 'secondary'}>
                        {note.status === 'Pendente' ? 'Entregue' : 'Pendente'}
                      </Button>
                      <Button onClick={() => onEdit(note)} size="sm" variant="ghost">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {notes.length === 0 && <p className="text-slate-500 text-center py-8">Nenhuma nota fiscal encontrada.</p>}
      </CardContent>
    </Card>
  );
};
