
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Card, CardContent, CardHeader } from '../ui/Card';

type Status = 'checking' | 'ok' | 'error';

interface TableStatus {
  name: string;
  status: Status;
  error?: string;
}

const tableNames = ['trips', 'settlements', 'receivable_freights', 'fiscal_notes', 'third_party_freights', 'saved_entries'];

const sqlSchema = `-- Habilita a extensão para usar UUIDs (identificadores únicos)
create extension if not exists "uuid-ossp";

-- Tabela para VIAGENS (Trips)
create table if not exists trips (
  id uuid primary key default uuid_generate_v4(),
  driver text not null,
  license_plate text not null,
  departure_date date,
  arrival_date date,
  initial_km numeric,
  final_km numeric,
  freights jsonb,
  expenses jsonb,
  refuelings jsonb,
  observations text,
  created_at timestamp with time zone default now()
);

-- Tabela para ACERTOS (Settlements)
create table if not exists settlements (
  id uuid primary key default uuid_generate_v4(),
  driver text not null,
  date date,
  observations text,
  commissions jsonb,
  additions jsonb,
  discounts jsonb,
  fines_balance text,
  final_balance numeric,
  created_at timestamp with time zone default now()
);

-- Tabela para FRETES A RECEBER (Receivables)
create table if not exists receivable_freights (
  id uuid primary key default uuid_generate_v4(),
  date date,
  due_date date,
  client text not null,
  origin text,
  destination text,
  cte text,
  total_value numeric not null default 0,
  paid_value numeric not null default 0,
  row_color text,
  created_at timestamp with time zone default now()
);

-- Tabela para NOTAS FISCAIS (Fiscal Notes)
create table if not exists fiscal_notes (
  id uuid primary key default uuid_generate_v4(),
  company text not null,
  shipping_date date,
  nf_number text not null,
  status text check (status in ('Pendente', 'Entregue')),
  delivery_location text,
  client_delivered boolean default false,
  created_at timestamp with time zone default now()
);

-- Tabela para FRETES DE TERCEIROS (Third Party Freights)
create table if not exists third_party_freights (
  id uuid primary key default uuid_generate_v4(),
  driver text not null,
  license_plate text,
  date date,
  origin text,
  destination text,
  company_freight_value numeric not null default 0,
  paid_freight_value numeric not null default 0,
  toll_value numeric default 0,
  advance_payment numeric not null default 0,
  status text check (status in ('Pendente', 'Pago', 'Parcial')),
  created_at timestamp with time zone default now()
);

-- Tabela para DADOS SALVOS (Persistência de Autocomplete)
create table if not exists saved_entries (
  id uuid primary key default uuid_generate_v4(),
  category text not null,
  value text not null,
  created_at timestamp with time zone default now(),
  unique (category, value)
);

-- Atualização para adicionar coluna de pedágio caso não exista
alter table third_party_freights add column if not exists toll_value numeric default 0;

-- Atualização para adicionar coluna de entregue ao cliente caso não exista
alter table fiscal_notes add column if not exists client_delivered boolean default false;

-- Habilita Row Level Security (RLS) para segurança futura
alter table trips enable row level security;
alter table settlements enable row level security;
alter table receivable_freights enable row level security;
alter table fiscal_notes enable row level security;
alter table third_party_freights enable row level security;
alter table saved_entries enable row level security;

-- Cria políticas públicas
create policy "Public access" on trips for all using (true) with check (true);
create policy "Public access" on settlements for all using (true) with check (true);
create policy "Public access" on receivable_freights for all using (true) with check (true);
create policy "Public access" on fiscal_notes for all using (true) with check (true);
create policy "Public access" on third_party_freights for all using (true) with check (true);
create policy "Public access" on saved_entries for all using (true) with check (true);`;

const StatusIndicator: React.FC<{ status: Status }> = ({ status }) => {
  if (status === 'checking') {
    return <span className="text-sm font-medium text-slate-500">Verificando...</span>;
  }
  if (status === 'ok') {
    return <span className="text-sm font-medium text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full">OK</span>;
  }
  return <span className="text-sm font-medium text-red-600 bg-red-100 px-2 py-1 rounded-full">Faltando</span>;
};

export const DashboardView: React.FC = () => {
  const [tablesStatus, setTablesStatus] = useState<TableStatus[]>(
    tableNames.map(name => ({ name, status: 'checking' }))
  );
  const [isAllOk, setIsAllOk] = useState(false);

  useEffect(() => {
    const checkTables = async () => {
      const promises = tableNames.map(async (name): Promise<TableStatus> => {
        const { error } = await supabase.from(name).select('id', { count: 'exact', head: true });
        if (error && error.code === '42P01') { // relation does not exist
          return { name, status: 'error', error: 'Tabela não encontrada.' };
        } else if (error) {
          return { name, status: 'error', error: error.message };
        }
        return { name, status: 'ok' };
      });

      const results = await Promise.all(promises);
      setTablesStatus(results);
      setIsAllOk(results.every(r => r.status === 'ok'));
    };

    checkTables();
  }, []);

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(sqlSchema);
    alert('Código SQL copiado para a área de transferência!');
  };

  return (
    <div className="flex flex-col h-full">
      <header className="bg-white/80 backdrop-blur-lg border-b border-slate-200 sticky top-0 z-30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-slate-800">Dashboard de Status</h1>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <Card>
            <CardHeader>Verificação do Backend (Supabase)</CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="font-semibold text-slate-700">Conexão com Supabase</span>
                  <span className="text-sm font-medium text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full">Conectado</span>
                </li>
                {tablesStatus.map(({ name, status }) => (
                  <li key={name} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="font-semibold text-slate-700">Tabela: <code className="bg-slate-200 px-1 rounded">{name}</code></span>
                    <StatusIndicator status={status} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Configuração do Banco de Dados
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>Caso veja erros de "tabela não encontrada" ou colunas faltando, execute o script abaixo. Ele criará as tabelas e colunas necessárias.</p>
              <p>
                <strong>Instruções:</strong>
                <ol className="list-decimal list-inside space-y-1 mt-2 pl-2">
                  <li>Copie o código SQL abaixo.</li>
                  <li>Vá para o seu projeto no site do Supabase e clique em <strong>SQL Editor</strong> no menu lateral.</li>
                  <li>Cole o código no editor e clique em <strong>RUN</strong>.</li>
                  <li>Recarregue esta página.</li>
                </ol>
              </p>
              <div className="relative">
                  <button onClick={copySqlToClipboard} className="absolute top-2 right-2 bg-slate-600 hover:bg-slate-700 text-white text-xs font-bold py-1 px-2 rounded">
                      Copiar
                  </button>
                  <pre className="bg-slate-800 text-white p-4 rounded-lg overflow-x-auto text-sm">
                      <code>{sqlSchema}</code>
                  </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};