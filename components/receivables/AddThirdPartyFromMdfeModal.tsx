import React, { useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { parseFiscalXml, type ParsedXmlData, type MdfeCteRef } from "../../lib/xmlParser";
import { Card, CardContent, CardHeader } from "../ui/Card";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import type { ReceivableFreight } from "../../types";

interface AddThirdPartyFromMdfeModalProps {
  onClose: () => void;
  onSaved: () => void;
}

interface CteMatch {
  ref: MdfeCteRef;
  receivable: ReceivableFreight | null;
}

const formatCurrency = (value: number) =>
  (value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const AddThirdPartyFromMdfeModal: React.FC<AddThirdPartyFromMdfeModalProps> = ({
  onClose,
  onSaved,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsed, setParsed] = useState<ParsedXmlData | null>(null);
  const [matches, setMatches] = useState<CteMatch[]>([]);

  const [driver, setDriver] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [date, setDate] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [companyFreightValue, setCompanyFreightValue] = useState<number | "">("");
  const [paidFreightValue, setPaidFreightValue] = useState<number | "">("");
  const [tollValue, setTollValue] = useState<number | "">("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    try {
      const xmlContent = await file.text();
      const data = parseFiscalXml(xmlContent);

      if (data.type !== "MDFe") {
        alert("Esse arquivo não parece ser um MDF-e. Selecione o XML do MDF-e.");
        setIsProcessing(false);
        return;
      }

      // Cruza cada CT-e do MDF-e com os fretes já lançados em Fretes a Receber
      const cteRefs = data.cte_list || [];
      const foundMatches: CteMatch[] = [];
      for (const ref of cteRefs) {
        // Usa ilike para encontrar registros que possam conter múltiplos CT-es no mesmo campo, ex: "3229, 3230"
        const { data: rows } = await supabase
          .from("receivable_freights")
          .select("*")
          .ilike("cte", `%${ref.cte_number}%`);
          
        let matchedReceivable = null;
        if (rows && rows.length > 0) {
            // Em caso de múltiplos retornos (improvável se as chaves forem únicas na string), pega o primeiro
            matchedReceivable = rows[0];
        }
        
        foundMatches.push({ ref, receivable: matchedReceivable });
      }

      setParsed(data);
      setMatches(foundMatches);

      // Pré-preenche o formulário: reaproveita origem/destino/valor do CT-e vinculado
      // quando encontrado; senão usa o que veio do próprio MDF-e.
      const matchedReceivables = foundMatches.filter((m) => m.receivable).map((m) => m.receivable!);
      
      // Remove duplicatas (mesmo frete a receber vinculado a múltiplos CT-es do MDF-e)
      const uniqueReceivables = Array.from(new Map(matchedReceivables.map(r => [r.id, r])).values());

      const sumMatchedValue = uniqueReceivables.reduce((a, r) => a + (Number(r.total_value) || 0), 0);
      const uniqueDestinations = Array.from(
        new Set(uniqueReceivables.map((r) => r.destination).filter(Boolean)),
      );

      setDriver((data.driver || "").toUpperCase());
      setLicensePlate((data.license_plate || "").toUpperCase());
      setDate(data.date || new Date().toISOString().split("T")[0]);
      setOrigin(
        (uniqueReceivables[0]?.origin || data.origin || "").toUpperCase(),
      );
      setDestination(
        uniqueDestinations.length > 1
          ? uniqueDestinations.join(" / ").toUpperCase()
          : (uniqueDestinations[0] || data.destination || "").toUpperCase(),
      );
      setCompanyFreightValue(
        sumMatchedValue > 0 ? sumMatchedValue : (data.contract_value ?? ""),
      );
      setPaidFreightValue(data.contract_value ?? "");
      setTollValue(data.toll_value ?? "");

      setStep("review");
    } catch (err: any) {
      console.error("Erro ao processar MDF-e:", err);
      alert("Erro ao processar o XML do MDF-e.");
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!driver || !licensePlate) {
      alert("Preencha ao menos o motorista e a placa.");
      return;
    }
    if (paidFreightValue === "" || Number(paidFreightValue) <= 0) {
      alert("Informe o valor pago ao motorista/terceiro.");
      return;
    }

    const thirdPartyId = crypto.randomUUID();
    const paid = Number(paidFreightValue) || 0;
    const advance = 0;
    const status = "Pendente" as const;

    const record = {
      id: thirdPartyId,
      driver: driver.trim().toUpperCase(),
      license_plate: licensePlate.trim().toUpperCase(),
      date: date || null,
      origin: origin.trim().toUpperCase(),
      destination: destination.trim().toUpperCase(),
      company_freight_value: Number(companyFreightValue) || 0,
      paid_freight_value: paid,
      toll_value: Number(tollValue) || 0,
      advance_payment: advance,
      status,
      mdfe_number: parsed?.mdfe || null,
      mdfe_key: parsed?.mdfe_key || null,
    };

    const { error } = await supabase.from("third_party_freights").insert(record);
    if (error) {
      alert(`Erro ao salvar frete de terceiro: ${error.message}`);
      return;
    }

    if (matches.length > 0) {
      const linkRows = matches.map((m) => ({
        third_party_freight_id: thirdPartyId,
        cte_key: m.ref.chCTe,
        cte_number: m.ref.cte_number,
        receivable_freight_id: m.receivable?.id || null,
      }));
      const { error: linkError } = await supabase
        .from("third_party_freight_ctes")
        .insert(linkRows);
      if (linkError) {
        console.error("Erro ao vincular CT-e(s) ao terceiro:", linkError);
      }
    }

    alert("Frete de terceiro lançado e sincronizado com sucesso!");
    onSaved();
    onClose();
  };

  const matchedCount = matches.filter((m) => m.receivable).length;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl bg-white animate-in fade-in-0 zoom-in-95">
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-800">Adicionar Terceiro (via MDF-e)</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fechar modal">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 max-h-[80vh] overflow-y-auto">
          {step === "upload" && (
            <div className="flex flex-col items-center justify-center gap-3 py-10 border-2 border-dashed border-slate-200 rounded-xl">
              <p className="text-sm text-slate-500 text-center max-w-sm">
                Envie o XML do MDF-e do terceiro. O sistema vai extrair placa, motorista, pedágio e
                cruzar o(s) CT-e(s) transportados com os fretes já lançados em Fretes a Receber.
              </p>
              <Button onClick={() => fileInputRef.current?.click()} disabled={isProcessing}>
                {isProcessing ? "Analisando..." : "Selecionar XML do MDF-e"}
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xml"
                className="hidden"
              />
            </div>
          )}

          {step === "review" && parsed && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-100 p-3 bg-slate-50 space-y-1">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  MDF-e nº {parsed.mdfe}
                </p>
                {matches.length === 0 && (
                  <p className="text-sm text-amber-600">Nenhum CT-e encontrado no MDF-e.</p>
                )}
                {matches.map((m, i) => (
                  <p key={i} className="text-sm">
                    CT-e <strong>{m.ref.cte_number}</strong>:{" "}
                    {m.receivable ? (
                      <span className="text-emerald-600">
                        vinculado ao frete de {m.receivable.client} ({formatCurrency(Number(m.receivable.total_value) || 0)})
                      </span>
                    ) : (
                      <span className="text-amber-600">não encontrado em Fretes a Receber</span>
                    )}
                  </p>
                ))}
                {matchedCount > 0 && (
                  <p className="text-xs text-slate-500 pt-1">
                    {matchedCount > 1
                      ? "Frete fracionado: o valor pago será rateado proporcionalmente ao valor de cada CT-e e descontado do líquido de cada frete correspondente na Visão Geral."
                      : "O valor pago a este terceiro será descontado do líquido desse frete na Visão Geral, em vez de contar como receita separada."}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Motorista" name="driver" value={driver} onChange={(e) => setDriver(e.target.value)} />
                <Input label="Placa" name="license_plate" value={licensePlate} onChange={(e) => setLicensePlate(e.target.value)} />
                <Input label="Data" name="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                <Input label="Origem" name="origin" value={origin} onChange={(e) => setOrigin(e.target.value)} />
                <Input label="Destino" name="destination" value={destination} onChange={(e) => setDestination(e.target.value)} />
                <Input
                  label="Valor do Frete (empresa)"
                  name="company_freight_value"
                  currency
                  value={companyFreightValue}
                  onChange={(e) => setCompanyFreightValue(e.target.value as unknown as number | "")}
                  title="Reaproveitado do CT-e vinculado quando encontrado"
                />
                <Input
                  label="Valor Pago ao Motorista/Terceiro"
                  name="paid_freight_value"
                  currency
                  value={paidFreightValue}
                  onChange={(e) => setPaidFreightValue(e.target.value as unknown as number | "")}
                  title="Sugerido a partir do vContrato do MDF-e — confirme o valor combinado"
                />
                <Input
                  label="Pedágio (R$)"
                  name="toll_value"
                  currency
                  value={tollValue}
                  onChange={(e) => setTollValue(e.target.value as unknown as number | "")}
                />
              </div>
            </div>
          )}
        </CardContent>
        {step === "review" && (
          <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" variant="primary" onClick={handleSave}>
              Lançar Terceiro
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};
