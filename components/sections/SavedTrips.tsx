
import React, { useState, useMemo } from 'react';
import type { Trip } from '../../types';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface SavedTripsProps {
    savedTrips: Trip[];
    activeTripId: string | null;
    onLoadTrip: (id: string) => void;
    onDeleteTrip: (id: string) => void;
}

const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
};

const TripCard: React.FC<{ trip: Trip; isActive: boolean; onLoad: () => void; onDelete: () => void; }> = ({ trip, isActive, onLoad, onDelete }) => {
    const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    
    const profit = useMemo(() => {
        const totalFreights = trip.freights.reduce((acc, f) => acc + (Number(f.value) || 0), 0);
        const totalDiesel = trip.refuelings.reduce((acc, r) => acc + (Number(r.value) || 0), 0);
        const totalExpenses = trip.expenses.reduce((acc, e) => acc + (Number(e.value) || 0), 0);
        return totalFreights - (totalDiesel + totalExpenses);
    }, [trip]);

    const dateDisplay = trip.departure_date && trip.arrival_date 
        ? `${formatDate(trip.departure_date)} - ${formatDate(trip.arrival_date)}`
        : trip.departure_date 
            ? formatDate(trip.departure_date)
            : '';

    return (
        <div className={`p-4 rounded-lg border transition-all duration-200 ${isActive ? 'bg-sky-50 border-sky-300 shadow-md' : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'}`}>
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-semibold text-slate-800">{trip.driver}</p>
                    <p className="text-xs text-slate-500">{trip.license_plate}</p>
                    <p className="text-xs text-slate-500">{dateDisplay}</p>
                </div>
                <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${profit >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                    {formatCurrency(profit)}
                </div>
            </div>
            <div className="flex gap-2 mt-3">
                <Button onClick={onLoad} size="sm" variant={isActive ? 'primary' : 'outline'} className="w-full">
                    {isActive ? 'Carregada' : 'Carregar'}
                </Button>
                <Button onClick={onDelete} size="sm" variant="danger">Excluir</Button>
            </div>
        </div>
    );
};


export const SavedTrips: React.FC<SavedTripsProps> = ({ savedTrips, activeTripId, onLoadTrip, onDeleteTrip }) => {
    const [filter, setFilter] = useState('');

    const filteredTrips = useMemo(() => {
        return savedTrips.filter(trip => 
            trip.driver.toLowerCase().includes(filter.toLowerCase()) ||
            trip.license_plate.toLowerCase().includes(filter.toLowerCase())
        );
    }, [savedTrips, filter]);

    return (
        <Card>
            <CardHeader>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-sky-600" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                </svg>
                Viagens Salvas
            </CardHeader>
            <div className="p-4 border-b border-slate-200">
                 <Input label="" id="search-trip" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filtrar por motorista, placa..." />
            </div>
            <CardContent className="max-h-[400px] overflow-y-auto space-y-3">
                {filteredTrips.length > 0 ? filteredTrips.map(trip => (
                    <TripCard 
                        key={trip.id} 
                        trip={trip}
                        isActive={trip.id === activeTripId}
                        onLoad={() => onLoadTrip(trip.id)}
                        onDelete={() => onDeleteTrip(trip.id)}
                    />
                )) : <p className="text-slate-500 text-center py-4">Nenhuma viagem encontrada.</p>}
            </CardContent>
        </Card>
    );
};
