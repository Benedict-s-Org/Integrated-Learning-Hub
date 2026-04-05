import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AudioFile {
  id: string;
  name: string;
  size?: number;
  createdTime?: string;
  parents?: string[];
  folderName?: string;
  type: 'phonics' | 'spelling' | 'cache' | 'unknown';
  linkedKey?: string; // Phoneme or Word
  linkedId?: string;  // Database ID
  status: 'linked' | 'unlinked' | 'orphaned';
  driveUrl: string;
}

export const useAudioManagement = () => {
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAudioData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Drive Files
      const { data: driveData, error: driveError } = await supabase.functions.invoke('google-tts', {
        body: { action: 'list' }
      });

      if (driveError) throw driveError;
      const driveFiles = driveData.files || [];

      // 2. Fetch Supabase Data
      const [cacheRes, phonicsRes, spellingRes] = await Promise.all([
        (supabase.from('tts_cache' as any) as any).select('*'),
        (supabase.from('phonics_mappings' as any) as any).select('id, phoneme, audio_url'),
        (supabase.from('spelling_practices' as any) as any).select('words')
      ]);

      if (cacheRes.error) throw cacheRes.error;
      if (phonicsRes.error) throw phonicsRes.error;
      if (spellingRes.error) throw spellingRes.error;

      // Prepare lookup maps
      const cacheMap = new Map((cacheRes.data as any[]).map(c => [c.drive_file_id, c]));
      
      // Map Drive IDs to Phonics records
      const phonicsIdMap = new Map();
      // Map Phoneme text to Phonics records (fallback for files generated but not uniquely linked yet)
      const phonemeMap = new Map();
      
      (phonicsRes.data as any[]).forEach(p => {
        if (p.audio_url) {
          const match = p.audio_url.match(/id=([^&]+)/);
          if (match) {
            phonicsIdMap.set(match[1], p);
          } else if (p.audio_url.startsWith('data:')) {
            // Keep Base64 fallback for existing records during migration
            phonemeMap.set(p.phoneme, p);
          }
        }
      });

      const activeSpellingWords = new Set<string>();
      (spellingRes.data as any[]).forEach(s => {
        if (s.words) {
          s.words.forEach((w: string) => {
            if (w) activeSpellingWords.add(w.toLowerCase().trim());
          });
        }
      });

      // 3. Merge
      const merged: AudioFile[] = driveFiles.map((df: any) => {
        const cacheEntry = cacheMap.get(df.id);
        
        // Priority 1: Direct link by Drive File ID in the phonics table
        // Priority 2: Fallback to matching phoneme text from cache
        const phonicsEntry = phonicsIdMap.get(df.id) || (cacheEntry ? phonemeMap.get(cacheEntry.text) : null);

        let type: AudioFile['type'] = 'unknown';
        let linkedKey = '';
        let linkedId = '';
        let status: AudioFile['status'] = 'unlinked';

        if (phonicsEntry) {
          type = 'phonics';
          linkedKey = phonicsEntry.phoneme;
          linkedId = phonicsEntry.id;
          status = 'linked';
        } else if (cacheEntry) {
          const text = cacheEntry.text || '';
          const isSpellingValue = !text.includes(' ');
          type = isSpellingValue ? 'spelling' : 'cache';
          linkedKey = text;
          
          // A spelling word is ONLY "linked" if it's in an active practice list
          const isActuallyInUse = isSpellingValue ? activeSpellingWords.has(text.toLowerCase().trim()) : false;
          status = isActuallyInUse ? 'linked' : 'orphaned';
        }

        return {
          id: df.id,
          name: df.name,
          size: df.size,
          createdTime: df.createdTime,
          parents: df.parents,
          folderName: df.folderName,
          type,
          linkedKey,
          linkedId,
          status,
          driveUrl: `https://drive.google.com/uc?export=download&id=${df.id}`
        };
      });

      setFiles(merged);
    } catch (error: any) {
      console.error('Fetch error:', error);
      alert('Error fetching audio: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteFiles = useCallback(async (fileIds: string[]) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-tts', {
        body: { action: 'delete_multiple', fileIds }
      });

      if (error) throw error;
      
      // Log the full response for debugging
      console.log('🗑️ Delete response:', JSON.stringify(data, null, 2));

      // Update linked phonics_mappings to null for successful deletions
      const successfulIds = data.results?.filter((r: any) => r.success).map((r: any) => r.id) || [];
      
      for (const id of successfulIds) {
        const file = files.find(f => f.id === id);
        if (file?.type === 'phonics' && file.linkedId) {
          await (supabase
            .from('phonics_mappings' as any) as any)
            .update({ audio_url: null })
            .eq('id', file.linkedId);
        }
      }

      // Immediately remove successfully-deleted files from local state
      if (successfulIds.length > 0) {
        setFiles(prev => prev.filter(f => !successfulIds.includes(f.id)));
      }

      // Build detailed result message
      const methods = data.results?.map((r: any) => `${r.id.substring(0,8)}: ${r.success ? '✅' : '❌'} ${r.method || 'unknown'}${r.stillExists ? ' (STILL EXISTS!)' : ''}`).join('\n') || '';
      
      if (data.failedCount === 0) {
        alert(`✅ Deleted ${data.deletedCount} files.\n\nDetails:\n${methods}`);
      } else {
        alert(`⚠️ ${data.deletedCount} ok, ${data.failedCount} FAILED, ${data.stillExistCount} still exist on Drive.\n\nDetails:\n${methods}`);
      }

      // Re-fetch after a delay
      setTimeout(() => fetchAudioData(), 2000);
      
    } catch (error: any) {
      console.error('Delete error:', error);
      alert('❌ Deletion failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [files, fetchAudioData]);

  return { files, loading, fetchAudioData, deleteFiles };
};
