
import React from 'react';
import { Card, CardContent } from '../ui/Card';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';

interface ReceivableFiltersProps {
  showOnlyPending: boolean;
  setShowOnlyPending: (value: boolean) => void;
  showOnlyOverdue: boolean;
  setShowOnlyOverdue: (value: boolean) => void;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  selectedMonth: string;
  setSelectedMonth: (value: string) => void;
  selectedYear: string;
  setSelectedYear: (value: string) => void;
}

export const ReceivableFilters: React.FC<ReceivableFiltersProps> = ({ 
    showOnlyPending, 
    setShowOnlyPending, 
    showOnlyOverdue,
    setShowOnlyOverdue,
    searchTerm, 
    setSearchTerm,
    selectedMonth,
    setSelectedMonth,
    selectedYear,
    setSelectedYear
}) => {
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

  return (
    <Card>
      <CardContent className="flex flex-col xl:flex-row items-center gap-4 p-4">
        <div className="flex flex-wrap gap-4 min-w-fit">
            <div className="flex items-center">
            <input
                id="show-pending"
                type="checkbox"
                checked={showOnlyPending}
                onChange={(e) => setShowOnlyPending(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
            />
            <label htmlFor="show-pending" className="ml-2 block text-sm text-gray-700 cursor-pointer select-none whitespace-nowrap font-medium">
                Apenas pendentes
            </label>
            </div>

            <div className="flex items-center">
            <input
                id="show-overdue"
                type="checkbox"
                checked={showOnlyOverdue}
                onChange={(e) => setShowOnlyOverdue(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
            />
            <label htmlFor="show-overdue" className="ml-2 block text-sm text-red-700 cursor-pointer select-none whitespace-nowrap font-bold">
                Apenas vencidos
            </label>
            </div>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto flex-1 xl:flex-none">
             <div className="w-1/2 md:w-40">
                 <Select label="" id="filter-month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="!py-2">
                     <option value="Todos">Mês (Todos)</option>
                     {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                 </Select>
             </div>
             <div className="w-1/2 md:w-32">
                 <Select label="" id="filter-year" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="!py-2">
                     <option value="Todos">Ano (Todos)</option>
                     {years.map(y => <option key={y} value={y}>{y}</option>)}
                 </Select>
             </div>
        </div>

        <div className="flex-grow w-full xl:w-auto">
          <Input 
            label="" 
            id="search-freight" 
            placeholder="Buscar CT-e, cliente, origem..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="!py-2"
            />
        </div>
      </CardContent>
    </Card>
  );
};
