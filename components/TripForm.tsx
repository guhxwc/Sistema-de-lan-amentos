
import React from 'react';
import type { Trip } from '../types';
import { TripDataSection } from './sections/TripDataSection';
import { FreightsSection } from './sections/FreightsSection';
import { ExpensesSection } from './sections/ExpensesSection';
import { RefuelingSection } from './sections/RefuelingSection';

interface TripFormProps {
  trip: Trip;
  setTrip: React.Dispatch<React.SetStateAction<Trip>>;
  savedDrivers: string[];
  savedLicensePlates: string[];
  savedExpenseCategories: string[];
  savedOrigins: string[];
  savedDestinations: string[];
  savedLocations: string[];
}

export const TripForm: React.FC<TripFormProps> = ({ 
    trip, 
    setTrip, 
    savedDrivers, 
    savedLicensePlates, 
    savedExpenseCategories,
    savedOrigins,
    savedDestinations,
    savedLocations
}) => {
  return (
    <div className="space-y-8">
      <TripDataSection 
        trip={trip} 
        setTrip={setTrip} 
        savedDrivers={savedDrivers}
        savedLicensePlates={savedLicensePlates}
      />
      <FreightsSection 
        trip={trip} 
        setTrip={setTrip} 
        savedOrigins={savedOrigins}
        savedDestinations={savedDestinations}
      />
      <ExpensesSection trip={trip} setTrip={setTrip} savedCategories={savedExpenseCategories} />
      <RefuelingSection 
        trip={trip} 
        setTrip={setTrip} 
        savedLocations={savedLocations}
      />
    </div>
  );
};
