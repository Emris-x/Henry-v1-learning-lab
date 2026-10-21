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
  const defaultModel = Deno.env.get("HENRY_AI_MODEL") || "openrouter/free";
  const plannerModel = Deno.env.get("HENRY_PLANNER_MODEL") || defaultModel;
  const reviewerModel = Deno.env.get("HENRY_REVIEWER_MODEL") || defaultModel;
  const synthesizerModel = Deno.env.get("HENRY_SYNTHESIZER_MODEL") || defaultModel;
  const callModel = async (chat: Array<{role:string;content:string}>, selectedModel=defaultModel, maxTokens=900) => {
    const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify({ model: selectedModel, messages: chat, temperature: 0.5, max_tokens: maxTokens }) });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(res.status === 429 ? "The free AI provider is busy or its free quota is exhausted. Wait and try again." : "The AI provider could not complete the request. Check the key or try again shortly.");
      (error as any).status = res.status;
      console.error("OpenRouter request failed", res.status, payload?.error?.message || "");
      throw error;
    }
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new Error("The AI provider returned an empty response.");
    return content.trim();
  };

  const latestUser = messages[messages.length - 1].content;
  const recent = messages.slice(-8);
  const runReviewPipeline = async () => {
    const plannerPrompt = `Generate 3-5 genuinely different solution directions or interpretations for this task, not paraphrases. Include useful assumptions and trade-offs. Be concise. Task: ${latestUser}`;
    const [candidateText] = await Promise.all([
      callModel([{ role: "system", content: systemPrompt }, ...recent.slice(0,-1), { role: "user", content: plannerPrompt }], plannerModel, 850)
    ]);
    const reviewText = await callModel([
      { role: "system", content: systemPrompt + " Act as an independent skeptical reviewer. Do not agree just to be agreeable." },
      { role: "user", content: `User task: ${latestUser}\nReview the following options. Identify missing approaches, invalid assumptions, edge cases, contradictions, and what can be verified.\nOptions:\n${candidateText}` }
    ], 650);
    const finalPrompt = `Answer the user's latest message. Treat candidates as brainstorming material, not unquestionable facts. Incorporate the review, remove duplicates, correct errors, explain key trade-offs, and state uncertainty. Do not expose hidden chain-of-thought; give a concise summary of alternatives and checks where useful.\nCANDIDATES:\n${candidateText}\nINDEPENDENT REVIEW:\n${reviewText}\n\nReturn the final user-facing answer.`;
    const reply = await callModel([{ role: "system", content: systemPrompt }, ...recent.slice(0,-1), { role: "user", content: finalPrompt }], synthesizerModel, 1200);
    return { reply, pipeline: "three-pass" };
  };

  const simpleReply = async () => ({
    reply: await callModel([{ role: "system", content: systemPrompt }, ...messages], defaultModel, 1200),
    pipeline: "single-pass-fallback",
  });

  try {
    const complex = latestUser.length > 220 || /design|architect|build|debug|compare|possibilit|algorithm|calculate|proof|plan|specification|lock it in|code|error|why|how can|alternatives|options/.test(latestUser.toLowerCase());
    let result: { reply: string; pipeline: string };
    if (complex) {
      try { result = await runReviewPipeline(); }
      catch (pipelineError) {
        console.error("Henry review pipeline failed; falling back to one pass.", String(pipelineError));
        result = await simpleReply();
      }
    } else result = await simpleReply();
    return json({ reply: result.reply, pipeline: result.pipeline });
  } catch (error) {
    const status = (error as any)?.status === 429 ? 429 : 502;
    return json({ error: error instanceof Error ? error.message : "Henry could not reach the AI provider. Try again shortly." }, status);
  }
});
