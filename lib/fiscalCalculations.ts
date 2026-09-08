import { supabase } from "./supabaseClient";
import type { IcmsUfRate, SeguroRctrcTaxa, SeguroConfig } from "../types";

export const UF_LIST: { value: string; label: string }[] = [
  { value: "AC", label: "AC - Acre" },
  { value: "AL", label: "AL - Alagoas" },
  { value: "AP", label: "AP - Amapá" },
  { value: "AM", label: "AM - Amazonas" },
  { value: "BA", label: "BA - Bahia" },
  { value: "CE", label: "CE - Ceará" },
  { value: "DF", label: "DF - Distrito Federal" },
  { value: "ES", label: "ES - Espírito Santo" },
  { value: "GO", label: "GO - Goiás" },
  { value: "MA", label: "MA - Maranhão" },
  { value: "MT", label: "MT - Mato Grosso" },
  { value: "MS", label: "MS - Mato Grosso do Sul" },
  { value: "MG", label: "MG - Minas Gerais" },
  { value: "PA", label: "PA - Pará" },
  { value: "PB", label: "PB - Paraíba" },
  { value: "PR", label: "PR - Paraná" },
  { value: "PE", label: "PE - Pernambuco" },
  { value: "PI", label: "PI - Piauí" },
  { value: "RJ", label: "RJ - Rio de Janeiro" },
  { value: "RN", label: "RN - Rio Grande do Norte" },
  { value: "RS", label: "RS - Rio Grande do Sul" },
  { value: "RO", label: "RO - Rondônia" },
  { value: "RR", label: "RR - Roraima" },
  { value: "SC", label: "SC - Santa Catarina" },
  { value: "SP", label: "SP - São Paulo" },
  { value: "SE", label: "SE - Sergipe" },
  { value: "TO", label: "TO - Tocantins" },
];

// ---------------------------------------------------------------------------
// Cache em memória das tabelas vindas do Supabase (evita refetch a cada linha)
// ---------------------------------------------------------------------------
let icmsRatesCache: Record<string, IcmsUfRate> | null = null;
let rctrcCache: Record<string, number> | null = null; // key: `${origin}_${dest}`
let seguroConfigCache: SeguroConfig | null = null;
let loadingPromise: Promise<void> | null = null;

async function ensureLoaded(): Promise<void> {
  if (icmsRatesCache && rctrcCache && seguroConfigCache) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const [icmsRes, rctrcRes, configRes] = await Promise.all([
      supabase.from("icms_uf_rates").select("*"),
      supabase.from("seguro_rctrc_taxas").select("*"),
      supabase.from("seguro_config").select("*").eq("id", 1).single(),
    ]);

    icmsRatesCache = {};
    (icmsRes.data || []).forEach((r: any) => {
      icmsRatesCache![r.uf] = {
        uf: r.uf,
        internal_rate: Number(r.internal_rate),
        is_reduced_origin: !!r.is_reduced_origin,
      };
    });

    rctrcCache = {};
    (rctrcRes.data || []).forEach((r: any) => {
      rctrcCache![`${r.origin_uf}_${r.destination_uf}`] = Number(
        r.taxa_base_percent,
      );
    });

    seguroConfigCache = configRes.data
      ? {
          id: configRes.data.id,
          desconto_rctrc_percent: Number(configRes.data.desconto_rctrc_percent),
          rc_dc_percent: Number(configRes.data.rc_dc_percent),
          franquia_percent: Number(configRes.data.franquia_percent),
          franquia_minima: Number(configRes.data.franquia_minima),
        }
      : {
          id: 1,
          desconto_rctrc_percent: 60,
          rc_dc_percent: 0.015,
          franquia_percent: 10,
          franquia_minima: 1000,
        };
  })();

  await loadingPromise;
  loadingPromise = null;
}

export async function loadFiscalTables(): Promise<void> {
  await ensureLoaded();
}

export function invalidateFiscalCache() {
  icmsRatesCache = null;
  rctrcCache = null;
  seguroConfigCache = null;
}

// ---------------------------------------------------------------------------
// ICMS sobre o frete (CT-e) — regra interestadual padrão (4% / 7% / 12%) +
// alíquota interna por UF. Exceção de negócio: PR → PR é isento (subcontratação).
// ---------------------------------------------------------------------------
export interface IcmsResult {
  aliquota: number;
  valor: number;
  motivo: string;
}

