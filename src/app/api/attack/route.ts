import { NextRequest } from "next/server";
import { sendLLMRequest } from "@/lib/llm-client";
import { allPayloads, getPayloadsByCategory } from "@/lib/attacks";
import { analyzeResponse, errorAnalysis } from "@/lib/analysis";
import type {
  AttackPayload,
  AttackResult,
  AttackCategory,
  TargetConfig,
} from "@/lib/types";
import { resolveKeyFromBody } from "@/lib/resolve-key";

interface AttackRequestBody {
  endpoint: string;
  apiKey?: string;
  apiKeyId?: string;
  model: string;
  provider: TargetConfig["provider"];
  categories?: AttackCategory[];
  payloadIds?: string[];
  rawPayloads?: AttackPayload[];
  concurrency?: number;
}

function resolvePayloads(body: AttackRequestBody): AttackPayload[] {
  if (body.rawPayloads?.length) {
    return body.rawPayloads;
  }
  if (body.payloadIds?.length) {
    return allPayloads.filter((p) => body.payloadIds!.includes(p.id));
  }
  if (body.categories?.length) {
    return body.categories.flatMap((cat) => getPayloadsByCategory(cat));
  }
  return [];
}

/** Execute a single payload and return the AttackResult. */
async function executePayload(
  payload: AttackPayload,
  endpoint: string,
  apiKey: string,
  model: string,
  provider: TargetConfig["provider"]
): Promise<AttackResult> {
  try {
    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [];
    if (payload.systemPrompt) {
      messages.push({ role: "system", content: payload.systemPrompt });
    }
    messages.push({ role: "user", content: payload.prompt });

    const llmResult = await sendLLMRequest({
      endpoint,
      apiKey,
      model,
      provider,
      messages,
    });

    const analysis = llmResult.error
      ? errorAnalysis(llmResult.error)
      : analyzeResponse(llmResult.content, payload.category, payload.prompt);
    const success =
      analysis.classification !== "refusal" &&
      analysis.classification !== "error";

    return {
      id: `${payload.id}-${Date.now()}`,
      payloadId: payload.id,
      payloadName: payload.name,
      category: payload.category,
      severity: payload.severity,
      status: llmResult.error ? "error" : success ? "success" : "fail",
      prompt: payload.prompt,
      response: llmResult.content || llmResult.error || "",
      timestamp: Date.now(),
      durationMs: llmResult.durationMs,
      success,
      analysis,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return {
      id: `${payload.id}-${Date.now()}`,
      payloadId: payload.id,
      payloadName: payload.name,
      category: payload.category,
      severity: payload.severity,
      status: "error",
      prompt: payload.prompt,
      response: "",
      timestamp: Date.now(),
      durationMs: 0,
      success: false,
      analysis: errorAnalysis(`Execution error: ${errorMessage}`),
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: AttackRequestBody = await request.json();
    const { endpoint, model, provider } = body;
    const resolvedKey = resolveKeyFromBody(body);

    if (!endpoint || !resolvedKey || !model || !provider) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Narrow type after guard
    const apiKey: string = resolvedKey;

    const payloads = resolvePayloads(body);

    if (payloads.length === 0) {
      return new Response(
        JSON.stringify({ error: "No matching payloads found for the given IDs" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Concurrency: 1 = sequential (default), up to 10 concurrent
    const concurrency = Math.max(1, Math.min(10, body.concurrency ?? 1));

    // Stream results as newline-delimited JSON
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        // Send meta line first so clients know total payload count
        controller.enqueue(
          encoder.encode(JSON.stringify({ type: "meta", totalPayloads: payloads.length }) + "\n")
        );

        if (concurrency === 1) {
          // Sequential mode — original behavior, preserves ordering
          for (const payload of payloads) {
            const result = await executePayload(payload, endpoint, apiKey, model, provider);
            controller.enqueue(encoder.encode(JSON.stringify(result) + "\n"));
          }
        } else {
          // Concurrent mode — semaphore-style pool
          let index = 0;
          const total = payloads.length;

          async function runWorker() {
            while (true) {
              const i = index++;
              if (i >= total) break;
              const result = await executePayload(payloads[i], endpoint, apiKey, model, provider);
              controller.enqueue(encoder.encode(JSON.stringify(result) + "\n"));
            }
          }

          // Spawn N workers that pull from a shared index
          const workers = Array.from({ length: Math.min(concurrency, total) }, () => runWorker());
          await Promise.all(workers);
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
