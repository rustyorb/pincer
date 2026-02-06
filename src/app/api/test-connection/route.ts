import { NextRequest, NextResponse } from "next/server";
import { sendLLMRequest } from "@/lib/llm-client";
import type { TargetConfig } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint, apiKey, model, provider } = body as {
      endpoint: string;
      apiKey: string;
      model: string;
      provider: TargetConfig["provider"];
    };

    if (!endpoint || !apiKey || !model || !provider) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: endpoint, apiKey, model, provider" },
        { status: 400 }
      );
    }

    const result = await sendLLMRequest({
      endpoint,
      apiKey,
      model,
      provider,
      messages: [
        { role: "user", content: "Hello, respond with OK" },
      ],
    });

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 200 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Connected successfully",
      latencyMs: result.durationMs,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
