
import React from 'react';
import type { SettlementItem } from '../../types';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { DatalistInput } from '../ui/DatalistInput';

interface DynamicListSectionProps {
  title: string;
  icon: React.ReactElement<any>;
  items: SettlementItem[];
  setItems: (items: SettlementItem[]) => void;
  variant: 'commission' | 'discount';
  suggestions?: {
    origins?: string[];
    destinations?: string[];
    descriptions?: string[];
  };
  descriptionPlaceholder: string;
}

export const DynamicListSection: React.FC<DynamicListSectionProps> = ({ 
  title, 
  icon, 
  items, 
  setItems, 
  variant,
  suggestions,
  descriptionPlaceholder 
}) => {
  const handleAddItem = () => {
    setItems([...items, { id: crypto.randomUUID(), description: '', origin: '', destination: '', value: '' }]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleChange = (id: string, field: keyof SettlementItem, value: string | number) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  return (
    <Card>
      <CardHeader action={<Button onClick={handleAddItem} size="sm">Adicionar Linha</Button>}>
        {React.cloneElement(icon, { className: 'h-5 w-5 text-sky-600' })}
        {title}
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item, index) => (
          <div key={item.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className={`grid gap-4 items-end ${variant === 'commission' ? 'grid-cols-1 md:grid-cols-12' : 'grid-cols-1 md:grid-cols-8'}`}>
              
              {variant === 'commission' && (
                <>
                  <div className="md:col-span-3">
                    <DatalistInput
                        label={`Origem #${index + 1}`}
                        value={item.origin || ''}
                        onChange={e => handleChange(item.id, 'origin', e.target.value)}
                        options={suggestions?.origins || []}
                        id={`origin-${item.id}`}
                        placeholder="Origem"
                    />
                  </div>
                  <div className="md:col-span-3">
                     <DatalistInput
                        label={`Destino #${index + 1}`}
                        value={item.destination || ''}
                        onChange={e => handleChange(item.id, 'destination', e.target.value)}
                        options={suggestions?.destinations || []}
                        id={`dest-${item.id}`}
                        placeholder="Destino"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <DatalistInput
                        label="Descrição / Nota"
                        value={item.description}
                        onChange={e => handleChange(item.id, 'description', e.target.value)}
                        options={suggestions?.descriptions || []}
                        id={`desc-${item.id}`}
                        placeholder={descriptionPlaceholder}
                    />
                  </div>
                </>
              )}

              {variant === 'discount' && (
                 <div className="md:col-span-5">
                    <DatalistInput
                        label={`Descrição #${index + 1}`}
                        value={item.description}
                        onChange={e => handleChange(item.id, 'description', e.target.value)}
                        options={suggestions?.descriptions || []}
                        id={`desc-${item.id}`}
                        placeholder={descriptionPlaceholder}
                    />
                </div>
              )}

              <div className="md:col-span-2">
                <Input
                  label="Valor (R$)"
                  type="number"
                  value={item.value}
                  onChange={e => handleChange(item.id, 'value', e.target.value === '' ? '' : parseFloat(e.target.value))}
                />
              </div>
              <div className="md:col-span-1">
                <Button onClick={() => handleRemoveItem(item.id)} variant="danger" size="sm" className="w-full" title="Remover linha">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </Button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-slate-500 text-center py-4">Nenhuma linha adicionada.</p>}
      </CardContent>
    </Card>
  );
};
