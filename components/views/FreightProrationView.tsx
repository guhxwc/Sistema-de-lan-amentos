
import React, { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface InvoiceItem {
  id: string;
  number: string;
  value: number | '';
  weight: number | '';
}

interface CalculationResult {
  id: string;
  number: string;
  value: number;
  weight: number;
  sharePercent: number; // % da NF no total
  proratedFreight: number; // Frete rateado
  freightPercentOnInvoice: number; // % do frete sobre a NF
  costPerKg: number; // R$/kg
}

export const FreightProrationView: React.FC = () => {
  const [totalFreight, setTotalFreight] = useState<number | ''>('');
  const [invoices, setInvoices] = useState<InvoiceItem[]>([
    { id: crypto.randomUUID(), number: '', value: '', weight: '' }
  ]);
  const [results, setResults] = useState<CalculationResult[]>([]);
  const [lastCalculationTime, setLastCalculationTime] = useState<string | null>(null);
  
  // XML Processing State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessingXml, setIsProcessingXml] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');

  // --- HELPERS DE MÁSCARA ---
  const formatMoneyDisplay = (val: number | '') => {
    if (val === '') return '';
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const parseMoneyInput = (rawValue: string): number | '' => {
    // Remove tudo que não for dígito
    const digits = rawValue.replace(/\D/g, '');
    if (!digits) return '';
    // Divide por 100 para considerar os centavos
    return parseFloat(digits) / 100;
  };

  // Totais dos Inputs (para display em tempo real, se necessário)
  const totals = useMemo(() => {
    const totalValue = invoices.reduce((acc, item) => acc + (Number(item.value) || 0), 0);
    const totalWeight = invoices.reduce((acc, item) => acc + (Number(item.weight) || 0), 0);
    return { totalValue, totalWeight };
  }, [invoices]);

  const handleInvoiceChange = (id: string, field: keyof InvoiceItem, value: string) => {
    setInvoices(prev => prev.map(inv => {
      if (inv.id !== id) return inv;
      if (field === 'number') return { ...inv, number: value };
      
      if (field === 'value') {
        // Aplica a lógica de máscara para moeda
        return { ...inv, value: parseMoneyInput(value) };
      }

      // Para peso (weight), mantemos comportamento numérico padrão ou string simples
      return { ...inv, [field]: value === '' ? '' : parseFloat(value) };
    }));
    // Limpar resultados antigos ao editar para evitar confusão
    if (results.length > 0) setResults([]);
  };

  const handleAddInvoice = () => {
    setInvoices(prev => [...prev, { id: crypto.randomUUID(), number: '', value: '', weight: '' }]);
  };

  const handleRemoveInvoice = (id: string) => {
    setInvoices(prev => prev.filter(inv => inv.id !== id));
    if (results.length > 0) setResults([]);
  };

  // --- XML UPLOAD LOGIC ---
  const handleXmlButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingXml(true);
    setProcessingStatus('Iniciando leitura...');
    
    const newItems: InvoiceItem[] = [];
    const rawApiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.VITE_GOOGLE_API_KEY || '';
    const apiKey = rawApiKey ? rawApiKey.replace(/["']/g, '').trim() : '';
    
    console.log('Debug API Key (FreightProration):', {
      original: rawApiKey ? `${rawApiKey.substring(0, 5)}...` : 'empty',
      cleaned: apiKey ? `${apiKey.substring(0, 5)}...` : 'empty',
      length: apiKey.length
    });

    if (!apiKey) {
      alert("Configuração da IA ausente. Verifique se a chave da API está configurada no ambiente.");
      setIsProcessingXml(false);
      setProcessingStatus('');
      return;
    }

    // const ai = new GoogleGenAI({ apiKey }); // Removido para usar fetch direto

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProcessingStatus(`Processando ${i + 1} de ${files.length}...`);
        
        try {
            const xmlContent = await file.text();
            
            const prompt = `Analise este XML de Documento Fiscal (NFe ou CTe) e extraia:
            1. Número (tag <nNF> ou <nCT>). Remova zeros à esquerda.
            2. Valor Total (tag <vNF> dentro de <ICMSTot>, ou <vTPrest> se CTe).
            3. Peso Bruto (tag <pesoB>). Se não existir, tente Peso Líquido (<pesoL>) ou <qCarga>. Se não encontrar, retorne 0.
            
            Retorne JSON numérico para valor e peso.`;

            // Usando fetch direto para garantir o envio correto da chave
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                contents: [{ parts: [{ text: `${prompt}\n\nXML:\n${xmlContent}` }] }],
                generationConfig: {
                  responseMimeType: "application/json",
                  responseSchema: {
                    type: "OBJECT",
                    properties: {
                      number: { type: "STRING" },
                      value: { type: "NUMBER" },
                      weight: { type: "NUMBER" },
                    },
                    required: ['number', 'value']
                  }
                }
              })
            });

            if (!response.ok) {
               const errorData = await response.json().catch(() => ({}));
               throw new Error(errorData.error?.message || `Erro na API: ${response.status}`);
            }

            const responseJson = await response.json();
            const responseText = responseJson.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!responseText) throw new Error("IA não retornou dados.");

            const data = JSON.parse(responseText);
            
            // Validação básica para evitar "zerados" indesejados
            if (data.value && data.value > 0) {
                newItems.push({
                    id: crypto.randomUUID(),
                    number: data.number || '',
                    value: data.value,
                    weight: data.weight || 0
                });
            } else {
                console.warn(`Arquivo ${file.name} retornou valor 0 ou inválido.`);
            }

            // Pequeno delay para ser gentil com a API se houver muitos arquivos
            if (files.length > 1) await new Promise(r => setTimeout(r, 500));

        } catch (err) {
            console.error(`Erro ao processar arquivo ${file.name}:`, err);
        }
      }

      if (newItems.length > 0) {
        setInvoices(prev => {
            // Se houver apenas uma linha e ela estiver vazia, substitua-a
            if (prev.length === 1 && !prev[0].number && !prev[0].value && !prev[0].weight) {
                return newItems;
            }
            // Caso contrário, adicione as novas linhas
            return [...prev, ...newItems];
        });
        
        // Limpar resultados anteriores pois a entrada mudou
        if(results.length > 0) setResults([]);
      } else {
          alert("Não foi possível extrair dados válidos dos arquivos selecionados.");
      }

    } catch (error) {
      console.error("Erro geral no processamento:", error);
      alert("Ocorreu um erro ao processar os arquivos.");
    } finally {
      setIsProcessingXml(false);
      setProcessingStatus('');
      if (fileInputRef.current) fileInputRef.current.value = ''; // Reset input
    }
  };

  const handleCalculate = () => {
    const freight = Number(totalFreight);
    const totalInvoiceValue = totals.totalValue;

    if (!freight || freight <= 0) {
      alert("Informe um valor de frete válido.");
      return;
    }
    if (totalInvoiceValue <= 0) {
      alert("O valor total das notas fiscais deve ser maior que zero.");
      return;
    }

    // 1. Cálculo Inicial (com alta precisão intermediária)
    let tempResults = invoices.map(inv => {
      const val = Number(inv.value) || 0;
      const weight = Number(inv.weight) || 0;
      
      // % da NF no rateio (Share)
      const shareRatio = val / totalInvoiceValue;
      
      // Frete bruto
      const rawFreight = freight * shareRatio;
      
      // Arredondamento para 2 casas
      const roundedFreight = Math.round(rawFreight * 100) / 100;

      return {
        id: inv.id,
        number: inv.number,
        value: val,
        weight: weight,
        sharePercent: shareRatio * 100,
        proratedFreight: roundedFreight,
        freightPercentOnInvoice: 0, // calculado depois
        costPerKg: 0 // calculado depois
      };
    });

    // 2. Ajuste de Diferença de Centavos (Arredondamento)
    const currentSumFreight = tempResults.reduce((acc, item) => acc + item.proratedFreight, 0);
    const diff = freight - currentSumFreight;
    
    // Pequeno ajuste para lidar com flutuação binária, arredondando a diferença para 2 casas
    const roundedDiff = Math.round(diff * 100) / 100;

    if (roundedDiff !== 0) {
      // Encontrar a NF com maior valor para aplicar a diferença
      let maxValIndex = -1;
      let maxVal = -1;

      tempResults.forEach((item, index) => {
        if (item.value > maxVal) {
          maxVal = item.value;
          maxValIndex = index;
        }
      });

      // Se todas forem 0 (improvável) ou iguais, pega a última
      if (maxValIndex === -1) maxValIndex = tempResults.length - 1;

      // Aplica a diferença
      tempResults[maxValIndex].proratedFreight += roundedDiff;
      // Garante 2 casas após o ajuste
      tempResults[maxValIndex].proratedFreight = Math.round(tempResults[maxValIndex].proratedFreight * 100) / 100;
    }

    // 3. Cálculos Finais (Métricas derivadas)
    const finalResults = tempResults.map(item => ({
      ...item,
      freightPercentOnInvoice: item.value > 0 ? (item.proratedFreight / item.value) * 100 : 0,
      costPerKg: item.weight > 0 ? (item.proratedFreight / item.weight) : 0
    }));

    setResults(finalResults);
    setLastCalculationTime(new Date().toLocaleString('pt-BR'));
  };

  const handleClear = () => {
    setInvoices([{ id: crypto.randomUUID(), number: '', value: '', weight: '' }]);
    setTotalFreight('');
    setResults([]);
    setLastCalculationTime(null);
  };

  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatPercent = (val: number) => val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
  const formatDecimal = (val: number) => val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleGeneratePDF = () => {
    if (results.length === 0) {
      alert("Calcule o rateio antes de gerar o PDF.");
      return;
    }

    const doc = new jsPDF();
    const primaryColor = [2, 132, 199]; // sky-600
    
    // Cabeçalho
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text("Demonstrativo de Rateio de Frete", 14, 20);
    
    // Info Geral
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Data do Cálculo: ${lastCalculationTime}`, 14, 28);

    // Resumo
    const generalPercent = totals.totalValue > 0 ? (Number(totalFreight) / totals.totalValue) * 100 : 0;
    
    doc.setDrawColor(200);
    doc.setFillColor(245, 250, 255);
    doc.roundedRect(14, 35, 182, 25, 2, 2, 'FD');
    
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text("Frete Total:", 20, 45);
    doc.text("Total NFs:", 80, 45);
    doc.text("% Geral Frete:", 140, 45);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(formatCurrency(Number(totalFreight)), 20, 52);
    doc.text(formatCurrency(totals.totalValue), 80, 52);
    doc.text(formatPercent(generalPercent), 140, 52);

    // Tabela
    const tableBody = results.map(r => [
      r.number || '-',
      formatCurrency(r.value),
      formatDecimal(r.weight),
      formatPercent(r.sharePercent),
      formatCurrency(r.proratedFreight),
      formatPercent(r.freightPercentOnInvoice),
      formatCurrency(r.costPerKg) // R$/kg
    ]);

    autoTable(doc, {
      startY: 70,
      head: [['NF', 'Valor NF', 'Peso (kg)', '% Part.', 'Frete Rateado', '% s/ NF', 'R$/kg']],
      body: tableBody,
      theme: 'striped',
      headStyles: { fillColor: primaryColor as any, textColor: 255, halign: 'center' },
      bodyStyles: { halign: 'center' },
      columnStyles: {
        0: { halign: 'left' }, // NF
        1: { halign: 'right' }, // Valor
        2: { halign: 'right' }, // Peso
        3: { halign: 'center' }, // % Part
        4: { halign: 'right', fontStyle: 'bold' }, // Frete
        5: { halign: 'center' }, // % s/ NF
        6: { halign: 'right' } // R$/kg
      },
      foot: [[
        'TOTAIS',
        formatCurrency(totals.totalValue),
        formatDecimal(totals.totalWeight),
        '100,00%',
        formatCurrency(Number(totalFreight)),
        '-',
        '-'
      ]],
      footStyles: { fillColor: [240, 240, 240], textColor: 50, fontStyle: 'bold', halign: 'right' }
    });

    // Rodapé de página
    const pageCount = (doc as any).internal.getNumberOfPages();
    doc.setFontSize(8);
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text('Sistema de Gestão de Viagens - Módulo de Rateio', 14, doc.internal.pageSize.height - 10);
        doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 25, doc.internal.pageSize.height - 10);
    }

    doc.save(`Rateio_Frete_${new Date().getTime()}.pdf`);
  };

  const generalPercentage = useMemo(() => {
    const f = Number(totalFreight);
    if (!f || totals.totalValue === 0) return 0;
    return (f / totals.totalValue) * 100;
  }, [totalFreight, totals.totalValue]);

  return (
    <div className="flex flex-col h-full">
      <header className="bg-white/80 backdrop-blur-lg border-b border-slate-200 sticky top-0 z-30">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2-2v14a2 2 0 002 2z" />
              </svg>
              Calculadora de Rateio de Frete
            </h1>
            <div className="flex gap-2">
                <Button onClick={handleClear} variant="ghost" size="sm">Limpar</Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="w-full mx-auto space-y-6">
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* INPUTS */}
            <div className="lg:col-span-1 space-y-6">
               <Card className="bg-sky-50 border-sky-100 shadow-sm">
                 <CardHeader>
                    <span className="text-sky-800 font-bold">Valor do Frete</span>
                 </CardHeader>
                 <CardContent>
                    <Input 
                      label="Frete Total (R$)" 
                      id="total-freight"
                      type="text" 
                      inputMode="numeric"
                      value={formatMoneyDisplay(totalFreight)} 
                      onChange={e => {
                        setTotalFreight(parseMoneyInput(e.target.value));
                        if(results.length > 0) setResults([]); // Reset results on change
                      }}
                      className="text-lg font-bold text-slate-700"
                      placeholder="0,00"
                    />
                    {totals.totalValue > 0 && Number(totalFreight) > 0 && (
                      <div className="mt-4 p-3 bg-white rounded-lg border border-sky-100 flex flex-col items-center">
                         <span className="text-xs font-bold text-sky-600 uppercase">Impacto Geral</span>
                         <span className="text-2xl font-bold text-slate-700">{formatPercent(generalPercentage)}</span>
                         <span className="text-xs text-slate-400">do valor da carga</span>
                      </div>
                    )}
                 </CardContent>
               </Card>

               <Card>
                 <CardHeader action={
                    <div className="flex gap-2">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept=".xml"
                            multiple
                            className="hidden"
                        />
                        <Button 
                            onClick={handleXmlButtonClick} 
                            size="sm" 
                            variant="outline"
                            disabled={isProcessingXml}
                            title="Importar dados de XML da NFe (Permite múltiplos arquivos)"
                        >
                            {isProcessingXml ? (
                                <div className="flex items-center gap-1">
                                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span className="text-xs">{processingStatus || '...'}</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <span className="hidden sm:inline">XML</span>
                                </div>
                            )}
                        </Button>
                        <Button onClick={handleAddInvoice} size="sm" variant="secondary">+ Adicionar</Button>
                    </div>
                 }>
                    Notas Fiscais
                 </CardHeader>
                 <CardContent className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                    {invoices.map((inv, idx) => (
                      <div key={inv.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg animate-in slide-in-from-left-2">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-bold text-slate-400 uppercase">Item #{idx + 1}</span>
                          <button onClick={() => handleRemoveInvoice(inv.id)} className="text-red-400 hover:text-red-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                           <div className="col-span-2">
                              <Input 
                                label="Número NF" 
                                value={inv.number} 
                                onChange={e => handleInvoiceChange(inv.id, 'number', e.target.value)} 
                                placeholder="Ex: 12345"
                                className="!py-1.5 !text-sm"
                              />
                           </div>
                           <Input 
                              label="Valor (R$)" 
                              type="text"
                              inputMode="numeric" 
                              value={formatMoneyDisplay(inv.value)} 
                              onChange={e => handleInvoiceChange(inv.id, 'value', e.target.value)} 
                              placeholder="0,00"
                              className="!py-1.5 !text-sm"
                           />
                           <Input 
                              label="Peso (kg)" 
                              type="number" 
                              value={inv.weight} 
                              onChange={e => handleInvoiceChange(inv.id, 'weight', e.target.value)} 
                              placeholder="0.00"
                              className="!py-1.5 !text-sm"
                           />
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-sm text-slate-600">
                        <span>Total NFs:</span>
                        <span className="font-bold">{formatCurrency(totals.totalValue)}</span>
                    </div>
                 </CardContent>
                 <div className="p-4 bg-slate-50 border-t border-slate-200">
                    <Button onClick={handleCalculate} className="w-full shadow-lg shadow-sky-600/20">
                      Calcular Rateio
                    </Button>
                 </div>
               </Card>
            </div>

            {/* RESULTS */}
            <div className="lg:col-span-2">
              <Card className="h-full flex flex-col">
                <CardHeader action={
                   <Button 
                     onClick={handleGeneratePDF} 
                     disabled={results.length === 0} 
                     variant="outline" 
                     size="sm"
                     className="flex items-center gap-2"
                   >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
                     </svg>
                     Gerar PDF
                   </Button>
                }>
                   Resultado do Rateio (por Valor)
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden flex flex-col p-0">
                   {results.length > 0 ? (
                     <div className="flex-1 overflow-auto">
                       <table className="w-full text-sm text-left text-slate-500">
                         <thead className="text-xs text-slate-700 uppercase bg-slate-100 sticky top-0">
                           <tr>
                             <th className="px-4 py-3">NF</th>
                             <th className="px-4 py-3 text-right">Valor NF</th>
                             <th className="px-4 py-3 text-right">Peso (kg)</th>
                             <th className="px-4 py-3 text-center">% Part.</th>
                             <th className="px-4 py-3 text-right bg-sky-50 text-sky-800 font-bold border-l border-sky-100">Frete Rateado</th>
                             <th className="px-4 py-3 text-center">% s/ NF</th>
                             <th className="px-4 py-3 text-right">R$/kg</th>
                           </tr>
                         </thead>
                         <tbody>
                           {results.map(r => (
                             <tr key={r.id} className="border-b hover:bg-slate-50 transition-colors">
                               <td className="px-4 py-3 font-medium text-slate-900">{r.number || '-'}</td>
                               <td className="px-4 py-3 text-right">{formatCurrency(r.value)}</td>
                               <td className="px-4 py-3 text-right">{formatDecimal(r.weight)}</td>
                               <td className="px-4 py-3 text-center text-slate-400">{formatPercent(r.sharePercent)}</td>
                               <td className="px-4 py-3 text-right font-bold text-sky-700 bg-sky-50/50 border-l border-sky-100">
                                 {formatCurrency(r.proratedFreight)}
                               </td>
                               <td className="px-4 py-3 text-center">{formatPercent(r.freightPercentOnInvoice)}</td>
                               <td className="px-4 py-3 text-right">{formatCurrency(r.costPerKg)}</td>
                             </tr>
                           ))}
                         </tbody>
                         <tfoot className="bg-slate-100 font-bold text-slate-700 sticky bottom-0">
                           <tr>
                             <td className="px-4 py-3">TOTAIS</td>
                             <td className="px-4 py-3 text-right">{formatCurrency(totals.totalValue)}</td>
                             <td className="px-4 py-3 text-right">{formatDecimal(totals.totalWeight)}</td>
                             <td className="px-4 py-3 text-center">100%</td>
                             <td className="px-4 py-3 text-right bg-sky-100 text-sky-900 border-l border-sky-200">
                               {formatCurrency(results.reduce((acc, r) => acc + r.proratedFreight, 0))}
                             </td>
                             <td className="px-4 py-3 text-center">-</td>
                             <td className="px-4 py-3 text-right">-</td>
                           </tr>
                         </tfoot>
                       </table>
                     </div>
                   ) : (
                     <div className="flex-1 flex flex-col items-center justify-center text-slate-400 min-h-[300px]">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2-2v14a2 2 0 002 2z" />
                        </svg>
                        <p>Preencha os dados e clique em calcular</p>
                     </div>
                   )}
                </CardContent>
              </Card>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};
