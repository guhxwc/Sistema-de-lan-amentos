
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { FiscalNote } from '../../types';
import { supabase, getDistinctValues } from '../../lib/supabaseClient';
import { FiscalNoteForm } from '../fiscalNotes/FiscalNoteForm';
import { FiscalNotesTable } from '../fiscalNotes/FiscalNotesTable';
import { EditFiscalNoteModal } from '../fiscalNotes/EditFiscalNoteModal';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { Select } from '../ui/Select';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { GoogleGenAI, Type } from "@google/genai";
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

  const [filterStatus, setFilterStatus] = useState('Todos');
  const [filterClientDelivered, setFilterClientDelivered] = useState('Todos');

  const fetchNotes = useCallback(async () => {
    const { data, error } = await supabase
      .from('fiscal_notes')
      .select('*')
      .order('shipping_date', { ascending: false })
      .order('created_at', { ascending: false }); 
    if (error) {
      alert(`Erro ao buscar notas: ${error.message}`);
    } else {
      setNotes(data || []);
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
        
        const localCompanies = JSON.parse(localStorage.getItem('fiscal_saved_companies') || '[]');
        const localLocations = JSON.parse(localStorage.getItem('fiscal_saved_locations') || '[]');

        const uniqueCompanies = Array.from(new Set([...companies, ...localCompanies])).sort();
        const uniqueLocations = Array.from(new Set([...locations, ...localLocations])).sort();

        setSavedCompanies(uniqueCompanies);
        setSavedLocations(uniqueLocations);

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

        return matchesStatus && matchesClientDelivered;
    });
  }, [notes, filterStatus, filterClientDelivered]);

  const extractDataFromXml = async (xmlContent: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `Atue como especialista em XML fiscal. Retorne um JSON com as chaves: "company", "nf_number", "delivery_location", "shipping_date".
      
      Regras:
      1. company: Remetente do CT-e (<rem><xNome>) ou Emitente da NF-e (<emit><xNome>).
      2. delivery_location: Recebedor (<receb><xNome>) ou Destinatário (<dest><xNome>). NOME, não cidade.
      3. nf_number: Apenas o número da NF (sem série, sem zeros a esquerda). Em CT-e procure na chave de acesso (<infNFe>).
      4. shipping_date: Emissão (<dhEmi>) AAAA-MM-DD.
      
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
         errorMessage = "Limite de uso da IA excedido. Aguarde alguns instantes.";
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

        for (let i = 0; i < xmlFiles.length; i++) {
            setZipProgress(`Processando ${i + 1}/${xmlFiles.length}...`);
            try {
                if (i > 0) await new Promise(r => setTimeout(r, 1000));
                
                const data = await extractDataFromXml(xmlFiles[i]);
                if (data && data.company && data.nf_number) {
                     const cleanNfNumber = data.nf_number.replace(/^0+/, '');

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
                        status: 'Pendente',
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
        
        setNotes(prev => prev.filter(note => !selectedNotes.has(note.id)));
        setSelectedNotes(new Set()); 
        
        await fetchNotes();
        await fetchAutocompleteData();
      } catch (error: any) {
        console.error("Erro ao excluir notas:", error);
        alert(`Erro ao excluir notas: ${error.message}`);
      }
    }
  };
  
  const handleUpdateNote = useCallback(async (updatedNote: FiscalNote) => {
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

  const handleGeneratePDF = useCallback(() => {
    if (selectedNotes.size === 0) {
      alert("Selecione pelo menos uma nota para gerar o PDF.");
      return;
    }

    const notesToPrint = notes.filter(n => selectedNotes.has(n.id));
    const doc = new jsPDF();

    const primaryColor = [2, 132, 199]; 
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text("Relatório de Notas Fiscais", 14, 20);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const dateStr = new Date().toLocaleDateString('pt-BR');
    doc.text(`Gerado em: ${dateStr}`, 14, 26);
    doc.text(`Total de itens: ${notesToPrint.length}`, 14, 31);

    doc.setDrawColor(200, 200, 200);
    doc.line(14, 35, 196, 35);

    const formatTableDate = (dateString: string) => {
        if (!dateString) return '-';
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    };

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
        0: { cellWidth: 'auto' }, 
        1: { halign: 'center' }, 
        2: { halign: 'center' }, 
        3: { halign: 'center', fontStyle: 'bold' }, 
        4: { halign: 'center', fontStyle: 'bold' }, 
        5: { cellWidth: 'auto' } 
      },
      alternateRowStyles: {
        fillColor: [245, 250, 255]
      },
      didParseCell: function(data) {
        if (data.section === 'body') {
            if (data.column.index === 3) {
                if (data.cell.raw === 'Entregue') {
                    data.cell.styles.textColor = [16, 185, 129]; 
                } else {
                    data.cell.styles.textColor = [217, 119, 6]; 
                }
            }
            if (data.column.index === 4) {
                 if (data.cell.raw === 'SIM') {
                    data.cell.styles.textColor = [13, 148, 136]; 
                } else {
                    data.cell.styles.textColor = [156, 163, 175]; 
                }
            }
        }
      }
    });

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
            <CardContent className="p-4 flex flex-col sm:flex-row gap-4">
                 <div className="w-full sm:w-48">
                     <Select label="Filtrar por Status" id="filter-status" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                         <option value="Todos">Todos</option>
                         <option value="Pendente">Pendentes</option>
                         <option value="Entregue">Entregues</option>
                     </Select>
                 </div>
                 <div className="w-full sm:w-48">
                     <Select label="Entregue ao Cliente" id="filter-client" value={filterClientDelivered} onChange={e => setFilterClientDelivered(e.target.value)}>
                         <option value="Todos">Todos</option>
                         <option value="Sim">Sim</option>
                         <option value="Não">Não</option>
                     </Select>
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
