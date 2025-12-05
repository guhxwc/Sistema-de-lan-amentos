
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { Trip } from '../../types';
import { Header } from '../Header';
import { TripForm } from '../TripForm';
import { Sidebar } from '../Sidebar';
import { SummaryFooter } from '../SummaryFooter';
import { getInitialTrip, getExampleTrip } from '../../constants';
import { supabase, getDistinctValues } from '../../lib/supabaseClient';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export function TripManagementView() {
  const [currentTrip, setCurrentTrip] = useState<Trip>(getInitialTrip());
  const [savedTrips, setSavedTrips] = useState<Trip[]>([]);
  const [activeTripId, setActiveTripId] = useState<string | null>(null);

  const [savedDrivers, setSavedDrivers] = useState<string[]>([]);
  const [savedLicensePlates, setSavedLicensePlates] = useState<string[]>([]);

  const fetchTrips = useCallback(async () => {
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      alert(`Erro ao buscar viagens: ${error.message}`);
    } else {
      setSavedTrips(data || []);
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
        // Silent fail or minimal log
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

  useEffect(() => {
    if (currentTrip.refuelings && currentTrip.refuelings.length > 0) {
      const maxOdometer = currentTrip.refuelings.reduce(
        (max, r) => Math.max(max, Number(r.odometer) || 0),
        0
      );
      if (maxOdometer > 0 && maxOdometer !== Number(currentTrip.final_km)) {
        setCurrentTrip(prev => ({ ...prev, final_km: maxOdometer }));
      }
    }
  }, [currentTrip.refuelings]);

  const calculations = useMemo(() => {
    const totalFreights = currentTrip.freights.reduce((acc, f) => acc + (Number(f.value) || 0), 0);
    const totalDieselCost = currentTrip.refuelings.reduce((acc, r) => acc + (Number(r.value) || 0), 0);
    const totalExpenses = currentTrip.expenses.reduce((acc, e) => acc + (Number(e.value) || 0), 0);
    const profit = totalFreights - (totalDieselCost + totalExpenses);
    
    const totalLiters = currentTrip.refuelings.reduce((acc, r) => acc + (Number(r.liters) || 0), 0);
    
    const initialKm = Number(currentTrip.initial_km) || 0;
    const finalKm = Number(currentTrip.final_km) || 0;
    const distance = finalKm > initialKm ? finalKm - initialKm : 0;

    const averageKmL = totalLiters > 0 && distance > 0 ? distance / totalLiters : 0;
    const averagePricePerLiter = totalLiters > 0 ? totalDieselCost / totalLiters : 0;

    return { totalFreights, totalDieselCost, totalExpenses, profit, distance, averageKmL, averagePricePerLiter };
  }, [currentTrip]);

  // Extract unique values for autocomplete from saved trips
  const { savedExpenseCategories, savedOrigins, savedDestinations, savedLocations } = useMemo(() => {
    const categories = new Set<string>();
    const origins = new Set<string>();
    const destinations = new Set<string>();
    const locations = new Set<string>();

    savedTrips.forEach(trip => {
      if (Array.isArray(trip.expenses)) {
        trip.expenses.forEach(expense => {
          if (expense.description && expense.description.trim() !== '') {
            categories.add(expense.description.trim());
          }
        });
      }
      if (Array.isArray(trip.freights)) {
          trip.freights.forEach(freight => {
              if (freight.origin && freight.origin.trim() !== '') origins.add(freight.origin.trim());
              if (freight.destination && freight.destination.trim() !== '') destinations.add(freight.destination.trim());
          });
      }
      if (Array.isArray(trip.refuelings)) {
          trip.refuelings.forEach(refueling => {
              if (refueling.location && refueling.location.trim() !== '') locations.add(refueling.location.trim());
          });
      }
    });
    
    return {
        savedExpenseCategories: Array.from(categories).sort(),
        savedOrigins: Array.from(origins).sort(),
        savedDestinations: Array.from(destinations).sort(),
        savedLocations: Array.from(locations).sort()
    };
  }, [savedTrips]);

  const handleNewTrip = useCallback(() => {
    setCurrentTrip(getInitialTrip());
    setActiveTripId(null);
  }, []);

  const handleSaveTrip = useCallback(async () => {
    // Prepare object for saving
    const tripToSave = { 
        ...currentTrip,
        driver: currentTrip.driver ? currentTrip.driver.trim().toUpperCase() : '',
        license_plate: currentTrip.license_plate ? currentTrip.license_plate.trim().toUpperCase() : '',
        departure_date: currentTrip.departure_date ? currentTrip.departure_date : null,
        arrival_date: currentTrip.arrival_date ? currentTrip.arrival_date : null,
        initial_km: currentTrip.initial_km === '' ? null : currentTrip.initial_km,
        final_km: currentTrip.final_km === '' ? null : currentTrip.final_km,
        // Ensure nested arrays clean up strings
        freights: currentTrip.freights.map(f => ({
            ...f,
            origin: f.origin ? f.origin.trim() : '',
            destination: f.destination ? f.destination.trim() : ''
        })),
        refuelings: currentTrip.refuelings.map(r => ({
            ...r,
            location: r.location ? r.location.trim() : ''
        })),
        expenses: currentTrip.expenses.map(e => ({
            ...e,
            description: e.description ? e.description.trim() : ''
        }))
    };
    
    const { error } = await supabase.from('trips').upsert(tripToSave);

    if (error) {
      alert(`Erro ao salvar viagem: ${error.message}`);
    } else {
      alert('Viagem salva com sucesso!');
      // Clean fields and reset ID to ensure new entry if user types again
      setCurrentTrip(getInitialTrip());
      setActiveTripId(null);
      
      await fetchTrips();
      await fetchAutocompleteData();
    }
  }, [currentTrip, fetchTrips, fetchAutocompleteData]);
  
  const handleLoadTrip = useCallback((tripId: string) => {
    const tripToLoad = savedTrips.find(t => t.id === tripId);
    if (tripToLoad) {
      setCurrentTrip(tripToLoad);
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
            if (activeTripId === tripId) {
                handleNewTrip();
            }
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
    const colorGray200 = [226, 232, 240];
    const colorBlue600 = [2, 132, 199]; 
    const colorSlate800 = [30, 41, 59]; 

    const marginLeft = 15;
    const marginRight = 195;
    const contentWidth = 180;
    
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
    
    currentY += 5;
    doc.setDrawColor(colorGray200[0], colorGray200[1], colorGray200[2]);
    doc.setLineWidth(0.5);
    doc.line(marginLeft, currentY, marginRight, currentY);
    currentY += 10;

    const labelStyle = (x: number, y: number, text: string) => {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colorSlate500[0], colorSlate500[1], colorSlate500[2]);
        doc.text(text.toUpperCase(), x, y);
    };
    
    const valueStyle = (x: number, y: number, text: string) => {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(colorSlate900[0], colorSlate900[1], colorSlate900[2]);
        doc.text(text, x, y);
    };

    labelStyle(marginLeft, currentY, 'Motorista');
    labelStyle(80, currentY, 'Placa');
    labelStyle(140, currentY, 'Período');
    currentY += 5;
    valueStyle(marginLeft, currentY, currentTrip.driver || '-');
    valueStyle(80, currentY, currentTrip.license_plate || '-');
    const dateRange = `${currentTrip.departure_date ? new Date(currentTrip.departure_date).toLocaleDateString('pt-BR') : '-'} a ${currentTrip.arrival_date ? new Date(currentTrip.arrival_date).toLocaleDateString('pt-BR') : '-'}`;
    valueStyle(140, currentY, dateRange);
    currentY += 12;

    labelStyle(marginLeft, currentY, 'KM Inicial');
    labelStyle(80, currentY, 'KM Final');
    labelStyle(140, currentY, 'Distância Total');
    currentY += 5;
    valueStyle(marginLeft, currentY, String(currentTrip.initial_km || '-'));
    valueStyle(80, currentY, String(currentTrip.final_km || '-'));
    valueStyle(140, currentY, `${calculations.distance.toLocaleString('pt-BR')} km`);
    currentY += 15;

    const formatBRL = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const tableOptions: any = {
        theme: 'striped',
        styles: { fontSize: 9, cellPadding: 3, textColor: colorSlate900 },
        headStyles: { 
            fillColor: colorSlate800, 
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            lineWidth: 0, 
        },
        alternateRowStyles: { fillColor: [241, 245, 249] },
        columnStyles: { last: { halign: 'right' } },
        margin: { left: marginLeft, right: 15 } 
    };

    if (currentTrip.freights.length > 0) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colorBlue600[0], colorBlue600[1], colorBlue600[2]);
        doc.text('Receitas (Fretes)', marginLeft, currentY);
        currentY += 2;
        autoTable(doc, {
            startY: currentY + 2,
            head: [['Origem', 'Destino', 'Valor']],
            body: currentTrip.freights.map(f => [f.origin, f.destination, formatBRL(Number(f.value) || 0)]),
            ...tableOptions,
            columnStyles: { 2: { halign: 'right', fontStyle: 'bold' } },
        });
        currentY = (doc as any).lastAutoTable.finalY + 10;
    }

    if (currentTrip.expenses.length > 0) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colorSlate900[0], colorSlate900[1], colorSlate900[2]);
        doc.text('Despesas Operacionais', marginLeft, currentY);
        currentY += 2;
        autoTable(doc, {
            startY: currentY + 2,
            head: [['Descrição', 'Valor']],
            body: currentTrip.expenses.map(e => [e.description, formatBRL(Number(e.value) || 0)]),
            ...tableOptions,
            columnStyles: { 1: { halign: 'right' } },
        });
        currentY = (doc as any).lastAutoTable.finalY + 10;
    }

    if (currentTrip.refuelings.length > 0) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colorSlate900[0], colorSlate900[1], colorSlate900[2]);
        doc.text('Abastecimentos', marginLeft, currentY);
        currentY += 2;
        autoTable(doc, {
            startY: currentY + 2,
            head: [['Data', 'Local', 'Litros', 'Valor']],
            body: currentTrip.refuelings.map(r => [
                r.date ? new Date(r.date).toLocaleDateString('pt-BR') : '-',
                r.location,
                Number(r.liters).toFixed(2) + ' L',
                formatBRL(Number(r.value) || 0)
            ]),
            ...tableOptions,
            columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } },
        });
        currentY = (doc as any).lastAutoTable.finalY + 10;
    }

    if (currentY + 50 > doc.internal.pageSize.height) {
        doc.addPage();
        currentY = 20;
    }

    doc.setDrawColor(colorGray200[0], colorGray200[1], colorGray200[2]);
    doc.setLineWidth(0.2);
    doc.roundedRect(marginLeft, currentY, contentWidth, 45, 2, 2);

    const boxY = currentY + 5;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colorSlate500[0], colorSlate500[1], colorSlate500[2]);
    doc.text('Indicadores de Desempenho', marginLeft + 5, boxY + 5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colorSlate900[0], colorSlate900[1], colorSlate900[2]);
    doc.text(`Consumo Médio: ${calculations.averageKmL.toFixed(2)} km/L`, marginLeft + 5, boxY + 15);
    doc.text(`Preço Médio Diesel: ${formatBRL(calculations.averagePricePerLiter)} /L`, marginLeft + 5, boxY + 22);
    
    // Profit
    doc.text('Resultado Financeiro:', marginLeft + 90, boxY + 15);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(formatBRL(calculations.profit), marginLeft + 90, boxY + 23);

    doc.save(`Relatorio_Viagem_${currentTrip.driver.replace(/\s+/g, '_')}.pdf`);
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
                  <TripForm 
                    trip={currentTrip} 
                    setTrip={setCurrentTrip} 
                    savedDrivers={savedDrivers}
                    savedLicensePlates={savedLicensePlates}
                    savedExpenseCategories={savedExpenseCategories}
                    savedOrigins={savedOrigins}
                    savedDestinations={savedDestinations}
                    savedLocations={savedLocations}
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
    </div>
  );
}
