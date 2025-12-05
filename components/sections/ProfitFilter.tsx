
import React, { useState, useMemo } from 'react';
import type { Trip } from '../../types';
import { Button } from '../ui/Button';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface ProfitFilterProps {
    trips: Trip[];
}

export const ProfitFilter: React.FC<ProfitFilterProps> = ({ trips }) => {
    const [selectedDriver, setSelectedDriver] = useState('Todos');
    const [selectedMonth, setSelectedMonth] = useState('Todos');
    const [selectedYear, setSelectedYear] = useState('Todos');

    const drivers = useMemo(() => {
        const unique = new Set(trips.map(t => t.driver).filter(Boolean));
        return Array.from(unique).sort();
    }, [trips]);

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

    // 1. Primeiro filtramos as viagens (array)
    const filteredTrips = useMemo(() => {
        let filtered = trips;

        if (selectedDriver !== 'Todos') {
            filtered = filtered.filter(t => t.driver === selectedDriver);
        }

        if (selectedYear !== 'Todos') {
            filtered = filtered.filter(t => t.departure_date && t.departure_date.startsWith(selectedYear));
        }

        if (selectedMonth !== 'Todos') {
             filtered = filtered.filter(t => {
                if (!t.departure_date) return false;
                const parts = t.departure_date.split('-');
                return parts[1] === selectedMonth;
             });
        }
        
        // Ordenar por data (mais recente primeiro)
        return filtered.sort((a, b) => {
            if (a.departure_date > b.departure_date) return -1;
            if (a.departure_date < b.departure_date) return 1;
            return 0;
        });
    }, [trips, selectedDriver, selectedMonth, selectedYear]);

    // 2. Depois calculamos os totais baseados no array filtrado
    const filteredStats = useMemo(() => {
        const totalFreights = filteredTrips.reduce((sum, t) => sum + t.freights.reduce((acc, f) => acc + (Number(f.value) || 0), 0), 0);
        const totalExpenses = filteredTrips.reduce((sum, t) => sum + t.expenses.reduce((acc, e) => acc + (Number(e.value) || 0), 0), 0);
        const totalDiesel = filteredTrips.reduce((sum, t) => sum + t.refuelings.reduce((acc, r) => acc + (Number(r.value) || 0), 0), 0);
        const totalProfit = totalFreights - totalExpenses - totalDiesel;

        return { totalFreights, totalExpenses, totalDiesel, totalProfit };
    }, [filteredTrips]);

    const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    };

    const handleGenerateReport = () => {
        if (filteredTrips.length === 0) {
            alert("Não há dados para gerar o relatório com os filtros selecionados.");
            return;
        }

        const doc = new jsPDF();
        const primaryColor = [2, 132, 199]; // sky-600

        // Cabeçalho
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(40, 40, 40);
        doc.text("Relatório de Viagens (Filtro)", 14, 20);

        // Subtítulo com os filtros aplicados
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        
        let filterText = `Motorista: ${selectedDriver}`;
        
        let periodText = 'Período: ';
        if (selectedMonth !== 'Todos' && selectedYear !== 'Todos') {
            const monthLabel = months.find(m => m.value === selectedMonth)?.label;
            periodText += `${monthLabel}/${selectedYear}`;
        } else if (selectedYear !== 'Todos') {
            periodText += `Ano ${selectedYear}`;
        } else if (selectedMonth !== 'Todos') {
            const monthLabel = months.find(m => m.value === selectedMonth)?.label;
            periodText += `Mês ${monthLabel} (Todos os anos)`;
        } else {
            periodText += "Todo o histórico";
        }

        doc.text(filterText, 14, 28);
        doc.text(periodText, 14, 33);
        doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 38);

        // Prepara os dados da tabela
        const tableBody = filteredTrips.map(trip => {
            const freightsVal = trip.freights.reduce((acc, f) => acc + (Number(f.value) || 0), 0);
            const expensesVal = trip.expenses.reduce((acc, e) => acc + (Number(e.value) || 0), 0);
            const dieselVal = trip.refuelings.reduce((acc, r) => acc + (Number(r.value) || 0), 0);
            const profitVal = freightsVal - expensesVal - dieselVal;
            
            // Rota resumida (pega a primeira origem e o último destino se houver)
            let route = '-';
            if (trip.freights.length > 0) {
                const origin = trip.freights[0].origin.split('-')[0].split(',')[0]; // Pega só a cidade
                const destination = trip.freights[trip.freights.length - 1].destination.split('-')[0].split(',')[0];
                route = `${origin} > ${destination}`;
                if (trip.freights.length > 1) route += ' (+)';
            }

            return [
                formatDate(trip.departure_date),
                trip.driver,
                trip.license_plate,
                route,
                formatCurrency(freightsVal),
                formatCurrency(expensesVal),
                formatCurrency(dieselVal),
                formatCurrency(profitVal)
            ];
        });

        autoTable(doc, {
            startY: 45,
            head: [['Data', 'Motorista', 'Placa', 'Rota', 'Frete', 'Despesas', 'Diesel', 'Lucro']],
            body: tableBody,
            theme: 'striped',
            headStyles: { fillColor: primaryColor as any, textColor: 255, fontStyle: 'bold', fontSize: 9 },
            bodyStyles: { fontSize: 8 },
            columnStyles: {
                0: { cellWidth: 20 },
                4: { halign: 'right' },
                5: { halign: 'right' },
                6: { halign: 'right' },
                7: { halign: 'right', fontStyle: 'bold' }
            },
            // Footer com totais
            foot: [[
                'TOTAIS', '', '', '', 
                formatCurrency(filteredStats.totalFreights),
                formatCurrency(filteredStats.totalExpenses),
                formatCurrency(filteredStats.totalDiesel),
                formatCurrency(filteredStats.totalProfit)
            ]],
            footStyles: { fillColor: [240, 240, 240], textColor: 50, fontStyle: 'bold', halign: 'right' }
        });

        // Rodapé de página
        const pageCount = (doc as any).internal.getNumberOfPages();
        doc.setFontSize(8);
        for(let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.text('Sistema de Gestão de Viagens', 14, doc.internal.pageSize.height - 10);
            doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 25, doc.internal.pageSize.height - 10);
        }

        const fileName = `Relatorio_Viagens_${selectedDriver.replace(/\s+/g, '')}_${new Date().getTime()}.pdf`;
        doc.save(fileName);
    };

    return (
        <div className="bg-white rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 h-fit">
            <div className="flex items-center justify-between mb-6">
                 <h2 className="text-lg font-bold text-slate-800 tracking-tight">Filtro de Resultados</h2>
                 <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                    </svg>
                 </div>
            </div>

            <div className="space-y-4 mb-8">
                <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Motorista</label>
                    <div className="relative">
                        <select
                            value={selectedDriver}
                            onChange={(e) => setSelectedDriver(e.target.value)}
                            className="w-full bg-slate-50 text-slate-700 text-sm font-medium rounded-xl border-0 py-3 px-4 pr-10 focus:ring-2 focus:ring-emerald-500/20 cursor-pointer appearance-none transition-shadow outline-none"
                        >
                            <option value="Todos">Todos</option>
                            {drivers.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                         <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Mês</label>
                         <div className="relative">
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="w-full bg-slate-50 text-slate-700 text-sm font-medium rounded-xl border-0 py-3 px-4 pr-10 focus:ring-2 focus:ring-emerald-500/20 cursor-pointer appearance-none transition-shadow outline-none"
                            >
                                <option value="Todos">Todos</option>
                                {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                             <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Ano</label>
                         <div className="relative">
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(e.target.value)}
                                className="w-full bg-slate-50 text-slate-700 text-sm font-medium rounded-xl border-0 py-3 px-4 pr-10 focus:ring-2 focus:ring-emerald-500/20 cursor-pointer appearance-none transition-shadow outline-none"
                            >
                                <option value="Todos">Todos</option>
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                             <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-1">
                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors group">
                    <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-sky-50 flex items-center justify-center text-sky-600 group-hover:bg-sky-100 transition-colors">
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                         </div>
                        <span className="text-sm font-medium text-slate-600">Fretes</span>
                    </div>
                    <span className="text-sm font-bold text-slate-800">{formatCurrency(filteredStats.totalFreights)}</span>
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors group">
                    <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-500 group-hover:bg-red-100 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                         </div>
                        <span className="text-sm font-medium text-slate-600">Despesas</span>
                    </div>
                    <span className="text-sm font-bold text-slate-800">{formatCurrency(filteredStats.totalExpenses)}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors group">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 group-hover:bg-amber-100 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <span className="text-sm font-medium text-slate-600">Diesel</span>
                    </div>
                    <span className="text-sm font-bold text-slate-800">{formatCurrency(filteredStats.totalDiesel)}</span>
                </div>
            </div>

            <div className="mt-6 pt-6 border-t border-dashed border-slate-200">
                <div className="flex items-end justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Lucro Líquido</p>
                         <p className={`text-2xl font-bold tracking-tight ${filteredStats.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatCurrency(filteredStats.totalProfit)}
                        </p>
                    </div>
                     <div className={`h-10 w-10 rounded-full flex items-center justify-center ${filteredStats.totalProfit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                         {filteredStats.totalProfit >= 0 ? (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                         ) : (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
                         )}
                     </div>
                </div>
            </div>

            <div className="mt-6">
                <Button 
                    onClick={handleGenerateReport} 
                    variant="outline" 
                    className="w-full flex items-center justify-center gap-2 border-slate-300 text-slate-600 hover:text-sky-700 hover:border-sky-300 hover:bg-sky-50"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
                    </svg>
                    Gerar Relatório (PDF)
                </Button>
            </div>
        </div>
    );
};
