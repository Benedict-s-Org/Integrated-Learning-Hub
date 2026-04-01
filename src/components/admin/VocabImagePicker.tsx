import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Image as ImageIcon, Search, Download, CheckCircle2, Check, X, RefreshCw, Layers } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface ImageCandidate {
  source: string;
  thumbUrl: string;
  sourcePageUrl: string;
  downloadUrl: string;
  licenseTag: string;
}

interface VocabItem {
  id: string;
  word: string;
  sense: string;
  status: 'pending' | 'searching' | 'ready' | 'selected' | 'no_result';
  candidates: ImageCandidate[];
  selectedIndex: number;
}

export const VocabImagePicker: React.FC = () => {
  const { session } = useAuth();
  const [inputText, setInputText] = useState('');
  const [items, setItems] = useState<VocabItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleParseInput = () => {
    const lines = inputText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const parsedItems: VocabItem[] = lines.map(line => {
      const parts = line.split('|');
      return {
        id: crypto.randomUUID(),
        word: parts[0].trim(),
        sense: parts.length > 1 ? parts[1].trim() : '',
        status: 'pending',
        candidates: [],
        selectedIndex: -1
      };
    });
    setItems(parsedItems);
  };

  const getFunctionHeaders = () => {
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    return {
      'Authorization': `Bearer ${session?.access_token || anonKey}`,
      'apikey': anonKey,
      'Content-Type': 'application/json'
    };
  };

  const getFunctionUrl = () => {
    return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-search`;
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const searchSingleItem = async (queryWord: string, sense: string): Promise<{ candidates: ImageCandidate[], error?: string }> => {
    const query = sense ? `${queryWord} ${sense}` : queryWord;
    
    try {
      const res = await fetch(getFunctionUrl(), {
        method: 'POST',
        headers: getFunctionHeaders(),
        body: JSON.stringify({ action: 'search', query, limit: 5 })
      });
      
      if (!res.ok) {
        let errorMsg = `HTTP Error ${res.status}`;
        try {
          const errorData = await res.json();
          if (errorData.error) errorMsg = errorData.error;
        } catch {}
        return { candidates: [], error: errorMsg };
      }
      
      const data = await res.json();
      if (data.success && data.candidates) {
        return { candidates: data.candidates };
      }
      return { candidates: [], error: 'Unexpected response format' };
    } catch (err: any) {
      console.error(err);
      return { candidates: [], error: err.message || 'Network error' };
    }
  };

  const handleSearchAll = async () => {
    setIsProcessing(true);
    setProgress(0);
    setError(null);
    
    const updatedItems = [...items];
    
    for (let i = 0; i < updatedItems.length; i++) {
      if (updatedItems[i].status === 'selected') continue;
      
      updatedItems[i].status = 'searching';
      setItems([...updatedItems]);
      
      const { candidates, error: searchError } = await searchSingleItem(updatedItems[i].word, updatedItems[i].sense);
      
      updatedItems[i].candidates = candidates;
      updatedItems[i].status = candidates.length > 0 ? 'ready' : 'no_result';
      
      if (searchError && !error) {
        setError(`Search Error for "${updatedItems[i].word}": ${searchError}`);
      }

      setItems([...updatedItems]);
      setProgress(((i + 1) / updatedItems.length) * 100);
      await delay(500);
    }
    
    setIsProcessing(false);
  };

  const handleAutoPick = () => {
    const updatedItems = items.map(item => {
      if ((item.status === 'ready' || item.status === 'selected') && item.candidates.length > 0) {
        return {
          ...item,
          status: 'selected' as const,
          selectedIndex: item.selectedIndex >= 0 ? item.selectedIndex : 0
        };
      }
      return item;
    });
    setItems(updatedItems);
  };

  const handleSelectImage = (itemId: string, candidateIndex: number) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          selectedIndex: candidateIndex,
          status: 'selected'
        };
      }
      return item;
    }));
  };

  const getProxyBlob = async (url: string): Promise<Blob> => {
    const res = await fetch(getFunctionUrl(), {
      method: 'POST',
      headers: getFunctionHeaders(),
      body: JSON.stringify({ action: 'proxy', url })
    });
    
    if (!res.ok) throw new Error(`Proxy failed: ${res.statusText}`);
    return await res.blob();
  };

  const getAudioAndUpload = async (word: string, accent: string = 'en-GB'): Promise<{ blob: Blob, fileName: string }> => {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-tts`, {
      method: 'POST',
      headers: getFunctionHeaders(),
      body: JSON.stringify({ text: word, accent })
    });
    
    if (!res.ok) throw new Error(`Audio fetch failed: ${res.statusText}`);
    const data = await res.json();
    
    const binary = atob(data.audioContent);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'audio/mpeg' });
    
    return { blob, fileName: data.fileName };
  };

  const handleDownloadZip = async () => {
    const selectedItems = items.filter(i => i.status === 'selected' && i.selectedIndex >= 0);
    if (selectedItems.length === 0) {
      setError('No images selected to download');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setError(null);
    
    try {
      const zip = new JSZip();
      const imagesFolder = zip.folder('images');
      const audioFolder = zip.folder('audio');
      if (!imagesFolder || !audioFolder) throw new Error('Could not create folders in ZIP');
      
      const selectionsData = [];
      const csvRows = [["Word", "Sense", "Image Filename", "Audio Filename", "Source", "License"]];

      for (let i = 0; i < selectedItems.length; i++) {
        const item = selectedItems[i];
        const candidate = item.candidates[item.selectedIndex];
        
        try {
          const imgBlob = await getProxyBlob(candidate.downloadUrl);
          let ext = 'jpg';
          if (imgBlob.type === 'image/png') ext = 'png';
          else if (imgBlob.type === 'image/webp') ext = 'webp';
          
          const safeWord = item.word.replace(/[^a-z0-9]/gi, '_').toLowerCase();
          const imgFileName = `${safeWord}_${i + 1}.${ext}`;
          imagesFolder.file(imgFileName, imgBlob);

          const { blob: audioBlob, fileName: audioFileName } = await getAudioAndUpload(item.word);
          audioFolder.file(audioFileName, audioBlob);

          selectionsData.push({
            word: item.word,
            sense: item.sense,
            imageFile: imgFileName,
            audioFile: audioFileName,
            sourcePageUrl: candidate.sourcePageUrl,
            licenseTag: candidate.licenseTag,
            source: candidate.source
          });

          csvRows.push([item.word, item.sense, imgFileName, audioFileName, candidate.source, candidate.licenseTag]);
        } catch (err) {
          console.error(`Failed to process ${item.word}:`, err);
        }
        
        setProgress(((i + 1) / selectedItems.length) * 100);
      }
      
      zip.file('manifest.json', JSON.stringify(selectionsData, null, 2));
      const csvContent = csvRows.map(row => row.map(cell => `"${(cell || "").toString().replace(/"/g, '""')}"`).join(',')).join('\n');
      zip.file('index.csv', csvContent);
      
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `vocab_export_${Date.now()}.zip`);
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate ZIP');
    } finally {
      setIsProcessing(false);
      setProgress(100);
    }
  };

  const completedCount = items.filter(i => i.status === 'selected').length;

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-8 font-sans pb-32">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
              <ImageIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Vocab Image Picker</h1>
              <p className="text-slate-500 text-sm">Find license-safe (CC0/PD) images for vocabulary lists</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <h2 className="text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wider">Vocab List Input</h2>
          <p className="text-xs text-slate-500 mb-4">One word per line. Format: <code className="bg-slate-100 px-1 py-0.5 rounded">word | optional sense</code></p>
          
          <textarea
            className="w-full h-40 p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition font-medium text-slate-700 mb-4"
            placeholder="apple | fruit&#10;bank | building&#10;bank | river edge"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          
          <div className="flex gap-3">
            <button
              onClick={handleParseInput}
              disabled={inputText.trim() === '' || isProcessing}
              className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-xl transition disabled:opacity-50"
            >
              Parse List
            </button>
            
            {items.length > 0 && (
              <>
                <button
                  onClick={handleSearchAll}
                  disabled={isProcessing}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition flex items-center gap-2 disabled:opacity-50"
                >
                  <Search className="w-4 h-4" />
                  Search All
                </button>
                
                <button
                  onClick={handleAutoPick}
                  disabled={isProcessing}
                  className="px-6 py-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-medium rounded-xl transition flex items-center gap-2 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Auto-pick #1
                </button>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 flex justify-between items-center">
            <p>{error}</p>
            <button onClick={() => setError(null)}><X className="w-5 h-5"/></button>
          </div>
        )}

        {isProcessing && progress > 0 && (
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between text-sm mb-2 text-slate-600">
              <span>Processing...</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-blue-600 h-full transition-all duration-300 ease-in-out" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}

        {items.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="text-sm font-medium text-slate-600">
                <span className="text-green-600 font-bold">{completedCount}</span> selected / {items.length} total
              </div>
              
              <button
                onClick={handleDownloadZip}
                disabled={isProcessing || completedCount === 0}
                className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition flex items-center gap-2 disabled:opacity-50 shadow-sm grow-0 shrink-0"
              >
                <Download className="w-4 h-4" />
                Download ZIP
              </button>
            </div>

            {items.map((item, rowIdx) => (
              <div key={item.id} className={`bg-white rounded-2xl p-5 shadow-sm border transition-colors ${item.status === 'selected' ? 'border-green-300 bg-green-50/10' : 'border-slate-200'} `}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-500 rounded-lg text-sm font-bold">
                      {rowIdx + 1}
                    </span>
                    <h3 className="text-xl font-bold font-serif text-slate-800">{item.word}</h3>
                    {item.sense && (
                      <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
                        {item.sense}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    {item.status === 'pending' && <span className="px-3 py-1 bg-slate-100 text-slate-500 text-xs font-medium rounded-full">Pending</span>}
                    {item.status === 'searching' && <span className="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-medium rounded-full flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin"/> Searching</span>}
                    {item.status === 'ready' && <span className="px-3 py-1 bg-amber-50 text-amber-600 text-xs font-medium rounded-full">Needs Selection</span>}
                    {item.status === 'no_result' && <span className="px-3 py-1 bg-red-50 text-red-600 text-xs font-medium rounded-full">No results</span>}
                    {item.status === 'selected' && <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1"><Check className="w-3 h-3"/> Selected</span>}
                  </div>
                </div>

                {item.candidates.length > 0 && (
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    {item.candidates.map((cand, candIdx) => {
                      const isSelected = item.selectedIndex === candIdx;
                      return (
                        <div 
                          key={candIdx} 
                          onClick={() => handleSelectImage(item.id, candIdx)}
                          className={`
                            relative flex flex-col rounded-xl overflow-hidden cursor-pointer border-2 transition-all
                            ${isSelected ? 'border-green-500 ring-4 ring-green-500/20' : 'border-slate-100 hover:border-blue-300 hover:shadow-md'}
                          `}
                        >
                          <div className="aspect-square bg-slate-50 relative group">
                            <img 
                              src={cand.thumbUrl} 
                              alt={`Candidate ${candIdx + 1}`}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                              <span className="self-end px-2 py-0.5 bg-black/60 text-white text-[10px] font-bold rounded uppercase tracking-wider">
                                {cand.licenseTag}
                              </span>
                              <div className="flex items-center gap-1 text-white text-xs truncate">
                                <Layers className="w-3 h-3 shrink-0"/>
                                <span className="truncate">{cand.source}</span>
                              </div>
                            </div>
                            
                            {isSelected && (
                              <div className="absolute top-2 right-2 bg-green-500 text-white p-1 rounded-full shadow-lg">
                                <Check className="w-4 h-4"/>
                              </div>
                            )}
                          </div>
                          
                          <div className="p-2 bg-white flex flex-col gap-1">
                            <button 
                              onClick={(e) => { e.stopPropagation(); window.open(cand.sourcePageUrl, '_blank'); }}
                              className="text-[10px] text-blue-600 hover:underline truncate text-left w-full"
                            >
                              View Original
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
