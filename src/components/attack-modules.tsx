"use client";

import { useState } from "react";
import { allPayloads, getPayloadsByCategory } from "@/lib/attacks";
import type { AttackCategory, Severity, ModelTarget } from "@/lib/types";
import { CATEGORY_LABELS, MODEL_TARGET_LABELS } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
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
  const [expanded, setExpanded] = useState<Set<AttackCategory>>(new Set());

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
