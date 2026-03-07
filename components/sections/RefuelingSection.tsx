
import React from 'react';
import type { Trip, Refueling } from '../../types';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { DatalistInput } from '../ui/DatalistInput';

interface RefuelingSectionProps {
  trip: Trip;
  setTrip: React.Dispatch<React.SetStateAction<Trip>>;
  savedLocations: string[];
}

export const RefuelingSection: React.FC<RefuelingSectionProps> = ({ trip, setTrip, savedLocations }) => {
  const handleAddRefueling = () => {
    setTrip(prev => ({
      ...prev,
      refuelings: [...prev.refuelings, { id: crypto.randomUUID(), date: '', location: '', odometer: '', liters: '', value: '' }]
    }));
  };

  const handleRemoveRefueling = (id: string) => {
    setTrip(prev => ({
      ...prev,
      refuelings: prev.refuelings.filter(r => r.id !== id)
    }));
  };

  const handleChange = (id: string, field: keyof Omit<Refueling, 'id'>, value: string | number) => {
    // Nota: Com o Input currency, value já vem como número. 
    // Para outros campos (litros, hodometro) que usam type=number no input, value vem como string do onChange e precisa de conversão se necessário.
    // Mas no código original, o Input chama handleChange que checa 'isNumericField' e converte com parseFloat.
    
    setTrip(prev => ({
      ...prev,
      refuelings: prev.refuelings.map(r => {
        if (r.id !== id) return r;
        
        let newValue: string | number = value;
        const isNumericField = ['odometer', 'liters', 'value'].includes(field);
        
        // Se for campo numérico, mas não for o 'value' (que agora é currency e já vem número), garantimos a conversão
        if (isNumericField && typeof value === 'string' && field !== 'value') {
             newValue = value === '' ? '' : parseFloat(value);
        }

        return { ...r, [field]: newValue };
      })
    }));
  };
  
  const sortedRefuelings = [...trip.refuelings].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return -1;
    if (!b.date) return 1;
    const dateDiff = b.date.localeCompare(a.date);
    if (dateDiff !== 0) return dateDiff;
    return (Number(b.odometer) || 0) - (Number(a.odometer) || 0);
  });
  
  return (
    <Card>
      <CardHeader action={<Button onClick={handleAddRefueling} size="sm">Adicionar Abastecimento</Button>}>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-sky-600" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 2.293a1 1 0 010 1.414L11.414 5l1.293 1.293a1 1 0 01-1.414 1.414L10 6.414l-1.293 1.293a1 1 0 01-1.414-1.414L8.586 5 7.293 3.707a1 1 0 011.414-1.414L10 3.586l1.293-1.293a1 1 0 011.414 0zM4 6a1 1 0 100-2 1 1 0 000 2zM4 10a1 1 0 100-2 1 1 0 000 2zM4 14a1 1 0 100-2 1 1 0 000 2zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z" clipRule="evenodd" />
        </svg>
        Abastecimentos
      </CardHeader>
      <CardContent className="space-y-4">
        {sortedRefuelings.map((refueling, index) => {
           const liters = Number(refueling.liters) || 0;
           const value = Number(refueling.value) || 0;
           const pricePerLiter = liters > 0 ? (value / liters).toFixed(2) : '0.00';

           const currentOdometer = Number(refueling.odometer) || 0;
           // In descending order, the previous refueling (chronologically) is the next one in the list (index + 1)
           const previousOdometer = index === sortedRefuelings.length - 1
             ? (Number(trip.initial_km) || 0)
             : (Number(sortedRefuelings[index + 1].odometer) || 0);

           const segmentDistance = currentOdometer > previousOdometer ? currentOdometer - previousOdometer : 0;
           const segmentAverage = liters > 0 && segmentDistance > 0 ? (segmentDistance / liters).toFixed(2) : '0.00';

           return (
            <div key={refueling.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start p-3 bg-slate-50 rounded-lg relative">
              <div className="md:col-span-2">
                  <Input label="Data" type="date" value={refueling.date} onChange={e => handleChange(refueling.id, 'date', e.target.value)} />
              </div>
              <div className="md:col-span-3">
                  <DatalistInput 
                    label="Local" 
                    value={refueling.location} 
                    onChange={e => handleChange(refueling.id, 'location', e.target.value)} 
                    placeholder="Posto, Cidade"
                    options={savedLocations}
                    id={`loc-${refueling.id}`}
                    autoComplete="off"
                  />
              </div>
              <div className="md:col-span-2">
                  <Input label="Hodômetro" type="number" value={refueling.odometer} onChange={e => handleChange(refueling.id, 'odometer', e.target.value)} autoComplete="off" />
              </div>
              {/* Aumentado para col-span-2 */}
              <div className="md:col-span-2">
                  <Input label="Litros" type="number" value={refueling.liters} onChange={e => handleChange(refueling.id, 'liters', e.target.value)} autoComplete="off" />
                  <div className="flex items-center justify-between mt-1 px-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Preço/L</span>
                      <span className="text-xs font-medium text-slate-600">R$ {pricePerLiter}</span>
                  </div>
              </div>
              {/* Aumentado para col-span-2 */}
              <div className="md:col-span-2">
                  <Input 
                    label="Valor (R$)" 
                    currency 
                    value={refueling.value} 
                    onChange={e => handleChange(refueling.id, 'value', e.target.value)} 
                    autoComplete="off" 
                  />
                  <div className="flex items-center justify-between mt-1 px-1">
                       <span className="text-[10px] uppercase font-bold text-slate-400">Média Seg.</span>
                       <span className="text-xs font-medium text-slate-600">{segmentAverage} km/L</span>
                  </div>
              </div>
              
              <div className="md:col-span-1 flex items-center justify-end pt-7">
                 <Button onClick={() => handleRemoveRefueling(refueling.id)} variant="danger" size="sm" className="w-full" title="Remover">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </Button>
              </div>
            </div>
           )
        })}
        {trip.refuelings.length === 0 && <p className="text-slate-500 text-center py-4">Nenhum abastecimento adicionado.</p>}
      </CardContent>
    </Card>
  );
};
