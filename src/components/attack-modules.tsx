"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { generateId } from "@/lib/uuid";
import { allPayloads, getPayloadsByCategory } from "@/lib/attacks";
import type { AttackCategory, Severity, ModelTarget, AttackPayload, AttackRun } from "@/lib/types";
import { CATEGORY_LABELS, MODEL_TARGET_LABELS } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Puzzle,
  Play,
  Loader2,
} from "lucide-react";

const CATEGORIES: AttackCategory[] = [
  "injection",
  "jailbreak",
  "extraction",
  "bypass",
];

const CATEGORY_DESCRIPTIONS: Record<AttackCategory, string> = {
  injection:
    "Techniques to inject malicious instructions into LLM prompts, overriding system instructions or manipulating behavior.",
  jailbreak:
    "Methods to bypass safety alignment and content policies, coercing the model into unrestricted behavior.",
  extraction:
    "Attacks aimed at extracting system prompts, training data, or sensitive information from the model.",
  bypass:
    "Strategies to evade content filters, safety guardrails, and output restrictions.",
};

const CATEGORY_ICONS: Record<AttackCategory, string> = {
  injection: "💉",
  jailbreak: "🔓",
  extraction: "🔍",
  bypass: "🚧",
};

function severityColor(severity: Severity): string {
  switch (severity) {
    case "critical":
      return "bg-redpincer/20 text-redpincer border-redpincer/30";
    case "high":
      return "bg-lobster/20 text-lobster border-lobster/30";
    case "medium":
      return "bg-warning/20 text-warning border-warning/30";
    case "low":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  }
}

