import React, { useEffect, useState } from 'react';
import type { ThirdPartyFreight, ReceivableFreight, ThirdPartyFreightCte } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import { calculateFreightBreakdown } from '../../lib/fiscalCalculations';
import { Button } from '../ui/Button';

interface ThirdPartyFreightDetailsModalProps {
  freight: ThirdPartyFreight;
  onClose: () => void;
}

const formatCurrency = (value: number) => 
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const ThirdPartyFreightDetailsModal: React.FC<ThirdPartyFreightDetailsModalProps> = ({ 
  freight, 
  onClose 
}) => {
  const [loading, setLoading] = useState(true);
  const [receivables, setReceivables] = useState<ReceivableFreight[]>([]);

  useEffect(() => {
    const fetchLinkedData = async () => {
      setLoading(true);
      try {
        const { data: links } = await supabase
          .from('third_party_freight_ctes')
          .select('*')
          .eq('third_party_freight_id', freight.id);
        
        if (links && links.length > 0) {
          const recIds = links.map(l => l.receivable_freight_id).filter(Boolean);
          if (recIds.length > 0) {
            const { data: recs } = await supabase
              .from('receivable_freights')
              .select('*')
              .in('id', recIds);
            
            if (recs) {
              setReceivables(recs);
            }
          }
        }
      } catch (error) {
        console.error("Erro ao buscar dados vinculados:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLinkedData();
  }, [freight.id]);

  let totalIcms = 0;
  let totalSeguro = 0;

  receivables.forEach((rec) => {
    const recTotal = Number(rec.total_value) || 0;
    const breakdown = calculateFreightBreakdown(
      rec.uf_origin, 
      rec.uf_destination, 
      recTotal, 
      rec.toll_value, 
      rec.cargo_value
    );
    totalIcms += breakdown.icms.valor;
    totalSeguro += breakdown.seguro.total;
  });

  const companyFreightValue = Number(freight.company_freight_value) || 0;
  const paidFreightValue = Number(freight.paid_freight_value) || 0;
  const tollValue = Number(freight.toll_value) || 0;

  // Calculo do liquido da empresa: (Frete Empresa) - (ICMS) - (Seguro) - (Frete Pago ao Terceiro) - (Pedágio pago ao terceiro/empresa)
  // O usuário pediu: "liquido, descontando icms, seguro, e frete pago ao terceiro."
  const netProfit = companyFreightValue - paidFreightValue - totalIcms - totalSeguro - tollValue;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">Resumo de Lucratividade</h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </Button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-1">
            <h3 className="font-semibold text-slate-800">{freight.driver}</h3>
            <p className="text-sm text-slate-500">
              {freight.origin} <span className="mx-1">→</span> {freight.destination}
            </p>
            {freight.license_plate && (
              <p className="text-xs text-slate-400 font-mono mt-1 px-2 py-0.5 bg-slate-100 rounded inline-block">
                {freight.license_plate}
              </p>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-32">
              <svg className="animate-spin h-6 w-6 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600 font-medium">Frete Empresa (Receita)</span>
                <span className="font-semibold text-slate-800">{formatCurrency(companyFreightValue)}</span>
              </div>
              
              <div className="h-px bg-slate-100 my-2"></div>
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Pago ao Terceiro</span>
                <span className="text-red-600">-{formatCurrency(paidFreightValue)}</span>
              </div>

              {tollValue > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Pedágio</span>
                  <span className="text-orange-600">-{formatCurrency(tollValue)}</span>
                </div>
              )}

              {receivables.length > 0 ? (
                <>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">ICMS (Total das Notas)</span>
                    <span className="text-red-600">-{formatCurrency(totalIcms)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Seguro RCTR-C (Total)</span>
                    <span className="text-red-600">-{formatCurrency(totalSeguro)}</span>
                  </div>
                </>
              ) : (
                <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-100">
                  Nenhum CT-e (Contas a Receber) vinculado. ICMS e Seguro não foram calculados.
                </p>
              )}

              <div className="h-px bg-slate-200 my-2"></div>
              
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="font-bold text-slate-700">Líquido da Viagem</span>
                <span className={`font-bold text-lg ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(netProfit)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};