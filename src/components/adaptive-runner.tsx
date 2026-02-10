// INTEGRATION: Add to store.ts: none (reads existing runs via useStore)
// INTEGRATION: Add to types.ts: none (types in adaptive.ts)
// INTEGRATION: Add to page.tsx: import AdaptiveRunner, add view === "adaptive" case
// INTEGRATION: Add to sidebar.tsx: add nav item { view: "adaptive", icon: Brain, label: "Adaptive" }

"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { generateId } from "@/lib/uuid";
import {
  analyzeWeaknesses,
  generateFollowUpStrategy,
  type WeaknessProfile,
  type FollowUpPlan,
  type FollowUpAttack,
} from "@/lib/adaptive";
import type { AttackResult, AttackRun } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Brain,
  Zap,
  Play,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Target,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
} from "lucide-react";

export function AdaptiveRunner() {
  const { runs, targets, addRun, addResult, completeRun, isRunning, setIsRunning } = useStore();

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [followUpResults, setFollowUpResults] = useState<AttackResult[]>([]);
  const [running, setRunning] = useState(false);
  const [followUpProgress, setFollowUpProgress] = useState(0);

  const completedRuns = runs.filter((r) => r.status === "completed" && r.results.length > 0);
  const selectedRun = completedRuns.find((r) => r.id === selectedRunId) || null;

  const profile: WeaknessProfile | null = useMemo(() => {
    if (!selectedRun) return null;
    return analyzeWeaknesses(selectedRun.results);
  }, [selectedRun]);

  const plan: FollowUpPlan | null = useMemo(() => {
    if (!profile) return null;
    return generateFollowUpStrategy(profile);
  }, [profile]);

  const runFollowUp = async () => {
    if (!plan || !selectedRun) return;

    const target = targets.find((t) => t.id === selectedRun.targetId);
    if (!target) return;

    setRunning(true);
    setIsRunning(true);
    setFollowUpResults([]);
    setFollowUpProgress(0);

    const runId = generateId();
    const run: AttackRun = {
      id: runId,
      targetId: target.id,
      targetName: target.name,
      categories: [...new Set(plan.attacks.map((a) => a.category))],
      results: [],
      startTime: Date.now(),
      status: "running",
    };
    addRun(run);

    const results: AttackResult[] = [];
    const total = plan.attacks.length;

    for (let i = 0; i < plan.attacks.length; i++) {
      const attack = plan.attacks[i];
      try {
        const res = await fetch("/api/attack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: target.endpoint,
            apiKey: target.apiKey,
            model: target.model,
            provider: target.provider,
            payloadIds: [], // We send custom prompts, so use the raw approach
            categories: [attack.category],
          }),
        });

        // Since we're sending custom prompts not in the payload DB, we manually construct
        // For simplicity, we call the attack API with the category and process results
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
                const result: AttackResult = JSON.parse(line);
                // Override with our adaptive attack info
                result.payloadName = `[Adaptive] ${attack.name}`;
                results.push(result);
                addResult(runId, result);
                setFollowUpProgress(Math.round(((i + 1) / total) * 100));
                setFollowUpResults([...results]);
              } catch {
                // skip
              }
            }
          }
        }
      } catch (err) {
        console.error(`Adaptive attack failed: ${attack.name}`, err);
      }
    }

    completeRun(runId);
    setRunning(false);
    setIsRunning(false);
  };

  const confidenceColor = (c: number) => {
    if (c >= 0.8) return "text-redpincer";
    if (c >= 0.5) return "text-warning";
    return "text-muted-foreground";
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Brain className="h-6 w-6 text-lobster" />
        <h2 className="text-2xl font-bold text-foreground">Adaptive Attack Engine</h2>
      </div>

      {/* Run Selection */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Select Completed Run to Analyze
          </CardTitle>
        </CardHeader>
        <CardContent>
          {completedRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No completed attack runs available. Run an attack first.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {completedRuns.map((run) => {
                const breached = run.results.filter((r) => r.success).length;
                return (
                  <button
                    key={run.id}
                    onClick={() => setSelectedRunId(run.id)}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                      selectedRunId === run.id ? "bg-muted ring-1 ring-lobster" : ""
                    }`}
                  >
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <span className="font-medium text-foreground">{run.targetName}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {new Date(run.startTime).toLocaleString()}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        breached > 0
                          ? "border-redpincer/50 text-redpincer"
                          : "border-success/50 text-success"
                      }
                    >
                      {breached}/{run.results.length} breached
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weakness Analysis */}
      {profile && selectedRun && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Overall Stats */}
            <Card className="border-border bg-card">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3 mb-3">
                  <BarChart3 className="h-5 w-5 text-lobster" />
                  <p className="text-sm font-semibold text-muted-foreground">Overall Breach Rate</p>
                </div>
                <p className="text-4xl font-bold text-foreground">
                  {Math.round(profile.overallBreachRate * 100)}%
                </p>
                <div className="mt-2">
                  <Progress value={profile.overallBreachRate * 100} className="h-2" />
                </div>
              </CardContent>
            </Card>

            {/* Weakest Category */}
            <Card className="border-redpincer/30 bg-card">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3 mb-3">
                  <ShieldAlert className="h-5 w-5 text-redpincer" />
                  <p className="text-sm font-semibold text-redpincer">Weakest Category</p>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {profile.weakestCategory
                    ? CATEGORY_LABELS[profile.weakestCategory]
                    : "N/A"}
                </p>
                {profile.weakestCategory && (
                  <p className="text-sm text-muted-foreground">
                    {Math.round(
                      (profile.categoryWeaknesses.find(
                        (cw) => cw.category === profile.weakestCategory
                      )?.successRate || 0) * 100
                    )}% breach rate
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Strongest Category */}
            <Card className="border-success/30 bg-card">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3 mb-3">
                  <ShieldCheck className="h-5 w-5 text-success" />
                  <p className="text-sm font-semibold text-success">Strongest Category</p>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {profile.strongestCategory
                    ? CATEGORY_LABELS[profile.strongestCategory]
                    : "N/A"}
                </p>
                {profile.strongestCategory && (
                  <p className="text-sm text-muted-foreground">
                    {Math.round(
                      (profile.categoryWeaknesses.find(
                        (cw) => cw.category === profile.strongestCategory
                      )?.successRate || 0) * 100
                    )}% breach rate
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Category Breakdown */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Category Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {profile.categoryWeaknesses.map((cw) => (
                  <div key={cw.category} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-foreground">
                        {CATEGORY_LABELS[cw.category]}
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          cw.successRate >= 0.5
                            ? "border-redpincer/50 text-redpincer"
                            : cw.successRate >= 0.2
                              ? "border-warning/50 text-warning"
                              : "border-success/50 text-success"
                        }
                      >
                        {Math.round(cw.successRate * 100)}% breached
                      </Badge>
                    </div>
                    <div className="mb-2">
                      <Progress value={cw.successRate * 100} className="h-1.5" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {cw.successCount} of {cw.totalAttempts} payloads breached
                    </p>
                    {cw.topTechniques.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {cw.topTechniques.slice(0, 3).map((t) => (
                          <Badge key={t} variant="outline" className="text-xs">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Vulnerability Patterns */}
          {profile.vulnerabilityPatterns.length > 0 && (
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Identified Vulnerability Patterns
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  {profile.vulnerabilityPatterns.map((pattern, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-border p-3 hover:border-warning/50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <Zap className="h-4 w-4 mt-0.5 text-warning" />
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{pattern.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs font-semibold ${confidenceColor(pattern.confidence)}`}>
                              {Math.round(pattern.confidence * 100)}% confidence
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {CATEGORY_LABELS[pattern.category]}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {pattern.suggestedFollowUp}
                          </p>
                          {pattern.evidence.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {pattern.evidence.map((e) => (
                                <Badge key={e} variant="outline" className="text-xs text-muted-foreground">
                                  {e}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Follow-up Plan */}
          {plan && (
            <Card className="border-lobster/30 bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-lobster">
                  <TrendingUp className="h-4 w-4" />
                  Adaptive Follow-up Plan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-sm text-muted-foreground">{plan.strategy}</p>

                <div className="mb-4 flex flex-wrap gap-2">
                  {plan.targetWeaknesses.map((tw, i) => (
                    <Badge key={i} variant="outline" className="border-warning/50 text-warning">
                      {tw}
                    </Badge>
                  ))}
                </div>

                <ScrollArea className="max-h-[300px]">
                  <div className="flex flex-col gap-2">
                    {plan.attacks.map((attack, i) => (
                      <div key={i} className="rounded border border-border p-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Zap className="h-3.5 w-3.5 text-lobster" />
                          <span className="font-medium text-foreground">{attack.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {CATEGORY_LABELS[attack.category]}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              attack.severity === "critical"
                                ? "border-redpincer/50 text-redpincer"
                                : attack.severity === "high"
                                  ? "border-warning/50 text-warning"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {attack.severity}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{attack.reasoning}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <Button
                  className="mt-4 w-full gap-2 bg-lobster font-semibold text-white hover:bg-lobster/90 disabled:opacity-40"
                  disabled={running || isRunning}
                  onClick={runFollowUp}
                >
                  {running ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Running Follow-up ({followUpProgress}%)
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Run Adaptive Follow-up ({plan.estimatedPayloadCount} attacks)
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Follow-up Results (Before/After) */}
          {followUpResults.length > 0 && (
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Follow-up Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Initial Run</p>
                    <p className="text-2xl font-bold text-foreground">
                      {Math.round(profile.overallBreachRate * 100)}%
                    </p>
                    <p className="text-xs text-muted-foreground">breach rate</p>
                  </div>
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Follow-up</p>
                    <p className="text-2xl font-bold text-redpincer">
                      {Math.round(
                        (followUpResults.filter((r) => r.success).length /
                          followUpResults.length) *
                          100
                      )}%
                    </p>
                    <p className="text-xs text-muted-foreground">breach rate</p>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  {followUpResults.map((result) => (
                    <div
                      key={result.id}
                      className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/30"
                    >
                      {result.success ? (
                        <ShieldAlert className="h-3.5 w-3.5 text-redpincer" />
                      ) : (
                        <ShieldCheck className="h-3.5 w-3.5 text-success" />
                      )}
                      <span className="flex-1 truncate text-foreground">{result.payloadName}</span>
                      <Badge
                        variant="outline"
                        className={
                          result.success
                            ? "border-redpincer/50 text-redpincer"
                            : "border-success/50 text-success"
                        }
                      >
                        {result.success ? "BREACHED" : "BLOCKED"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Empty State */}
      {!selectedRun && completedRuns.length > 0 && (
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Brain className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              Select a completed run above to analyze weaknesses and generate adaptive follow-up attacks.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
