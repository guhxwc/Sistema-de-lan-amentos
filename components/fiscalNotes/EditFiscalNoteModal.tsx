
import React, { useState } from 'react';
import type { FiscalNote } from '../../types';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { DatalistInput } from '../ui/DatalistInput';
import { Select } from '../ui/Select';

interface EditFiscalNoteModalProps {
  note: FiscalNote;
  onSave: (note: FiscalNote) => void;
  onClose: () => void;
  savedCompanies: string[];
  savedLocations: string[];
}

export const EditFiscalNoteModal: React.FC<EditFiscalNoteModalProps> = ({ note, onSave, onClose, savedCompanies, savedLocations }) => {
  const [editedNote, setEditedNote] = useState(note);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditedNote(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedNote(prev => ({ ...prev, client_delivered: e.target.checked }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(editedNote);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl bg-white animate-in fade-in-0 zoom-in-95">
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-800">Editar Nota Fiscal</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fechar modal">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </Button>
        </CardHeader>
        <form onSubmit={handleSave}>
          <CardContent className="space-y-4 max-h-[80vh] overflow-y-auto">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DatalistInput label="Empresa" name="company" value={editedNote.company} onChange={handleChange} options={savedCompanies} id="edit-company-list" />
              <Input label="Data de carregamento" name="shipping_date" type="date" value={editedNote.shipping_date} onChange={handleChange} />
              <Input label="Nº NF" name="nf_number" value={editedNote.nf_number} onChange={handleChange} />
              <Select label="Status Entrega" name="status" value={editedNote.status} onChange={handleChange}>
                <option value="Pendente">Pendente</option>
                <option value="Entregue">Entregue</option>
              </Select>
              <div className="md:col-span-2">
                <DatalistInput label="Local de entrega" name="delivery_location" value={editedNote.delivery_location} onChange={handleChange} options={savedLocations} id="edit-location-list" />
              </div>
              <div className="md:col-span-2 flex items-center gap-2 py-2">
                <input 
                    id="check-client-delivered-edit" 
                    type="checkbox" 
                    checked={editedNote.client_delivered || false} 
                    onChange={handleCheckboxChange}
                    className="w-4 h-4 text-teal-600 bg-gray-100 border-gray-300 rounded focus:ring-teal-500 cursor-pointer"
                />
                <label htmlFor="check-client-delivered-edit" className="text-sm text-slate-700 cursor-pointer select-none">
                    Marcar como <strong className="text-teal-700">Entregue ao Cliente</strong>
                </label>
            </div>
            </div>
          </CardContent>
          <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="primary">Salvar Alterações</Button>
          </div>
        </form>
      </Card>
    </div>
  );
};