import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ProofreadRequest {
  sentences: string[];
}

interface ProofreadResult {
  lineNumber: number;
  wordIndex: number;
  correction: string;
  originalWord: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { sentences }: ProofreadRequest = await req.json();

    if (!sentences || !Array.isArray(sentences) || sentences.length === 0) {
      return new Response(
        JSON.stringify({ error: "Invalid input: sentences array is required" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const deepseekApiKey = Deno.env.get("DEEPSEEK_API_KEY");
    if (!deepseekApiKey) {
      return new Response(
        JSON.stringify({ error: "DeepSeek API key not configured" }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const prompt = `You are a proofreading expert. Analyze the following sentences and identify ONE grammatical error in each sentence (if present). For each sentence, provide:
1. The word index (0-based position) of the incorrect word
2. The correct version of that word

Sentences:
${sentences.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Respond ONLY with a JSON array in this exact format:
[
  {"lineNumber": 0, "wordIndex": 2, "correction": "doesn't", "originalWord": "don't"},
  {"lineNumber": 1, "wordIndex": 1, "correction": "goes", "originalWord": "go"}
]

If a sentence has no errors, omit it from the array. Only include the word itself, not punctuation.`;

    const deepseekResponse = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${deepseekApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "You are a grammar correction expert. Always respond with valid JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!deepseekResponse.ok) {
      const errorText = await deepseekResponse.text();
      console.error("DeepSeek API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to process with AI", details: errorText }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const deepseekData = await deepseekResponse.json();
    const aiResponse = deepseekData.choices[0]?.message?.content || "[]";
    
    let results: ProofreadResult[];
    try {
      const cleanedResponse = aiResponse.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "");
      results = JSON.parse(cleanedResponse);
    } catch (e) {
      console.error("Failed to parse AI response:", aiResponse);
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response", details: aiResponse }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({ results }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error in ai-proofread function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});