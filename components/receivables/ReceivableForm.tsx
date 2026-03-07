
import React, { useRef } from 'react';
import type { ReceivableFreight } from '../../types';
import { Card, CardContent } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { DatalistInput } from '../ui/DatalistInput';

interface ReceivableFormProps {
  newFreight: ReceivableFreight;
  setNewFreight: React.Dispatch<React.SetStateAction<ReceivableFreight>>;
  onAddFreight: () => void;
  savedClients: string[];
  savedOrigins: string[];
  savedDestinations: string[];
  onXmlUpload: (file: File) => void;
  isProcessingXml: boolean;
}

export const ReceivableForm: React.FC<ReceivableFormProps> = ({ newFreight, setNewFreight, onAddFreight, savedClients, savedOrigins, savedDestinations, onXmlUpload, isProcessingXml }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setNewFreight(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? '' : parseFloat(value)) : value,
    }));
  };

  const handleXmlButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onXmlUpload(file);
      e.target.value = ''; // Reset file input
    }
  };

  return (
    <Card>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4 items-end">
          <div className="lg:col-span-1"><Input label="Data" name="date" type="date" value={newFreight.date} onChange={handleChange} /></div>
          <div className="lg:col-span-1"><Input label="Vencimento" name="due_date" type="date" value={newFreight.due_date} onChange={handleChange} /></div>
          <div className="lg:col-span-1"><Input label="Data Entrega" name="delivery_date" type="date" value={newFreight.delivery_date || ''} onChange={handleChange} /></div>
          <div className="md:col-span-2 lg:col-span-2"><DatalistInput label="Cliente" name="client" value={newFreight.client} onChange={handleChange} options={savedClients} id="client-list" /></div>
          <div className="md:col-span-2 lg:col-span-1"><DatalistInput label="Origem" name="origin" value={newFreight.origin} onChange={handleChange} options={savedOrigins} id="origin-list"/></div>
          <div className="md:col-span-2 lg:col-span-1"><DatalistInput label="Destino" name="destination" value={newFreight.destination} onChange={handleChange} options={savedDestinations} id="destination-list" /></div>
          <div className="md:col-span-1"><Input label="CT-e" name="cte" value={newFreight.cte} onChange={handleChange} /></div>
          <div className="md:col-span-1"><Input label="Valor Total (R$)" name="total_value" currency value={newFreight.total_value} onChange={handleChange} /></div>
          <div className="md:col-span-1"><Input label="Pago (R$)" name="paid_value" currency value={newFreight.paid_value} onChange={handleChange} /></div>
          <div className="md:col-span-1"><Input label="Cor da Linha" name="row_color" type="color" value={newFreight.row_color} onChange={handleChange} className="p-1 h-10"/></div>
          <div className="md:col-span-2 lg:col-span-3 grid grid-cols-2 gap-2">
            <Button
              type="button"
              onClick={handleXmlButtonClick}
              variant="outline"
              className="w-full flex items-center justify-center gap-2"
              disabled={isProcessingXml}
              title="Anexar XML e preencher com IA"
            >
              {isProcessingXml ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Analisando...</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span>Anexar XML</span>
                </>
              )}
            </Button>
            <Button onClick={onAddFreight} className="w-full">Adicionar</Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xml"
              className="hidden"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
