
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
    <div className="flex h-screen w-full bg-slate-100 overflow-hidden">
      <NavSidebar activeView={activeView} setActiveView={setActiveView} />
      
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <main className="flex-1 overflow-hidden relative w-full h-full">
          {activeView === 'trips' && <TripManagementView />}
          {activeView === 'settlements' && <SettlementView />}
          {activeView === 'receivables' && <ReceivablesView />}
          {activeView === 'fiscalNotes' && <FiscalNotesView />}
          {activeView === 'thirdPartyFreights' && <ThirdPartyFreightsView />}
          {activeView === 'dashboard' && <DashboardView />}
        </main>
      </div>
    </div>
  );
}

export default App;
