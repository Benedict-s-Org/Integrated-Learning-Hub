import { supabase } from "@/lib/supabase"; // adjust if your supabase client is located elsewhere

export interface NotionQuestion {
  questionPageUrl: string;
  questionId: string;
  letters: string;
  validAnswers: string[];
  tier: string;
  length: number;
}

export interface RunPayload {
  runId: string;
  participantId: string;
  taskVersion: string;
  startedAt: string;
  finishedAt?: string;
  totalDurationMs: number;
  completed: boolean;
  calibrationPredSec: number;
  calibrationActualSec: number;
  easyPredSec: number;
  easyActualSec: number;
  hardPredSec: number;
  hardActualSec: number;
  deviceBrowser?: string;
  notes?: string;
  responses: ResponsePayload[];
}

export interface ResponsePayload {
  responseId: string;
  questionId: string; // The Notion page ID of the Question in Question Bank
  questionPageUrl?: string;
  block: string;
  position: number;
  lettersShown: string;
  wordLength: number;
  answerTyped: string;
  isCorrect: boolean;
  skipped: boolean;
  attempts: number;
  timeTakenMs: number;
  submittedAt?: string;
  validAnswersSnapshot: string;
}

/**
 * Fetch questions from the Notion Question Bank via Edge Function
 */
export async function fetchQuestions(tier: string = "Hard", limit: number = 200, active: boolean = true): Promise<NotionQuestion[]> {
  try {
    // Standardize on Direct Fetch for better control and reliability over Content-Negotiation (406 errors)
    const functionUrl = import.meta.env.VITE_SUPABASE_URL + '/functions/v1/anagram-notion';
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!functionUrl || !anonKey) {
        console.error("Supabase environment variables are missing.");
        return [];
    }

    const params = new URLSearchParams({
      action: "questions",
      tier: tier,
      active: String(active),
      limit: String(limit)
    });

    const res = await fetch(`${functionUrl}?${params.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${anonKey}`,
      }
    });
    
    if (!res.ok) {
        if (res.status === 404) {
            console.error("404: Notion Edge Function 'anagram-notion' not found. Please deploy it.");
        }
        throw new Error(`Failed to fetch questions: ${res.status} ${res.statusText}`);
    }
    return await res.json();
  } catch (error) {
    console.warn("Retrying Notion fetch through standard invoke...");
    // Fallback if direct fetch is blocked by CORS or other issues
    try {
        const { data, error: invokeError } = await (supabase.functions.invoke("anagram-notion", {
            method: 'GET',
            queryParams: { action: "questions", tier, active: String(active), limit: String(limit) }
        }) as any);
        if (invokeError) throw invokeError;
        return data || [];
    } catch (finalErr) {
        console.error("All Fetch Methods Failed:", finalErr);
        return [];
    }
  }
}

/**
 * Post a Run and its Responses to Notion via Edge Function
 */
export async function postRun(payload: RunPayload) {
  try {
    const functionUrl = import.meta.env.VITE_SUPABASE_URL + '/functions/v1/anagram-notion';
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!functionUrl || !anonKey) throw new Error("Supabase config missing");

    const res = await fetch(`${functionUrl}?action=run`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to post run: ${res.status} ${errorText}`);
    }

    const data = await res.json();
    console.log("Notion Log Success:", data);
    return data;
  } catch (error) {
    console.error("Error posting run to Notion:", error);
    throw error;
  }
}

/**
 * Setup relations in Notion DB (Admin only)
 */
export async function setupNotionRelations() {
  try {
    const functionUrl = import.meta.env.VITE_SUPABASE_URL + '/functions/v1/anagram-notion';
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    const res = await fetch(`${functionUrl}?action=setup-relations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) throw new Error(`Setup failed: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error("Error setting up relations:", error);
    throw error;
  }
}
