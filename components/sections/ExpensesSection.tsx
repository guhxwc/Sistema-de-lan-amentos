
import React, { useState, useMemo } from 'react';
import type { Trip, Expense } from '../../types';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { DatalistInput } from '../ui/DatalistInput';

interface ExpensesSectionProps {
  trip: Trip;
  setTrip: React.Dispatch<React.SetStateAction<Trip>>;
  savedCategories: string[];
}

export const ExpensesSection: React.FC<ExpensesSectionProps> = ({ trip, setTrip, savedCategories }) => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');

  const handleAddExpense = () => {
    setTrip(prev => ({
      ...prev,
      expenses: [{ id: crypto.randomUUID(), description: filterCategory || '', value: '' }, ...prev.expenses]
    }));
  };

  const handleRemoveExpense = (id: string) => {
    setTrip(prev => ({
      ...prev,
      expenses: prev.expenses.filter(e => e.id !== id)
    }));
  };

  const handleChange = (id: string, field: keyof Omit<Expense, 'id'>, value: string | number) => {
    setTrip(prev => ({
      ...prev,
      expenses: prev.expenses.map(e =>
        e.id === id
          ? { ...e, [field]: value }
          : e
      )
    }));
  };

  // Combine saved categories with those currently in the trip to ensure list is up to date
  const allCategories = useMemo(() => {
    const currentCategories = new Set(savedCategories);
    trip.expenses.forEach(e => {
        if(e.description) currentCategories.add(e.description.trim());
    });
    return Array.from(currentCategories).sort();
  }, [trip.expenses, savedCategories]);

  const filteredExpenses = useMemo(() => {
    if (!filterCategory) return trip.expenses;
    return trip.expenses.filter(e => 
        e.description.toLowerCase().includes(filterCategory.toLowerCase())
    );
  }, [trip.expenses, filterCategory]);

  const categoryTotal = useMemo(() => {
    if (!filterCategory) return 0;
    return filteredExpenses.reduce((acc, e) => acc + (Number(e.value) || 0), 0);
  }, [filteredExpenses, filterCategory]);

  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const toggleFilter = () => {
      if (isFilterOpen) {
          setFilterCategory('');
      }
      setIsFilterOpen(!isFilterOpen);
  };

  return (
    <Card>
      <CardHeader action={
        <div className="flex items-center gap-2">
             <Button 
                onClick={toggleFilter} 
                variant={isFilterOpen ? 'secondary' : 'ghost'} 
                size="sm"
                className="flex items-center gap-1"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                </svg>
                {isFilterOpen ? 'Fechar Filtro' : 'Filtrar'}
            </Button>
            <Button onClick={handleAddExpense} size="sm">Adicionar Despesa</Button>
        </div>
      }>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
        Despesas (sem diesel)
      </CardHeader>
      
      {isFilterOpen && (
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 animate-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col md:flex-row items-end gap-4">
                <div className="w-full md:w-1/3">
                     <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 ml-1">
                        Filtrar por Categoria
                    </label>
                    <select 
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="w-full px-4 py-2 bg-white border border-slate-300 rounded-xl text-slate-700 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                    >
                        <option value="">Todas</option>
                        {allCategories.map((cat, idx) => (
                            <option key={idx} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>
                {filterCategory && (
                     <div className="bg-white border border-sky-200 rounded-xl px-4 py-2 shadow-sm flex items-center gap-3">
                        <div className="text-xs font-bold text-sky-600 uppercase tracking-wider">
                            Total em {filterCategory}
                        </div>
                        <div className="text-lg font-bold text-slate-800">
                            {formatCurrency(categoryTotal)}
                        </div>
                     </div>
                )}
                <div className="flex-grow"></div>
                {filterCategory && (
                    <Button variant="ghost" size="sm" onClick={() => setFilterCategory('')} className="text-slate-400 hover:text-slate-600">
                        Limpar Filtro
                    </Button>
                )}
            </div>
        </div>
      )}

      <CardContent className="space-y-4">
        {filteredExpenses.map((expense, index) => (
          <div key={expense.id} className="grid grid-cols-1 md:grid-cols-8 gap-4 items-end p-3 bg-slate-50 rounded-lg">
            <div className="md:col-span-6">
              <DatalistInput 
                label={`Descrição`} 
                value={expense.description} 
                onChange={e => handleChange(expense.id, 'description', e.target.value)} 
                placeholder="Ex: Pedágio" 
                options={allCategories} // Use the combined list for autocompletion
                id={`expense-desc-${expense.id}`}
              />
            </div>
            <div className="md:col-span-1">
              <Input 
                label="Valor (R$)" 
                currency 
                value={expense.value} 
                onChange={e => handleChange(expense.id, 'value', e.target.value)} 
              />
            </div>
            <div className="md:col-span-1">
              <Button onClick={() => handleRemoveExpense(expense.id)} variant="danger" size="sm" className="w-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </Button>
            </div>
          </div>
        ))}
        {filteredExpenses.length === 0 && (
            <div className="text-center py-8 text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                {filterCategory ? `Nenhuma despesa encontrada na categoria "${filterCategory}".` : 'Nenhuma despesa adicionada.'}
            </div>
        )}
      </CardContent>
    </Card>
  );
};
