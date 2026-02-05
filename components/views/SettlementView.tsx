
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { Settlement, SettlementItem } from '../../types';
import { supabase, getDistinctValues } from '../../lib/supabaseClient';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Input, Textarea } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { DynamicListSection } from '../settlement/DynamicListSection';
import { SettlementHistory } from '../settlement/SettlementHistory';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const initialSettlementState = (): Settlement => ({
  id: crypto.randomUUID(),
  driver: '',
  date: new Date().toISOString().split('T')[0],
  observations: '',
  commissions: [],
  additions: [],
  discounts: [],
  fines_balance: '',
  final_balance: 0,
});

export const SettlementView: React.FC = () => {
  const [currentSettlement, setCurrentSettlement] = useState<Settlement>(initialSettlementState());
  const [history, setHistory] = useState<Settlement[]>([]);
  const [savedDrivers, setSavedDrivers] = useState<string[]>([]);

  // Filter States
  const [filterDriver, setFilterDriver] = useState('Todos');
  const [filterMonth, setFilterMonth] = useState('Todos');
  const [filterYear, setFilterYear] = useState('Todos');
  
  const fetchSettlements = useCallback(async () => {
    const { data, error } = await supabase
      .from('settlements')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      alert(`Erro ao buscar acertos: ${error.message}`);
    } else {
      // Null Safety: Ensure jsonb columns are arrays
      const safeData = (data || []).map((item: Settlement) => ({
        ...item,
        commissions: item.commissions || [],
        additions: item.additions || [],
        discounts: item.discounts || []
      }));
      setHistory(safeData);
    }
  }, []);

  const fetchDrivers = useCallback(async () => {
    try {
        const [settlementDrivers, tripDrivers] = await Promise.all([
            getDistinctValues('settlements', 'driver'),
            getDistinctValues('trips', 'driver')
        ]);
        const allDrivers = new Set([...settlementDrivers, ...tripDrivers]);
        setSavedDrivers(Array.from(allDrivers).sort());
    } catch(error: any) {
        alert(`Erro ao carregar lista de motoristas: ${error.message}`);
    }
  }, []);

  useEffect(() => {
    fetchSettlements();
    fetchDrivers();

    const channel = supabase.channel('settlements-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settlements' }, payload => {
        console.log('Change received!', payload);
        fetchSettlements();
        fetchDrivers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSettlements, fetchDrivers]);

  const suggestions = useMemo(() => {
    const origins = new Set<string>();
    const destinations = new Set<string>();
    const commissionDescriptions = new Set<string>();
    const additionDescriptions = new Set<string>();
    const discountDescriptions = new Set<string>();

    history.forEach(item => {
        // Commissions
        if (Array.isArray(item.commissions)) {
            item.commissions.forEach((c: any) => {
                if (c.origin) origins.add(c.origin);
                if (c.destination) destinations.add(c.destination);
                if (c.description) commissionDescriptions.add(c.description);
            });
        }
        // Additions
        if (Array.isArray(item.additions)) {
            item.additions.forEach((a: any) => {
                if (a.description) additionDescriptions.add(a.description);
            });
        }
        // Discounts
        if (Array.isArray(item.discounts)) {
            item.discounts.forEach((d: any) => {
                if (d.description) discountDescriptions.add(d.description);
            });
        }
    });

    return {
        origins: Array.from(origins).sort(),
        destinations: Array.from(destinations).sort(),
        commissionDescriptions: Array.from(commissionDescriptions).sort(),
        additionDescriptions: Array.from(additionDescriptions).sort(),
        discountDescriptions: Array.from(discountDescriptions).sort(),
    };
  }, [history]);

  const totals = useMemo(() => {
    const totalCommissions = currentSettlement.commissions.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
    const totalAdditions = currentSettlement.additions.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
    const totalDiscounts = currentSettlement.discounts.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
    const finalBalance = totalCommissions + totalAdditions - totalDiscounts;
    return { totalCommissions, totalAdditions, totalDiscounts, finalBalance };
  }, [currentSettlement]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCurrentSettlement(prev => ({ ...prev, [name]: value }));
  };

  const setCommissions = (commissions: SettlementItem[]) => {
    setCurrentSettlement(prev => ({ ...prev, commissions }));
  };

  const setAdditions = (additions: SettlementItem[]) => {
    setCurrentSettlement(prev => ({ ...prev, additions }));
  };
  
  const setDiscounts = (discounts: SettlementItem[]) => {
    setCurrentSettlement(prev => ({ ...prev, discounts }));
  };

  const handleClearFields = useCallback(() => {
    setCurrentSettlement(initialSettlementState());
  }, []);
  
  const handleSave = async () => {
    if (!currentSettlement.driver) {
        alert('Por favor, preencha o nome do motorista.');
        return;
    }
    const settlementToSave = { 
        ...currentSettlement, 
        final_balance: totals.finalBalance,
        driver: currentSettlement.driver.trim().toUpperCase(),
        // Sanitize nested items
        commissions: currentSettlement.commissions.map(c => ({ 
            ...c, 
            value: Number(c.value) || 0,
            freightValue: c.freightValue ? Number(c.freightValue) : null, // Salvar valor do frete
            percentage: c.percentage ? Number(c.percentage) : null,       // Salvar porcentagem
            origin: c.origin ? c.origin.trim().toUpperCase() : '',
            destination: c.destination ? c.destination.trim().toUpperCase() : '',
            description: c.description ? c.description.trim() : ''
        })),
        additions: currentSettlement.additions.map(a => ({ 
            ...a, 
            value: Number(a.value) || 0,
            description: a.description ? a.description.trim() : ''
        })),
        discounts: currentSettlement.discounts.map(d => ({ 
            ...d, 
            value: Number(d.value) || 0,
            description: d.description ? d.description.trim() : ''
        })),
    };
    
    const { error } = await supabase.from('settlements').upsert(settlementToSave);

    if (error) {
        alert(`Erro ao salvar acerto: ${error.message}`);
    } else {
        alert('Acerto salvo com sucesso!');
        fetchSettlements();
        fetchDrivers();
        handleClearFields(); // Limpa os campos automaticamente após salvar
    }
  };

  const handleLoadFromHistory = (id: string) => {
    const itemToLoad = history.find(item => item.id === id);
    if (itemToLoad) {
      setCurrentSettlement({
          ...itemToLoad,
          commissions: itemToLoad.commissions || [],
          additions: itemToLoad.additions || [],
          discounts: itemToLoad.discounts || []
      });
    }
  };

  const handleDeleteFromHistory = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este acerto do histórico?')) {
        const { error } = await supabase.from('settlements').delete().eq('id', id);
        if (error) {
            alert(`Erro ao excluir acerto: ${error.message}`);
        } else {
            alert('Acerto excluído com sucesso.');
            if(currentSettlement.id === id) {
                handleClearFields();
            }
            fetchSettlements();
            fetchDrivers();
        }
    }
  };

  const handleClearHistory = async () => {
    if (confirm('Tem certeza que deseja limpar todo o histórico de acertos? Esta ação não pode ser desfeita.')) {
        const { error } = await supabase.from('settlements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) {
            alert(`Erro ao limpar histórico: ${error.message}`);
        } else {
            alert('Histórico de acertos limpo com sucesso.');
            fetchSettlements();
            fetchDrivers();
        }
    }
  }

  const handleGeneratePDF = () => {
    if (!currentSettlement.driver) {
        alert('Preencha os dados do acerto primeiro.');
        return;
    }

    const doc = new jsPDF();
    const primaryColor = [2, 132, 199]; // sky-600
    const secondaryColor = [60, 60, 60];

    // Header
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('Demonstrativo de Acerto', 14, 20);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Transportes & Logística', 14, 30);

    // Info Section
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.setFontSize(12);
    doc.text(`Motorista: ${currentSettlement.driver}`, 14, 50);
    
    const [year, month, day] = currentSettlement.date.split('-');
    const formattedDate = `${day}/${month}/${year}`;
    doc.text(`Data: ${formattedDate}`, 150, 50, { align: 'right' });

    let currentY = 60;

    const formatBRL = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // Commissions Table
    if (currentSettlement.commissions.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text('CRÉDITOS / COMISSÕES', 14, currentY);
        currentY += 5;

        const commissionData = currentSettlement.commissions.map(c => {
            let detail = (c.origin || c.destination) ? `${c.origin || ''} x ${c.destination || ''}` : '-';
            // Se tiver dados de cálculo, adiciona ao detalhe
            if (c.percentage && c.freightValue) {
                detail += `\n(Frete: ${formatBRL(Number(c.freightValue))} | ${c.percentage}%)`;
            }
            return [detail, c.description, formatBRL(Number(c.value) || 0)];
        });

        autoTable(doc, {
            startY: currentY,
            head: [['Rota / Detalhe', 'Descrição/Obs', 'Valor']],
            body: commissionData,
            theme: 'grid',
            headStyles: { fillColor: [240, 240, 240], textColor: [60, 60, 60], fontStyle: 'bold' },
            columnStyles: { 
                0: { cellWidth: 'auto' }, 
                1: { cellWidth: 'auto' },
                2: { cellWidth: 40, halign: 'right' } 
            },
            margin: { left: 14, right: 14 }
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    // Additions Table
    if (currentSettlement.additions.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text('OUTROS CRÉDITOS / DESCARGAS', 14, currentY);
        currentY += 5;

        const additionsData = currentSettlement.additions.map(a => [a.description, formatBRL(Number(a.value) || 0)]);
        autoTable(doc, {
            startY: currentY,
            head: [['Descrição', 'Valor']],
            body: additionsData,
            theme: 'grid',
            headStyles: { fillColor: [235, 245, 255], textColor: [60, 60, 60], fontStyle: 'bold' },
            columnStyles: { 
                0: { cellWidth: 'auto' }, 
                1: { cellWidth: 40, halign: 'right' } 
            },
            margin: { left: 14, right: 14 }
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    // Discounts Table
    if (currentSettlement.discounts.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(180, 60, 60); // Red-ish
        doc.text('DÉBITOS / DESCONTOS', 14, currentY);
        currentY += 5;

        const discountData = currentSettlement.discounts.map(d => [d.description, formatBRL(Number(d.value) || 0)]);
        autoTable(doc, {
            startY: currentY,
            head: [['Descrição', 'Valor']],
            body: discountData,
            theme: 'grid',
            headStyles: { fillColor: [255, 240, 240], textColor: [60, 60, 60], fontStyle: 'bold' },
             columnStyles: { 
                0: { cellWidth: 'auto' }, 
                1: { cellWidth: 40, halign: 'right' } 
            },
            margin: { left: 14, right: 14 }
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    // Summary Section
    const finalY = currentY;
    
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(14, finalY, 182, 50, 2, 2, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);

    doc.text('Total Comissões:', 20, finalY + 10);
    doc.text(formatBRL(totals.totalCommissions), 190, finalY + 10, { align: 'right' });

    doc.text('Total Outros Créditos:', 20, finalY + 18);
    doc.text(formatBRL(totals.totalAdditions), 190, finalY + 18, { align: 'right' });

    doc.text('Total Débitos:', 20, finalY + 26);
    doc.text(formatBRL(totals.totalDiscounts), 190, finalY + 26, { align: 'right' });

    doc.setDrawColor(220, 220, 220);
    doc.line(20, finalY + 32, 190, finalY + 32);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    
    // COR DO SALDO FINAL NO PDF
    if (totals.finalBalance < 0) {
        doc.setTextColor(220, 38, 38); // Red-600
    } else {
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    }
    
    doc.text('SALDO FINAL:', 20, finalY + 42);
    doc.text(formatBRL(totals.finalBalance), 190, finalY + 42, { align: 'right' });

    // Observations if any
    if (currentSettlement.observations || currentSettlement.fines_balance) {
        let obsY = finalY + 60;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);
        doc.text('Observações:', 14, obsY);
        
        doc.setFont('helvetica', 'normal');
        const splitObs = doc.splitTextToSize(currentSettlement.observations + (currentSettlement.fines_balance ? `\nSaldo de Multas: ${currentSettlement.fines_balance}` : ''), 180);
        doc.text(splitObs, 14, obsY + 7);
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Documento gerado eletronicamente.', 105, 285, { align: 'center' });

    doc.save(`Acerto_${currentSettlement.driver.replace(/\s+/g, '_')}_${currentSettlement.date}.pdf`);
  };

  const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Filtered History Logic
  const months = [
    { value: '01', label: 'Janeiro' },
    { value: '02', label: 'Fevereiro' },
    { value: '03', label: 'Março' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Maio' },
    { value: '06', label: 'Junho' },
    { value: '07', label: 'Julho' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' },
  ];
  const years = ['2023', '2024', '2025', '2026', '2027'];

  const filteredHistory = useMemo(() => {
    return history.filter(item => {
        const matchesDriver = filterDriver === 'Todos' || item.driver === filterDriver;
        
        let matchesMonth = true;
        let matchesYear = true;

        if (item.date) {
            const [y, m] = item.date.split('-');
            if (filterMonth !== 'Todos' && m !== filterMonth) matchesMonth = false;
            if (filterYear !== 'Todos' && y !== filterYear) matchesYear = false;
        } else {
             matchesMonth = filterMonth === 'Todos';
             matchesYear = filterYear === 'Todos';
        }

        return matchesDriver && matchesMonth && matchesYear;
    });
  }, [history, filterDriver, filterMonth, filterYear]);

  const filteredTotal = useMemo(() => {
    return filteredHistory.reduce((acc, curr) => acc + (Number(curr.final_balance) || 0), 0);
  }, [filteredHistory]);

  const handleGenerateReportPDF = () => {
    const doc = new jsPDF();
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Relatório de Acertos', 14, 20);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Motorista: ${filterDriver}`, 14, 30);
    
    const monthLabel = filterMonth === 'Todos' ? 'Todos' : months.find(m => m.value === filterMonth)?.label;
    const periodText = `Período: ${monthLabel}/${filterYear}`;
    doc.text(periodText, 14, 35);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 40);

    // Calculate totals for the entire filtered period
    const totals = filteredHistory.reduce((acc, item) => {
        const comms = (item.commissions || []).reduce((sum, c) => sum + (Number(c.value) || 0), 0);
        const adds = (item.additions || []).reduce((sum, c) => sum + (Number(c.value) || 0), 0);
        const discs = (item.discounts || []).reduce((sum, c) => sum + (Number(c.value) || 0), 0);
        
        return {
            commissions: acc.commissions + comms,
            additions: acc.additions + adds,
            discounts: acc.discounts + discs,
            finalBalance: acc.finalBalance + (Number(item.final_balance) || 0)
        };
    }, { commissions: 0, additions: 0, discounts: 0, finalBalance: 0 });

    const formatBRL = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const tableData = filteredHistory.map(item => {
        const comms = (item.commissions || []).reduce((sum, c) => sum + (Number(c.value) || 0), 0);
        const adds = (item.additions || []).reduce((sum, c) => sum + (Number(c.value) || 0), 0);
        const discs = (item.discounts || []).reduce((sum, c) => sum + (Number(c.value) || 0), 0);

        return [
            item.date ? item.date.split('-').reverse().join('/') : '-',
            item.driver,
            formatBRL(comms),
            formatBRL(adds),
            formatBRL(discs),
            formatBRL(Number(item.final_balance))
        ];
    });

    autoTable(doc, {
        startY: 45,
        head: [['Data', 'Motorista', 'Comissões', 'Descargas', 'Descontos', 'Saldo Final']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [2, 132, 199], textColor: 255, fontStyle: 'bold', fontSize: 9, halign: 'center' },
        bodyStyles: { fontSize: 8, halign: 'center' },
        columnStyles: {
             0: { cellWidth: 22, halign: 'center' }, // Data
             1: { cellWidth: 'auto', halign: 'left' }, // Motorista
             2: { cellWidth: 25, halign: 'right' }, // Comissões
             3: { cellWidth: 25, halign: 'right' }, // Outros
             4: { cellWidth: 25, halign: 'right' }, // Descontos
             5: { cellWidth: 25, halign: 'right', fontStyle: 'bold' } // Saldo
        },
        foot: [[
            'TOTAIS', 
            '', 
            formatBRL(totals.commissions),
            formatBRL(totals.additions),
            formatBRL(totals.discounts),
            formatBRL(totals.finalBalance)
        ]],
        footStyles: { fillColor: [240, 240, 240], textColor: 50, fontStyle: 'bold', halign: 'right' }
    });

    doc.save('relatorio_acertos_detalhado.pdf');
  };

  return (
    <div className="flex flex-col h-full">
      <header className="bg-white/80 backdrop-blur-lg border-b border-slate-200 sticky top-0 z-30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-slate-800">Sistema de Acerto de Viagem</h1>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto space-y-8 pb-24">
            <Card>
                <CardHeader>Informações Gerais</CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input label="Motorista" name="driver" value={currentSettlement.driver} onChange={handleInputChange} placeholder="Ex: João Pedro" />
                    <Select label="Selecionar motorista salvo" id="saved-driver-select" value={currentSettlement.driver} onChange={handleInputChange} name="driver">
                        <option value="">Selecione...</option>
                        {savedDrivers.map(driver => <option key={driver} value={driver}>{driver}</option>)}
                    </Select>
                    <Input label="Data do Acerto" name="date" type="date" value={currentSettlement.date} onChange={handleInputChange} />
                    <div className="md:col-span-2">
                        <Textarea label="Observações Gerais (opcional)" name="observations" value={currentSettlement.observations} onChange={handleInputChange} rows={3} placeholder="Ex: Viagem com duas cargas, pedágio pago pela empresa, etc." />
                    </div>
                </CardContent>
            </Card>

            <DynamicListSection 
                title="Comissões de Frete" 
                icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.5 2.5 0 00-1.168-.217c-1.38 0-2.5 1.12-2.5 2.5s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5v-1.698c.959.181 1.682 1.047 1.682 2.152 0 1.242-1.008 2.25-2.25 2.25S5 13.742 5 12.5c0-1.105.723-1.97 1.682-2.152V9.318a4.5 4.5 0 116.636 2.152V6.682a4.5 4.5 0 01-6.636-2.152z" /></svg>} 
                items={currentSettlement.commissions} 
                setItems={setCommissions} 
                variant="commission"
                suggestions={{
                    origins: suggestions.origins,
                    destinations: suggestions.destinations,
                    descriptions: suggestions.commissionDescriptions
                }}
                descriptionPlaceholder="Pagamento Descarga / Complemento..." 
            />

            <DynamicListSection 
                title="Descargas / Outros (Créditos)" 
                icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" /></svg>} 
                items={currentSettlement.additions} 
                setItems={setAdditions}
                variant="discount"
                suggestions={{
                    descriptions: suggestions.additionDescriptions
                }}
                descriptionPlaceholder="Descarga / Reembolso..." 
            />

            <DynamicListSection 
                title="Descontos" 
                icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>} 
                items={currentSettlement.discounts} 
                setItems={setDiscounts}
                variant="discount"
                suggestions={{
                    descriptions: suggestions.discountDescriptions
                }}
                descriptionPlaceholder="Vale / Multa..." 
            />
            
            <Card>
                <CardHeader>Resumo e Ações</CardHeader>
                <CardContent className="space-y-6">
                    <Textarea label="Saldo de multas (somente formalização - não entra no cálculo)" name="fines_balance" value={currentSettlement.fines_balance} onChange={handleInputChange} rows={2} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="p-4 bg-slate-100 text-slate-800 rounded-lg text-center">
                            <h3 className="font-semibold text-xs uppercase tracking-wider">Total Comissões</h3>
                            <p className="text-xl font-bold">{formatCurrency(totals.totalCommissions)}</p>
                        </div>
                        <div className="p-4 bg-emerald-50 text-emerald-800 rounded-lg text-center">
                            <h3 className="font-semibold text-xs uppercase tracking-wider">Total Outros</h3>
                            <p className="text-xl font-bold">{formatCurrency(totals.totalAdditions)}</p>
                        </div>
                        <div className="p-4 bg-red-50 text-red-800 rounded-lg text-center">
                            <h3 className="font-semibold text-xs uppercase tracking-wider">Total Descontos</h3>
                            <p className="text-xl font-bold">{formatCurrency(totals.totalDiscounts)}</p>
                        </div>
                        <div className={`p-4 rounded-lg text-center border-2 ${totals.finalBalance < 0 ? 'bg-red-100 text-red-800 border-red-200' : 'bg-sky-100 text-sky-800 border-sky-200'}`}>
                            <h3 className="font-semibold text-xs uppercase tracking-wider">Saldo Final</h3>
                            <p className="text-xl font-bold">{formatCurrency(totals.finalBalance)}</p>
                        </div>
                    </div>
                     <div className="flex flex-wrap gap-2 justify-end pt-4 border-t border-slate-200">
                        <Button variant="primary" onClick={handleSave}>Gerar Resumo (Salvar / Atualizar)</Button>
                        <Button variant="secondary" onClick={handleGeneratePDF} className="flex items-center gap-2">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
                            </svg>
                            Gerar PDF
                        </Button>
                        <Button variant="danger" onClick={handleClearFields}>Limpar Campos</Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>Filtros e Relatórios de Histórico</CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <Select label="Motorista" id="filter-driver" value={filterDriver} onChange={e => setFilterDriver(e.target.value)}>
                            <option value="Todos">Todos</option>
                            {savedDrivers.map(d => <option key={d} value={d}>{d}</option>)}
                        </Select>
                        <Select label="Mês" id="filter-month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
                            <option value="Todos">Todos</option>
                            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </Select>
                        <Select label="Ano" id="filter-year" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                            <option value="Todos">Todos</option>
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </Select>
                        <Button onClick={handleGenerateReportPDF} variant="outline" className="flex items-center gap-2 justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                            Imprimir Relatório
                        </Button>
                    </div>
                    {filteredTotal !== 0 && (
                        <div className="mt-4 p-4 bg-sky-50 border border-sky-100 rounded-lg flex justify-between items-center">
                            <span className="font-semibold text-sky-900">Total do Período/Filtro:</span>
                            <span className="text-xl font-bold text-sky-700">{formatCurrency(filteredTotal)}</span>
                        </div>
                    )}
                </CardContent>
            </Card>

            <SettlementHistory 
                history={filteredHistory} 
                onView={handleLoadFromHistory}
                onEdit={handleLoadFromHistory}
                onDelete={handleDeleteFromHistory}
                onClear={handleClearHistory}
            />
        </div>
      </main>
    </div>
  );
};