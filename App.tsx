
import React, { useState } from 'react';
import { NavSidebar } from './components/NavSidebar';
import { TripManagementView } from './components/views/TripManagementView';
import { SettlementView } from './components/views/SettlementView';
import { ReceivablesView } from './components/views/ReceivablesView';
import { FiscalNotesView } from './components/views/FiscalNotesView';
import { ThirdPartyFreightsView } from './components/views/ThirdPartyFreightsView';
import { DashboardView } from './components/views/DashboardView';

export type View = 'trips' | 'settlements' | 'receivables' | 'fiscalNotes' | 'thirdPartyFreights' | 'dashboard';

function App() {
  const [activeView, setActiveView] = useState<View>('trips');

  return (
    <div className="flex h-screen bg-slate-200 overflow-hidden">
      <NavSidebar activeView={activeView} setActiveView={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        
        <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
          {activeView === 'trips' && <TripManagementView />}
          {activeView === 'settlements' && <SettlementView />}
          {activeView === 'receivables' && <ReceivablesView />}
          {activeView === 'fiscalNotes' && <FiscalNotesView />}
          {activeView === 'thirdPartyFreights' && <ThirdPartyFreightsView />}
          {activeView === 'dashboard' && <DashboardView />}
        </div>
      </div>
    </div>
  );
}

export default App;
