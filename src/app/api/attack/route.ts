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

interface AttackRequestBody {
  endpoint: string;
  apiKey: string;
  model: string;
  provider: TargetConfig["provider"];
  categories?: AttackCategory[];
  payloadIds?: string[];
}

function resolvePayloads(body: AttackRequestBody): AttackPayload[] {
  if (body.payloadIds?.length) {
    return allPayloads.filter((p) => body.payloadIds!.includes(p.id));
  }
  if (body.categories?.length) {
    return body.categories.flatMap((cat) => getPayloadsByCategory(cat));
  }
  return [];
}

export async function POST(request: NextRequest) {
  try {
    const body: AttackRequestBody = await request.json();
    const { endpoint, apiKey, model, provider, payloadIds } = body;

    if (!endpoint || !apiKey || !model || !provider) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const payloads = resolvePayloads(body);

    if (payloads.length === 0) {
      return new Response(
        JSON.stringify({ error: "No matching payloads found for the given IDs" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Stream results as newline-delimited JSON
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        for (const payload of payloads) {
          try {
            // Build the messages array
            const messages: { role: "system" | "user" | "assistant"; content: string }[] = [];
            if (payload.systemPrompt) {
              messages.push({ role: "system", content: payload.systemPrompt });
            }
            messages.push({ role: "user", content: payload.prompt });

            // Send the request
            const llmResult = await sendLLMRequest({
              endpoint,
              apiKey,
              model,
              provider,
              messages,
            });

            // Analyze the response
            const analysis = llmResult.error
              ? errorAnalysis(llmResult.error)
              : analyzeResponse(llmResult.content, payload.category, payload.prompt);
            const success =
              analysis.classification !== "refusal" &&
              analysis.classification !== "error";

            const result: AttackResult = {
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

            // Write the result as a JSON line
            controller.enqueue(encoder.encode(JSON.stringify(result) + "\n"));
          } catch (err: unknown) {
            // If a single payload errors, report it and continue
            const errorMessage =
              err instanceof Error ? err.message : "Unknown error";

            const errorResult: AttackResult = {
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

            controller.enqueue(
              encoder.encode(JSON.stringify(errorResult) + "\n")
            );
          }
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
