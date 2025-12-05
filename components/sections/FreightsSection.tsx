
import React from 'react';
import type { Trip, Freight } from '../../types';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { DatalistInput } from '../ui/DatalistInput';

interface FreightsSectionProps {
  trip: Trip;
  setTrip: React.Dispatch<React.SetStateAction<Trip>>;
  savedOrigins: string[];
  savedDestinations: string[];
}

export const FreightsSection: React.FC<FreightsSectionProps> = ({ trip, setTrip, savedOrigins, savedDestinations }) => {
  const handleAddFreight = () => {
    setTrip(prev => ({
      ...prev,
      freights: [...prev.freights, { id: crypto.randomUUID(), origin: '', destination: '', value: '' }]
    }));
  };

  const handleRemoveFreight = (id: string) => {
    setTrip(prev => ({
      ...prev,
      freights: prev.freights.filter(f => f.id !== id)
    }));
  };

  const handleChange = (id: string, field: keyof Omit<Freight, 'id'>, value: string) => {
    const isNumericField = field === 'value';
    setTrip(prev => ({
      ...prev,
      freights: prev.freights.map(f =>
        f.id === id
          ? { ...f, [field]: isNumericField ? (value === '' ? '' : parseFloat(value)) : value }
          : f
      )
    }));
  };

  return (
    <Card>
      <CardHeader action={<Button onClick={handleAddFreight} size="sm">Adicionar Frete</Button>}>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        Fretes
      </CardHeader>
      <CardContent className="space-y-4">
        {trip.freights.map((freight, index) => (
          <div key={freight.id} className="grid grid-cols-1 md:grid-cols-8 gap-4 items-end p-3 bg-slate-50 rounded-lg">
            <div className="md:col-span-3">
              <DatalistInput 
                label={`Origem #${index + 1}`} 
                value={freight.origin} 
                onChange={e => handleChange(freight.id, 'origin', e.target.value)} 
                placeholder="Cidade, UF" 
                options={savedOrigins}
                id={`origin-${freight.id}`}
                autoComplete="off"
              />
            </div>
            <div className="md:col-span-3">
              <DatalistInput 
                label={`Destino #${index + 1}`} 
                value={freight.destination} 
                onChange={e => handleChange(freight.id, 'destination', e.target.value)} 
                placeholder="Cidade, UF" 
                options={savedDestinations}
                id={`dest-${freight.id}`}
                autoComplete="off"
              />
            </div>
            <div className="md:col-span-1">
              <Input label="Valor (R$)" type="number" value={freight.value} onChange={e => handleChange(freight.id, 'value', e.target.value)} autoComplete="off" />
            </div>
            <div className="md:col-span-1">
              <Button onClick={() => handleRemoveFreight(freight.id)} variant="danger" size="sm" className="w-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </Button>
            </div>
          </div>
        ))}
        {trip.freights.length === 0 && <p className="text-slate-500 text-center py-4">Nenhum frete adicionado.</p>}
      </CardContent>
    </Card>
  );
};
