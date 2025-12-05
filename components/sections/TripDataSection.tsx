import React from 'react';
import type { Trip } from '../../types';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Input } from '../ui/Input';
import { DatalistInput } from '../ui/DatalistInput';

interface TripDataSectionProps {
  trip: Trip;
  setTrip: React.Dispatch<React.SetStateAction<Trip>>;
  savedDrivers: string[];
  savedLicensePlates: string[];
}

export const TripDataSection: React.FC<TripDataSectionProps> = ({ trip, setTrip, savedDrivers, savedLicensePlates }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setTrip(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? '' : parseFloat(value)) : value
    }));
  };

  return (
    <Card>
      <CardHeader>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
        Dados da Viagem
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DatalistInput label="Motorista" name="driver" value={trip.driver} onChange={handleChange} placeholder="Ex: Rafael" options={savedDrivers} id="driver-list" />
          <DatalistInput label="Placa" name="license_plate" value={trip.license_plate} onChange={handleChange} placeholder="Ex: ABC1D23" options={savedLicensePlates} id="plate-list" />
          <Input label="Saída" name="departure_date" type="date" value={trip.departure_date} onChange={handleChange} />
          <Input label="Chegada" name="arrival_date" type="date" value={trip.arrival_date} onChange={handleChange} />
          <Input label="KM Inicial" name="initial_km" type="number" value={trip.initial_km} onChange={handleChange} placeholder="Ex: 894000" />
          <Input label="KM Final" name="final_km" type="number" value={trip.final_km} onChange={handleChange} placeholder="Ex: 896500" />
        </div>
      </CardContent>
    </Card>
  );
};