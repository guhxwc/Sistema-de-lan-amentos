
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';

type Status = 'checking' | 'ok' | 'error';

interface TableStatus {
  name: string;
  status: Status;
  error?: string;
}

const tableNames = ['trips', 'settlements', 'receivable_freights', 'fiscal_notes', 'third_party_freights', 'saved_entries', 'inbox_ctes'];

const sqlSchema = `-- Habilita a extensão para usar UUIDs
create extension if not exists "uuid-ossp";

-- Tabela para Inbox de CT-es vindos do E-mail
create table if not exists inbox_ctes (
  id uuid primary key default uuid_generate_v4(),
  email_source text,
  received_at timestamp with time zone default now(),
  xml_content text,
  cte_number text,
  client_name text,
  origin text,
  destination text,
  total_value numeric,
  emission_date date,
  is_used boolean default false,
  created_at timestamp with time zone default now()
);

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
  maintenances jsonb,
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
  delivery_date date,
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

-- RLS
alter table trips enable row level security;
alter table settlements enable row level security;
alter table receivable_freights enable row level security;
alter table fiscal_notes enable row level security;
alter table third_party_freights enable row level security;
alter table saved_entries enable row level security;
alter table inbox_ctes enable row level security;

-- Políticas
create policy "Public access trips" on trips for all using (true) with check (true);
create policy "Public access settlements" on settlements for all using (true) with check (true);
create policy "Public access receivables" on receivable_freights for all using (true) with check (true);
create policy "Public access notes" on fiscal_notes for all using (true) with check (true);
create policy "Public access third_party" on third_party_freights for all using (true) with check (true);
create policy "Public access entries" on saved_entries for all using (true) with check (true);
create policy "Public access inbox" on inbox_ctes for all using (true) with check (true);
`;

const edgeFunctionCode = `// Supabase Edge Function: email-processor
// Deploy: supabase functions deploy email-processor

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  try {
    // 1. Recebe o Webhook (Ex: SendGrid Inbound Parse ou Custom POST)
    const { from, subject, attachments } = await req.json()

    // 2. Procura por anexos XML
    const xmlAttachment = attachments?.find((att: any) => 
      att.filename.toLowerCase().endsWith('.xml') || 
      att.type.includes('xml')
    );

    if (!xmlAttachment) {
      return new Response(JSON.stringify({ message: 'No XML found' }), { status: 200 })
    }

    // 3. Decodifica o conteúdo (Assumindo Base64 se vier de APIs padrão)
    // Nota: Dependendo do provedor, pode vir texto puro
    const xmlContent = atob(xmlAttachment.content); 

    // 4. Extração Simples (Regex) para dados vitais 
    // (Idealmente use um parser XML completo, mas Regex é rápido para Edge Functions simples)
    const cteMatch = xmlContent.match(/<nCT>(.*?)<\/nCT>/);
    const valMatch = xmlContent.match(/<vTPrest>(.*?)<\/vTPrest>/);
    const remMatch = xmlContent.match(/<rem>.*?<xNome>(.*?)<\/xNome>.*?<\/rem>/s); // Remetente
    const destMatch = xmlContent.match(/<dest>.*?<xNome>(.*?)<\/xNome>.*?<\/dest>/s); // Destinatário (Cliente)

    // 5. Salva no Banco de Dados
    const { error } = await supabase.from('inbox_ctes').insert({
      email_source: from,
      xml_content: xmlContent,
      cte_number: cteMatch ? cteMatch[1] : 'N/A',
      total_value: valMatch ? parseFloat(valMatch[1]) : 0,
      client_name: destMatch ? destMatch[1] : (remMatch ? remMatch[1] : 'Desconhecido'),
      origin: 'Extraído via XML', // Melhorar com parser completo
      destination: 'Extraído via XML',
      emission_date: new Date().toISOString()
    })

    if (error) throw error

    return new Response(JSON.stringify({ message: 'XML Processed' }), { status: 200 })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})`;

const promptForSupabase = `Atue como um Engenheiro de Software Sênior especializado em Supabase.

Preciso configurar o backend para meu sistema de transportadora.
1. Gere o SQL para criar a tabela 'inbox_ctes' com os campos: id (uuid), email_source (text), xml_content (text), cte_number (text), client_name (text), total_value (numeric), emission_date (date), is_used (bool).
2. Crie uma política RLS (Row Level Security) que permita inserção de dados via 'service_role' (para minha Edge Function funcionar).
3. Escreva o código de uma Supabase Edge Function em TypeScript (Deno) que funcione como um Webhook. Ela deve:
   - Receber um POST JSON (formato padrão de webhooks de e-mail como SendGrid ou Mailgun).
   - Identificar se há um anexo XML.
   - Decodificar o anexo.
   - Extrair dados básicos via Regex (Número CT-e, Valor, Cliente).
   - Inserir na tabela 'inbox_ctes'.

O objetivo é que, quando meu e-mail receber um XML, ele seja encaminhado para essa função e apareça no meu painel.`;

const StatusIndicator: React.FC<{ status: Status }> = ({ status }) => {
  if (status === 'checking') return <span className="text-sm font-medium text-slate-500">Verificando...</span>;
  if (status === 'ok') return <span className="text-sm font-medium text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full">OK</span>;
  return <span className="text-sm font-medium text-red-600 bg-red-100 px-2 py-1 rounded-full">Faltando</span>;
};

