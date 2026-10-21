import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type ChatMessage = { role: "user" | "assistant"; content: string };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const authHeader = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const apiKey = Deno.env.get("HENRY_AI_API_KEY");
  if (!authHeader || !supabaseUrl || !supabaseAnonKey) return json({ error: "Please sign in to use Henry." }, 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: "Your session is not valid. Please sign in again." }, 401);
  if (!apiKey) return json({ error: "Henry's AI provider key is not configured. Add HENRY_AI_API_KEY to Supabase Edge Function secrets." }, 503);

  let input: any;
  try { input = await req.json(); } catch { return json({ error: "Invalid request body." }, 400); }
  const title = String(input?.project?.title || "Untitled project").slice(0, 100);
  const goal = String(input?.project?.goal || "").slice(0, 2000);
  const mode = ["Explore", "Teach", "Build"].includes(input?.mode) ? input.mode : "Explore";
  const experience = ["beginner", "intermediate", "expert"].includes(input?.experienceLevel) ? input.experienceLevel : "beginner";
  const rawMessages = Array.isArray(input?.messages) ? input.messages.slice(-16) : [];
  const messages: ChatMessage[] = rawMessages
    .filter((m: any) => ["user", "assistant"].includes(m?.role) && typeof m?.content === "string")
    .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 6000) }))
    .filter((m) => m.content.trim());
  if (!messages.length || messages[messages.length - 1].role !== "user") return json({ error: "Send a message to start the conversation." }, 400);

  const experienceGuide = experience === "beginner"
    ? "Explain terminology plainly, establish fundamentals, and give manageable steps without being patronizing."
    : experience === "intermediate"
    ? "Balance practical implementation with explanations of concepts and trade-offs."
    : "Use precise technical language, discuss architecture and trade-offs, and avoid explaining basics unless needed.";

  const systemPrompt = `You are Henry (Human Expression Networked into Reality), an engineering companion helping people turn ideas into reality while learning. Be collaborative, creative, and technically careful. Never claim you ran code, browsed the web, edited files, or deployed anything unless a tool actually did so. Ask a focused question if a missing requirement would change the answer. ${experienceGuide}
Project: ${title}
Project brief: ${goal || "No project brief provided yet."}
Mode: ${mode}. ${mode === "Explore" ? "Clarify the idea, intended users, constraints, assumptions, success criteria, and genuinely different approaches. Do not force a specification too early." : mode === "Teach" ? "Teach the concepts step by step, define terminology, use concrete examples, and check understanding." : "Help implement, plan, write code, debug, review tests, and explain trade-offs. Clearly distinguish suggested code from code actually executed."}
Reasoning standard: Do not stop at the first plausible answer. Consider multiple materially different approaches, state assumptions, identify edge cases and counterexamples, and synthesize the strongest valid answer. For math or other exactly-checkable claims, calculate or verify carefully; never invent a count when the allowed search space is undefined. Keep the final answer clear rather than exposing private internal chain-of-thought. Summarize useful alternatives and checks, not hidden deliberation.
If the user says "Lock it in", draft a structured specification using only decisions actually agreed; mark unresolved questions. `;

  const endpoint = "https://openrouter.ai/api/v1/chat/completions";
  const headers = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://henry-v1-learning-lab.vercel.app",
    "X-Title": "Henry Engineering Intelligence",
  };

  // Prefer a concrete free model so routing behaviour is predictable.
  // Override with HENRY_AI_MODEL if a different verified model is selected.
  const primaryModel = Deno.env.get("HENRY_AI_MODEL") || "openai/gpt-oss-20b:free";
  const fallbackModel = Deno.env.get("HENRY_AI_FALLBACK_MODEL") || "openrouter/free";

  const callModel = async (chat: Array<{role:string;content:string}>, selectedModel: string, maxTokens=1000) => {
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ model: selectedModel, messages: chat, temperature: 0.5, max_tokens: maxTokens }),
        signal: AbortSignal.timeout(45000),
      });
    } catch (networkError) {
      console.error("OpenRouter network request failed", String(networkError));
      throw new Error("Henry could not reach OpenRouter. Check connectivity and try again.");
    }

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const providerMessage = String(payload?.error?.message || "").slice(0, 300);
      console.error("OpenRouter request failed", res.status, providerMessage);
      const error = new Error(
        res.status === 401 || res.status === 403
          ? "The AI provider rejected its API key. Check the HENRY_AI_API_KEY secret."
          : res.status === 429
          ? "The free AI provider is busy or its quota is exhausted. Wait a moment and try again."
          : `The AI provider returned HTTP ${res.status}.${providerMessage ? " " + providerMessage : ""}`
      );
      (error as any).status = res.status;
      throw error;
    }

    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      console.error("OpenRouter returned no text", JSON.stringify({
        model: selectedModel,
        finish_reason: payload?.choices?.[0]?.finish_reason,
        response_id: payload?.id,
        has_choices: Array.isArray(payload?.choices),
      }));
      throw new Error("The AI provider returned no text. Try again or switch the configured free model.");
    }
    return content.trim();
  };

  const chatMessages = [{ role: "system", content: systemPrompt }, ...messages];
  try {
    let reply: string;
    let modelUsed = primaryModel;
    try {
      reply = await callModel(chatMessages, primaryModel, 1200);
    } catch (primaryError) {
      // Retry via OpenRouter's free-model router only when the primary model fails.
      console.error("Henry primary model failed; trying free router.", String(primaryError));
      modelUsed = fallbackModel;
      reply = await callModel(chatMessages, fallbackModel, 1200);
    }
    return json({ reply, pipeline: "single-pass", model: modelUsed });
  } catch (error) {
    const rawStatus = (error as any)?.status;
    const status = rawStatus === 429 ? 429 : rawStatus === 401 || rawStatus === 403 ? 502 : 502;
    const message = error instanceof Error ? error.message : "Henry could not reach the AI provider. Try again shortly.";
    console.error("Henry AI request failed", message);
    return json({ error: message }, status);
  }
});
