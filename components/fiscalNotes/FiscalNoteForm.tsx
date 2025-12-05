
import React, { useRef } from 'react';
import type { FiscalNote } from '../../types';
import { Card, CardContent } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { DatalistInput } from '../ui/DatalistInput';
import { Select } from '../ui/Select';

interface FiscalNoteFormProps {
  newNote: FiscalNote;
  setNewNote: React.Dispatch<React.SetStateAction<FiscalNote>>;
  onAddNote: () => void;
  savedCompanies: string[];
  savedLocations: string[];
  onXmlUpload: (file: File) => void;
  isProcessingXml: boolean;
  onZipUpload: (file: File) => void;
  isProcessingZip: boolean;
  zipProgress: string;
}

export const FiscalNoteForm: React.FC<FiscalNoteFormProps> = ({ 
  newNote, 
  setNewNote, 
  onAddNote, 
  savedCompanies, 
  savedLocations,
  onXmlUpload,
  isProcessingXml,
  onZipUpload,
  isProcessingZip,
  zipProgress
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewNote(prev => ({ ...prev, [name]: value as 'Pendente' | 'Entregue' }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setNewNote(prev => ({ ...prev, client_delivered: e.target.checked }));
  };

  const handleXmlButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleZipButtonClick = () => {
    zipInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onXmlUpload(file);
      e.target.value = ''; // Reset file input
    }
  };

  const handleZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onZipUpload(file);
      e.target.value = ''; // Reset file input
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
            <span className="bg-sky-100 text-sky-700 p-1.5 rounded-md">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
            </span>
            Novo lançamento
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <DatalistInput label="Empresa" name="company" value={newNote.company} onChange={handleChange} options={savedCompanies} id="company-list" />
          <Input label="Data de carregamento" name="shipping_date" type="date" value={newNote.shipping_date} onChange={handleChange} />
          <Input label="Nº NF" name="nf_number" value={newNote.nf_number} onChange={handleChange} />
          <Select label="Status Entrega" name="status" value={newNote.status} onChange={handleChange}>
            <option value="Pendente">Pendente</option>
            <option value="Entregue">Entregue</option>
          </Select>
          <DatalistInput label="Local de entrega" name="delivery_location" value={newNote.delivery_location} onChange={handleChange} options={savedLocations} id="location-list" />
        </div>
        
        <div className="flex items-center gap-2 py-2">
            <input 
                id="check-client-delivered-new" 
                type="checkbox" 
                checked={newNote.client_delivered || false} 
                onChange={handleCheckboxChange}
                className="w-4 h-4 text-teal-600 bg-gray-100 border-gray-300 rounded focus:ring-teal-500 cursor-pointer"
            />
            <label htmlFor="check-client-delivered-new" className="text-sm text-slate-700 cursor-pointer select-none">
                Marcar como <strong className="text-teal-700">Entregue ao Cliente</strong>
            </label>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100 mt-2">
            <input
              type="file"
              ref={zipInputRef}
              onChange={handleZipChange}
              accept=".zip"
              className="hidden"
            />
             <Button
              type="button"
              onClick={handleZipButtonClick}
              variant="outline"
              className="flex items-center gap-2"
              disabled={isProcessingZip || isProcessingXml}
              title="Anexar ZIP com múltiplos XMLs"
            >
              {isProcessingZip ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="truncate max-w-[150px]">{zipProgress || 'Processando ZIP...'}</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  <span>Anexar ZIP</span>
                </>
              )}
            </Button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xml"
              className="hidden"
            />
            <Button
              type="button"
              onClick={handleXmlButtonClick}
              variant="outline"
              className="flex items-center gap-2"
              disabled={isProcessingXml || isProcessingZip}
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
            <Button onClick={onAddNote} variant="primary">Adicionar NF</Button>
        </div>
      </CardContent>
    </Card>
  );
};