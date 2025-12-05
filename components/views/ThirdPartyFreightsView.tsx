
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { ThirdPartyFreight } from '../../types';
import { supabase, getDistinctValues, saveAutocompleteValue, getSavedAutocompleteValues } from '../../lib/supabaseClient';
import { ThirdPartySummaryCards } from '../thirdPartyFreights/ThirdPartySummaryCards';
import { ThirdPartyFreightForm } from '../thirdPartyFreights/ThirdPartyFreightForm';
import { ThirdPartyFreightsTable } from '../thirdPartyFreights/ThirdPartyFreightsTable';
import { EditThirdPartyFreightModal } from '../thirdPartyFreights/EditThirdPartyFreightModal';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { Select } from '../ui/Select';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { GoogleGenAI, Type } from "@google/genai";

const calculateStatus = (paidFreight: number, advance: number, toll: number): 'Pago' | 'Parcial' | 'Pendente' => {
    const balance = paidFreight - advance - toll;
    if (balance <= 0.01 && paidFreight > 0) return 'Pago';
    if (advance > 0) return 'Parcial';
    return 'Pendente';
};

const getInitialThirdPartyFreight = (): ThirdPartyFreight => ({
  id: crypto.randomUUID(),
  driver: '',
  license_plate: '',
  date: new Date().toISOString().split('T')[0],
  origin: '',
  destination: '',
  company_freight_value: '',
  paid_freight_value: '',
  toll_value: '',
  advance_payment: '',
  status: 'Pendente',
});

// Helper functions for LocalStorage persistence
const addToLocalStorage = (key: string, value: string) => {
    if (!value) return;
    try {
        const current = JSON.parse(localStorage.getItem(key) || '[]');
        const cleanValue = value.trim().toUpperCase();
        if (!current.includes(cleanValue)) {
            const updated = [...current, cleanValue].sort();
            localStorage.setItem(key, JSON.stringify(updated));
        }
    } catch (e) {
        console.error('Erro ao salvar no localStorage', e);
    }
};

const getFromLocalStorage = (key: string): string[] => {
    try {
        return JSON.parse(localStorage.getItem(key) || '[]');
    } catch (e) {
        return [];
    }
};

