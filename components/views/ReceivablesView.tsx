
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import type { ReceivableFreight } from '../../types';
import { supabase, getDistinctValues } from '../../lib/supabaseClient';
import { SummaryCards } from '../receivables/SummaryCards';
import { ReceivableForm } from '../receivables/ReceivableForm';
import { ReceivablesTable } from '../receivables/ReceivablesTable';
import { ReceivableFilters } from '../receivables/ReceivableFilters';
import { EditFreightModal } from '../receivables/EditFreightModal';
import { Button } from '../ui/Button';

const getInitialFreight = (): ReceivableFreight => ({
  id: crypto.randomUUID(),
  date: new Date().toISOString().split('T')[0],
  due_date: '',
  client: '',
  origin: '',
  destination: '',
  cte: '',
  total_value: '',
  paid_value: '',
  row_color: '#FFFFFF',
});

export const ReceivablesView: React.FC = () => {
  const [freights, setFreights] = useState<ReceivableFreight[]>([]);
  const [newFreight, setNewFreight] = useState(getInitialFreight());
  
  const [savedClients, setSavedClients] = useState<string[]>([]);
  const [savedOrigins, setSavedOrigins] = useState<string[]>([]);
  const [savedDestinations, setSavedDestinations] = useState<string[]>([]);
  
  const [showOnlyPending, setShowOnlyPending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('Todos');
  const [selectedYear, setSelectedYear] = useState('Todos');

  const [editingFreight, setEditingFreight] = useState<ReceivableFreight | null>(null);
  const [isProcessingXml, setIsProcessingXml] = useState(false);
  const [selectedFreights, setSelectedFreights] = useState<Set<string>>(new Set());

  const fetchFreights = useCallback(async () => {
    const { data, error } = await supabase
      .from('receivable_freights')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }); // Ordenação secundária para estabilidade

    if (error) {
      alert(`Erro ao buscar fretes: ${error.message}`);
    } else {
      setFreights(data || []);
      // Clean up selection for items that no longer exist
      setSelectedFreights(prev => {
        const newSet = new Set<string>();
        if (data) {
            const currentIds = new Set(data.map(f => f.id));
            prev.forEach(id => {
                if (currentIds.has(id)) newSet.add(id);
            });
        }
        return newSet;
      });
    }
  }, []);

  const fetchAutocompleteData = useCallback(async () => {
    try {
        const [clients, origins, destinations] = await Promise.all([
          getDistinctValues('receivable_freights', 'client'),
          getDistinctValues('receivable_freights', 'origin'),
          getDistinctValues('receivable_freights', 'destination'),
        ]);
        setSavedClients(clients);
        setSavedOrigins(origins);
        setSavedDestinations(destinations);
    } catch(error: any) {
        alert(`Erro ao carregar dados de autocompletar: ${error.message}`);
    }
  }, []);

  useEffect(() => {
    fetchFreights();
    fetchAutocompleteData();

    const channel = supabase.channel('receivable_freights-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'receivable_freights' }, payload => {
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
    return freights
      .filter(freight => {
        const total = Number(freight.total_value) || 0;
        const paid = Number(freight.paid_value) || 0;
        
        if (showOnlyPending && paid >= total) {
          return false;
        }

        if (selectedYear !== 'Todos') {
             if (!freight.date || !freight.date.startsWith(selectedYear)) return false;
        }

        if (selectedMonth !== 'Todos') {
             if (!freight.date) return false;
             const parts = freight.date.split('-');
             if (parts.length > 1 && parts[1] !== selectedMonth) return false;
        }

        if (searchTerm) {
          const lowerSearch = searchTerm.toLowerCase();
          return (
            freight.client.toLowerCase().includes(lowerSearch) ||
            freight.origin.toLowerCase().includes(lowerSearch) ||
            freight.destination.toLowerCase().includes(lowerSearch) ||
            freight.cte.toLowerCase().includes(lowerSearch)
          );
        }
        return true;
      });
  }, [freights, showOnlyPending, searchTerm, selectedMonth, selectedYear]);

  // Calcula os totais com base nos itens FILTRADOS para refletir a busca/filtros
  const summaryData = useMemo(() => {
    return filteredFreights.reduce((acc, freight) => {
      acc.totalValue += Number(freight.total_value) || 0;
      acc.totalReceived += Number(freight.paid_value) || 0;
      return acc;
    }, { totalValue: 0, totalReceived: 0 });
  }, [filteredFreights]);

  const overdueCount = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    return freights.filter(f => {
        const total = Number(f.total_value) || 0;
        const paid = Number(f.paid_value) || 0;
        return f.due_date && new Date(f.due_date) < today && total > paid;
    }).length;
  }, [freights]);

  const handleXmlUpload = useCallback(async (file: File) => {
    setIsProcessingXml(true);
    try {
      const xmlContent = await file.text();
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Você é um assistente especializado em logística e transporte no Brasil. Sua tarefa é extrair informações de um arquivo XML de Conhecimento de Transporte Eletrônico (CT-e). Ao analisar, ignore os namespaces do XML e foque apenas nos nomes das tags. Analise o XML a seguir e retorne um objeto JSON com os seguintes campos:

- \`cte\`: O número do CT-e, encontrado na tag \`<nCT>\` dentro de \`<ide>\`.
- \`date\`: A data de emissão, encontrada na tag \`<dhEmi>\`. Formate como AAAA-MM-DD.
- \`client\`: O nome do tomador do serviço. Procure pela tag \`<xNome>\` dentro de \`<toma3>\` (Tomador do Serviço).
- \`origin\`: O nome do município de origem, encontrado na tag \`<xMun>\` dentro de \`<rem>\` (Remetente).
- \`destination\`: O nome do município de destino, encontrado na tag \`<xMun>\` dentro de \`<dest>\` (Destinatário).
- \`total_value\`: O valor total da prestação do serviço, encontrado na tag \`<vTPrest>\` dentro de \`<vPrest>\`.

Aqui está o XML:
${xmlContent}`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              cte: { type: Type.STRING, description: "Número do CT-e" },
              date: { type: Type.STRING, description: "Data de emissão no formato AAAA-MM-DD" },
              client: { type: Type.STRING, description: "Nome do tomador do serviço" },
              origin: { type: Type.STRING, description: "Município de origem" },
              destination: { type: Type.STRING, description: "Município de destino" },
              total_value: { type: Type.NUMBER, description: "Valor total da prestação" },
            },
            required: ['cte', 'date', 'client', 'origin', 'destination', 'total_value']
          },
        },
      });

      const parsedData = JSON.parse(response.text);

      setNewFreight(prev => ({
        ...prev,
        cte: parsedData.cte || '',
        date: parsedData.date || prev.date,
        client: parsedData.client || '',
        origin: parsedData.origin || '',
        destination: parsedData.destination || '',
        total_value: parsedData.total_value || 0,
      }));

      alert('Dados do XML preenchidos com sucesso!');
    } catch (error: any) {
      console.error("Erro ao processar XML com IA:", error);
      
      let errorMessage = "Ocorreu um erro ao processar o arquivo XML. Verifique se é um arquivo válido.";
      
      if (error.message?.includes('429') || error.status === 429 || error.message?.includes('Resource has been exhausted')) {
         errorMessage = "Limite de uso da IA excedido (Erro 429). A cota da API foi atingida. Por favor, aguarde alguns instantes e tente novamente ou preencha os campos manualmente.";
      } else if (error.message) {
         errorMessage += ` Detalhes: ${error.message}`;
      }
      
      alert(errorMessage);
    } finally {
      setIsProcessingXml(false);
    }
  }, []);

  const handleAddFreight = useCallback(async () => {
    if (!newFreight.client || !newFreight.total_value) {
        alert('Por favor, preencha pelo menos o cliente e o valor total.');
        return;
    }

    const freightToAdd = {
        ...newFreight,
        client: newFreight.client.trim().toUpperCase(),
        origin: newFreight.origin.trim().toUpperCase(),
        destination: newFreight.destination.trim().toUpperCase(),
        // Sanitize empty strings to 0 for backend
        total_value: (newFreight.total_value as any) === '' ? 0 : newFreight.total_value,
        paid_value: (newFreight.paid_value as any) === '' ? 0 : newFreight.paid_value,
    };

    const { error } = await supabase.from('receivable_freights').upsert(freightToAdd);
    
    if (error) {
        alert(`Erro ao adicionar frete: ${error.message}`);
    } else {
        alert('Frete adicionado com sucesso!');
        setNewFreight(getInitialFreight());
        fetchFreights();
        fetchAutocompleteData();
    }
  }, [newFreight, fetchFreights, fetchAutocompleteData]);

  const handleDeleteFreight = useCallback(async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este frete?')) {
      const { error } = await supabase.from('receivable_freights').delete().eq('id', id);
      if (error) {
        alert(`Erro ao excluir frete: ${error.message}`);
      } else {
        alert('Frete excluído com sucesso.');
        fetchFreights();
        fetchAutocompleteData();
      }
    }
  }, [fetchFreights, fetchAutocompleteData]);

  const handleUpdateFreight = useCallback(async (updatedFreight: ReceivableFreight) => {
    const freightToUpdate = {
        ...updatedFreight,
        client: updatedFreight.client.trim().toUpperCase(),
        origin: updatedFreight.origin.trim().toUpperCase(),
        destination: updatedFreight.destination.trim().toUpperCase(),
        // Sanitize
        total_value: (updatedFreight.total_value as any) === '' ? 0 : updatedFreight.total_value,
        paid_value: (updatedFreight.paid_value as any) === '' ? 0 : updatedFreight.paid_value,
    };
    const { error } = await supabase
        .from('receivable_freights')
        .update(freightToUpdate)
        .eq('id', freightToUpdate.id);
    
    if (error) {
        alert(`Erro ao atualizar frete: ${error.message}`);
    } else {
        alert('Frete atualizado com sucesso.');
        fetchFreights();
        fetchAutocompleteData();
    }
  }, [fetchFreights, fetchAutocompleteData]);

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

  const handleMarkAsPaidSelected = useCallback(async () => {
    if (selectedFreights.size === 0) return;

    if (confirm(`Deseja marcar ${selectedFreights.size} frete(s) como PAGO? Isso atualizará o valor pago para igualar o valor total.`)) {
        try {
            const updates = Array.from(selectedFreights).map(id => {
                const freight = freights.find(f => f.id === id);
                if (!freight) return Promise.resolve();
                
                return supabase
                    .from('receivable_freights')
                    .update({ paid_value: Number(freight.total_value) || 0 })
                    .eq('id', id);
            });

            await Promise.all(updates);
            
            alert('Fretes atualizados com sucesso!');
            setSelectedFreights(new Set());
            fetchFreights();
        } catch (error: any) {
            console.error("Erro ao atualizar fretes:", error);
            alert("Ocorreu um erro ao atualizar os fretes.");
        }
    }
  }, [selectedFreights, freights, fetchFreights]);

  return (
    <div className="flex flex-col h-full">
      <header className="bg-white/80 backdrop-blur-lg border-b border-slate-200 sticky top-0 z-30">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-slate-800">Controle de Fretes - Contas a Receber</h1>
             {selectedFreights.size > 0 && (
                <div className="flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
                    <span className="text-sm font-medium text-slate-500">
                        {selectedFreights.size} selecionado(s)
                    </span>
                    <Button 
                        onClick={handleMarkAsPaidSelected} 
                        variant="primary" 
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Marcar como PAGO
                    </Button>
                </div>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="w-full mx-auto space-y-6">
          <SummaryCards
            totalFreights={filteredFreights.length}
            totalValue={summaryData.totalValue}
            totalReceived={summaryData.totalReceived}
            totalPending={summaryData.totalValue - summaryData.totalReceived}
          />

          {overdueCount > 0 && (
            <div className="p-4 bg-red-100 border-l-4 border-red-500 text-red-700">
                <p className="font-bold">Atenção!</p>
                <p>Você tem {overdueCount} frete(s) vencido(s) com saldo pendente.</p>
            </div>
          )}

          <ReceivableForm 
            newFreight={newFreight} 
            setNewFreight={setNewFreight}
            onAddFreight={handleAddFreight}
            savedClients={savedClients}
            savedOrigins={savedOrigins}
            savedDestinations={savedDestinations}
            onXmlUpload={handleXmlUpload}
            isProcessingXml={isProcessingXml}
          />
          
          <ReceivableFilters
            showOnlyPending={showOnlyPending}
            setShowOnlyPending={setShowOnlyPending}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            selectedYear={selectedYear}
            setSelectedYear={setSelectedYear}
          />
          
          <ReceivablesTable 
            freights={filteredFreights} 
            selectedFreights={selectedFreights}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            onDelete={handleDeleteFreight}
            onEdit={setEditingFreight}
            onUpdate={handleUpdateFreight}
          />

        </div>
      </main>
      {editingFreight && (
        <EditFreightModal
          freight={editingFreight}
          onClose={() => setEditingFreight(null)}
          onSave={(updatedFreight) => {
            handleUpdateFreight(updatedFreight);
            setEditingFreight(null);
          }}
          savedClients={savedClients}
          savedOrigins={savedOrigins}
          savedDestinations={savedDestinations}
        />
      )}
    </div>
  );
};
