
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Maintenance } from '../../types';

interface MaintenanceHistoryModalProps {
    licensePlate: string;
    history: (Maintenance & { tripDate?: string })[];
    onClose: () => void;
}

export const MaintenanceHistoryModal: React.FC<MaintenanceHistoryModalProps> = ({ licensePlate, history, onClose }) => {
    
    const formatDate = (dateString?: string) => {
        if (!dateString) return '-';
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    };

    const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const handleGeneratePDF = () => {
        const doc = new jsPDF();
        const primaryColor = [245, 158, 11]; // amber-500

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text(`Histórico de Manutenção`, 14, 20);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.text(`Veículo: ${licensePlate}`, 14, 28);
        doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 34);

        const tableBody = history.map(item => [
            formatDate(item.date || item.tripDate),
            item.type,
            item.current_km || '-',
            item.next_km || '-',
            formatCurrency(Number(item.value) || 0),
            item.observations || '-'
        ]);

        autoTable(doc, {
            startY: 40,
            head: [['Data', 'Serviço', 'KM Realizado', 'Próx. KM', 'Valor', 'Obs']],
            body: tableBody,
            theme: 'striped',
            headStyles: { fillColor: primaryColor as any, textColor: 255 },
            styles: { fontSize: 8 },
            columnStyles: {
                4: { halign: 'right' }
            }
        });

        doc.save(`Historico_Manutencao_${licensePlate}.pdf`);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-4xl bg-white animate-in fade-in-0 zoom-in-95 flex flex-col max-h-[90vh]">
                <CardHeader>
                    <div className="flex justify-between items-center w-full">
                        <div className="flex items-center gap-2">
                             <div className="p-2 bg-amber-100 rounded-lg text-amber-700">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">Histórico de Manutenção</h2>
                                <p className="text-xs text-slate-500 font-semibold">Veículo: {licensePlate}</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={onClose}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden flex flex-col">
                     <div className="flex justify-end mb-4">
                        <Button onClick={handleGeneratePDF} variant="outline" className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                            Baixar PDF
                        </Button>
                    </div>
                    <div className="overflow-y-auto flex-1 border rounded-lg">
                        <table className="w-full text-sm text-left text-slate-500">
                            <thead className="text-xs text-slate-700 uppercase bg-slate-100 sticky top-0">
                                <tr>
                                    <th className="px-6 py-3">Data</th>
                                    <th className="px-6 py-3">Serviço</th>
                                    <th className="px-6 py-3">KM</th>
                                    <th className="px-6 py-3">Próx. KM</th>
                                    <th className="px-6 py-3">Valor</th>
                                    <th className="px-6 py-3">Obs</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.length > 0 ? history.map((item, idx) => (
                                    <tr key={idx} className="bg-white border-b hover:bg-slate-50">
                                        <td className="px-6 py-4 whitespace-nowrap">{formatDate(item.date || item.tripDate)}</td>
                                        <td className="px-6 py-4 font-medium text-slate-900">{item.type}</td>
                                        <td className="px-6 py-4">{item.current_km}</td>
                                        <td className="px-6 py-4">{item.next_km}</td>
                                        <td className="px-6 py-4">{formatCurrency(Number(item.value) || 0)}</td>
                                        <td className="px-6 py-4 truncate max-w-[200px]" title={item.observations}>{item.observations}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                                            Nenhum registro encontrado para esta placa.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
