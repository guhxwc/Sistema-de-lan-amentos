import type { Trip } from './types';

export const getInitialTrip = (): Trip => ({
  id: crypto.randomUUID(),
  driver: '',
  license_plate: '',
  departure_date: '',
  arrival_date: '',
  initial_km: '',
  final_km: '',
  freights: [],
  expenses: [],
  refuelings: [],
  observations: '',
});

export const getExampleTrip = (): Trip => ({
  id: crypto.randomUUID(),
  driver: 'Rafael',
  license_plate: 'ABC1D23',
  departure_date: '2023-10-01',
  arrival_date: '2023-10-05',
  initial_km: 894000,
  final_km: 896500,
  freights: [
    { id: crypto.randomUUID(), origin: 'São Paulo, SP', destination: 'Rio de Janeiro, RJ', value: 5500 },
    { id: crypto.randomUUID(), origin: 'Rio de Janeiro, RJ', destination: 'Belo Horizonte, MG', value: 6000 },
  ],
  expenses: [
    { id: crypto.randomUUID(), description: 'Comissão', value: 1150 },
    { id: crypto.randomUUID(), description: 'Pedágio', value: 350 },
    { id: crypto.randomUUID(), description: 'Alimentação', value: 400 },
  ],
  refuelings: [
    { id: crypto.randomUUID(), date: '2023-10-01', location: 'Posto XYZ, SP', odometer: 894000, liters: 150, value: 825 },
    { id: crypto.randomUUID(), date: '2023-10-03', location: 'Posto ABC, RJ', odometer: 895200, liters: 200, value: 1140 },
  ],
  observations: 'Viagem tranquila, sem ocorrências. Carga entregue no prazo.',
});