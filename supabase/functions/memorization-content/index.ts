import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateContentRequest {
  title: string;
  originalText: string;
  selectedWordIndices: number[];
  userId: string;
}

interface DeleteContentRequest {
  contentId: string;
  userId: string;
}

interface PublishContentRequest {
  contentId: string;
  userId: string;
}

interface ListContentsRequest {
  userId: string;
}

const MAX_TITLE_LENGTH = 200;
const MAX_TEXT_LENGTH = 50000;
const MAX_SELECTED_INDICES = 10000;

function validateCreateRequest(req: CreateContentRequest): string | null {
  if (!req.title || typeof req.title !== 'string') {
    return 'Title is required';
  }

  if (req.title.trim().length === 0) {
    return 'Title cannot be empty';
  }

  if (req.title.length > MAX_TITLE_LENGTH) {
    return `Title cannot exceed ${MAX_TITLE_LENGTH} characters`;
  }

  if (!req.originalText || typeof req.originalText !== 'string') {
    return 'Original text is required';
  }

  if (req.originalText.trim().length === 0) {
    return 'Text content cannot be empty';
  }

  if (req.originalText.length > MAX_TEXT_LENGTH) {
    return `Text content cannot exceed ${MAX_TEXT_LENGTH} characters`;
  }

  if (!Array.isArray(req.selectedWordIndices)) {
    return 'Selected word indices must be an array';
  }

  if (req.selectedWordIndices.length === 0) {
    return 'At least one word must be selected';
  }

  if (req.selectedWordIndices.length > MAX_SELECTED_INDICES) {
    return `Cannot select more than ${MAX_SELECTED_INDICES} words`;
  }

  if (!req.selectedWordIndices.every(idx => typeof idx === 'number' && idx >= 0)) {
    return 'Selected word indices must be non-negative numbers';
  }

  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing environment variables:", {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey
      });
      return new Response(
        JSON.stringify({
          error: "Server configuration error: Missing required environment variables",
          details: "SUPABASE_SERVICE_ROLE_KEY must be configured in edge function secrets"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const path = url.pathname;

    if (path.endsWith("/create")) {
      const requestData: CreateContentRequest = await req.json();

      const validationError = validateCreateRequest(requestData);
      if (validationError) {
        return new Response(
          JSON.stringify({ error: validationError }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: user, error: userError } = await supabase
        .from("users")
        .select("id, role")
        .eq("id", requestData.userId)
        .maybeSingle();

      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: "User not found or unauthorized" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (user.role !== 'admin') {
        const { data: countData, error: countError } = await supabase
          .rpc('get_user_saved_contents_count', { user_uuid: requestData.userId });

        if (countError) {
          console.error("Error checking save count:", countError);
          return new Response(
            JSON.stringify({ error: "Failed to verify save limit" }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const currentCount = countData || 0;
        const limit = 3;

        if (currentCount >= limit) {
          return new Response(
            JSON.stringify({
              error: `Save limit reached. You can only save up to ${limit} memorization practices. Please delete an existing practice to save a new one.`,
              currentCount,
              limit
            }),
            {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      const { data: content, error: insertError } = await supabase
        .from("saved_contents")
        .insert({
          user_id: requestData.userId,
          title: requestData.title.trim(),
          original_text: requestData.originalText,
          selected_word_indices: requestData.selectedWordIndices,
          is_published: false,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error creating content:", insertError);
        return new Response(
          JSON.stringify({
            error: "Failed to save content",
            details: insertError.message
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          content: {
            id: content.id,
            title: content.title,
            originalText: content.original_text,
            selectedWordIndices: content.selected_word_indices,
            createdAt: content.created_at,
            isPublished: content.is_published,
            publicId: content.public_id,
          }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path.endsWith("/list")) {
      const { userId }: ListContentsRequest = await req.json();

      const { data: user, error: userError } = await supabase
        .from("users")
        .select("id, role")
        .eq("id", userId)
        .maybeSingle();

      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: "User not found or unauthorized" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: contents, error: fetchError } = await supabase
        .from("saved_contents")
        .select("id, title, original_text, selected_word_indices, created_at, is_published, public_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("Error fetching contents:", fetchError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch saved contents" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const formattedContents = contents?.map((item: any) => ({
        id: item.id,
        title: item.title,
        originalText: item.original_text,
        selectedWordIndices: item.selected_word_indices,
        createdAt: item.created_at,
        isPublished: item.is_published,
        publicId: item.public_id,
      })) || [];

      const currentCount = formattedContents.length;
      const limit = user.role === 'admin' ? null : 3;

      return new Response(
        JSON.stringify({
          contents: formattedContents,
          currentCount,
          limit,
          isAdmin: user.role === 'admin'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path.endsWith("/delete")) {
      const { contentId, userId }: DeleteContentRequest = await req.json();

      if (!contentId || !userId) {
        return new Response(
          JSON.stringify({ error: "Content ID and User ID are required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { error: deleteError } = await supabase
        .from("saved_contents")
        .delete()
        .eq("id", contentId)
        .eq("user_id", userId);

      if (deleteError) {
        console.error("Error deleting content:", deleteError);
        return new Response(
          JSON.stringify({ error: "Failed to delete content" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path.endsWith("/publish")) {
      const { contentId, userId }: PublishContentRequest = await req.json();

      if (!contentId || !userId) {
        return new Response(
          JSON.stringify({ error: "Content ID and User ID are required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const publicId = crypto.randomUUID();

      const { error: updateError } = await supabase
        .from("saved_contents")
        .update({
          is_published: true,
          public_id: publicId,
        })
        .eq("id", contentId)
        .eq("user_id", userId);

      if (updateError) {
        console.error("Error publishing content:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to publish content" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ success: true, publicId }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in memorization-content function:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
