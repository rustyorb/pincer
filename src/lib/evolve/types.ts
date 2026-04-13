import type {
  AttackCategory,
  AttackPayload,
  AttackResult,
  TargetConfig,
} from "@/lib/types";

export interface PayloadSelectionInput {
  categories?: AttackCategory[];
  payloadIds?: string[];
  rawPayloads?: AttackPayload[];
}

export interface AttackExecutionRequestBody extends PayloadSelectionInput {
  endpoint: string;
  apiKey?: string;
  apiKeyId?: string;
  model: string;
  provider: TargetConfig["provider"];
  concurrency?: number;
}

export interface ExecutionConfig {
  endpoint: string;
  apiKey: string;
  model: string;
  provider: TargetConfig["provider"];
}

export interface EvolveRequestBody extends AttackExecutionRequestBody {
  generations?: number;
  topK?: number;
  mutationRate?: number;
}

export interface ScoredPayload {
  payload: AttackPayload;
  result: AttackResult;
  successRate: number;
  avgSeverityNorm: number;
  novelty: number;
  fitness: number;
}

export interface EvolveRankedPayloadSummary {
  payloadId: string;
  payloadName: string;
  promptPreview: string;
  fitness: number;
  success: boolean;
  status: AttackResult["status"];
  classification: AttackResult["analysis"]["classification"];
  severityNorm: number;
  novelty: number;
}

export interface EvolveMetaEvent {
  type: "meta";
  totalGenerations: number;
  initialPayloadCount: number;
  totalPayloads: number;
  concurrency: number;
  topK: number;
  mutationRate: number;
}

export interface EvolveGenerationSummaryEvent {
  type: "generation_summary";
  generation: number;
  totalPayloads: number;
  successCount: number;
  successRate: number;
  avgSeverityNorm: number;
  avgNovelty: number;
  avgFitness: number;
  topPayloads: EvolveRankedPayloadSummary[];
  nextPopulationSize: number | null;
}

export type EvolveStreamEvent = EvolveMetaEvent | EvolveGenerationSummaryEvent;
