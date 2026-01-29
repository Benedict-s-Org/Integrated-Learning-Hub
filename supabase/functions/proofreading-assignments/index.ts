import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AssignRequest {
  practiceId: string;
  userIds: string[];
  assignedBy: string;
}

interface ListRequest {
  practiceId: string;
  adminUserId: string;
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
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const url = new URL(req.url);
    const path = url.pathname;

    if (path.endsWith("/assign")) {
      const { practiceId, userIds, assignedBy }: AssignRequest = await req.json();

      const { data: admin, error: adminError } = await supabase
        .from("users")
        .select("role")
        .eq("id", assignedBy)
        .maybeSingle();

      if (adminError || !admin || admin.role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Unauthorized: Admin access required" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const insertData = userIds.map(userId => ({
        practice_id: practiceId,
        user_id: userId,
        assigned_by: assignedBy,
      }));

      const { error: insertError } = await supabase
        .from("proofreading_practice_assignments")
        .insert(insertData);

      if (insertError) {
        console.error("Error assigning practice:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to assign practice", details: insertError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ success: true, assignedCount: userIds.length }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path.endsWith("/list")) {
      const { practiceId, adminUserId }: ListRequest = await req.json();

      const { data: admin, error: adminError } = await supabase
        .from("users")
        .select("role")
        .eq("id", adminUserId)
        .maybeSingle();

      if (adminError || !admin || admin.role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Unauthorized: Admin access required" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: assignments, error } = await supabase
        .from("proofreading_practice_assignments")
        .select("user_id")
        .eq("practice_id", practiceId);

      if (error) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch assignments" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ assignments }),
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
    console.error("Error in proofreading-assignments function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});