export const DashboardView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'status' | 'backend'>('status');
  const [tablesStatus, setTablesStatus] = useState<TableStatus[]>(
    tableNames.map(name => ({ name, status: 'checking' }))
  );

  const checkTables = async () => {
    const promises = tableNames.map(async (name): Promise<TableStatus> => {
      const { error } = await supabase.from(name).select('id', { count: 'exact', head: true });
      if (error && error.code === '42P01') return { name, status: 'error', error: 'Tabela não encontrada.' };
      return { name, status: 'ok' };
    });
    const results = await Promise.all(promises);
    setTablesStatus(results);
  };

  useEffect(() => {
    checkTables();
  }, []);

  const simulateSync = async () => {
    const mockCtes = [
      {
        email_source: 'transportes@empresa.com.br',
        cte_number: String(Math.floor(Math.random() * 99999)),
        client_name: 'METALURGICA BRASIL S.A',
        origin: 'SAO PAULO - SP',
        destination: 'BELO HORIZONTE - MG',
        total_value: 4500.50,
        emission_date: new Date().toISOString().split('T')[0],
        is_used: false
      },
      {
        email_source: 'faturamento@logistica.com',
        cte_number: String(Math.floor(Math.random() * 99999)),
        client_name: 'DISTRIBUIDORA NORDESTE LTDA',
        origin: 'RIO DE JANEIRO - RJ',
        destination: 'RECIFE - PE',
        total_value: 12400.00,
        emission_date: new Date().toISOString().split('T')[0],
        is_used: false
      }
    ];

    const { error } = await supabase.from('inbox_ctes').insert(mockCtes);
    if (error) alert(error.message);
    else alert('Simulação de sincronização concluída! Verifique o módulo "Receber".');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copiado para a área de transferência!');
  };

  return (
    <div className="flex flex-col h-full">
      <header className="bg-white/80 backdrop-blur-lg border-b border-slate-200 sticky top-0 z-30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-slate-800">Dashboard & Configurações</h1>
            <div className="flex gap-2">
                <Button 
                    variant={activeTab === 'status' ? 'primary' : 'ghost'} 
                    size="sm" 
                    onClick={() => setActiveTab('status')}
                >
                    Status & Simulação
                </Button>
                <Button 
                    variant={activeTab === 'backend' ? 'primary' : 'ghost'} 
                    size="sm" 
                    onClick={() => setActiveTab('backend')}
                >
                    Integração Real (Backend)
                </Button>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-8 pb-10">
          
          {activeTab === 'status' && (
            <>
                <Card className="border-l-4 border-l-sky-500 bg-sky-50/30">
                    <CardHeader>
                    <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Como conectar meu e-mail? (Básico)
                    </div>
                    </CardHeader>
                    <CardContent>
                    <div className="space-y-4 text-slate-700 text-sm leading-relaxed">
                        <p>Para usuários não-técnicos, recomendamos usar o <strong>Make.com</strong> ou <strong>Zapier</strong>:</p>
                        <ol className="list-decimal list-inside space-y-2 ml-2">
                        <li>Crie uma conta no Make.com.</li>
                        <li>Use o módulo "Email" (Watch Emails) para monitorar seus XMLs.</li>
                        <li>Conecte ao módulo "Supabase" (Insert Row) na tabela <code className="bg-slate-200 px-1 rounded">inbox_ctes</code>.</li>
                        </ol>
                        <div className="mt-4 p-3 bg-white border border-sky-100 rounded-lg shadow-sm">
                        <p className="font-bold text-sky-800 mb-1">Teste Rápido</p>
                        <p className="mb-2">Gere dados fictícios para ver como funciona no sistema.</p>
                        <Button onClick={simulateSync} size="sm" className="bg-sky-600">Simular Chegada de E-mail</Button>
                        </div>
                    </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>Status das Tabelas</CardHeader>
                    <CardContent>
                    <ul className="space-y-3">
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
                    <CardHeader>Script SQL Completo (Instalação)</CardHeader>
                    <CardContent className="space-y-4">
                    <div className="relative">
                        <button onClick={() => copyToClipboard(sqlSchema)} className="absolute top-2 right-2 bg-slate-600 hover:bg-slate-700 text-white text-xs font-bold py-1 px-2 rounded">Copiar Tudo</button>
                        <pre className="bg-slate-800 text-white p-4 rounded-lg overflow-x-auto text-sm"><code>{sqlSchema}</code></pre>
                    </div>
                    </CardContent>
                </Card>
            </>
          )}

          {activeTab === 'backend' && (
            <>
                <div className="bg-slate-800 text-white p-6 rounded-2xl shadow-xl">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                        Área do Desenvolvedor
                    </h2>
                    <p className="text-slate-300 mb-6">
                        Para uma integração real profissional, utilize o prompt abaixo na IA do Supabase ou implemente a Edge Function manualmente.
                    </p>

                    <div className="space-y-8">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-bold text-sky-400 uppercase tracking-wide">1. Prompt para a IA do Supabase</label>
                                <button onClick={() => copyToClipboard(promptForSupabase)} className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-white transition-colors">Copiar Prompt</button>
                            </div>
                            <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 text-slate-300 text-sm font-mono whitespace-pre-wrap">
                                {promptForSupabase}
                            </div>
                            <p className="text-xs text-slate-500 mt-2">
                                Cole este texto no chat "Ask AI" dentro do painel do Supabase para que ele configure o banco e a função para você automaticamente.
                            </p>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-bold text-emerald-400 uppercase tracking-wide">2. Código da Edge Function (Manual)</label>
                                <button onClick={() => copyToClipboard(edgeFunctionCode)} className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-white transition-colors">Copiar Código</button>
                            </div>
                            <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 overflow-x-auto">
                                <pre className="text-emerald-300 text-xs font-mono"><code>{edgeFunctionCode}</code></pre>
                            </div>
                        </div>
                    </div>
                </div>
            </>
          )}

        </div>
      </main>
    </div>
  );
};