export function AttackModules() {
  const { targets, activeTargetId, addRun, addResult, completeRun, isRunning, setIsRunning, setView, setActiveRun } = useStore();
  const [expanded, setExpanded] = useState<Set<AttackCategory>>(new Set());
  const [customPayloads, setCustomPayloads] = useState<AttackPayload[]>([]);
  const [customExpanded, setCustomExpanded] = useState(false);
  const [selectedCustomIds, setSelectedCustomIds] = useState<Set<string>>(new Set());
  const [runningCustom, setRunningCustom] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("redpincer-custom-payloads");
      if (stored) setCustomPayloads(JSON.parse(stored));
    } catch {
      // ignore
    }
  }, []);

  const toggleCustomSelect = (id: string) => {
    setSelectedCustomIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedCustomIds.size === customPayloads.length) {
      setSelectedCustomIds(new Set());
    } else {
      setSelectedCustomIds(new Set(customPayloads.map((p) => p.id)));
    }
  };

  const runCustomPayloads = async () => {
    const target = targets.find((t) => t.id === activeTargetId);
    if (!target || selectedCustomIds.size === 0) return;

    const payloadsToRun = customPayloads.filter((p) => selectedCustomIds.has(p.id));
    setRunningCustom(true);
    setIsRunning(true);

    const runId = generateId();
    const run: AttackRun = {
      id: runId,
      targetId: target.id,
      targetName: target.name,
      categories: [...new Set(payloadsToRun.map((p) => p.category))],
      results: [],
      startTime: Date.now(),
      status: "running",
    };
    addRun(run);
    setActiveRun(runId);
    setView("results");

    try {
      const res = await fetch("/api/attack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: target.endpoint,
          apiKey: target.apiKey,
          model: target.model,
          provider: target.provider,
          rawPayloads: payloadsToRun,
        }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.trim()) {
            try {
              addResult(runId, JSON.parse(line));
            } catch {
              // skip malformed
            }
          }
        }
      }
    } catch (err) {
      console.error("Custom payload run failed", err);
    }

    completeRun(runId);
    setRunningCustom(false);
    setIsRunning(false);
  };

  const toggleExpand = (cat: AttackCategory) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Shield className="h-6 w-6 text-redpincer" />
          Attack Modules
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse and explore all available attack payloads across{" "}
          {CATEGORIES.length} categories. Total payloads:{" "}
          <span className="font-mono text-foreground">{allPayloads.length}</span>
        </p>
      </div>

      <div className="space-y-3">
        {/* Custom Payloads Section */}
        {customPayloads.length > 0 && (
          <Card className="border-lobster/30 bg-card">
            <CardHeader
              className="cursor-pointer select-none transition-colors hover:bg-accent/50"
              onClick={() => setCustomExpanded(!customExpanded)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🧩</span>
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      Custom Payloads
                      <Badge variant="outline" className="border-lobster/40 text-lobster text-[10px]">
                        {customPayloads.length}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="mt-0.5 text-xs">
                      Payloads you created in the Payload Editor
                    </CardDescription>
                  </div>
                </div>
                {customExpanded ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </CardHeader>

            {customExpanded && (
              <CardContent className="pt-0">
                <Separator className="mb-4" />

                <div className="mb-3 flex items-center justify-between">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox
                      checked={selectedCustomIds.size === customPayloads.length && customPayloads.length > 0}
                      onCheckedChange={toggleSelectAll}
                      className="border-muted-foreground data-[state=checked]:border-lobster data-[state=checked]:bg-lobster"
                    />
                    Select all ({customPayloads.length})
                  </label>

                  {selectedCustomIds.size > 0 && (
                    <Button
                      size="sm"
                      className="gap-1.5 bg-lobster text-white hover:bg-lobster/90 disabled:opacity-40 h-7 text-xs"
                      disabled={runningCustom || isRunning || !activeTargetId}
                      onClick={runCustomPayloads}
                    >
                      {runningCustom ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                      Run {selectedCustomIds.size} selected
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  {customPayloads.map((payload) => (
                    <div key={payload.id} className="flex items-start gap-2">
                      <Checkbox
                        checked={selectedCustomIds.has(payload.id)}
                        onCheckedChange={() => toggleCustomSelect(payload.id)}
                        className="mt-3 border-muted-foreground data-[state=checked]:border-lobster data-[state=checked]:bg-lobster"
                      />
                      <div className="flex-1">
                        <PayloadItem
                          name={payload.name}
                          severity={payload.severity}
                          description={payload.description}
                          prompt={payload.prompt}
                          tags={payload.tags}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {CATEGORIES.map((cat) => {
          const payloads = getPayloadsByCategory(cat);
          const isExpanded = expanded.has(cat);
          const criticalCount = payloads.filter(
            (p) => p.severity === "critical"
          ).length;
          const highCount = payloads.filter(
            (p) => p.severity === "high"
          ).length;

          return (
            <Card key={cat} className="border-border bg-card">
              <CardHeader
                className="cursor-pointer select-none transition-colors hover:bg-accent/50"
                onClick={() => toggleExpand(cat)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{CATEGORY_ICONS[cat]}</span>
                    <div>
                      <CardTitle className="text-base">
                        {CATEGORY_LABELS[cat]}
                      </CardTitle>
                      <CardDescription className="mt-0.5 text-xs">
                        {payloads.length} payload
                        {payloads.length !== 1 ? "s" : ""}
                        {criticalCount > 0 && (
                          <span className="ml-2 text-redpincer">
                            {criticalCount} critical
                          </span>
                        )}
                        {highCount > 0 && (
                          <span className="ml-2 text-lobster">
                            {highCount} high
                          </span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0">
                  <p className="mb-4 text-sm text-muted-foreground">
                    {CATEGORY_DESCRIPTIONS[cat]}
                  </p>
                  <Separator className="mb-4" />

                  <ScrollArea className={payloads.length > 6 ? "h-[500px]" : ""}>
                    <div className="space-y-2">
                      {payloads.map((payload) => (
                        <PayloadItem
                          key={payload.id}
                          name={payload.name}
                          severity={payload.severity}
                          description={payload.description}
                          prompt={payload.prompt}
                          modelTarget={payload.modelTarget}
                          tags={payload.tags}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function PayloadItem({
  name,
  severity,
  description,
  prompt,
  modelTarget,
  tags,
}: {
  name: string;
  severity: Severity;
  description: string;
  prompt: string;
  modelTarget?: ModelTarget;
  tags?: string[];
}) {
  const [showPrompt, setShowPrompt] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{name}</span>
            <Badge
              variant="outline"
              className={`text-[10px] uppercase ${severityColor(severity)}`}
            >
              {severity}
            </Badge>
            {modelTarget && modelTarget !== "universal" && (
              <Badge variant="outline" className="text-[10px] border-muted-foreground/30 text-muted-foreground">
                {MODEL_TARGET_LABELS[modelTarget]}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          {tags && tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-accent px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => setShowPrompt(!showPrompt)}
          className="shrink-0 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {showPrompt ? "Hide" : "View"}
        </button>
      </div>

      {showPrompt && (
        <div className="mt-2 rounded border border-border bg-sidebar p-2">
          <pre className="whitespace-pre-wrap font-mono text-xs text-muted-foreground">
            {prompt}
          </pre>
        </div>
      )}
    </div>
  );
}
