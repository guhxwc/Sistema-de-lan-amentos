
import React from 'react';
import type { Trip } from '../types';
import { SavedTrips } from './sections/SavedTrips';
import { ProfitFilter } from './sections/ProfitFilter';

interface SidebarProps {
    savedTrips: Trip[];
    activeTripId: string | null;
    onLoadTrip: (id: string) => void;
    onDeleteTrip: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ savedTrips, activeTripId, onLoadTrip, onDeleteTrip }) => {
    return (
        <aside className="space-y-8">
            <SavedTrips 
                savedTrips={savedTrips}
                activeTripId={activeTripId}
                onLoadTrip={onLoadTrip}
                onDeleteTrip={onDeleteTrip}
            />
            <ProfitFilter trips={savedTrips} />
        </aside>
    );
};
