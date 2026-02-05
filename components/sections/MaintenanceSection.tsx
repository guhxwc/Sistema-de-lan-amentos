
import React from 'react';
import type { Trip, Maintenance } from '../../types';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { DatalistInput } from '../ui/DatalistInput';

interface MaintenanceSectionProps {
  trip: Trip;
  setTrip: React.Dispatch<React.SetStateAction<Trip>>;
  savedTypes: string[];
  lastMaintenances?: Maintenance[];
  onShowHistory: () => void;
}

export const MaintenanceSection: React.FC<MaintenanceSectionProps> = ({ trip, setTrip, savedTypes, lastMaintenances, onShowHistory }) => {
  const handleAddMaintenance = () => {
    setTrip(prev => ({
      ...prev,
      maintenances: [
        ...prev.maintenances, 
        { 
          id: crypto.randomUUID(), 
          type: '', 
          date: new Date().toISOString().split('T')[0], 
          current_km: '', 
          next_km: '', 
          value: '',
          observations: ''
        }
      ]
    }));
  };

  const handleRemoveMaintenance = (id: string) => {
    setTrip(prev => ({
      ...prev,
      maintenances: prev.maintenances.filter(m => m.id !== id)
    }));
  };

  const handleChange = (id: string, field: keyof Omit<Maintenance, 'id'>, value: string) => {
    setTrip(prev => ({
      ...prev,
      maintenances: prev.maintenances.map(m => {
        if (m.id !== id) return m;

        const isNumericField = ['current_km', 'next_km', 'value'].includes(field);
        const newValue = isNumericField ? (value === '' ? '' : parseFloat(value)) : value;
        
        const updatedItem = { ...m, [field]: newValue };

        // Lógica de Intervalo Automático
        const getInterval = (type: string) => {
            const t = type.toLowerCase();
            if (t.includes('oleo') || t.includes('óleo')) return 30000;
            return 15000;
        };

        if (field === 'current_km' || field === 'type') {
            const currentVal = updatedItem.current_km;
            const numericCurrent = (typeof currentVal === 'number') ? currentVal : parseFloat(currentVal as string);
            
            if (!isNaN(numericCurrent) && currentVal !== '') {
                const interval = getInterval(updatedItem.type);
                updatedItem.next_km = numericCurrent + interval;
            } else if (field === 'current_km') {
                updatedItem.next_km = '';
            }
        }

        return updatedItem;
      })
    }));
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  return (
    <Card className="border-l-4 border-l-amber-500">
      <CardHeader action={
        <div className="flex gap-2">
            <Button onClick={onShowHistory} size="sm" variant="outline" className="text-amber-700 border-amber-200 hover:bg-amber-50">
                Histórico Completo
            </Button>
            <Button onClick={handleAddMaintenance} size="sm" variant="secondary">
                Adicionar Manutenção
            </Button>
        </div>
      }>
        <div className="flex items-center gap-2 text-amber-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
            Manutenção
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {lastMaintenances && lastMaintenances.length > 0 && (
            <div className="p-3 bg-sky-50 border border-sky-100 rounded-lg mb-4 text-sm animate-in slide-in-from-top-1">
                <div className="flex items-center justify-between mb-2 border-b border-sky-200 pb-1">
                     <div className="flex items-center gap-2 font-bold text-sky-800">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                        Últimos Registros (Por Tipo)
                    </div>
                    <span className="text-xs text-sky-600 italic">Baseado no histórico dessa placa</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {lastMaintenances.map((lm, i) => (
                        <div key={i} className="flex justify-between items-center p-2 bg-white rounded border border-sky-100 shadow-sm">
                            <div className="flex flex-col">
                                <span className="font-bold text-sky-700">{lm.type}</span>
                                <span className="text-xs text-slate-500">Data: {formatDate(lm.date)}</span>
                            </div>
                            <div className="text-right">
                                <div className="text-xs font-medium text-slate-700">KM {lm.current_km}</div>
                                {lm.next_km && <div className="text-[10px] font-bold text-sky-600 bg-sky-50 px-1 rounded">Próx: {lm.next_km}</div>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {trip.maintenances.map((m, index) => (
          <div key={m.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end p-3 bg-amber-50/50 rounded-lg border border-amber-100">
            <div className="md:col-span-3">
              <DatalistInput 
                label="Tipo de Serviço" 
                value={m.type} 
                onChange={e => handleChange(m.id, 'type', e.target.value)} 
                placeholder="Ex: Troca de Óleo" 
                options={savedTypes}
                id={`maint-type-${m.id}`}
              />
            </div>
            <div className="md:col-span-2">
                <Input label="Data" type="date" value={m.date} onChange={e => handleChange(m.id, 'date', e.target.value)} />
            </div>
            <div className="md:col-span-2">
                <Input label="KM Atual" type="number" value={m.current_km} onChange={e => handleChange(m.id, 'current_km', e.target.value)} placeholder="0" />
            </div>
            <div className="md:col-span-2">
                <Input label="Próxima Troca (Auto)" type="number" value={m.next_km} onChange={e => handleChange(m.id, 'next_km', e.target.value)} placeholder="0" />
            </div>
            <div className="md:col-span-2">
                <Input label="Custo (R$)" type="number" value={m.value} onChange={e => handleChange(m.id, 'value', e.target.value)} placeholder="0.00" />
            </div>
            <div className="md:col-span-1">
              <Button onClick={() => handleRemoveMaintenance(m.id)} variant="danger" size="sm" className="w-full" title="Remover">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </Button>
            </div>
          </div>
        ))}
        {trip.maintenances.length === 0 && (
            <div className="text-center py-4 text-amber-700/60 bg-amber-50 rounded-lg border border-dashed border-amber-200 text-sm">
                Nenhuma nova manutenção nesta viagem. Adicione apenas se estiver realizando o serviço agora.
            </div>
        )}
      </CardContent>
    </Card>
  );
};
