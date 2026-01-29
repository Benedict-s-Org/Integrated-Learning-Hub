import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppContextType, SavedContent, MemorizationState, SpellingPracticeList, ProofreadingPractice, ProofreadingAnswer } from '../types';
import { supabase } from '../lib/supabase';
import { processText } from '../utils/textProcessor';

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: React.ReactNode;
  userId?: string;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children, userId }) => {
  const [savedContents, setSavedContents] = useState<SavedContent[]>([]);
  const [spellingLists, setSpellingLists] = useState<SpellingPracticeList[]>([]);
  const [proofreadingPractices, setProofreadingPractices] = useState<ProofreadingPractice[]>([]);
  const [currentContent, setCurrentContent] = useState<MemorizationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveLimit, setSaveLimit] = useState<number | null>(null);
  const [currentSaveCount, setCurrentSaveCount] = useState<number>(0);

  // Load saved contents from Supabase on mount
  useEffect(() => {
    const fetchSavedContents = async () => {
      if (!userId) {
        setLoading(false);
        setSaveLimit(null);
        setCurrentSaveCount(0);
        return;
      }

      try {
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/memorization-content/list`;

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        });

        const responseData = await response.json();

        if (!response.ok) {
          console.error('Error fetching saved contents:', responseData.error);
        } else {
          const formattedData = responseData.contents.map((item: any) => ({
            id: item.id,
            title: item.title,
            originalText: item.originalText,
            selectedWordIndices: item.selectedWordIndices,
            createdAt: new Date(item.createdAt),
            isPublished: item.isPublished || false,
            publicId: item.publicId || null,
          }));
          setSavedContents(formattedData);
          setSaveLimit(responseData.limit);
          setCurrentSaveCount(responseData.currentCount);
        }
      } catch (error) {
        console.error('Failed to fetch saved contents:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSavedContents();
  }, [userId]);

  useEffect(() => {
    const fetchSpellingLists = async () => {
      if (!userId) {
        return;
      }

      try {
        const { data, error } = await supabase
          .from('spelling_practice_lists')
          .select('id, user_id, title, words, created_at, updated_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching spelling lists:', error);
        } else {
          const formattedData = data.map((item: any) => ({
            id: item.id,
            userId: item.user_id,
            title: item.title,
            words: item.words,
            createdAt: new Date(item.created_at),
            updatedAt: new Date(item.updated_at),
          }));
          setSpellingLists(formattedData);
        }
      } catch (error) {
        console.error('Failed to fetch spelling lists:', error);
      }
    };

    fetchSpellingLists();
  }, [userId]);

  useEffect(() => {
    const fetchProofreadingPractices = async () => {
      if (!userId) {
        setProofreadingPractices([]);
        return;
      }

      try {
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proofreading-practices/list`;

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        });

        const data = await response.json();

        if (!response.ok) {
          console.error('Error fetching proofreading practices:', data.error);
          setProofreadingPractices([]);
        } else {
          const formattedData = data.practices.map((item: any) => ({
            id: item.id,
            user_id: item.user_id,
            title: item.title,
            sentences: item.sentences,
            answers: item.answers,
            created_at: item.created_at,
            updated_at: item.updated_at,
          }));
          setProofreadingPractices(formattedData);
        }
      } catch (error) {
        console.error('Failed to fetch proofreading practices:', error);
        setProofreadingPractices([]);
      }
    };

    fetchProofreadingPractices();
  }, [userId]);

  const addSavedContent = async (content: Omit<SavedContent, 'id' | 'createdAt'>): Promise<boolean> => {
    if (!userId) {
      console.error('User not authenticated');
      return false;
    }

    try {
      const { data, error } = await supabase
        .from('saved_contents')
        .insert([{
          user_id: userId,
          title: content.title,
          original_text: content.originalText,
          selected_word_indices: content.selectedWordIndices,
          is_published: false,
        }])
        .select()
        .single();

      if (error) {
        console.error('Error adding saved content:', error);
        return false;
      }

      const newContent: SavedContent = {
        id: data.id,
        title: data.title,
        originalText: data.original_text,
        selectedWordIndices: data.selected_word_indices,
        createdAt: new Date(data.created_at),
        isPublished: data.is_published || false,
        publicId: data.public_id || null,
      };

      setSavedContents(prev => [newContent, ...prev]);
      setCurrentSaveCount(prev => prev + 1);
      return true;
    } catch (error) {
      console.error('Failed to add saved content:', error);
      return false;
    }
  };

  const deleteSavedContent = async (id: string): Promise<void> => {
    if (!userId) {
      console.error('User not authenticated');
      return;
    }

    try {
      const { error } = await supabase
        .from('saved_contents')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error('Error deleting saved content:', error);
        return;
      }

      setSavedContents(prev => prev.filter(content => content.id !== id));
      setCurrentSaveCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to delete saved content:', error);
    }
  };

  const publishSavedContent = async (id: string): Promise<string | null> => {
    if (!userId) {
      console.error('User not authenticated');
      return null;
    }

    try {
      const publicId = crypto.randomUUID();

      const { error } = await supabase
        .from('saved_contents')
        .update({
          is_published: true,
          public_id: publicId
        })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error('Error publishing content:', error);
        return null;
      }

      // Update local state
      setSavedContents(prev => 
        prev.map(content => 
          content.id === id 
            ? { ...content, isPublished: true, publicId }
            : content
        )
      );

      return publicId;
    } catch (error) {
      console.error('Failed to publish content:', error);
      return null;
    }
  };

  const fetchPublicContent = async (publicId: string): Promise<MemorizationState | null> => {
    try {
      const { data, error } = await supabase
        .from('saved_contents')
        .select('original_text, selected_word_indices')
        .eq('public_id', publicId)
        .eq('is_published', true)
        .single();

      if (error || !data) {
        console.error('Error fetching public content:', error);
        return null;
      }

      const words = processText(data.original_text);
      const wordsWithSelection = words.map(word => ({
        ...word,
        isMemorized: data.selected_word_indices.includes(word.index)
      }));

      return {
        originalText: data.original_text,
        words: wordsWithSelection,
        selectedWordIndices: data.selected_word_indices,
        hiddenWords: new Set(data.selected_word_indices),
      };
    } catch (error) {
      console.error('Failed to fetch public content:', error);
      return null;
    }
  };

  const addSpellingList = async (title: string, words: string[]): Promise<boolean> => {
    if (!userId) {
      console.error('User not authenticated');
      return false;
    }

    try {
      const { data, error } = await supabase
        .from('spelling_practice_lists')
        .insert([{
          user_id: userId,
          title,
          words,
        }])
        .select()
        .single();

      if (error) {
        console.error('Error adding spelling list:', error);
        return false;
      }

      const newList: SpellingPracticeList = {
        id: data.id,
        userId: data.user_id,
        title: data.title,
        words: data.words,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };

      setSpellingLists(prev => [newList, ...prev]);
      return true;
    } catch (error) {
      console.error('Failed to add spelling list:', error);
      return false;
    }
  };

  const deleteSpellingList = async (id: string): Promise<void> => {
    if (!userId) {
      console.error('User not authenticated');
      return;
    }

    try {
      const { error } = await supabase
        .from('spelling_practice_lists')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error('Error deleting spelling list:', error);
        return;
      }

      setSpellingLists(prev => prev.filter(list => list.id !== id));
    } catch (error) {
      console.error('Failed to delete spelling list:', error);
    }
  };

  const addProofreadingPractice = async (title: string, sentences: string[], answers: ProofreadingAnswer[]): Promise<boolean> => {
    if (!userId) {
      console.error('User not authenticated');
      return false;
    }

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proofreading-practices/create`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          sentences,
          answers,
          userId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Error adding proofreading practice:', data.error);
        return false;
      }

      const newPractice: ProofreadingPractice = {
        id: data.practice.id,
        user_id: data.practice.user_id,
        title: data.practice.title,
        sentences: data.practice.sentences,
        answers: data.practice.answers,
        created_at: data.practice.created_at,
        updated_at: data.practice.updated_at,
      };

      setProofreadingPractices(prev => [newPractice, ...prev]);
      return true;
    } catch (error) {
      console.error('Failed to add proofreading practice:', error);
      return false;
    }
  };

  const deleteProofreadingPractice = async (id: string): Promise<void> => {
    if (!userId) {
      console.error('User not authenticated');
      return;
    }

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proofreading-practices/delete`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          practiceId: id,
          userId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Error deleting proofreading practice:', data.error);
        return;
      }

      setProofreadingPractices(prev => prev.filter(practice => practice.id !== id));
    } catch (error) {
      console.error('Failed to delete proofreading practice:', error);
    }
  };

  const value: AppContextType = {
    savedContents,
    addSavedContent,
    deleteSavedContent,
    publishSavedContent,
    fetchPublicContent,
    currentContent,
    setCurrentContent,
    loading,
    spellingLists,
    addSpellingList,
    deleteSpellingList,
    saveLimit,
    currentSaveCount,
    proofreadingPractices,
    addProofreadingPractice,
    deleteProofreadingPractice,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};