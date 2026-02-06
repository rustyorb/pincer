import type { LLMRequest, LLMResponse } from "./types";

const TIMEOUT_MS = 30_000;

/**
 * Send a chat completion request to an LLM provider.
 * Supports OpenAI, Anthropic, OpenRouter, and custom (OpenAI-compatible) endpoints.
 */
export async function sendLLMRequest(req: LLMRequest): Promise<LLMResponse> {
  const start = Date.now();

  try {
    if (req.provider === "anthropic") {
      return await sendAnthropicRequest(req, start);
    }
    return await sendOpenAICompatibleRequest(req, start);
  } catch (err: unknown) {
    const durationMs = Date.now() - start;
    const message =
      err instanceof Error ? err.message : "Unknown error occurred";

    if (
      message.includes("AbortError") ||
      message.includes("abort") ||
      message.includes("timeout")
    ) {
      return { content: "", error: `Request timed out after ${TIMEOUT_MS}ms`, durationMs };
    }

    return { content: "", error: message, durationMs };
  }
}

/**
 * OpenAI-compatible request (works for openai, openrouter, custom providers).
 */
async function sendOpenAICompatibleRequest(
  req: LLMRequest,
  start: number
): Promise<LLMResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(req.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${req.apiKey}`,
      },
      body: JSON.stringify({
        model: req.model,
        messages: req.messages,
        max_tokens: 1024,
      }),
      signal: controller.signal,
    });

    const durationMs = Date.now() - start;

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        content: "",
        error: `HTTP ${response.status}: ${body || response.statusText}`,
        durationMs,
      };
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? "";

    return { content, durationMs };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Anthropic Messages API request.
 * Extracts system message from the messages array and sends it as a top-level param.
 */
async function sendAnthropicRequest(
  req: LLMRequest,
  start: number
): Promise<LLMResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // Separate system messages from the rest
    const systemMessages = req.messages.filter((m) => m.role === "system");
    const nonSystemMessages = req.messages.filter((m) => m.role !== "system");

    const systemText =
      systemMessages.length > 0
        ? systemMessages.map((m) => m.content).join("\n\n")
        : undefined;

    const body: Record<string, unknown> = {
      model: req.model,
      messages: nonSystemMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: 1024,
    };

    if (systemText) {
      body.system = systemText;
    }

    const response = await fetch(req.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": req.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const durationMs = Date.now() - start;

    if (!response.ok) {
      const responseBody = await response.text().catch(() => "");
      return {
        content: "",
        error: `HTTP ${response.status}: ${responseBody || response.statusText}`,
        durationMs,
      };
    }

    const data = await response.json();
    // Anthropic returns content as an array of content blocks
    const content =
      data?.content
        ?.filter((block: { type: string }) => block.type === "text")
        ?.map((block: { text: string }) => block.text)
        ?.join("") ?? "";

    return { content, durationMs };
  } finally {
    clearTimeout(timer);
  }
}
