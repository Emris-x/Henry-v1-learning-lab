# Henry Cognitive Engine — Diversity, Critique, and Verification

Status: design for Henry V1; not yet connected to the deployed chat endpoint.

## Goal

Make Henry explore more than the first plausible answer without pretending that extra wording equals extra intelligence. The engine should deliberately generate alternatives, inspect assumptions, test claims, and then present a grounded synthesis.

## Three-model workflow through OpenRouter

1. **Planner / Divergent thinker** — turns the user's request into a precise task, identifies missing constraints, and generates materially different approaches. For open-ended prompts, aim for 3–5 distinct candidates rather than paraphrases.
2. **Reviewer / Skeptic** — independently reviews the candidates, finds hidden assumptions, counterexamples, missing cases, contradictions, safety issues, and unsupported claims. It may propose a better candidate.
3. **Synthesizer / Engineer** — combines the strongest compatible ideas, explains trade-offs, removes duplication, and returns one coherent answer with uncertainty and limitations stated.

Each model call receives the project brief, recent conversation, mode, experience level, and a role-specific prompt. Keep provider/model IDs configurable server-side; do not hardcode a paid model or assume any free model is always available. If one model fails, degrade gracefully and disclose that the full review pipeline was unavailable rather than claiming all three ran.

## Core algorithm

```text
function HENRY_REASON(request, projectContext, conversation, mode, level):
    task = FRAME(request, projectContext, conversation)
    if task is ambiguous in a way that changes the answer:
        ask one focused clarification OR state the chosen assumptions

    candidates = MODEL_1.generate(
        task,
        instruction = "Generate diverse approaches; do not stop at the first obvious answer"
    )

    review = MODEL_2.review(
        task,
        candidates,
        instruction = "Find counterexamples, missing cases, false assumptions, and verification needs"
    )

    if task requires arithmetic, code execution, dates, unit conversion, or another
       exactly-checkable result:
        evidence = RUN_DETERMINISTIC_TOOL(task)
    else:
        evidence = RETRIEVE_RELEVANT_KNOWLEDGE(task)  // when available

    answer = MODEL_3.synthesize(
        task, candidates, review, evidence,
        instruction = "Prefer verified claims; merge distinct valid options; state scope and uncertainty"
    )

    checks = VALIDATE(answer, evidence, task)
    if checks find a material contradiction:
        answer = MODEL_3.revise(answer, checks)

    return FORMAT_FOR_USER(answer, mode, level, include_assumptions=true)
```

## Example: “How many possibilities are there for 10 + 10 = 20?”

Henry should not answer “one” by default, nor claim an infinite or exact count without a defined search space.

- Direct expression: `10 + 10 = 20`
- Repeated addition: `5 + 5 + 5 + 5 = 20`
- Two repeated pairs: `(4 + 6) + (4 + 6) = 20`
- Multiplication: `4 × 5 = 20`
- Subtraction and addition: `25 - 5 = 20`
- Multiplication with addition: `3 × 6 + 2 = 20`

These are examples of different expressions, not a complete count. There are many more, and the count depends on rules: which numbers and operators are allowed, whether parentheses are allowed, whether order matters, and whether equivalent expressions count separately. Henry should state that boundary and ask for it if an exact count is wanted.

## Verification policy

- Use deterministic code for arithmetic and exact transformations whenever possible; language models are not calculators.
- Treat model agreement as a signal, not proof.
- Keep evidence and assumptions separate from guesses.
- For coding tasks, prefer syntax checks, unit tests, static analysis, and actual execution results when tools are available.
- Never claim a test, web search, file edit, or deployment occurred unless a connected tool confirms it.
- For factual answers, ask the reviewer to find counterexamples and edge cases, not just polish the first answer.
- Keep the user in control: “Lock it in” formalizes agreed decisions; unresolved choices remain explicitly marked.

## Cost and latency controls

- Run the three-model path for complex, creative, engineering, or high-ambiguity questions.
- Use a lightweight single response for greetings and simple low-risk questions.
- Use parallel calls for candidate generation and review only when each call has sufficient input; synthesize after results arrive.
- Cap conversation history, output tokens, retries, and total request time.
- Add provider fallback and transparent error handling.
- The free OpenRouter router and model availability/quotas can change. No paid fallback should be enabled without the owner's approval.

## Initial implementation boundary

The current Henry frontend has a chat invocation contract. This document specifies the reasoning layer to integrate into the Supabase Edge Function next. It does not claim that three-model orchestration, deterministic tools, retrieval, or evaluation are already live.
