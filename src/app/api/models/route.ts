import { NextRequest, NextResponse } from "next/server";
import type { TargetConfig } from "@/lib/types";

const ANTHROPIC_MODELS = [
  "claude-opus-4-20250918",
  "claude-sonnet-4-20250514",
  "claude-haiku-4-20250414",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku-20241022",
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint, apiKey, provider } = body as {
      endpoint: string;
      apiKey: string;
      provider: TargetConfig["provider"];
    };

    if (!apiKey || !provider) {
      return NextResponse.json(
        { models: [], error: "Missing required fields: apiKey, provider" },
        { status: 400 }
      );
    }

    let models: string[] = [];

    if (provider === "anthropic") {
      models = ANTHROPIC_MODELS;
    } else if (provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json(
          { models: [], error: `OpenAI API error: ${res.status} ${errText}` },
          { status: 200 }
        );
      }
      const data = await res.json();
      models = (data.data as { id: string }[])
        .map((m) => m.id)
        .filter(
          (id) =>
            id.includes("gpt") ||
            id.startsWith("o1") ||
            id.startsWith("o3") ||
            id.startsWith("chatgpt")
        );
    } else if (provider === "openrouter") {
      const res = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json(
          { models: [], error: `OpenRouter API error: ${res.status} ${errText}` },
          { status: 200 }
        );
      }
      const data = await res.json();
      models = (data.data as { id: string }[]).map((m) => m.id);
    } else {
      // Custom provider - return empty
      return NextResponse.json({ models: [] });
    }

    models.sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ models });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json(
      { models: [], error: message },
      { status: 500 }
    );
  }
}
