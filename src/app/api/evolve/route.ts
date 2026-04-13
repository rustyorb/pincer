import { NextRequest } from "next/server";
import { resolveKeyFromBody } from "@/lib/resolve-key";
import {
  buildNextGeneration,
  clampConcurrency,
  clampGenerationCount,
  clampMutationRate,
  clampTopK,
  executePayloads,
  resolvePayloads,
  scoreGeneration,
  summarizeGeneration,
} from "@/lib/evolve/runner";
import type { EvolveMetaEvent, EvolveRequestBody } from "@/lib/evolve/types";

export async function POST(request: NextRequest) {
  try {
    const body: EvolveRequestBody = await request.json();
    const { endpoint, model, provider } = body;
    const resolvedKey = resolveKeyFromBody(body);

    if (!endpoint || !resolvedKey || !model || !provider) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const apiKey: string = resolvedKey;
    const initialPayloads = resolvePayloads(body);

    if (initialPayloads.length === 0) {
      return new Response(
        JSON.stringify({ error: "No matching payloads found for the given IDs" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const concurrency = clampConcurrency(body.concurrency);
    const totalGenerations = clampGenerationCount(body.generations);
    const mutationRate = clampMutationRate(body.mutationRate);
    const topK = clampTopK(body.topK, initialPayloads.length);

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const writeLine = (value: unknown) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
        };

        const meta: EvolveMetaEvent = {
          type: "meta",
          totalGenerations,
          initialPayloadCount: initialPayloads.length,
          totalPayloads: initialPayloads.length,
          concurrency,
          topK,
          mutationRate,
        };

        writeLine(meta);

        let population = initialPayloads;

        for (let generation = 0; generation < totalGenerations; generation += 1) {
          const results = await executePayloads(
            population,
            { endpoint, apiKey, model, provider },
            concurrency
          );
          const scoredPayloads = scoreGeneration(population, results);
          const nextPopulationSize =
            generation < totalGenerations - 1 ? population.length : null;

          writeLine(
            summarizeGeneration(
              scoredPayloads,
              generation,
              nextPopulationSize,
              clampTopK(topK, scoredPayloads.length)
            )
          );

          if (generation < totalGenerations - 1) {
            population = buildNextGeneration(
              scoredPayloads,
              generation,
              population.length,
              topK,
              mutationRate
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
