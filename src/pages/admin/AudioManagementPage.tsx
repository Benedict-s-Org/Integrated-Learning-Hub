import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAudioManagement, AudioFile } from '@/hooks/useAudioManagement';
import { resolveAudioUrl } from '@/utils/voiceManager';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Search, Trash2, RefreshCw, Filter, FileAudio, ExternalLink, MousePointer2, PlayCircle, Folder, CheckCircle2, AlertCircle, ChevronLeft, Wrench } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const AudioManagementPage: React.FC = () => {
  const { files, loading, fetchAudioData, deleteFiles } = useAudioManagement();
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<AudioFile['type'] | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<AudioFile['status'] | 'all'>('all');
  const [isRepairing, setIsRepairing] = useState(false);

  // Drag selection state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ x: number, y: number } | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    fetchAudioData();
  }, [fetchAudioData]);

  const filteredFiles = useMemo(() => {
    return files.filter(f => {
      const matchesSearch = f.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           f.linkedKey?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || f.type === filterType;
      const matchesStatus = filterStatus === 'all' || f.status === filterStatus;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [files, searchTerm, filterType, filterStatus]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (selectedIds.size === filteredFiles.length && filteredFiles.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredFiles.map(f => f.id)));
    }
  };

  const selectOrphans = () => {
    const orphans = files.filter(f => f.status === 'orphaned').map(f => f.id);
    setSelectedIds(new Set(orphans));
    setFilterStatus('orphaned'); // Automatically filter to show them
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedIds.size} files?`)) {
      await deleteFiles(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  const repairPhonicsLinks = async () => {
    if (!confirm("This will scan for Base64 audio links and try to reconnect them to Drive files. Proceed?")) return;
    setIsRepairing(true);
    try {
      const { data: mappings } = await (supabase as any).from('phonics_mappings').select('*');
      if (!mappings) return;

      const base64Mappings = mappings.filter((m: any) => m.audio_url?.startsWith('data:'));
      if (base64Mappings.length === 0) {
        alert("No Base64 links found to repair.");
        return;
      }

      let repairedCount = 0;
      for (const mapping of base64Mappings) {
        // Match by phoneme text or by searching for the file ID in the cache
        const match = files.find(f => f.linkedKey === mapping.phoneme);
        if (match) {
          const driveUrl = `https://drive.google.com/uc?export=download&id=${match.id}`;
          await (supabase as any).from('phonics_mappings').update({ audio_url: driveUrl }).eq('id', mapping.id);
          repairedCount++;
        }
      }

      alert(`Successfully repaired ${repairedCount} / ${base64Mappings.length} phonics links!`);
      fetchAudioData();
    } catch (err) {
      console.error("Repair failed:", err);
      alert("Repair failed. Check console.");
    } finally {
      setIsRepairing(false);
    }
  };

  // Selection Box Logic
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, input, a')) return;
    
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragEnd({ x: e.clientX, y: e.clientY });
    
    if (!e.shiftKey) {
        setSelectedIds(new Set());
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setDragEnd({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    if (!isDragging || !dragStart || !dragEnd || !tableRef.current) {
        setIsDragging(false);
        return;
    }

    const rect = {
      left: Math.min(dragStart.x, dragEnd.x),
      top: Math.min(dragStart.y, dragEnd.y),
      right: Math.max(dragStart.x, dragEnd.x),
      bottom: Math.max(dragStart.y, dragEnd.y)
    };

    const newSelection = new Set(selectedIds);
    const rows = tableRef.current.querySelectorAll('tr[data-id]');
    
    rows.forEach(row => {
      const rowRect = row.getBoundingClientRect();
      const isIntersecting = !(
        rowRect.left > rect.right ||
        rowRect.right < rect.left ||
        rowRect.top > rect.bottom ||
        rowRect.bottom < rect.top
      );

      if (isIntersecting) {
        const id = row.getAttribute('data-id');
        if (id) newSelection.add(id);
      }
    });

    setSelectedIds(newSelection);
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  };

  return (
    <div className="p-6 bg-slate-50 h-full overflow-y-auto font-sans" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-2">
            <button 
              onClick={() => navigate('/admin')}
              className="flex items-center gap-1 text-slate-500 hover:text-indigo-600 transition-colors text-sm font-bold w-fit group"
            >
              <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
              Back to Admin
            </button>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200">
                <FileAudio className="text-white" size={24} />
              </div>
              Audio Repository
            </h1>
            <p className="text-slate-500 font-medium">Manage, link, and optimize your system audio assets.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
                variant="secondary" 
                onClick={repairPhonicsLinks} 
                disabled={isRepairing || loading}
                className="hover:bg-indigo-50 hover:text-indigo-700 transition-all border-indigo-200 text-indigo-600"
            >
              <Wrench className={`mr-2 h-4 w-4 ${isRepairing ? 'animate-spin' : ''}`} />
              Repair Links
            </Button>
            <Button 
                variant="secondary" 
                onClick={selectOrphans} 
                disabled={loading}
                className="hover:bg-amber-50 hover:text-amber-700 transition-all border-amber-200 text-amber-600"
            >
              <Filter className="mr-2 h-4 w-4" />
              Select Orphans
            </Button>
            <Button 
                variant="secondary" 
                onClick={() => fetchAudioData()} 
                disabled={loading}
                className="hover:bg-slate-100 transition-all border-slate-200"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Sync Drive
            </Button>
            <Button 
                variant="danger" 
                onClick={handleDelete} 
                disabled={selectedIds.size === 0 || loading}
                className="shadow-md hover:shadow-lg transition-all"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete ({selectedIds.size})
            </Button>
          </div>
        </div>

        {/* Filters Card */}
        <Card className="border-none shadow-sm overflow-hidden bg-white/80 backdrop-blur-md p-4 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[240px]">
            <Input 
              icon={<Search size={18} />}
              placeholder="Search by file name or phoneme..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-50 border-slate-200 focus:bg-white"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-500" />
            <select 
              className="bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
            >
              <option value="all">All Types</option>
              <option value="phonics">Phonics</option>
              <option value="spelling">Spelling</option>
              <option value="cache">General TTS</option>
              <option value="unknown">Unidentified</option>
            </select>
            
            <select 
              className="bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
            >
              <option value="all">All States</option>
              <option value="linked">Linked</option>
              <option value="unlinked">Unlinked</option>
              <option value="orphaned">Orphaned</option>
            </select>
          </div>
        </Card>

        {/* Table Container */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden relative select-none">
          <div 
            className="overflow-x-auto min-h-[400px]"
            onMouseDown={handleMouseDown}
          >
            <table ref={tableRef} className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-indigo-50/50 border-b border-indigo-100 uppercase text-xs tracking-wider text-slate-500 font-bold">
                  <th className="px-6 py-4 w-12 text-center">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      checked={selectedIds.size === filteredFiles.length && filteredFiles.length > 0}
                      onChange={selectAll}
                    />
                  </th>
                  <th className="px-6 py-4">File Name</th>
                  <th className="px-6 py-4">Location</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Mapped To</th>
                  <th className="px-6 py-4">Created</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && files.length === 0 ? (
                    <tr>
                        <td colSpan={6} className="py-20 text-center">
                            <div className="flex flex-col items-center gap-2">
                                <RefreshCw className="animate-spin text-indigo-500" size={32} />
                                <span className="text-slate-500 font-medium tracking-tight">Scanning Drive hierarchy...</span>
                            </div>
                        </td>
                    </tr>
                ) : filteredFiles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-2">
                          <Search className="text-slate-300" size={48} />
                          <span className="text-slate-500 font-medium tracking-tight">No audio files found matching your criteria.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredFiles.map((file) => (
                    <tr 
                      key={file.id} 
                      data-id={file.id}
                      className={`group hover:bg-slate-50 transition-colors cursor-default ${selectedIds.has(file.id) ? 'bg-indigo-50/70 hover:bg-indigo-50/90' : ''}`}
                    >
                      <td className="px-6 py-4 text-center">
                        <input 
                          type="checkbox" 
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                          checked={selectedIds.has(file.id)}
                          onChange={() => toggleSelect(file.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col max-w-xs overflow-hidden">
                          <span className="font-semibold text-slate-900 truncate" title={file.name}>{file.name}</span>
                          <span className="text-xs text-slate-400 font-mono">ID: {file.id.substring(0, 8)}...</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-tight">
                          <Folder size={12} className="text-slate-400" />
                          <span className="truncate max-w-[120px]">{file.folderName || 'Root'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={`
                          ${file.type === 'phonics' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 
                            file.type === 'spelling' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' :
                            file.type === 'cache' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' :
                            'bg-slate-100 text-slate-700'} capitalize border-none font-bold text-[10px]
                        `}>
                          {file.type}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          {file.linkedKey ? (
                              <div className="flex items-center gap-2">
                                <span className={`font-bold text-sm tracking-tight ${file.status === 'linked' ? 'text-slate-900' : 'text-slate-400'}`}>
                                  {file.linkedKey}
                                </span>
                                {file.status === 'linked' ? (
                                  <div className="flex items-center gap-1 text-[#059669] bg-[#ecfdf5] px-1.5 py-0.5 rounded text-[10px] font-bold border border-[#a7f3d0]">
                                    <CheckCircle2 size={10} />
                                    ACTIVE
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-[#d97706] bg-[#fffbeb] px-1.5 py-0.5 rounded text-[10px] font-bold border border-[#fef3c7]">
                                    <AlertCircle size={10} />
                                    CACHE
                                  </div>
                                )}
                              </div>
                          ) : (
                              <span className="text-slate-400 italic text-xs">No mapping found</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-sm">
                        {file.createdTime ? new Date(file.createdTime).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center gap-3">
                            <a 
                                href={file.driveUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-full transition-colors bg-white shadow-sm"
                                title="Open in Drive"
                            >
                                <ExternalLink size={16} />
                            </a>
                            <button 
                                onClick={async () => {
                                  const playableUrl = await resolveAudioUrl(file.driveUrl);
                                  const audio = new Audio(playableUrl);
                                  audio.play();
                                }}
                                className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-full transition-colors bg-white shadow-sm"
                                title="Preview Audio"
                            >
                                <PlayCircle size={18} />
                            </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Selection Tooltip */}
          {selectedIds.size > 0 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300 ring-4 ring-indigo-500/20">
                <span className="font-semibold">{selectedIds.size} files selected</span>
                <div className="h-4 w-px bg-white/20" />
                <button 
                    className="text-indigo-400 hover:text-indigo-300 text-sm font-bold transition-colors"
                    onClick={() => setSelectedIds(new Set())}
                >
                    Clear Selection
                </button>
            </div>
          )}

          {/* Drag Overlay */}
          {isDragging && dragStart && dragEnd && (
            <div 
              style={{
                position: 'fixed',
                left: Math.min(dragStart.x, dragEnd.x),
                top: Math.min(dragStart.y, dragEnd.y),
                width: Math.abs(dragStart.x - dragEnd.x),
                height: Math.abs(dragStart.y - dragEnd.y),
                backgroundColor: 'rgba(79, 70, 229, 0.15)',
                border: '2px solid rgba(79, 70, 229, 0.5)',
                borderRadius: '6px',
                pointerEvents: 'none',
                zIndex: 9999,
                boxShadow: '0 0 15px rgba(79, 70, 229, 0.2)'
              }}
            />
          )}
        </div>
        
        {/* Footer info */}
        <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase tracking-widest px-2">
            <div className="flex items-center gap-4">
                <span className="flex items-center gap-1"><MousePointer2 size={12} /> Click & Drag to batch select</span>
                <span>•</span>
                <span>Inventory: {files.length} audio assets</span>
            </div>
            <span>Google Cloud Integrated Storage System</span>
        </div>
      </div>
    </div>
  );
};

export default AudioManagementPage;
