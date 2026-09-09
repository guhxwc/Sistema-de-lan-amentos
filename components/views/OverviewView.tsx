import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import { Card, CardContent, CardHeader } from "../ui/Card";
import { Select } from "../ui/Select";
import {
  loadFiscalTables,
  calculateFreightBreakdown,
  getSeguroConfig,
} from "../../lib/fiscalCalculations";
import type {
  ReceivableFreight,
  Trip,
  ThirdPartyFreight,
  ThirdPartyFreightCte,
} from "../../types";

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const MONTHS = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

interface KpiCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  accent: string; // tailwind classes for icon bg/text
  subtitle?: string;
  emphasis?: boolean;
  marginPercent?: number | null;
}

const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  icon,
  accent,
  subtitle,
  emphasis,
  marginPercent,
}) => (
  <Card
    className={
      emphasis ? "border-2 border-sky-500 shadow-lg shadow-sky-500/10" : ""
    }
  >
    <CardContent className="flex items-start justify-between">
      <div className="flex-1 min-w-0 mr-2">
        <div className="flex items-center gap-1.5 flex-wrap mb-1">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {title}
          </p>
          {marginPercent !== undefined && marginPercent !== null && (
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold ${
                marginPercent >= 0
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200/70"
                  : "bg-red-50 text-red-700 border border-red-200/70"
              }`}
              title="Margem de Lucro (% sobre faturamento)"
            >
              {marginPercent >= 0
                ? `+${marginPercent.toFixed(1)}%`
                : `${marginPercent.toFixed(1)}%`}
            </span>
          )}
        </div>
        <p
          className={`font-extrabold ${emphasis ? "text-3xl" : "text-2xl"} ${value >= 0 ? "text-slate-800" : "text-red-600"}`}
        >
          {formatCurrency(value)}
        </p>
        {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-xl shrink-0 ${accent}`}>{icon}</div>
    </CardContent>
  </Card>
);

const MiniStat: React.FC<{
  label: string;
  value: string;
  colorClass?: string;
}> = ({ label, value, colorClass }) => (
  <div className="flex flex-col p-3 bg-slate-50 rounded-xl border border-slate-100">
    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
      {label}
    </span>
    <span className={`text-base font-bold ${colorClass || "text-slate-800"}`}>
      {value}
    </span>
  </div>
);

export const OverviewView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [thirdParty, setThirdParty] = useState<ThirdPartyFreight[]>([]);
  const [receivables, setReceivables] = useState<ReceivableFreight[]>([]);
  const [thirdPartyCtes, setThirdPartyCtes] = useState<ThirdPartyFreightCte[]>([]);

  // Padrão: Abre sempre filtrando no mês e ano atuais
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, "0");
  const currentYear = String(new Date().getFullYear());

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      await loadFiscalTables();
      const [tripsRes, thirdRes, recRes, ctesRes] = await Promise.all([
        supabase.from("trips").select("*"),
        supabase.from("third_party_freights").select("*"),
        supabase.from("receivable_freights").select("*"),
        supabase.from("third_party_freight_ctes").select("*"),
      ]);
      setTrips(tripsRes.data || []);
      setThirdParty(thirdRes.data || []);
      setReceivables(recRes.data || []);
      setThirdPartyCtes(ctesRes.data || []);
    } catch (err) {
      console.error("Erro ao carregar Visão Geral:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const channels = [
      "trips",
      "third_party_freights",
      "receivable_freights",
      "third_party_freight_ctes",
    ].map((table) =>
      supabase
        .channel(`${table}-overview-realtime`)
        .on("postgres_changes", { event: "*", schema: "public", table }, () =>
          fetchAll(),
        )
        .subscribe(),
    );
    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [fetchAll]);

  const availableYears = useMemo(() => {
    const curYear = String(new Date().getFullYear());
    const years = new Set<string>([curYear]);
    trips.forEach(
      (t) => t.departure_date && years.add(t.departure_date.substring(0, 4)),
    );
    thirdParty.forEach((t) => t.date && years.add(t.date.substring(0, 4)));
    receivables.forEach((r) => r.date && years.add(r.date.substring(0, 4)));
    return Array.from(years).sort().reverse();
  }, [trips, thirdParty, receivables]);

  const inPeriod = useCallback(
    (dateStr?: string) => {
      if (!dateStr)
        return selectedMonth === "Todos" && selectedYear === "Todos";
      const parts = dateStr.split("-");
      if (selectedYear !== "Todos" && parts[0] !== selectedYear) return false;
      if (selectedMonth !== "Todos" && parts[1] !== selectedMonth) return false;
      return true;
    },
    [selectedMonth, selectedYear],
  );

  // ---- Frota própria (viagens) ----
  const frotaData = useMemo(() => {
    let freightsTotal = 0,
      expensesTotal = 0,
      dieselTotal = 0,
      maintenanceTotal = 0;
    trips
      .filter((t) => inPeriod(t.departure_date))
      .forEach((trip) => {
        freightsTotal += (trip.freights || []).reduce(
          (a, f) => a + (Number(f.value) || 0),
          0,
        );
        expensesTotal += (trip.expenses || []).reduce(
          (a, e) => a + (Number(e.value) || 0),
          0,
        );
        dieselTotal += (trip.refuelings || []).reduce(
          (a, r) => a + (Number(r.value) || 0),
          0,
        );
        maintenanceTotal += (trip.maintenances || []).reduce(
          (a, m) => a + (Number(m.value) || 0),
          0,
        );
      });
    const net = freightsTotal - expensesTotal - dieselTotal - maintenanceTotal;
    return { freightsTotal, expensesTotal, dieselTotal, maintenanceTotal, net };
  }, [trips, inPeriod]);

  // ---- Cruzamento CT-e: quanto foi pago a terceiros por frete já lançado em
  // Fretes a Receber (via CT-e referenciado no MDF-e do terceiro). Isso evita contar
  // a mesma receita duas vezes (uma em Fretes a Receber, outra em Terceiros).
  // Em frete fracionado (um MDF-e com vários CT-e de clientes diferentes), o valor
  // pago ao terceiro é rateado PROPORCIONALMENTE ao valor de cada CT-e vinculado —
  // não dividido em partes iguais, já que cada CT-e pode ter um peso bem diferente. ----
  const { paidToThirdPartyByReceivable, linkedThirdPartyIds } = useMemo(() => {
    const linksByThirdParty = new Map<string, ThirdPartyFreightCte[]>();
    thirdPartyCtes.forEach((link) => {
      const arr = linksByThirdParty.get(link.third_party_freight_id) || [];
      arr.push(link);
      linksByThirdParty.set(link.third_party_freight_id, arr);
    });

    const receivableValueById = new Map<string, number>();
    receivables.forEach((r) => receivableValueById.set(r.id, Number(r.total_value) || 0));

    const paidMap = new Map<string, number>();
    const linkedIds = new Set<string>();

    thirdParty.forEach((tp) => {
      const links = linksByThirdParty.get(tp.id) || [];
      const linkedReceivableIds = links
        .map((l) => l.receivable_freight_id)
        .filter((id): id is string => !!id);
      if (linkedReceivableIds.length === 0) return;

      linkedIds.add(tp.id);
      const paid = Number(tp.paid_freight_value) || 0;

      // Rateio proporcional ao valor de cada CT-e vinculado (frete fracionado).
      // Se nenhum CT-e vinculado tiver valor (ex: frete apagado), cai para rateio igual.
      const totalValue = linkedReceivableIds.reduce(
        (a, id) => a + (receivableValueById.get(id) || 0),
        0,
      );

      linkedReceivableIds.forEach((rid) => {
        const value = receivableValueById.get(rid) || 0;
        const share =
          totalValue > 0 ? paid * (value / totalValue) : paid / linkedReceivableIds.length;
        paidMap.set(rid, (paidMap.get(rid) || 0) + share);
      });
    });

    return { paidToThirdPartyByReceivable: paidMap, linkedThirdPartyIds: linkedIds };
  }, [thirdParty, thirdPartyCtes, receivables]);

  // ---- Terceiros ----
  // Apenas fretes de terceiro SEM CT-e vinculado entram no líquido/KPI: os vinculados já
  // têm o valor pago descontado diretamente no líquido do frete em Fretes a Receber, então
  // contá-los aqui de novo duplicaria a receita e o custo.
  const terceirosData = useMemo(() => {
    let companyTotal = 0,
      paidTotal = 0,
      tollTotal = 0,
      linkedPaidTotal = 0,
      linkedCount = 0;
    thirdParty
      .filter((f) => inPeriod(f.date))
      .forEach((f) => {
        if (linkedThirdPartyIds.has(f.id)) {
          linkedPaidTotal += Number(f.paid_freight_value) || 0;
          linkedCount += 1;
          return;
        }
        companyTotal += Number(f.company_freight_value) || 0;
        paidTotal += Number(f.paid_freight_value) || 0;
        tollTotal += Number(f.toll_value) || 0;
      });
    const net = companyTotal - (paidTotal + tollTotal);
    return { companyTotal, paidTotal, tollTotal, net, linkedPaidTotal, linkedCount };
  }, [thirdParty, inPeriod, linkedThirdPartyIds]);

  // ---- Fretes a Receber (com ICMS + Seguro RCTR-C + Pedágio + terceiro vinculado) ----
  const receivablesData = useMemo(() => {
    const filtered = receivables.filter((r) => inPeriod(r.date));
    let grossTotal = 0,
      icmsTotal = 0,
      seguroTotal = 0,
      tollTotal = 0,
      thirdPartyTotal = 0,
      netTotal = 0;
    const breakdown = filtered.map((freight) => {
      const total = Number(freight.total_value) || 0;
      const result = calculateFreightBreakdown(
        freight.uf_origin,
        freight.uf_destination,
        total,
        freight.toll_value,
        freight.cargo_value,
      );
      const paidToThirdParty = paidToThirdPartyByReceivable.get(freight.id) || 0;
      const netValue = result.netValue - paidToThirdParty;
      grossTotal += total;
      icmsTotal += result.icms.valor;
      seguroTotal += result.seguro.total;
      tollTotal += result.toll;
      thirdPartyTotal += paidToThirdParty;
      netTotal += netValue;
      return { freight, result, paidToThirdParty, netValue };
    });
    return {
      grossTotal,
      icmsTotal,
      seguroTotal,
      tollTotal,
      thirdPartyTotal,
      net: netTotal,
      breakdown,
    };
  }, [receivables, inPeriod, paidToThirdPartyByReceivable]);

  const totalConsolidado =
    frotaData.net + terceirosData.net + receivablesData.net;

  // Cálculos de Margem de Lucro (% sobre faturamento)
  const totalRevenue =
    frotaData.freightsTotal +
    terceirosData.companyTotal +
    receivablesData.grossTotal;

  const frotaMargin =
    frotaData.freightsTotal > 0
      ? (frotaData.net / frotaData.freightsTotal) * 100
      : null;

  const terceirosMargin =
    terceirosData.companyTotal > 0
      ? (terceirosData.net / terceirosData.companyTotal) * 100
      : null;

  const receivablesMargin =
    receivablesData.grossTotal > 0
      ? (receivablesData.net / receivablesData.grossTotal) * 100
      : null;

  const consolidadoMargin =
    totalRevenue > 0 ? (totalConsolidado / totalRevenue) * 100 : null;

  const isCurrentMonthSelected =
    selectedMonth === currentMonth && selectedYear === currentYear;

  const seguroConfig = getSeguroConfig();

  return (
    <div className="flex flex-col h-full">
      <header className="bg-white/80 backdrop-blur-lg border-b border-slate-200 sticky top-0 z-30">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3 h-16">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-800">Visão Geral</h1>
              {isCurrentMonthSelected && (
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                  Mês Atual
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isCurrentMonthSelected && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMonth(currentMonth);
                    setSelectedYear(currentYear);
                  }}
                  className="text-xs font-semibold text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 px-2.5 py-1.5 rounded-lg border border-sky-200 transition-colors"
                  title="Voltar para o mês atual"
                >
                  Ir para Mês Atual
                </button>
              )}
              <div className="w-36">
                <Select
                  label=""
                  name="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="!py-1.5"
                >
                  <option value="Todos">Todos os meses</option>
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="w-28">
                <Select
                  label=""
                  name="year"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="!py-1.5"
                >
                  <option value="Todos">Todos</option>
                  {availableYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-400">
            <svg
              className="animate-spin h-8 w-8 mr-3"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Carregando visão geral...
          </div>
        ) : (
          <div className="w-full mx-auto space-y-6 pb-10">
            {/* KPI Cards principais */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <KpiCard
                title="Líquido Frota Própria"
                value={frotaData.net}
                marginPercent={frotaMargin}
                accent="bg-sky-100 text-sky-600"
                subtitle={`${trips.filter((t) => inPeriod(t.departure_date)).length} viagem(ns)`}
                icon={
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h8a1 1 0 001-1z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 6h2a3 3 0 013 3v7h-2"
                    />
                  </svg>
                }
              />
              <KpiCard
                title="Líquido Terceiros"
                value={terceirosData.net}
                marginPercent={terceirosMargin}
                accent="bg-amber-100 text-amber-600"
                subtitle={`${thirdParty.filter((f) => inPeriod(f.date)).length} frete(s)`}
                icon={
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.084-1.284-.24-1.88M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.084-1.284.24-1.88"
                    />
                  </svg>
                }
              />
              <KpiCard
                title="Líquido Fretes a Receber"
                value={receivablesData.net}
                marginPercent={receivablesMargin}
                accent="bg-emerald-100 text-emerald-600"
                subtitle={`${receivablesData.breakdown.length} frete(s) · após ICMS + seguro + pedágio`}
                icon={
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                }
              />
              <KpiCard
                title="Total Consolidado"
                value={totalConsolidado}
                marginPercent={consolidadoMargin}
                accent="bg-slate-800 text-white"
                subtitle="Frota + Terceiros + A Receber"
                emphasis
                icon={
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2-2v14a2 2 0 002 2z"
                    />
                  </svg>
                }
              />
            </div>

            {/* Detalhamento Frota */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2 w-full">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-sky-100 rounded-lg text-sky-600">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h8a1 1 0 001-1z"
                        />
                      </svg>
                    </div>
                    <span className="font-semibold text-slate-800">
                      Frota Própria (Viagens)
                    </span>
                    {frotaMargin !== null && (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                          frotaMargin >= 0
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80"
                            : "bg-red-50 text-red-700 border border-red-200/80"
                        }`}
                      >
                        {frotaMargin >= 0
                          ? `+${frotaMargin.toFixed(1)}%`
                          : `${frotaMargin.toFixed(1)}%`}{" "}
                        lucro
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <MiniStat
                    label="Fretes"
                    value={formatCurrency(frotaData.freightsTotal)}
                  />
                  <MiniStat
                    label="Despesas"
                    value={formatCurrency(frotaData.expensesTotal)}
                    colorClass="text-red-600"
                  />
                  <MiniStat
                    label="Diesel"
                    value={formatCurrency(frotaData.dieselTotal)}
                    colorClass="text-orange-600"
                  />
                  <MiniStat
                    label="Manutenção"
                    value={formatCurrency(frotaData.maintenanceTotal)}
                    colorClass="text-amber-600"
                  />
                  <MiniStat
                    label="Líquido"
                    value={formatCurrency(frotaData.net)}
                    colorClass={
                      frotaData.net >= 0 ? "text-emerald-600" : "text-red-600"
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* Detalhamento Terceiros */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2 w-full">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.084-1.284-.24-1.88M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.084-1.284.24-1.88"
                        />
                      </svg>
                    </div>
                    <span className="font-semibold text-slate-800">
                      Fretes de Terceiros
                    </span>
                    {terceirosMargin !== null && (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                          terceirosMargin >= 0
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80"
                            : "bg-red-50 text-red-700 border border-red-200/80"
                        }`}
                      >
                        {terceirosMargin >= 0
                          ? `+${terceirosMargin.toFixed(1)}%`
                          : `${terceirosMargin.toFixed(1)}%`}{" "}
                        lucro
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MiniStat
                    label="Faturado (empresa)"
                    value={formatCurrency(terceirosData.companyTotal)}
                  />
                  <MiniStat
                    label="Pago ao terceiro"
                    value={formatCurrency(terceirosData.paidTotal)}
                    colorClass="text-red-600"
                  />
                  <MiniStat
                    label="Pedágio"
                    value={formatCurrency(terceirosData.tollTotal)}
                    colorClass="text-orange-600"
                  />
                  <MiniStat
                    label="Líquido"
                    value={formatCurrency(terceirosData.net)}
                    colorClass={
                      terceirosData.net >= 0
                        ? "text-emerald-600"
                        : "text-red-600"
                    }
                  />
                </div>
                {terceirosData.linkedCount > 0 && (
                  <p className="text-xs text-slate-400 mt-3">
                    +{terceirosData.linkedCount} frete(s) de terceiro vinculado(s) a CT-e de Fretes a
                    Receber ({formatCurrency(terceirosData.linkedPaidTotal)} pagos) — já descontados
                    diretamente do líquido do frete correspondente ali embaixo, não somados aqui para
                    não duplicar a receita.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Detalhamento Fretes a Receber: ICMS + Seguro */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2 w-full">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <span className="font-semibold text-slate-800">
                      Fretes a Receber — ICMS e Seguro RCTR-C
                    </span>
                    {receivablesMargin !== null && (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                          receivablesMargin >= 0
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80"
                            : "bg-red-50 text-red-700 border border-red-200/80"
                        }`}
                      >
                        {receivablesMargin >= 0
                          ? `+${receivablesMargin.toFixed(1)}%`
                          : `${receivablesMargin.toFixed(1)}%`}{" "}
                        lucro
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  <MiniStat
                    label="Bruto"
                    value={formatCurrency(receivablesData.grossTotal)}
                  />
                  <MiniStat
                    label="ICMS"
                    value={formatCurrency(receivablesData.icmsTotal)}
                    colorClass="text-red-600"
                  />
                  <MiniStat
                    label="Seguro RCTR-C+RC-DC"
                    value={formatCurrency(receivablesData.seguroTotal)}
                    colorClass="text-red-600"
                  />
                  <MiniStat
                    label="Pedágio"
                    value={formatCurrency(receivablesData.tollTotal)}
                    colorClass="text-orange-600"
                  />
                  <MiniStat
                    label="Pago a Terceiro"
                    value={formatCurrency(receivablesData.thirdPartyTotal)}
                    colorClass="text-red-600"
                  />
                  <MiniStat
                    label="Líquido"
                    value={formatCurrency(receivablesData.net)}
                    colorClass={
                      receivablesData.net >= 0
                        ? "text-emerald-600"
                        : "text-red-600"
                    }
                  />
                </div>
                <p className="text-xs text-slate-400">
                  Seguro RCTR-C calculado com{" "}
                  {seguroConfig.desconto_rctrc_percent}% de desconto sobre a
                  taxa base da tabela, mais RC-DC de{" "}
                  {seguroConfig.rc_dc_percent}% sobre o valor do frete. ICMS
                  PR→PR tratado como isento (subcontratação).
                </p>

                {/* Tabela detalhada por frete */}
                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                      <tr>
                        <th className="px-3 py-2 text-left">Data</th>
                        <th className="px-3 py-2 text-left">Cliente</th>
                        <th className="px-3 py-2 text-left">Rota</th>
                        <th className="px-3 py-2 text-right">Total</th>
                        <th className="px-3 py-2 text-right">ICMS</th>
                        <th className="px-3 py-2 text-right">Seguro</th>
                        <th className="px-3 py-2 text-right">Pedágio</th>
                        <th className="px-3 py-2 text-right">Pago Terceiro</th>
                        <th className="px-3 py-2 text-right">Líquido</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {receivablesData.breakdown.length === 0 && (
                        <tr>
                          <td
                            colSpan={9}
                            className="px-3 py-6 text-center text-slate-400"
                          >
                            Nenhum frete no período selecionado.
                          </td>
                        </tr>
                      )}
                      {receivablesData.breakdown.map(({ freight, result, paidToThirdParty, netValue }) => (
                        <tr key={freight.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                            {freight.date}
                          </td>
                          <td className="px-3 py-2 text-slate-800 font-medium">
                            {freight.client}
                          </td>
                          <td className="px-3 py-2 text-slate-500">
                            {freight.uf_origin || "?"} →{" "}
                            {freight.uf_destination || "?"}
                            <span className="block text-[11px] text-slate-400">
                              {freight.origin} → {freight.destination}
                            </span>
                            {paidToThirdParty > 0 && (
                              <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/70">
                                Subcontratado
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-medium">
                            {formatCurrency(Number(freight.total_value) || 0)}
                          </td>
                          <td className="px-3 py-2 text-right text-red-600">
                            {formatCurrency(result.icms.valor)}
                            <span className="block text-[11px] text-slate-400">
                              {result.icms.aliquota}%
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-red-600">
                            {formatCurrency(result.seguro.total)}
                          </td>
                          <td className="px-3 py-2 text-right text-orange-600">
                            {formatCurrency(result.toll)}
                          </td>
                          <td className="px-3 py-2 text-right text-red-600">
                            {paidToThirdParty > 0 ? formatCurrency(paidToThirdParty) : "—"}
                          </td>
                          <td
                            className={`px-3 py-2 text-right font-bold ${netValue >= 0 ? "text-emerald-600" : "text-red-600"}`}
                          >
                            {formatCurrency(netValue)}
                            {Number(freight.total_value) > 0 && (
                              <span className="block text-[11px] font-semibold text-slate-400">
                                {(
                                  (netValue /
                                    Number(freight.total_value)) *
                                  100
                                ).toFixed(1)}
                                % margem
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};
