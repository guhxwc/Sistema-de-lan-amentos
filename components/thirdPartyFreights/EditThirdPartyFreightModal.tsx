
import React, { useState, useMemo } from 'react';
import type { ThirdPartyFreight } from '../../types';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { DatalistInput } from '../ui/DatalistInput';

interface EditThirdPartyFreightModalProps {
  freight: ThirdPartyFreight;
  onSave: (freight: ThirdPartyFreight) => void;
  onClose: () => void;
  savedDrivers: string[];
  savedLicensePlates: string[];
  savedOrigins: string[];
  savedDestinations: string[];
}

export const EditThirdPartyFreightModal: React.FC<EditThirdPartyFreightModalProps> = ({ freight, onSave, onClose, savedDrivers, savedLicensePlates, savedOrigins, savedDestinations }) => {
  const [editedFreight, setEditedFreight] = useState(freight);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setEditedFreight(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? '' : parseFloat(value)) : value,
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(editedFreight);
  };
  
  const calculatedStatus = useMemo(() => {
    const advance = Number(editedFreight.advance_payment) || 0;
    const paid = Number(editedFreight.paid_freight_value) || 0;
    const toll = Number(editedFreight.toll_value) || 0;
    
    const balance = paid - advance - toll;

    if (balance <= 0.01 && paid > 0) return 'Pago';
    if (advance > 0) return 'Parcial';
    return 'Pendente';
  }, [editedFreight.advance_payment, editedFreight.paid_freight_value, editedFreight.toll_value]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl bg-white animate-in fade-in-0 zoom-in-95">
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-800">Editar Frete Terceirizado</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fechar modal">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </Button>
        </CardHeader>
        <form onSubmit={handleSave}>
          <CardContent className="space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <DatalistInput label="Motorista" name="driver" value={editedFreight.driver} onChange={handleChange} options={savedDrivers} id="edit-tp-driver-list" />
                <DatalistInput label="Placa" name="license_plate" value={editedFreight.license_plate} onChange={handleChange} options={savedLicensePlates} id="edit-tp-plate-list" />
                <Input label="Data" name="date" type="date" value={editedFreight.date} onChange={handleChange} />
                <DatalistInput label="Origem" name="origin" value={editedFreight.origin} onChange={handleChange} options={savedOrigins} id="edit-tp-origin-list"/>
                <DatalistInput label="Destino" name="destination" value={editedFreight.destination} onChange={handleChange} options={savedDestinations} id="edit-tp-destination-list" />
                <Input label="Frete Empresa (R$)" name="company_freight_value" type="number" step="0.01" value={editedFreight.company_freight_value} onChange={handleChange} />
                <Input label="Frete Pago (R$)" name="paid_freight_value" type="number" step="0.01" value={editedFreight.paid_freight_value} onChange={handleChange} />
                <Input label="Pedágio (R$)" name="toll_value" type="number" step="0.01" value={editedFreight.toll_value} onChange={handleChange} />
                <Input label="Adiantamento (R$)" name="advance_payment" type="number" step="0.01" value={editedFreight.advance_payment} onChange={handleChange} />
                <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Status (Automático)</label>
                    <div className="w-full h-[42px] px-3 py-2 bg-slate-100 border border-slate-300 rounded-md shadow-sm sm:text-sm flex items-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${calculatedStatus === 'Pago' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                            {calculatedStatus}
                        </span>
                    </div>
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
