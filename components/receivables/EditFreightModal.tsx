import React, { useState } from "react";
import type { ReceivableFreight } from "../../types";
import { Card, CardContent, CardHeader } from "../ui/Card";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { DatalistInput } from "../ui/DatalistInput";
import { UF_LIST } from "../../lib/fiscalCalculations";

interface EditFreightModalProps {
  freight: ReceivableFreight;
  onSave: (freight: ReceivableFreight) => void;
  onClose: () => void;
  savedClients: string[];
  savedOrigins: string[];
  savedDestinations: string[];
}

export const EditFreightModal: React.FC<EditFreightModalProps> = ({
  freight,
  onSave,
  onClose,
  savedClients,
  savedOrigins,
  savedDestinations,
}) => {
  const [editedFreight, setEditedFreight] = useState(freight);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target as HTMLInputElement;
    setEditedFreight((prev) => ({
      ...prev,
      [name]:
        type === "number" ? (value === "" ? "" : parseFloat(value)) : value,
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(editedFreight);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl bg-white animate-in fade-in-0 zoom-in-95">
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-800">Editar Frete</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </Button>
        </CardHeader>
        <form onSubmit={handleSave}>
          <CardContent className="space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Input
                label="Data"
                name="date"
                type="date"
                value={editedFreight.date}
                onChange={handleChange}
              />
              <Input
                label="Vencimento"
                name="due_date"
                type="date"
                value={editedFreight.due_date}
                onChange={handleChange}
              />
              <Input
                label="Data Entrega"
                name="delivery_date"
                type="date"
                value={editedFreight.delivery_date || ""}
                onChange={handleChange}
              />
              <DatalistInput
                label="Cliente"
                name="client"
                value={editedFreight.client}
                onChange={handleChange}
                options={savedClients}
                id="edit-client-list"
              />
              <DatalistInput
                label="Origem"
                name="origin"
                value={editedFreight.origin}
                onChange={handleChange}
                options={savedOrigins}
                id="edit-origin-list"
              />
              <Select
                label="UF Origem"
                name="uf_origin"
                value={editedFreight.uf_origin || ""}
                onChange={handleChange}
              >
                <option value="">--</option>
                {UF_LIST.map((uf) => (
                  <option key={uf.value} value={uf.value}>
                    {uf.value}
                  </option>
                ))}
              </Select>
              <DatalistInput
                label="Destino"
                name="destination"
                value={editedFreight.destination}
                onChange={handleChange}
                options={savedDestinations}
                id="edit-destination-list"
              />
              <Select
                label="UF Destino"
                name="uf_destination"
                value={editedFreight.uf_destination || ""}
                onChange={handleChange}
              >
                <option value="">--</option>
                {UF_LIST.map((uf) => (
                  <option key={uf.value} value={uf.value}>
                    {uf.value}
                  </option>
                ))}
              </Select>
              <Input
                label="CT-e"
                name="cte"
                value={editedFreight.cte}
                onChange={handleChange}
              />
              <Input
                label="Valor Total (R$)"
                name="total_value"
                currency
                value={editedFreight.total_value}
                onChange={handleChange}
              />
              <Input
                label="Mercadoria (R$)"
                name="cargo_value"
                currency
                value={editedFreight.cargo_value ?? ""}
                onChange={handleChange}
              />
              <Input
                label="Pago (R$)"
                name="paid_value"
                currency
                value={editedFreight.paid_value}
                onChange={handleChange}
              />
              <Input
                label="Pedágio (R$)"
                name="toll_value"
                currency
                value={editedFreight.toll_value ?? ""}
                onChange={handleChange}
              />
              <Input
                label="Cor da Linha"
                name="row_color"
                type="color"
                value={editedFreight.row_color}
                onChange={handleChange}
                className="p-1 h-10"
              />
            </div>
          </CardContent>
          <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              Salvar Alterações
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
