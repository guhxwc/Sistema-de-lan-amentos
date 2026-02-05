
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { FiscalNote } from '../../types';
import { supabase, getDistinctValues } from '../../lib/supabaseClient';
import { FiscalNoteForm } from '../fiscalNotes/FiscalNoteForm';
import { FiscalNotesTable } from '../fiscalNotes/FiscalNotesTable';
import { EditFiscalNoteModal } from '../fiscalNotes/EditFiscalNoteModal';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { GoogleGenAI, Type } from '@google/genai';
import JSZip from 'jszip';

const getInitialNote = (): FiscalNote => ({
  id: crypto.randomUUID(),
  company: '',
  shipping_date: new Date().toISOString().split('T')[0],
  nf_number: '',
  status: 'Pendente',
  delivery_location: '',
  client_delivered: false,
});

export const FiscalNotesView: React.FC = () => {
  const [notes, setNotes] = useState<FiscalNote[]>([]);
  const [newNote, setNewNote] = useState(getInitialNote());
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
  
  const [savedCompanies, setSavedCompanies] = useState<string[]>([]);
  const [savedLocations, setSavedLocations] = useState<string[]>([]);

  const [editingNote, setEditingNote] = useState<FiscalNote | null>(null);
  const [isProcessingXml, setIsProcessingXml] = useState(false);
  const [isProcessingZip, setIsProcessingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState('');

  // Filters
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [filterClientDelivered, setFilterClientDelivered] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchNotes = useCallback(async () => {
    const { data, error } = await supabase
      .from('fiscal_notes')
      .select('*')
      .order('shipping_date', { ascending: false })
      .order('created_at', { ascending: false }); // Ordenação secundária para estabilidade
    if (error) {
      alert(`Erro ao buscar notas: ${error.message}`);
    } else {
      setNotes(data || []);
      // Manter seleção válida apenas para itens que ainda existem
      setSelectedNotes(prev => {
        const newSet = new Set<string>();
        if (data) {
            const currentIds = new Set(data.map(n => n.id));
            prev.forEach(id => {
                if (currentIds.has(id)) newSet.add(id);
            });
        }
        return newSet;
      });
    }
  }, []);

  const fetchAutocompleteData = useCallback(async () => {
    try {
        const [companies, locations] = await Promise.all([
          getDistinctValues('fiscal_notes', 'company'),
          getDistinctValues('fiscal_notes', 'delivery_location'),
        ]);
        
        // Carregar do LocalStorage para persistência mesmo após exclusão
        const localCompanies = JSON.parse(localStorage.getItem('fiscal_saved_companies') || '[]');
        const localLocations = JSON.parse(localStorage.getItem('fiscal_saved_locations') || '[]');

        // Mesclar dados do banco com dados locais e remover duplicatas
        const uniqueCompanies = Array.from(new Set([...companies, ...localCompanies])).sort();
        const uniqueLocations = Array.from(new Set([...locations, ...localLocations])).sort();

        setSavedCompanies(uniqueCompanies);
        setSavedLocations(uniqueLocations);

        // Atualizar LocalStorage com a união para garantir que novos itens do banco sejam persistidos localmente
        localStorage.setItem('fiscal_saved_companies', JSON.stringify(uniqueCompanies));
        localStorage.setItem('fiscal_saved_locations', JSON.stringify(uniqueLocations));

    } catch(error: any) {
        console.error(`Erro ao carregar dados de autocompletar: ${error.message}`);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
    fetchAutocompleteData();

    const channel = supabase.channel('fiscal_notes-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fiscal_notes' }, payload => {
        console.log('Change received!', payload);
        fetchNotes();
        fetchAutocompleteData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNotes, fetchAutocompleteData]);

  const addToLocalStorage = (key: string, value: string) => {
      try {
          const current = JSON.parse(localStorage.getItem(key) || '[]');
          if (!current.includes(value)) {
              const updated = [...current, value].sort();
              localStorage.setItem(key, JSON.stringify(updated));
          }
      } catch (e) {
          console.error('Erro ao salvar no localStorage', e);
      }
  };

  const filteredNotes = useMemo(() => {
    return notes.filter(note => {
        const matchesStatus = filterStatus === 'Todos' ? true : note.status === filterStatus;
        
        let matchesClientDelivered = true;
        if (filterClientDelivered === 'Sim') matchesClientDelivered = note.client_delivered === true;
        if (filterClientDelivered === 'Não') matchesClientDelivered = !note.client_delivered;

        const matchesSearch = searchTerm === '' || note.nf_number.toLowerCase().includes(searchTerm.toLowerCase());

        return matchesStatus && matchesClientDelivered && matchesSearch;
    });
  }, [notes, filterStatus, filterClientDelivered, searchTerm]);

  const extractDataFromXml = async (xmlContent: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Atualizado para extrair APENAS o número da NF (nNF) e ignorar a série e remover zeros a esquerda
    // Atualizado para extrair Nome do Destinatário/Recebedor ao invés da cidade
    const prompt = `Atue como um especialista em processamento de XML de documentos fiscais brasileiros (CT-e e NF-e).
      
      Regras RÍGIDAS para extração de dados:
      
      1. **company** (Empresa/Cliente):
         - Se o XML for um **CT-e** (Conhecimento de Transporte): Extraia o nome do **REMETENTE** (tag <rem><xNome>).
           **ATENÇÃO:** JAMAIS extraia o nome do Emitente (<emit>), pois em um CT-e o emitente é a transportadora.
         - Se o XML for uma **NF-e** (Nota Fiscal): Extraia o nome do **EMITENTE** (tag <emit><xNome>).
      
      2. **delivery_location** (Local de Entrega):
         - **Prioridade 1:** Se houver um **RECEBEDOR** identificado (tag <receb>), extraia o **NOME** (<xNome>) dentro de <receb>.
         - **Prioridade 2:** Caso contrário, extraia o **NOME** (<xNome>) do **DESTINATÁRIO** dentro de <dest>.
         - **IMPORTANTE:** Extraia o NOME da empresa/pessoa, **NÃO** extraia a cidade/município.
      
      3. **nf_number** (Número da NF):
         - Extraia APENAS o **Número da Nota Fiscal** (nNF).
         - **IMPORTANTE**:
           - NÃO inclua a série.
           - NÃO extraia o número do CT-e (<nCT>).
           - **REMOVA zeros à esquerda**. Exemplo: "000008348" deve ser retornado como "8348".
         - Se for **NF-e**: Extraia o conteúdo de <nNF>.
         - Se for **CT-e**: Procure pela chave de acesso da NF-e referenciada na tag <infNFe>.
           - Na chave de 44 dígitos, o número da NF está nas posições **26 a 34** (9 dígitos).
           - Exemplo: Na chave "...55001000028496...", o número é "000028496". Retorne "28496".
      
      4. **shipping_date** (Data):
         - Extraia a data de emissão (<dhEmi>). Formato: AAAA-MM-DD.

      Retorne APENAS um objeto JSON com as chaves: company, nf_number, delivery_location, shipping_date.
      
      XML:
      ${xmlContent}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              company: { type: Type.STRING, description: "Nome da empresa remetente" },
              nf_number: { type: Type.STRING, description: "Número da NF (somente o número, sem zeros a esquerda)" },
              delivery_location: { type: Type.STRING, description: "Nome da empresa recebedora ou destinatária" },
              shipping_date: { type: Type.STRING, description: "Data no formato AAAA-MM-DD" },
            },
            required: ['company', 'nf_number', 'delivery_location', 'shipping_date']
          },
        },
      });

      return JSON.parse(response.text);
  };

  const handleXmlUpload = useCallback(async (file: File) => {
    setIsProcessingXml(true);
    try {
      const xmlContent = await file.text();
      const parsedData = await extractDataFromXml(xmlContent);

      // Limpar zeros à esquerda se houver
      const cleanNfNumber = parsedData.nf_number ? parsedData.nf_number.replace(/^0+/, '') : '';

      setNewNote(prev => ({
        ...prev,
        company: parsedData.company || prev.company,
        nf_number: cleanNfNumber || prev.nf_number,
        delivery_location: parsedData.delivery_location || prev.delivery_location,
        shipping_date: parsedData.shipping_date || prev.shipping_date,
      }));

      alert('Dados do XML preenchidos com sucesso!');

    } catch (error: any) {
      console.error("Erro ao processar XML com IA:", error);
      let errorMessage = "Ocorreu um erro ao processar o arquivo XML.";
      if (error.message?.includes('429')) {
         errorMessage = "Limite de uso da IA excedido. Aguarde alguns instantes e tente novamente.";
      }
      alert(errorMessage);
    } finally {
      setIsProcessingXml(false);
    }
  }, []);

  const handleZipUpload = useCallback(async (file: File) => {
    setIsProcessingZip(true);
    setZipProgress('Lendo ZIP...');
    try {
        const zip = new JSZip();
        const content = await zip.loadAsync(file);
        const xmlFiles: string[] = [];
        
        // Coleta todos os arquivos XML
        for (const [filename, fileData] of Object.entries(content.files)) {
            const zipEntry = fileData as any;
            if (!zipEntry.dir && filename.toLowerCase().endsWith('.xml')) {
                const text = await zipEntry.async('string');
                xmlFiles.push(text);
            }
        }
        
        if (xmlFiles.length === 0) {
            alert('Nenhum arquivo XML encontrado no ZIP.');
            return;
        }

        const notesToAdd: Partial<FiscalNote>[] = [];
        let successCount = 0;
        let duplicateCount = 0;

        // Processa sequencialmente para não estourar rate limit da IA
        for (let i = 0; i < xmlFiles.length; i++) {
            setZipProgress(`Processando ${i + 1}/${xmlFiles.length}...`);
            try {
                // Pequeno delay para ser gentil com a API
                if (i > 0) await new Promise(r => setTimeout(r, 1000));
                
                const data = await extractDataFromXml(xmlFiles[i]);
                if (data && data.company && data.nf_number) {
                     // Limpar zeros à esquerda se houver
                     const cleanNfNumber = data.nf_number.replace(/^0+/, '');

                     // VERIFICAÇÃO DE DUPLICIDADE (ZIP)
                     // Verifica se já existe na base ou se já foi adicionado na lista de inserção atual
                     const isDuplicateInDb = notes.some(n => n.nf_number === cleanNfNumber);
                     const isDuplicateInBatch = notesToAdd.some(n => n.nf_number === cleanNfNumber);

                     if (isDuplicateInDb || isDuplicateInBatch) {
                        duplicateCount++;
                        continue;
                     }

                     notesToAdd.push({
                        company: data.company.trim().toUpperCase(),
                        nf_number: cleanNfNumber,
                        delivery_location: data.delivery_location?.trim().toUpperCase() || '',
                        shipping_date: data.shipping_date || new Date().toISOString().split('T')[0],
                        status: 'Pendente', // Padrão
                        client_delivered: false
                     });
                     successCount++;
                }
            } catch (err) {
                console.error(`Falha ao processar arquivo XML ${i + 1} do ZIP:`, err);
            }
        }

        if (notesToAdd.length > 0) {
            setZipProgress('Salvando...');
            const { error } = await supabase.from('fiscal_notes').insert(notesToAdd);
            
            if (error) {
                 throw error;
            }

            // Atualiza autocompletar localmente
            notesToAdd.forEach(n => {
                if(n.company) addToLocalStorage('fiscal_saved_companies', n.company);
                if(n.delivery_location) addToLocalStorage('fiscal_saved_locations', n.delivery_location);
            });
            
            let message = `${successCount} notas importadas com sucesso!`;
            if (duplicateCount > 0) {
                message += `\n${duplicateCount} notas duplicadas foram ignoradas.`;
            }
            alert(message);
            
            fetchNotes();
            fetchAutocompleteData();
        } else if (duplicateCount > 0) {
            alert(`Nenhuma nota importada. ${duplicateCount} notas duplicadas foram encontradas e ignoradas.`);
        } else {
            alert('Não foi possível extrair dados válidos dos arquivos XML.');
        }

    } catch (e: any) {
        console.error("Erro no processamento do ZIP:", e);
        alert('Erro ao processar arquivo ZIP: ' + e.message);
    } finally {
        setIsProcessingZip(false);
        setZipProgress('');
    }
  }, [fetchNotes, fetchAutocompleteData, notes]);

  const handleAddNote = useCallback(async () => {
    if (!newNote.company || !newNote.nf_number) {
        alert('Por favor, preencha a Empresa e o Nº NF.');
        return;
    }

    // VERIFICAÇÃO DE DUPLICIDADE (Manual)
    const isDuplicate = notes.some(n => n.nf_number === newNote.nf_number);
    if (isDuplicate) {
        alert('Erro: Já existe uma nota fiscal cadastrada com este número.');
        return;
    }

    const companyClean = newNote.company.trim().toUpperCase();
    const locationClean = newNote.delivery_location.trim().toUpperCase();

    const noteToAdd = {
        ...newNote,
        company: companyClean,
        delivery_location: locationClean,
        client_delivered: newNote.client_delivered || false
    };

    const { error } = await supabase.from('fiscal_notes').upsert(noteToAdd);
    if (error) {
        alert(`Erro ao adicionar nota: ${error.message}`);
    } else {
        // Salvar explicitamente no LocalStorage
        addToLocalStorage('fiscal_saved_companies', companyClean);
        if (locationClean) addToLocalStorage('fiscal_saved_locations', locationClean);

        alert('Nota fiscal adicionada com sucesso!');
        setNewNote(getInitialNote());
        fetchNotes();
        fetchAutocompleteData();
    }
  }, [newNote, fetchNotes, fetchAutocompleteData, notes]);

  const handleDeleteSelected = async () => {
    const idsToDelete = Array.from(selectedNotes);
    if (idsToDelete.length === 0) {
        alert("Nenhuma nota selecionada para exclusão.");
        return;
    }

    if (window.confirm(`Tem certeza que deseja excluir ${idsToDelete.length} nota(s) selecionada(s)?`)) {
      try {
        const { error } = await supabase
            .from('fiscal_notes')
            .delete()
            .in('id', idsToDelete);

        if (error) throw error;

        alert('Notas selecionadas excluídas com sucesso!');
        
        // Atualização imediata da UI para remover os itens excluídos
        setNotes(prev => prev.filter(note => !selectedNotes.has(note.id)));
        setSelectedNotes(new Set()); // Limpa seleção
        
        // Recarrega dados para garantir sincronia com o servidor
        await fetchNotes();
        // fetchAutocompleteData manterá os dados antigos pois estão no LocalStorage
        await fetchAutocompleteData();
      } catch (error: any) {
        console.error("Erro ao excluir notas:", error);
        alert(`Erro ao excluir notas: ${error.message}`);
      }
    }
  };
  
  const handleUpdateNote = useCallback(async (updatedNote: FiscalNote) => {
    // Ao editar, verificamos duplicidade apenas se o número mudou
    // Mas precisamos ignorar a própria nota que está sendo editada
    const isDuplicate = notes.some(n => n.nf_number === updatedNote.nf_number && n.id !== updatedNote.id);
    if (isDuplicate) {
        alert('Erro: Já existe outra nota fiscal cadastrada com este número.');
        return;
    }

    const companyClean = updatedNote.company.trim().toUpperCase();
    const locationClean = updatedNote.delivery_location.trim().toUpperCase();

    const noteToUpdate = {
        ...updatedNote,
        company: companyClean,
        delivery_location: locationClean,
    };
    const { error } = await supabase.from('fiscal_notes').update(noteToUpdate).eq('id', noteToUpdate.id);
    if (error) {
        alert(`Erro ao atualizar nota: ${error.message}`);
    } else {
        // Salvar explicitamente no LocalStorage
        addToLocalStorage('fiscal_saved_companies', companyClean);
        if (locationClean) addToLocalStorage('fiscal_saved_locations', locationClean);

        alert('Nota fiscal atualizada com sucesso.');
        fetchNotes();
        fetchAutocompleteData();
    }
  }, [fetchNotes, fetchAutocompleteData, notes]);

  const handleToggleStatus = useCallback(async (id: string) => {
    const noteToToggle = notes.find(n => n.id === id);
    if (!noteToToggle) return;

    const newStatus = noteToToggle.status === 'Pendente' ? 'Entregue' : 'Pendente';
    const { error } = await supabase.from('fiscal_notes').update({ status: newStatus }).eq('id', id);
    if (error) {
        alert(`Erro ao alterar status: ${error.message}`);
    } else {
        fetchNotes();
    }
  }, [notes, fetchNotes]);

  const handleToggleClientDelivered = useCallback(async (id: string) => {
    const noteToToggle = notes.find(n => n.id === id);
    if (!noteToToggle) return;

    const newClientDelivered = !noteToToggle.client_delivered;
    const { error } = await supabase.from('fiscal_notes').update({ client_delivered: newClientDelivered }).eq('id', id);
    
    if (error) {
        alert(`Erro ao alterar status de entrega ao cliente: ${error.message}`);
    } else {
        fetchNotes();
    }
  }, [notes, fetchNotes]);

  // Selection Logic
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedNotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const handleToggleSelectAll = useCallback((selectAll: boolean) => {
    if (selectAll) {
      const allIds = filteredNotes.map(n => n.id);
      setSelectedNotes(new Set(allIds));
    } else {
      setSelectedNotes(new Set());
    }
  }, [filteredNotes]);

  // PDF Generation Logic
  const handleGeneratePDF = useCallback(() => {
    if (selectedNotes.size === 0) {
      alert("Selecione pelo menos uma nota para gerar o PDF.");
      return;
    }

    const notesToPrint = notes.filter(n => selectedNotes.has(n.id));
    const doc = new jsPDF();

    // Configurações visuais
    const primaryColor = [2, 132, 199]; // sky-600 equivalent
    const titleFontSize = 18;
    const subtitleFontSize = 10;
    
    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(titleFontSize);
    doc.setTextColor(40, 40, 40);
    doc.text("Relatório de Notas Fiscais", 14, 20);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(subtitleFontSize);
    doc.setTextColor(100, 100, 100);
    const dateStr = new Date().toLocaleDateString('pt-BR');
    doc.text(`Gerado em: ${dateStr}`, 14, 26);
    doc.text(`Total de itens: ${notesToPrint.length}`, 14, 31);

    // Linha divisória
    doc.setDrawColor(200, 200, 200);
    doc.line(14, 35, 196, 35);

    // Formatar data para a tabela
    const formatTableDate = (dateString: string) => {
        if (!dateString) return '-';
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    };

    // Tabela
    const tableData = notesToPrint.map(note => [
      note.company,
      formatTableDate(note.shipping_date),
      note.nf_number,
      note.status,
      note.client_delivered ? 'SIM' : 'NÃO',
      note.delivery_location
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Empresa', 'Data Carreg.', 'Nº NF', 'Status', 'Entregue Cliente', 'Local de Entrega']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: primaryColor as any,
        textColor: 255,
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 8,
        textColor: 50
      },
      columnStyles: {
        0: { cellWidth: 'auto' }, // Empresa
        1: { halign: 'center' }, // Data
        2: { halign: 'center' }, // NF
        3: { halign: 'center', fontStyle: 'bold' }, // Status
        4: { halign: 'center', fontStyle: 'bold' }, // Entregue Cliente
        5: { cellWidth: 'auto' } // Local
      },
      alternateRowStyles: {
        fillColor: [245, 250, 255]
      },
      didParseCell: function(data) {
        // Customizar cor do texto do status
        if (data.section === 'body') {
            if (data.column.index === 3) {
                if (data.cell.raw === 'Entregue') {
                    data.cell.styles.textColor = [16, 185, 129]; // Emerald
                } else {
                    data.cell.styles.textColor = [217, 119, 6]; // Amber
                }
            }
            if (data.column.index === 4) {
                 if (data.cell.raw === 'SIM') {
                    data.cell.styles.textColor = [13, 148, 136]; // Teal
                } else {
                    data.cell.styles.textColor = [156, 163, 175]; // Gray
                }
            }
        }
      }
    });

    // Footer (Opcional)
    const pageCount = (doc as any).internal.getNumberOfPages();
    doc.setFontSize(8);
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text('Sistema de Lançamentos de Viagens', 14, doc.internal.pageSize.height - 10);
        doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 25, doc.internal.pageSize.height - 10);
    }

    doc.save(`Relatorio_Notas_${dateStr.replace(/\//g, '-')}.pdf`);

  }, [selectedNotes, notes]);
  
  return (
    <div className="flex flex-col h-full">
      <header className="bg-white/80 backdrop-blur-lg border-b border-slate-200 sticky top-0 z-30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-slate-800">Controle de Notas Fiscais</h1>
            <div className="flex items-center gap-2">
                {selectedNotes.size > 0 && (
                    <>
                        <span className="hidden sm:inline text-sm text-slate-500 mr-2">
                            {selectedNotes.size} selecionada(s)
                        </span>
                        <Button
                            onClick={handleDeleteSelected}
                            variant="danger"
                            size="sm"
                            className="flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            Excluir Selecionados
                        </Button>
                    </>
                )}
                <Button 
                    onClick={handleGeneratePDF} 
                    disabled={selectedNotes.size === 0}
                    variant={selectedNotes.size > 0 ? 'primary' : 'secondary'}
                    size="sm"
                    className="flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
                    </svg>
                    Gerar PDF
                </Button>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-[98%] mx-auto space-y-6">
          <Card>
            <CardContent className="p-4 flex flex-col md:flex-row gap-4">
                 <div className="w-full md:w-48">
                     <Select label="Filtrar por Status" id="filter-status" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                         <option value="Todos">Todos</option>
                         <option value="Pendente">Pendentes</option>
                         <option value="Entregue">Entregues</option>
                     </Select>
                 </div>
                 <div className="w-full md:w-48">
                     <Select label="Entregue ao Cliente" id="filter-client" value={filterClientDelivered} onChange={e => setFilterClientDelivered(e.target.value)}>
                         <option value="Todos">Todos</option>
                         <option value="Sim">Sim</option>
                         <option value="Não">Não</option>
                     </Select>
                 </div>
                 <div className="w-full md:flex-1">
                    <Input 
                        label="Pesquisar Nº NF" 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        placeholder="Digite o número da nota..." 
                    />
                 </div>
            </CardContent>
          </Card>

          <FiscalNoteForm
            newNote={newNote}
            setNewNote={setNewNote}
            onAddNote={handleAddNote}
            savedCompanies={savedCompanies}
            savedLocations={savedLocations}
            onXmlUpload={handleXmlUpload}
            isProcessingXml={isProcessingXml}
            onZipUpload={handleZipUpload}
            isProcessingZip={isProcessingZip}
            zipProgress={zipProgress}
          />
          <FiscalNotesTable
            notes={filteredNotes}
            selectedNotes={selectedNotes}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            onToggleStatus={handleToggleStatus}
            onToggleClientDelivered={handleToggleClientDelivered}
            onEdit={setEditingNote}
          />
        </div>
      </main>
      {editingNote && (
        <EditFiscalNoteModal
          note={editingNote}
          onClose={() => setEditingNote(null)}
          onSave={(updatedNote) => {
            handleUpdateNote(updatedNote);
            setEditingNote(null);
          }}
          savedCompanies={savedCompanies}
          savedLocations={savedLocations}
        />
      )}
    </div>
  );
};