export const ThirdPartyFreightsView: React.FC = () => {
  const [freights, setFreights] = useState<ThirdPartyFreight[]>([]);
  const [newFreight, setNewFreight] = useState(getInitialThirdPartyFreight());
  
  const [savedDrivers, setSavedDrivers] = useState<string[]>([]);
  const [savedLicensePlates, setSavedLicensePlates] = useState<string[]>([]);
  const [savedOrigins, setSavedOrigins] = useState<string[]>([]);
  const [savedDestinations, setSavedDestinations] = useState<string[]>([]);

  const [editingFreight, setEditingFreight] = useState<ThirdPartyFreight | null>(null);
  const [selectedFreights, setSelectedFreights] = useState<Set<string>>(new Set());
  const [isProcessingXml, setIsProcessingXml] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('todos');

  const fetchFreights = useCallback(async () => {
    const { data, error } = await supabase
      .from('third_party_freights')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }); 

    if (error) {
      alert(`Erro ao buscar fretes de terceiros: ${error.message}`);
    } else {
      const dataList = data || [];
      setFreights(dataList);
      
      setSelectedFreights(prev => {
        const newSet = new Set<string>();
        const currentIds = new Set(dataList.map(f => f.id));
        prev.forEach(id => {
            if (currentIds.has(id)) newSet.add(id);
        });
        return newSet;
      });
    }
  }, []);

  const fetchAutocompleteData = useCallback(async () => {
    try {
        const [
            driversDB, platesDB, originsDB, destinationsDB
        ] = await Promise.all([
          getDistinctValues('third_party_freights', 'driver'),
          getDistinctValues('third_party_freights', 'license_plate'),
          getDistinctValues('third_party_freights', 'origin'),
          getDistinctValues('third_party_freights', 'destination'),
        ]);

        const [
            driversSavedDB, platesSavedDB, originsSavedDB, destinationsSavedDB
        ] = await Promise.all([
          getSavedAutocompleteValues('driver'),
          getSavedAutocompleteValues('license_plate'),
          getSavedAutocompleteValues('origin'),
          getSavedAutocompleteValues('destination')
        ]);

        const driversLocal = getFromLocalStorage('tp_saved_drivers');
        const platesLocal = getFromLocalStorage('tp_saved_plates');
        const originsLocal = getFromLocalStorage('tp_saved_origins');
        const destinationsLocal = getFromLocalStorage('tp_saved_destinations');

        setSavedDrivers(Array.from(new Set([...driversDB, ...driversSavedDB, ...driversLocal])).sort());
        setSavedLicensePlates(Array.from(new Set([...platesDB, ...platesSavedDB, ...platesLocal])).sort());
        setSavedOrigins(Array.from(new Set([...originsDB, ...originsSavedDB, ...originsLocal])).sort());
        setSavedDestinations(Array.from(new Set([...destinationsDB, ...destinationsSavedDB, ...destinationsLocal])).sort());
    } catch(error: any) {
        console.error(`Erro ao carregar dados de autocompletar: ${error.message}`);
    }
  }, []);

  useEffect(() => {
    fetchFreights();
    fetchAutocompleteData();

    const channel = supabase.channel('third_party_freights-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'third_party_freights' }, payload => {
        console.log('Change received!', payload);
        fetchFreights();
        fetchAutocompleteData(); 
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchFreights, fetchAutocompleteData]);

  const filteredFreights = useMemo(() => {
    if (filterStatus === 'todos') return freights;
    if (filterStatus === 'pagos') return freights.filter(f => f.status === 'Pago');
    if (filterStatus === 'pendentes') return freights.filter(f => f.status === 'Pendente' || f.status === 'Parcial');
    return freights;
  }, [freights, filterStatus]);

  const summaryData = useMemo(() => {
    return freights.reduce((acc, f) => {
        const companyFreight = Number(f.company_freight_value) || 0;
        const paidFreight = Number(f.paid_freight_value) || 0;
        const tollValue = Number(f.toll_value) || 0;
        const advance = Number(f.advance_payment) || 0;

        acc.totalNetProfit += companyFreight - paidFreight;
        
        const balanceToPay = paidFreight - advance - tollValue;
        if (balanceToPay > 0) {
            acc.totalBalanceToPay += balanceToPay;
        }
        return acc;
    }, { totalNetProfit: 0, totalBalanceToPay: 0 });
  }, [freights]);

  const saveSuggestions = async (freight: ThirdPartyFreight) => {
      await Promise.all([
          saveAutocompleteValue('driver', freight.driver),
          saveAutocompleteValue('license_plate', freight.license_plate),
          saveAutocompleteValue('origin', freight.origin),
          saveAutocompleteValue('destination', freight.destination)
      ]);

      addToLocalStorage('tp_saved_drivers', freight.driver);
      addToLocalStorage('tp_saved_plates', freight.license_plate);
      addToLocalStorage('tp_saved_origins', freight.origin);
      addToLocalStorage('tp_saved_destinations', freight.destination);
  };

  const handleXmlUpload = useCallback(async (file: File) => {
    setIsProcessingXml(true);
    try {
      const xmlContent = await file.text();
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const prompt = `Você é um assistente de logística. Analise este XML de transporte (CT-e ou MDF-e) e extraia os dados para cadastro de frete terceiro.
      
      Procure especificamente por:
      - Motorista: tags como <xNome> dentro de <moto> ou <prop>.
      - Placa: tags como <placa> dentro de <veic> ou <veicTracao>.
      - Origem: Município de início (<xMunIni>, <xMun> do remetente).
      - Destino: Município de fim (<xMunFim>, <xMun> do destinatário).

      Retorne um JSON.
      XML:
      ${xmlContent}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              driver: { type: Type.STRING, description: "Nome do motorista" },
              license_plate: { type: Type.STRING, description: "Placa do veículo" },
              origin: { type: Type.STRING, description: "Cidade de origem" },
              destination: { type: Type.STRING, description: "Cidade de destino" },
            },
            required: ['driver', 'license_plate', 'origin', 'destination']
          },
        },
      });

      const parsedData = JSON.parse(response.text);

      setNewFreight(prev => ({
        ...prev,
        driver: parsedData.driver || prev.driver,
        license_plate: parsedData.license_plate || prev.license_plate,
        origin: parsedData.origin || prev.origin,
        destination: parsedData.destination || prev.destination,
      }));

      alert('Dados do XML preenchidos com sucesso!');

    } catch (error: any) {
      console.error("Erro ao processar XML:", error);
      
      let errorMessage = "Erro ao processar XML. Verifique se é um arquivo válido.";
      if (error.message?.includes('429')) {
         errorMessage = "Limite de uso da IA excedido (Erro 429). Aguarde alguns instantes.";
      }
      alert(errorMessage);
    } finally {
      setIsProcessingXml(false);
    }
  }, []);

  const handleAddFreight = useCallback(async () => {
    if (!newFreight.driver || !newFreight.company_freight_value) {
      alert('Preencha pelo menos o Motorista e o Frete Empresa.');
      return;
    }
    
    const companyFreight = Number(newFreight.company_freight_value) || 0;
    const paidFreight = Number(newFreight.paid_freight_value) || 0;
    const tollValue = Number(newFreight.toll_value) || 0;
    const advance = Number(newFreight.advance_payment) || 0;

    const freightToAdd: ThirdPartyFreight = { 
        ...newFreight, 
        company_freight_value: companyFreight,
        paid_freight_value: paidFreight,
        toll_value: tollValue,
        advance_payment: advance,
        driver: newFreight.driver.trim().toUpperCase(),
        license_plate: newFreight.license_plate.trim().toUpperCase(),
        origin: newFreight.origin.trim().toUpperCase(),
        destination: newFreight.destination.trim().toUpperCase(),
        status: calculateStatus(paidFreight, advance, tollValue)
    };
    const { error } = await supabase.from('third_party_freights').upsert(freightToAdd);
    if (error) {
        alert(`Erro ao adicionar frete: ${error.message}`);
    } else {
        await saveSuggestions(freightToAdd);
        alert('Frete de terceiro adicionado com sucesso!');
        setNewFreight(getInitialThirdPartyFreight());
        fetchFreights();
        fetchAutocompleteData();
    }
  }, [newFreight, fetchFreights, fetchAutocompleteData]);

  const handleUpdateFreight = useCallback(async (updatedFreight: ThirdPartyFreight) => {
    const companyFreight = Number(updatedFreight.company_freight_value) || 0;
    const paidFreight = Number(updatedFreight.paid_freight_value) || 0;
    const tollValue = Number(updatedFreight.toll_value) || 0;
    const advance = Number(updatedFreight.advance_payment) || 0;

    const freightWithCorrectStatus: ThirdPartyFreight = {
        ...updatedFreight,
        company_freight_value: companyFreight,
        paid_freight_value: paidFreight,
        toll_value: tollValue,
        advance_payment: advance,
        driver: updatedFreight.driver.trim().toUpperCase(),
        license_plate: updatedFreight.license_plate.trim().toUpperCase(),
        origin: updatedFreight.origin.trim().toUpperCase(),
        destination: updatedFreight.destination.trim().toUpperCase(),
        status: calculateStatus(paidFreight, advance, tollValue)
    };
    
    const { error } = await supabase.from('third_party_freights').update(freightWithCorrectStatus).eq('id', freightWithCorrectStatus.id);
    if (error) {
        alert(`Erro ao atualizar frete: ${error.message}`);
    } else {
        await saveSuggestions(freightWithCorrectStatus);
        alert('Frete atualizado com sucesso.');
        setEditingFreight(null);
        fetchFreights();
        fetchAutocompleteData();
    }
  }, [fetchFreights, fetchAutocompleteData]);

  const handleDeleteFreight = useCallback(async (id: string) => {
    if (window.confirm('Tem certeza?')) {
      const { error } = await supabase.from('third_party_freights').delete().eq('id', id);
      if (error) {
          alert(`Erro ao excluir frete: ${error.message}`);
      } else {
          alert('Frete excluído com sucesso.');
          fetchFreights();
          fetchAutocompleteData();
      }
    }
  }, [fetchFreights, fetchAutocompleteData]);

  const handleSetAsPaid = useCallback(async (freightId: string) => {
    const freightToUpdate = freights.find(f => f.id === freightId);
    if (!freightToUpdate) return;

    const paidFreight = Number(freightToUpdate.paid_freight_value) || 0;
    const tollValue = Number(freightToUpdate.toll_value) || 0;
    const newAdvance = Math.max(0, paidFreight - tollValue);

    const { error } = await supabase.from('third_party_freights').update({
      advance_payment: newAdvance, 
      status: 'Pago'
    }).eq('id', freightId);

    if (error) {
        alert(`Erro ao quitar frete: ${error.message}`);
    } else {
        fetchFreights();
    }
  }, [freights, fetchFreights]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedFreights(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  }, []);

  const handleToggleSelectAll = useCallback((selectAll: boolean) => {
    if (selectAll) {
      setSelectedFreights(new Set(filteredFreights.map(f => f.id)));
    } else {
      setSelectedFreights(new Set());
    }
  }, [filteredFreights]);

  const handleGeneratePDF = useCallback(() => {
    if (selectedFreights.size === 0) return;

    const selectedItems = freights.filter(f => selectedFreights.has(f.id));
    const doc = new jsPDF({ orientation: 'landscape' });
    const primaryColor = [2, 132, 199]; 

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text("Relatório de Fretes Terceirizados", 14, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const dateStr = new Date().toLocaleDateString('pt-BR');
    doc.text(`Gerado em: ${dateStr}`, 14, 26);
    doc.text(`Itens selecionados: ${selectedItems.length}`, 14, 31);

    let totalPaid = 0;
    let totalToll = 0;
    let totalAdvance = 0;
    let totalBalance = 0;

    const tableData = selectedItems.map(f => {
        const paid = Number(f.paid_freight_value) || 0;
        const toll = Number(f.toll_value) || 0;
        const advance = Number(f.advance_payment) || 0;
        const balance = paid - toll - advance;

        totalPaid += paid;
        totalToll += toll;
        totalAdvance += advance;
        totalBalance += balance > 0 ? balance : 0; 

        const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '-';
        const formatMoney = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        return [
            formatDate(f.date),
            f.driver,
            f.license_plate,
            `${f.origin} \n-> ${f.destination}`,
            formatMoney(paid),
            formatMoney(toll),
            formatMoney(advance),
            formatMoney(balance)
        ];
    });

    const formatMoney = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    autoTable(doc, {
        startY: 40,
        head: [['Data', 'Motorista', 'Placa', 'Rota', 'Frete (Pago)', 'Pedágio', 'Adiantamento', 'Saldo a Pagar']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: primaryColor as any, textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 3, valign: 'middle' },
        columnStyles: {
            0: { cellWidth: 25 }, 
            3: { cellWidth: 60 }, 
            4: { halign: 'right' }, 
            5: { halign: 'right' }, 
            6: { halign: 'right' }, 
            7: { halign: 'right', fontStyle: 'bold' }  
        },
        foot: [[
            'TOTAIS', '', '', '', 
            formatMoney(totalPaid), 
            formatMoney(totalToll), 
            formatMoney(totalAdvance), 
            formatMoney(totalBalance)
        ]],
        footStyles: { fillColor: [240, 240, 240], textColor: 50, fontStyle: 'bold', halign: 'right' }
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    doc.setFontSize(8);
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text('Sistema de Lançamentos de Viagens', 14, doc.internal.pageSize.height - 10);
        doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 25, doc.internal.pageSize.height - 10);
    }

    doc.save(`Relatorio_Terceiros_${dateStr.replace(/\//g, '-')}.pdf`);
  }, [selectedFreights, freights]);

  return (
    <div className="flex flex-col h-full">
      <header className="bg-white/80 backdrop-blur-lg border-b border-slate-200 sticky top-0 z-30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-slate-800">Controle de Fretes Terceirizados</h1>
            <div className="flex items-center gap-3">
                {selectedFreights.size > 0 && (
                    <span className="text-sm text-slate-500 hidden sm:inline">
                        {selectedFreights.size} selecionado(s)
                    </span>
                )}
                <Button 
                    onClick={handleGeneratePDF} 
                    disabled={selectedFreights.size === 0}
                    variant={selectedFreights.size > 0 ? 'primary' : 'secondary'}
                    className="flex items-center gap-2 shadow-sm"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
                    </svg>
                    Gerar PDF
                </Button>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-[95%] mx-auto space-y-6">
            <ThirdPartySummaryCards 
                netProfit={summaryData.totalNetProfit}
                balanceToPay={summaryData.totalBalanceToPay}
            />
            <ThirdPartyFreightForm 
                newFreight={newFreight}
                setNewFreight={setNewFreight}
                onAddFreight={handleAddFreight}
                savedDrivers={savedDrivers}
                savedLicensePlates={savedLicensePlates}
                savedOrigins={savedOrigins}
                savedDestinations={savedDestinations}
                onXmlUpload={handleXmlUpload}
                isProcessingXml={isProcessingXml}
            />
            
            <Card>
                <CardContent className="p-4">
                     <div className="w-full md:w-64">
                         <Select label="Filtrar por Status" id="status-filter" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                             <option value="todos">Todos</option>
                             <option value="pendentes">Pendentes / Parcial</option>
                             <option value="pagos">Pagos</option>
                         </Select>
                     </div>
                </CardContent>
            </Card>

            <ThirdPartyFreightsTable
                freights={filteredFreights}
                selectedFreights={selectedFreights}
                onToggleSelect={handleToggleSelect}
                onToggleSelectAll={handleToggleSelectAll}
                onEdit={setEditingFreight}
                onDelete={handleDeleteFreight}
                onSetAsPaid={handleSetAsPaid}
            />
        </div>
      </main>
      {editingFreight && (
        <EditThirdPartyFreightModal
          freight={editingFreight}
          onClose={() => setEditingFreight(null)}
          onSave={handleUpdateFreight}
          savedDrivers={savedDrivers}
          savedLicensePlates={savedLicensePlates}
          savedOrigins={savedOrigins}
          savedDestinations={savedDestinations}
        />
      )}
    </div>
  );
};
