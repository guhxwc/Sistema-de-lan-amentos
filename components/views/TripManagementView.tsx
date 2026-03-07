
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { Trip, Maintenance } from '../../types';
import { Header } from '../Header';
import { TripForm } from '../TripForm';
import { Sidebar } from '../Sidebar';
import { SummaryFooter } from '../SummaryFooter';
import { getInitialTrip, getExampleTrip } from '../../constants';
import { supabase, getDistinctValues } from '../../lib/supabaseClient';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { MaintenanceHistoryModal } from '../modals/MaintenanceHistoryModal';

export function TripManagementView() {
  const [currentTrip, setCurrentTrip] = useState<Trip>(getInitialTrip());
  const [savedTrips, setSavedTrips] = useState<Trip[]>([]);
  const [activeTripId, setActiveTripId] = useState<string | null>(null);

  const [savedDrivers, setSavedDrivers] = useState<string[]>([]);
  const [savedLicensePlates, setSavedLicensePlates] = useState<string[]>([]);
  
  // Estado para controlar modal de histórico
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const fetchTrips = useCallback(async () => {
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      alert(`Erro ao buscar viagens: ${error.message}`);
    } else {
      // Null Safety: Garante que os campos JSONB sejam arrays
      const safeData = (data || []).map((trip: Trip) => ({
        ...trip,
        freights: trip.freights || [],
        expenses: trip.expenses || [],
        refuelings: trip.refuelings || [],
        maintenances: trip.maintenances || []
      }));
      setSavedTrips(safeData);
    }
  }, []);

  const fetchAutocompleteData = useCallback(async () => {
    try {
      const [drivers, plates] = await Promise.all([
        getDistinctValues('trips', 'driver'),
        getDistinctValues('trips', 'license_plate')
      ]);
      setSavedDrivers(drivers);
      setSavedLicensePlates(plates);
    } catch(error: any) {
        console.error(`Erro ao carregar dados de autocompletar: ${error.message}`);
    }
  }, []);

  useEffect(() => {
    fetchTrips();
    fetchAutocompleteData();

    const channel = supabase.channel('trips-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, (payload) => {
        console.log('Change received!', payload);
        fetchTrips(); 
        fetchAutocompleteData(); 
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTrips, fetchAutocompleteData]);

  // LOGICA: Atualizar data de chegada e KM final com base nos abastecimentos da viagem ATUAL
  useEffect(() => {
    if (currentTrip.refuelings && currentTrip.refuelings.length > 0) {
      const maxOdometer = currentTrip.refuelings.reduce(
        (max, r) => Math.max(max, Number(r.odometer) || 0),
        0
      );
      
      const dates = currentTrip.refuelings
        .map(r => r.date)
        .filter(d => !!d)
        .sort();
      const lastRefuelingDate = dates.length > 0 ? dates[dates.length - 1] : null;

      setCurrentTrip(prev => {
        let updates: Partial<Trip> = {};
        let hasChanges = false;

        if (maxOdometer > 0 && maxOdometer > (Number(prev.final_km) || 0)) {
          updates.final_km = maxOdometer;
          hasChanges = true;
        }

        if (lastRefuelingDate && lastRefuelingDate !== prev.arrival_date) {
            updates.arrival_date = lastRefuelingDate;
            hasChanges = true;
        }

        return hasChanges ? { ...prev, ...updates } : prev;
      });
    }
  }, [currentTrip.refuelings]);

  // LOGICA: Buscar última placa usada pelo motorista selecionado
  useEffect(() => {
    const fetchLastPlate = async () => {
      if (activeTripId) return;
      if (!currentTrip.driver) return;

      try {
        const { data, error } = await supabase
          .from('trips')
          .select('license_plate')
          .eq('driver', currentTrip.driver.trim().toUpperCase())
          .order('departure_date', { ascending: false })
          .limit(1)
          .single();

        if (!error && data && data.license_plate) {
           setCurrentTrip(prev => {
             if (prev.license_plate !== data.license_plate) {
                 return { ...prev, license_plate: data.license_plate };
             }
             return prev;
           });
        }
      } catch (err) { }
    };

    const timeoutId = setTimeout(() => fetchLastPlate(), 500);
    return () => clearTimeout(timeoutId);
  }, [currentTrip.driver, activeTripId]);

  // LOGICA CORRIGIDA: Busca robusta do KM inicial baseado no histórico do veículo
  useEffect(() => {
    const fetchLastKm = async () => {
      if (activeTripId) return; 
      if (!currentTrip.license_plate) return;

      const plate = currentTrip.license_plate.trim().toUpperCase();

      try {
         // Buscamos as últimas 10 viagens desse veículo para garantir que pegamos o KM mais recente real
         const { data: recentTrips } = await supabase
          .from('trips')
          .select('final_km, refuelings, departure_date')
          .eq('license_plate', plate)
          .order('departure_date', { ascending: false })
          .limit(10);

        if (recentTrips && recentTrips.length > 0) {
          let absoluteMaxKm = 0;

          recentTrips.forEach(trip => {
            // Verifica KM Final da viagem
            const fkm = Number(trip.final_km) || 0;
            
            // Verifica todos os abastecimentos daquela viagem
            const refuelKms = (trip.refuelings || []).map((r: any) => Number(r.odometer) || 0);
            const tripMax = Math.max(fkm, ...refuelKms);
            
            if (tripMax > absoluteMaxKm) {
              absoluteMaxKm = tripMax;
            }
          });

          if (absoluteMaxKm > 0) {
            setCurrentTrip(prev => ({ 
                ...prev, 
                initial_km: absoluteMaxKm 
            }));
          }
        }
      } catch (err) {
        console.error("Erro ao buscar km robusto pela placa:", err);
      }
    };

    const timeoutId = setTimeout(() => fetchLastKm(), 600);
    return () => clearTimeout(timeoutId);
  }, [currentTrip.license_plate, activeTripId]);

  // CÁLCULO DE HISTÓRICO DE MANUTENÇÃO COMPLETO PARA A PLACA ATUAL
  const fullMaintenanceHistory = useMemo(() => {
    if (!currentTrip.license_plate) return [];
    
    const plate = currentTrip.license_plate.trim().toUpperCase();
    const history: (Maintenance & { tripDate?: string })[] = [];

    savedTrips.forEach(t => {
        if (t.license_plate === plate && t.maintenances && t.maintenances.length > 0) {
            t.maintenances.forEach(m => {
                history.push({
                    ...m,
                    tripDate: t.departure_date 
                });
            });
        }
    });

    return history.sort((a, b) => {
        const dateA = a.date || a.tripDate || '';
        const dateB = b.date || b.tripDate || '';
        return dateB.localeCompare(dateA);
    });
  }, [currentTrip.license_plate, savedTrips]);

  const uniqueLastMaintenances = useMemo(() => {
    const uniqueMap = new Map<string, Maintenance>();
    fullMaintenanceHistory.forEach(item => {
        if (!item.type) return;
        const normalizedType = item.type.trim().toUpperCase();
        if (!uniqueMap.has(normalizedType)) {
            uniqueMap.set(normalizedType, item);
        }
    });
    return Array.from(uniqueMap.values());
  }, [fullMaintenanceHistory]);

  const maintenanceAlerts = useMemo(() => {
    if (!currentTrip.license_plate || !currentTrip.initial_km) return [];
    const currentKm = Number(currentTrip.initial_km);
    const alerts: string[] = [];
    const typesBeingFixed = new Set(currentTrip.maintenances.map(m => m.type ? m.type.trim().toLowerCase() : ''));

    uniqueLastMaintenances.forEach(maint => {
        if (!maint.type || !maint.next_km) return;
        const normalizedType = maint.type.trim().toLowerCase();
        if (typesBeingFixed.has(normalizedType)) return;

        const nextKm = Number(maint.next_km);
        const remaining = nextKm - currentKm;

        if (remaining <= 0) {
            alerts.push(`URGENTE: ${maint.type} vencida há ${Math.abs(remaining)} km (Venceu em ${nextKm} km)`);
        } else if (remaining <= 1000) {
            alerts.push(`ATENÇÃO: ${maint.type} vence em ${remaining} km (Próxima troca: ${nextKm} km)`);
        }
    });
    return alerts;
  }, [currentTrip.license_plate, currentTrip.initial_km, currentTrip.maintenances, uniqueLastMaintenances]);

  const calculations = useMemo(() => {
    const totalFreights = currentTrip.freights.reduce((acc, f) => acc + (Number(f.value) || 0), 0);
    const totalDieselCost = currentTrip.refuelings.reduce((acc, r) => acc + (Number(r.value) || 0), 0);
    const totalExpenses = currentTrip.expenses.reduce((acc, e) => acc + (Number(e.value) || 0), 0);
    const totalMaintenance = (currentTrip.maintenances || []).reduce((acc, m) => acc + (Number(m.value) || 0), 0);
    const profit = totalFreights - (totalDieselCost + totalExpenses + totalMaintenance);
    const totalLiters = currentTrip.refuelings.reduce((acc, r) => acc + (Number(r.liters) || 0), 0);
    const initialKm = Number(currentTrip.initial_km) || 0;
    const finalKm = Number(currentTrip.final_km) || 0;
    const distance = finalKm > initialKm ? finalKm - initialKm : 0;
    const averageKmL = totalLiters > 0 && distance > 0 ? distance / totalLiters : 0;
    const averagePricePerLiter = totalLiters > 0 ? totalDieselCost / totalLiters : 0;

    return { totalFreights, totalDieselCost, totalExpenses, totalMaintenance, profit, distance, averageKmL, averagePricePerLiter };
  }, [currentTrip]);

  const { savedExpenseCategories, savedOrigins, savedDestinations, savedLocations, savedMaintenanceTypes } = useMemo(() => {
    const categories = new Set<string>();
    const origins = new Set<string>();
    const destinations = new Set<string>();
    const locations = new Set<string>();
    const maintenanceTypes = new Set<string>();

    savedTrips.forEach(trip => {
      trip.expenses?.forEach(e => { if (e.description) categories.add(e.description.trim()); });
      trip.freights?.forEach(f => {
          if (f.origin) origins.add(f.origin.trim());
          if (f.destination) destinations.add(f.destination.trim());
      });
      trip.refuelings?.forEach(r => { if (r.location) locations.add(r.location.trim()); });
      trip.maintenances?.forEach(m => { if (m.type) maintenanceTypes.add(m.type.trim()); });
    });
    
    return {
        savedExpenseCategories: Array.from(categories).sort(),
        savedOrigins: Array.from(origins).sort(),
        savedDestinations: Array.from(destinations).sort(),
        savedLocations: Array.from(locations).sort(),
        savedMaintenanceTypes: Array.from(maintenanceTypes).sort()
    };
  }, [savedTrips]);

  const handleNewTrip = useCallback(() => {
    setCurrentTrip(getInitialTrip());
    setActiveTripId(null);
  }, []);

  const handleSaveTrip = useCallback(async () => {
    const tripToSave = { 
        ...currentTrip,
        arrival_date: currentTrip.arrival_date || null,
        driver: currentTrip.driver ? currentTrip.driver.trim().toUpperCase() : '',
        license_plate: currentTrip.license_plate ? currentTrip.license_plate.trim().toUpperCase() : '',
        departure_date: currentTrip.departure_date || null,
        initial_km: currentTrip.initial_km === '' ? null : currentTrip.initial_km,
        final_km: currentTrip.final_km === '' ? null : currentTrip.final_km,
        freights: currentTrip.freights.map(f => ({ ...f, origin: f.origin ? f.origin.trim() : '', destination: f.destination ? f.destination.trim() : '' })),
        refuelings: currentTrip.refuelings.map(r => ({ ...r, location: r.location ? r.location.trim() : '' })),
        expenses: currentTrip.expenses.map(e => ({ ...e, description: e.description ? e.description.trim() : '' })),
        maintenances: currentTrip.maintenances.map(m => ({ ...m, type: m.type ? m.type.trim() : '' }))
    };
    
    const { error } = await supabase.from('trips').upsert(tripToSave);
    if (error) {
      alert(`Erro ao salvar viagem: ${error.message}`);
    } else {
      alert('Viagem salva com sucesso!');
      setCurrentTrip(getInitialTrip());
      setActiveTripId(null);
      await fetchTrips();
      await fetchAutocompleteData();
    }
  }, [currentTrip, fetchTrips, fetchAutocompleteData]);
  
  const handleLoadTrip = useCallback((tripId: string) => {
    const tripToLoad = savedTrips.find(t => t.id === tripId);
    if (tripToLoad) {
      setCurrentTrip({
          ...tripToLoad,
          freights: tripToLoad.freights || [],
          expenses: tripToLoad.expenses || [],
          refuelings: tripToLoad.refuelings || [],
          maintenances: tripToLoad.maintenances || []
      });
      setActiveTripId(tripId);
    }
  }, [savedTrips]);
  
  const handleDeleteTrip = useCallback(async (tripId: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta viagem?')) {
        const { error } = await supabase.from('trips').delete().eq('id', tripId);
        if (error) {
            alert(`Erro ao excluir viagem: ${error.message}`);
        } else {
            alert('Viagem excluída com sucesso.');
            if (activeTripId === tripId) handleNewTrip();
            await fetchTrips();
            await fetchAutocompleteData();
        }
    }
  }, [activeTripId, handleNewTrip, fetchTrips, fetchAutocompleteData]);

  const handleFillExample = useCallback(() => {
    const exampleTrip = getExampleTrip();
    setCurrentTrip(exampleTrip);
    setActiveTripId(exampleTrip.id);
  }, []);

  const handleGeneratePDF = useCallback(() => {
    if (!currentTrip.driver) {
      alert('Preencha pelo menos o nome do motorista para gerar o PDF.');
      return;
    }

    const doc = new jsPDF();
    const colorSlate900 = [15, 23, 42]; 
    const colorSlate500 = [100, 116, 139]; 
    const marginLeft = 15;
    const marginRight = 195;
    let currentY = 20;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(colorSlate900[0], colorSlate900[1], colorSlate900[2]);
    doc.text('Relatório de Viagem', marginLeft, currentY);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(colorSlate500[0], colorSlate500[1], colorSlate500[2]);
    const today = new Date().toLocaleDateString('pt-BR');
    doc.text(`Gerado em: ${today}`, marginRight, currentY, { align: 'right' });
    
    currentY += 10;
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Motorista: ${currentTrip.driver}`, marginLeft, currentY);
    doc.text(`Placa: ${currentTrip.license_plate}`, 80, currentY);
    const dateRange = `${currentTrip.departure_date ? new Date(currentTrip.departure_date).toLocaleDateString('pt-BR') : '-'} a ${currentTrip.arrival_date ? new Date(currentTrip.arrival_date).toLocaleDateString('pt-BR') : '-'}`;
    doc.text(`Período: ${dateRange}`, 140, currentY);
    
    currentY += 15;

    const formatBRL = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const tableOptions: any = {
        theme: 'striped',
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
        margin: { left: marginLeft, right: 15 } 
    };

    if (currentTrip.freights.length > 0) {
        doc.text('Fretes', marginLeft, currentY);
        currentY += 2;
        autoTable(doc, {
            startY: currentY + 2,
            head: [['Origem', 'Destino', 'Valor']],
            body: currentTrip.freights.map(f => [f.origin, f.destination, formatBRL(Number(f.value) || 0)]),
            ...tableOptions
        });
        currentY = (doc as any).lastAutoTable.finalY + 10;
    }

    if (currentTrip.maintenances && currentTrip.maintenances.length > 0) {
        doc.text('Manutenção', marginLeft, currentY);
        currentY += 2;
        autoTable(doc, {
            startY: currentY + 2,
            head: [['Serviço', 'Data', 'KM Atual', 'Prox. KM', 'Valor']],
            body: currentTrip.maintenances.map(m => [
                m.type, 
                m.date ? new Date(m.date).toLocaleDateString('pt-BR') : '-',
                m.current_km,
                m.next_km,
                formatBRL(Number(m.value) || 0)
            ]),
            ...tableOptions
        });
        currentY = (doc as any).lastAutoTable.finalY + 10;
    }

    if (currentTrip.expenses.length > 0) {
        doc.text('Despesas', marginLeft, currentY);
        currentY += 2;
        autoTable(doc, {
            startY: currentY + 2,
            head: [['Descrição', 'Valor']],
            body: currentTrip.expenses.map(e => [e.description, formatBRL(Number(e.value) || 0)]),
            ...tableOptions
        });
        currentY = (doc as any).lastAutoTable.finalY + 10;
    }

    if (currentTrip.refuelings.length > 0) {
        doc.text('Abastecimentos', marginLeft, currentY);
        currentY += 2;

        const sortedRefuelings = [...currentTrip.refuelings].sort((a, b) => {
             if (!a.date && !b.date) return 0;
             if (!a.date) return -1;
             if (!b.date) return 1;
             return b.date.localeCompare(a.date);
        });

        autoTable(doc, {
            startY: currentY + 2,
            head: [['Data', 'Local', 'Litros', 'Valor']],
            body: sortedRefuelings.map(r => [
                r.date ? new Date(r.date).toLocaleDateString('pt-BR') : '-',
                r.location,
                Number(r.liters).toFixed(2) + ' L',
                formatBRL(Number(r.value) || 0)
            ]),
            ...tableOptions
        });
        currentY = (doc as any).lastAutoTable.finalY + 10;
    }

    currentY += 5;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Lucro Líquido: ${formatBRL(calculations.profit)}`, marginLeft, currentY);

    doc.save(`Relatorio_${currentTrip.driver}.pdf`);
  }, [currentTrip, calculations]);

  return (
    <div className="flex flex-col h-full">
      <Header 
        onNewTrip={handleNewTrip} 
        onSaveTrip={handleSaveTrip} 
        onFillExample={handleFillExample}
        onGeneratePDF={handleGeneratePDF}
      />
      
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-10">
          <div className="mx-auto grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6">
              <div className="space-y-6 min-w-0">
                  {maintenanceAlerts.length > 0 && (
                     <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg animate-in slide-in-from-top-2">
                        <div className="flex items-center gap-2 mb-2">
                            <svg className="h-5 w-5 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <h3 className="font-bold text-amber-800">Lembretes de Manutenção</h3>
                        </div>
                        <ul className="list-disc list-inside space-y-1">
                            {maintenanceAlerts.map((alert, idx) => (
                                <li key={idx} className={`text-sm font-medium ${alert.includes('URGENTE') ? 'text-red-700' : 'text-amber-700'}`}>
                                    {alert}
                                </li>
                            ))}
                        </ul>
                     </div>
                  )}

                  <TripForm 
                    trip={currentTrip} 
                    setTrip={setCurrentTrip} 
                    savedDrivers={savedDrivers}
                    savedLicensePlates={savedLicensePlates}
                    savedExpenseCategories={savedExpenseCategories}
                    savedOrigins={savedOrigins}
                    savedDestinations={savedDestinations}
                    savedLocations={savedLocations}
                    savedMaintenanceTypes={savedMaintenanceTypes}
                    lastMaintenances={uniqueLastMaintenances}
                    onShowMaintenanceHistory={() => setIsHistoryModalOpen(true)}
                  />
                  <SummaryFooter calculations={calculations} />
              </div>
              <div className="space-y-6">
                   <Sidebar 
                      savedTrips={savedTrips} 
                      activeTripId={activeTripId} 
                      onLoadTrip={handleLoadTrip}
                      onDeleteTrip={handleDeleteTrip}
                   />
              </div>
          </div>
      </div>
      
      {isHistoryModalOpen && (
          <MaintenanceHistoryModal 
            licensePlate={currentTrip.license_plate}
            history={fullMaintenanceHistory}
            onClose={() => setIsHistoryModalOpen(false)}
          />
      )}
    </div>
  );
}
