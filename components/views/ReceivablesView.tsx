
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { ReceivableFreight, ProcessedCte } from '../../types';
import { supabase, getDistinctValues } from '../../lib/supabaseClient';
import { parseFiscalXml } from '../../lib/xmlParser';
import { SummaryCards } from '../receivables/SummaryCards';
import { ReceivableForm } from '../receivables/ReceivableForm';
import { ReceivablesTable } from '../receivables/ReceivablesTable';
import { ReceivableFilters } from '../receivables/ReceivableFilters';
import { EditFreightModal } from '../receivables/EditFreightModal';
import { CteInboxModal } from '../receivables/CteInboxModal';
import { Button } from '../ui/Button';

const getInitialFreight = (): ReceivableFreight => ({
  id: crypto.randomUUID(),
  date: new Date().toISOString().split('T')[0],
  due_date: '',
  delivery_date: '',
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
  const [showOnlyOverdue, setShowOnlyOverdue] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('Todos');
  const [selectedYear, setSelectedYear] = useState('Todos');

  const [editingFreight, setEditingFreight] = useState<ReceivableFreight | null>(null);
  const [isProcessingXml, setIsProcessingXml] = useState(false);
  const [selectedFreights, setSelectedFreights] = useState<Set<string>>(new Set());

  // Inbox States
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const [inboxCtes, setInboxCtes] = useState<ProcessedCte[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(false);

  const fetchFreights = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('receivable_freights')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.warn(`Erro ao buscar fretes: ${error.message}`);
      } else {
        setFreights(data || []);
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
    } catch (error: any) {
      console.warn(`Erro de rede ao buscar fretes: ${error.message}`);
    }
  }, []);

  const fetchInbox = useCallback(async () => {
    setLoadingInbox(true);
    const { data, error } = await supabase
      .from('inbox_ctes')
      .select('*')
      .eq('is_used', false)
      .order('received_at', { ascending: false });
    
    if (error) {
      // Ignora erro de tabela inexistente (42P01) para não poluir o console
      if (error.code !== '42P01') {
        console.error("Erro ao buscar inbox:", error.message);
      }
    } else {
      setInboxCtes(data || []);
    }
    setLoadingInbox(false);
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
    fetchInbox();

    const channel = supabase.channel('receivable_freights-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'receivable_freights' }, payload => {
        fetchFreights();
        fetchAutocompleteData();
      })
      .subscribe();

    const inboxChannel = supabase.channel('inbox_ctes-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inbox_ctes' }, payload => {
        fetchInbox();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(inboxChannel);
    };
  }, [fetchFreights, fetchAutocompleteData, fetchInbox]);

  const filteredFreights = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return freights
      .filter(freight => {
        const total = Number(freight.total_value) || 0;
        const paid = Number(freight.paid_value) || 0;
        const pendingValue = total - paid;
        
        if (showOnlyPending && pendingValue <= 0.01) return false;

        if (showOnlyOverdue) {
            if (pendingValue <= 0.01) return false;
            if (!freight.due_date) return false;
            const [year, month, day] = freight.due_date.split('-').map(Number);
            const dueDate = new Date(year, month - 1, day);
            if (dueDate >= today) return false;
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
  }, [freights, showOnlyPending, showOnlyOverdue, searchTerm, selectedMonth, selectedYear]);

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
      const parsedData = parseFiscalXml(xmlContent);

      setNewFreight(prev => ({
        ...prev,
        cte: parsedData.cte || parsedData.mdfe || '',
        date: parsedData.date?.split('T')[0] || prev.date,
        client: parsedData.client || parsedData.company || '',
        origin: parsedData.origin || '',
        destination: parsedData.destination || '',
        total_value: parsedData.total_value || 0,
      }));

      alert('Dados do XML preenchidos com sucesso!');
    } catch (error: any) {
      console.error("Erro ao processar XML:", error);
      alert("Erro ao processar o arquivo XML localmente.");
    } finally {
      setIsProcessingXml(false);
    }
  }, []);

  const handleSelectFromInbox = useCallback(async (cte: ProcessedCte) => {
    setNewFreight({
      ...getInitialFreight(),
      cte: cte.cte_number || '',
      date: cte.emission_date || new Date().toISOString().split('T')[0],
      client: cte.client_name || '',
      origin: cte.origin || '',
      destination: cte.destination || '',
      total_value: cte.total_value || 0,
    });
    
    // Marcar como usado no Supabase (Opcional: você pode querer fazer isso apenas após Salvar o frete, mas aqui remove do inbox)
    await supabase.from('inbox_ctes').update({ is_used: true }).eq('id', cte.id);
    
    setIsInboxOpen(false);
    fetchInbox();
    alert('Campos preenchidos com sucesso. Agora informe a data de vencimento.');
  }, [fetchInbox]);

  const handleDeleteFromInbox = useCallback(async (id: string) => {
    if (confirm('Deseja excluir este item da caixa de entrada?')) {
        await supabase.from('inbox_ctes').delete().eq('id', id);
        fetchInbox();
    }
  }, [fetchInbox]);

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
        date: newFreight.date || null,
        due_date: newFreight.due_date || null,
        delivery_date: newFreight.delivery_date || null,
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
        date: updatedFreight.date || null,
        due_date: updatedFreight.due_date || null,
        delivery_date: updatedFreight.delivery_date || null,
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
    if (confirm(`Deseja marcar ${selectedFreights.size} frete(s) como PAGO?`)) {
        try {
            const updates = Array.from(selectedFreights).map(id => {
                const freight = freights.find(f => f.id === id);
                if (!freight) return Promise.resolve();
                return supabase.from('receivable_freights').update({ paid_value: Number(freight.total_value) || 0 }).eq('id', id);
            });
            await Promise.all(updates);
            setSelectedFreights(new Set());
            fetchFreights();
        } catch (error) {
            alert("Erro ao atualizar fretes.");
        }
    }
  }, [selectedFreights, freights, fetchFreights]);

  return (
    <div className="flex flex-col h-full">
      <header className="bg-white/80 backdrop-blur-lg border-b border-slate-200 sticky top-0 z-30">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-slate-800">Controle de Fretes - Contas a Receber</h1>
            <div className="flex items-center gap-3">
              {inboxCtes.length > 0 && (
                 <div className="relative">
                    <Button 
                        onClick={() => setIsInboxOpen(true)} 
                        variant="secondary" 
                        size="sm"
                        className="bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100 pr-10"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                           <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Caixa de Entrada XML
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 text-[10px] font-bold text-white animate-pulse">
                            {inboxCtes.length}
                        </span>
                    </Button>
                 </div>
              )}
              {selectedFreights.size > 0 && (
                <div className="flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
                    <span className="text-sm font-medium text-slate-500">
                        {selectedFreights.size} selecionado(s)
                    </span>
                    <Button onClick={handleMarkAsPaidSelected} variant="primary" size="sm" className="bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20">
                        Marcar como PAGO
                    </Button>
                </div>
              )}
            </div>
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
            showOnlyOverdue={showOnlyOverdue}
            setShowOnlyOverdue={setShowOnlyOverdue}
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
      {isInboxOpen && (
          <CteInboxModal 
            ctes={inboxCtes}
            onSelect={handleSelectFromInbox}
            onClose={() => setIsInboxOpen(false)}
            onDelete={handleDeleteFromInbox}
            loading={loadingInbox}
          />
      )}
    </div>
  );
};
