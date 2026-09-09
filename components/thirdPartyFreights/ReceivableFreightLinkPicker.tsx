import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import type { ReceivableFreight } from "../../types";

interface ReceivableFreightLinkPickerProps {
  selected: ReceivableFreight[];
  onChange: (freights: ReceivableFreight[]) => void;
  onClose?: () => void;
}

const formatCurrency = (value: number) =>
  (value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const ReceivableFreightLinkPicker: React.FC<ReceivableFreightLinkPickerProps> = ({
  selected,
  onChange,
  onClose,
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ReceivableFreight[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("receivable_freights")
        .select("*")
        .or(`client.ilike.%${query}%,origin.ilike.%${query}%,destination.ilike.%${query}%`)
        .order("date", { ascending: false })
        .limit(8);
      setResults(data || []);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedIds = new Set(selected.map((f) => f.id));

  const addFreight = (freight: ReceivableFreight) => {
    if (selectedIds.has(freight.id)) return;
    onChange([...selected, freight]);
    setQuery("");
    setResults([]);
    setIsOpen(false);
  };

  const removeFreight = (id: string) => {
    onChange(selected.filter((f) => f.id !== id));
  };

  return (
    <div className="w-full bg-slate-50/90 border border-slate-200 rounded-xl p-3.5 shadow-sm" ref={boxRef}>
      <div className="flex items-center justify-between mb-1.5 px-0.5">
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
          Vincular a Frete(s) a Receber (busque pelo cliente, origem ou destino)
        </label>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-800 px-2 py-0.5 rounded hover:bg-slate-200/60 transition-colors"
            title="Fechar busca de vínculo"
          >
            ✕ Fechar
          </button>
        )}
      </div>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Buscar por cliente, origem ou destino..."
          className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 transition-all duration-200 ease-in-out shadow-sm focus:outline-none focus:bg-white focus:border-sky-600 focus:ring-4 focus:ring-sky-500/10 hover:border-slate-400 sm:text-sm"
        />
        {isOpen && query.trim().length >= 2 && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
            {loading && (
              <div className="px-4 py-3 text-sm text-slate-400">Buscando...</div>
            )}
            {!loading && results.length === 0 && (
              <div className="px-4 py-3 text-sm text-slate-400">Nenhum frete encontrado.</div>
            )}
            {!loading &&
              results.map((f) => (
                <button
                  type="button"
                  key={f.id}
                  onClick={() => addFreight(f)}
                  disabled={selectedIds.has(f.id)}
                  className="w-full text-left px-4 py-2.5 hover:bg-sky-50 disabled:opacity-40 disabled:cursor-not-allowed border-b border-slate-50 last:border-0"
                >
                  <p className="text-sm font-medium text-slate-800">{f.client}</p>
                  <p className="text-xs text-slate-400">
                    {f.origin} → {f.destination} · {f.date} ·{" "}
                    {formatCurrency(Number(f.total_value) || 0)}
                    {f.cte ? ` · CT-e ${f.cte}` : " · sem CT-e"}
                  </p>
                </button>
              ))}
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {selected.map((f) => (
            <span
              key={f.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"
            >
              {f.client} ({formatCurrency(Number(f.total_value) || 0)})
              <button
                type="button"
                onClick={() => removeFreight(f.id)}
                className="hover:text-amber-900"
                aria-label={`Remover vínculo com ${f.client}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