export function calculateIcms(
  originUf: string,
  destinationUf: string,
  baseValue: number,
): IcmsResult {
  const origin = (originUf || "").toUpperCase().trim();
  const destination = (destinationUf || "").toUpperCase().trim();
  const base = Number(baseValue) || 0;

  if (!origin || !destination) {
    return {
      aliquota: 0,
      valor: 0,
      motivo: "UF de origem/destino não informada",
    };
  }

  // Exceção de negócio: frete PR → PR isento (subcontratação Convênio ICMS 25/90)
  if (origin === "PR" && destination === "PR") {
    return {
      aliquota: 0,
      valor: 0,
      motivo: "Isento (PR → PR, subcontratação)",
    };
  }

  const rates = icmsRatesCache || {};
  const originRate = rates[origin];
  const destRate = rates[destination];

  if (origin === destination) {
    const aliquota = originRate ? originRate.internal_rate : 12;
    return {
      aliquota,
      valor: (base * aliquota) / 100,
      motivo: `Alíquota interna ${origin}`,
    };
  }

  // Origem do "clube" de 7% (SP, RJ, MG, PR, SC, RS) → demais estados (exceto entre eles) = 7%
  // Entre estados desse clube, ou de/para qualquer outro estado = 12%
  const isReducedOrigin = originRate?.is_reduced_origin;
  const destIsAlsoReduced = destRate?.is_reduced_origin;

  if (isReducedOrigin && !destIsAlsoReduced) {
    return {
      aliquota: 7,
      valor: (base * 7) / 100,
      motivo: `Interestadual reduzida (${origin} → ${destination})`,
    };
  }

  return {
    aliquota: 12,
    valor: (base * 12) / 100,
    motivo: `Interestadual padrão (${origin} → ${destination})`,
  };
}

// ---------------------------------------------------------------------------
// Seguro obrigatório RCTR-C + RC-DC
// ---------------------------------------------------------------------------
export interface SeguroResult {
  taxaBase: number;
  desconto: number;
  taxaEfetiva: number;
  premioRctrc: number;
  premioRcDc: number;
  total: number;
}

export function calculateSeguro(
  originUf: string,
  destinationUf: string,
  baseValue: number,
): SeguroResult {
  const origin = (originUf || "").toUpperCase().trim();
  const destination = (destinationUf || "").toUpperCase().trim();
  const base = Number(baseValue) || 0;
  const config = seguroConfigCache || {
    desconto_rctrc_percent: 60,
    rc_dc_percent: 0.015,
    id: 1,
    franquia_percent: 10,
    franquia_minima: 1000,
  };

  const taxaBase = rctrcCache?.[`${origin}_${destination}`] ?? 0;
  const desconto = config.desconto_rctrc_percent;
  const taxaEfetiva = taxaBase * (1 - desconto / 100);

  const premioRctrc = (base * taxaEfetiva) / 100;
  const premioRcDc = (base * config.rc_dc_percent) / 100;

  return {
    taxaBase,
    desconto,
    taxaEfetiva,
    premioRctrc,
    premioRcDc,
    total: premioRctrc + premioRcDc,
  };
}

export function getSeguroConfig(): SeguroConfig {
  return (
    seguroConfigCache || {
      id: 1,
      desconto_rctrc_percent: 60,
      rc_dc_percent: 0.015,
      franquia_percent: 10,
      franquia_minima: 1000,
    }
  );
}

// ---------------------------------------------------------------------------
// Cálculo consolidado de um frete a receber: líquido = total - ICMS - seguro - pedágio
// ---------------------------------------------------------------------------
export interface FreightFiscalBreakdown {
  icms: IcmsResult;
  seguro: SeguroResult;
  toll: number;
  netValue: number;
}

export function calculateFreightBreakdown(
  originUf: string | undefined,
  destinationUf: string | undefined,
  totalValue: number,
  tollValue: number | undefined,
  cargoValue?: number | null,
): FreightFiscalBreakdown {
  const icms = calculateIcms(originUf || "", destinationUf || "", totalValue);
  const seguro = calculateSeguro(
    originUf || "",
    destinationUf || "",
    cargoValue != null ? Number(cargoValue) : totalValue,
  );
  const toll = Number(tollValue) || 0;
  const netValue = (Number(totalValue) || 0) - icms.valor - seguro.total - toll;
  return { icms, seguro, toll, netValue };
}
