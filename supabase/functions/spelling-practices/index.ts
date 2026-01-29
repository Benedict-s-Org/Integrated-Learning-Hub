import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreatePracticeRequest {
  title: string;
  words: string[];
  userId: string;
}

interface DeletePracticeRequest {
  practiceId: string;
  userId: string;
}

interface ListPracticesRequest {
  userId: string;
}

interface UpdateAssignmentsRequest {
  practiceId: string;
  userId: string;
  userIds: string[];
}

interface GetAssignmentsRequest {
  practiceId: string;
  userId: string;
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
      const { title, words, userId }: CreatePracticeRequest = await req.json();

      const { data: user, error: userError } = await supabase
        .from("users")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: "User not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (user.role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Only admins can create practices" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: practice, error: insertError } = await supabase
        .from("spelling_practices")
        .insert({
          title,
          words,
          created_by: userId,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error creating practice:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to create practice", details: insertError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ success: true, practice }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path.endsWith("/list")) {
      const { userId }: ListPracticesRequest = await req.json();

      const { data: user, error: userError } = await supabase
        .from("users")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: "User not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      let practices;
      if (user.role === "admin") {
        const { data, error } = await supabase
          .from("spelling_practices")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          return new Response(
            JSON.stringify({ error: "Failed to fetch practices" }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        practices = data;
      } else {
        const { data, error } = await supabase
          .from("practice_assignments")
          .select("id, practice_id, spelling_practices(*)")
          .eq("user_id", userId);

        if (error) {
          return new Response(
            JSON.stringify({ error: "Failed to fetch practices" }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        practices = data?.map((item: any) => ({
          ...item.spelling_practices,
          assignment_id: item.id
        })) || [];
      }

      const practicesWithCounts = await Promise.all(
        practices.map(async (practice: any) => {
          const { count } = await supabase
            .from("practice_assignments")
            .select("*", { count: "exact", head: true })
            .eq("practice_id", practice.id);

          return {
            ...practice,
            assignment_count: count || 0,
          };
        })
      );

      return new Response(
        JSON.stringify({ practices: practicesWithCounts }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path.endsWith("/delete")) {
      const { practiceId, userId }: DeletePracticeRequest = await req.json();

      const { data: user, error: userError } = await supabase
        .from("users")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: "User not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (user.role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Only admins can delete practices" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { error: deleteError } = await supabase
        .from("spelling_practices")
        .delete()
        .eq("id", practiceId);

      if (deleteError) {
        console.error("Error deleting practice:", deleteError);
        return new Response(
          JSON.stringify({ error: "Failed to delete practice" }),
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

    if (path.endsWith("/get-assignments")) {
      const { practiceId, userId }: GetAssignmentsRequest = await req.json();

      const { data: user, error: userError } = await supabase
        .from("users")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: "User not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (user.role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Only admins can view assignments" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: assignments, error: fetchError } = await supabase
        .from("practice_assignments")
        .select("user_id")
        .eq("practice_id", practiceId);

      if (fetchError) {
        console.error("Error fetching assignments:", fetchError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch assignments" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          assignments: assignments?.map((a) => a.user_id) || []
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path.endsWith("/update-assignments")) {
      const { practiceId, userId, userIds }: UpdateAssignmentsRequest = await req.json();

      const { data: user, error: userError } = await supabase
        .from("users")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: "User not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (user.role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Only admins can update assignments" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: existingAssignments, error: fetchError } = await supabase
        .from("practice_assignments")
        .select("user_id")
        .eq("practice_id", practiceId);

      if (fetchError) {
        console.error("Error fetching assignments:", fetchError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch current assignments" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const existingUserIds = new Set(existingAssignments?.map((a) => a.user_id) || []);
      const newUserIds = new Set(userIds);

      const usersToAdd = userIds.filter((id) => !existingUserIds.has(id));
      const usersToRemove = Array.from(existingUserIds).filter((id) => !newUserIds.has(id));

      if (usersToRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from("practice_assignments")
          .delete()
          .eq("practice_id", practiceId)
          .in("user_id", usersToRemove);

        if (deleteError) {
          console.error("Error removing assignments:", deleteError);
          return new Response(
            JSON.stringify({ error: "Failed to remove assignments", details: deleteError.message }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      if (usersToAdd.length > 0) {
        const { error: insertError } = await supabase
          .from("practice_assignments")
          .insert(
            usersToAdd.map((assignedUserId) => ({
              practice_id: practiceId,
              user_id: assignedUserId,
              assigned_by: userId,
            }))
          );

        if (insertError) {
          console.error("Error adding assignments:", insertError);
          return new Response(
            JSON.stringify({ error: "Failed to add assignments", details: insertError.message }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          added: usersToAdd.length,
          removed: usersToRemove.length
        }),
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
    console.error("Error in spelling-practices function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
