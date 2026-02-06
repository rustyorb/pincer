"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import type { AttackCategory, Severity, AttackResult, AnalysisClassification } from "@/lib/types";
import { CATEGORY_LABELS, SEVERITY_ORDER } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Shield,
  Target,
} from "lucide-react";

const ALL_CATEGORIES: AttackCategory[] = [
  "injection",
  "jailbreak",
  "extraction",
  "bypass",
];

const ALL_SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];

function severityBadgeClass(severity: Severity): string {
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

function categoryBadgeClass(category: AttackCategory): string {
  switch (category) {
    case "injection":
      return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    case "jailbreak":
      return "bg-redpincer/20 text-redpincer border-redpincer/30";
    case "extraction":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "bypass":
      return "bg-lobster/20 text-lobster border-lobster/30";
  }
}

function classificationBadgeClass(classification: AnalysisClassification): string {
  switch (classification) {
    case "refusal":
      return "bg-success/20 text-success border-success/30";
    case "partial_compliance":
      return "bg-warning/20 text-warning border-warning/30";
    case "full_jailbreak":
      return "bg-redpincer/20 text-redpincer border-redpincer/30";
    case "information_leakage":
      return "bg-lobster/20 text-lobster border-lobster/30";
    case "error":
      return "bg-muted/20 text-muted-foreground border-border";
  }
}

function classificationLabel(classification: AnalysisClassification): string {
  switch (classification) {
    case "refusal":
      return "Refusal";
    case "partial_compliance":
      return "Partial Compliance";
    case "full_jailbreak":
      return "Full Jailbreak";
    case "information_leakage":
      return "Information Leakage";
    case "error":
      return "Error";
  }
}

function severityScoreColor(score: number): string {
  if (score <= 2) return "[&>div]:bg-success";
  if (score <= 4) return "[&>div]:bg-blue-500";
  if (score <= 6) return "[&>div]:bg-warning";
  if (score <= 8) return "[&>div]:bg-lobster";
  return "[&>div]:bg-redpincer";
}

function statusIcon(result: AttackResult) {
  if (result.status === "running") {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }
  if (result.success) {
    return <AlertTriangle className="h-4 w-4 text-redpincer" />;
  }
  return <CheckCircle className="h-4 w-4 text-success" />;
}

export function ResultsDashboard() {
  const { runs, activeRunId } = useStore();
  const activeRun = runs.find((r) => r.id === activeRunId) ?? runs[0];

  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [expandedResults, setExpandedResults] = useState<Set<string>>(
    new Set()
  );

  const results = activeRun?.results ?? [];

  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      if (filterCategory !== "all" && r.category !== filterCategory)
        return false;
      if (filterSeverity !== "all" && r.severity !== filterSeverity)
        return false;
      if (filterStatus === "success" && !r.success) return false;
      if (filterStatus === "fail" && r.success) return false;
      return true;
    });
  }, [results, filterCategory, filterSeverity, filterStatus]);

  const totalAttacks = results.length;
  const successfulAttacks = results.filter((r) => r.success).length;
  const failedAttacks = results.filter(
    (r) => !r.success && r.status !== "running"
  ).length;
  const runningAttacks = results.filter((r) => r.status === "running").length;
  const successRate =
    totalAttacks > 0 ? Math.round((successfulAttacks / totalAttacks) * 100) : 0;

  const toggleExpand = (id: string) => {
    setExpandedResults((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Per-category stats
  const categoryStats = ALL_CATEGORIES.map((cat) => {
    const catResults = results.filter((r) => r.category === cat);
    const catSuccess = catResults.filter((r) => r.success).length;
    return {
      category: cat,
      total: catResults.length,
      success: catSuccess,
      rate: catResults.length > 0 ? (catSuccess / catResults.length) * 100 : 0,
    };
  });

  // Severity stats
  const severityStats = ALL_SEVERITIES.map((sev) => {
    const sevResults = results.filter((r) => r.severity === sev);
    const sevSuccess = sevResults.filter((r) => r.success).length;
    return {
      severity: sev,
      total: sevResults.length,
      success: sevSuccess,
    };
  });

  if (!activeRun) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-muted-foreground">
        <BarChart3 className="h-16 w-16 opacity-30" />
        <p className="text-lg">No attack runs yet</p>
        <p className="text-sm">
          Configure a target and run attacks to see results here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <BarChart3 className="h-6 w-6 text-redpincer" />
          Results Dashboard
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Target: <span className="text-foreground">{activeRun.targetName}</span>{" "}
          &middot; Status:{" "}
          <span
            className={
              activeRun.status === "running" ? "text-warning" : "text-success"
            }
          >
            {activeRun.status}
          </span>
          {activeRun.status === "running" && (
            <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />
          )}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Attacks
            </p>
            <p className="mt-1 text-3xl font-bold text-foreground">
              {totalAttacks}
            </p>
          </CardContent>
        </Card>

        <Card className="border-redpincer/30 bg-card">
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-redpincer">
              Successful (Vulnerable)
            </p>
            <p className="mt-1 text-3xl font-bold text-redpincer">
              {successfulAttacks}
            </p>
            <p className="text-xs text-muted-foreground">{successRate}%</p>
          </CardContent>
        </Card>

        <Card className="border-success/30 bg-card">
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-success">
              Blocked (Safe)
            </p>
            <p className="mt-1 text-3xl font-bold text-success">
              {failedAttacks}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Running
            </p>
            <p className="mt-1 text-3xl font-bold text-warning">
              {runningAttacks}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Category & Severity Breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Category Breakdown */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              By Category
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {categoryStats.map((stat) => (
              <div key={stat.category}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {CATEGORY_LABELS[stat.category]}
                  </span>
                  <span className="font-mono text-foreground">
                    {stat.success}/{stat.total}
                  </span>
                </div>
                <Progress
                  value={stat.rate}
                  className="h-2 bg-secondary [&>div]:bg-redpincer"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Severity Distribution */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              By Severity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {severityStats.map((stat) => (
              <div
                key={stat.severity}
                className="flex items-center justify-between"
              >
                <Badge
                  variant="outline"
                  className={`text-[10px] uppercase ${severityBadgeClass(stat.severity)}`}
                >
                  {stat.severity}
                </Badge>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {stat.success} breached / {stat.total} total
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Filter:
        </span>

        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="h-8 w-[160px] bg-background text-xs">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {ALL_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterSeverity} onValueChange={setFilterSeverity}>
          <SelectTrigger className="h-8 w-[140px] bg-background text-xs">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            {ALL_SEVERITIES.map((sev) => (
              <SelectItem key={sev} value={sev}>
                {sev.charAt(0).toUpperCase() + sev.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-[140px] bg-background text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="success">Breached</SelectItem>
            <SelectItem value="fail">Blocked</SelectItem>
          </SelectContent>
        </Select>

        <span className="ml-auto text-xs text-muted-foreground">
          Showing {filteredResults.length} of {results.length} results
        </span>
      </div>

      {/* Results List */}
      <ScrollArea className="h-[500px]">
        <div className="space-y-2">
          {filteredResults.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {results.length === 0
                ? "Waiting for results..."
                : "No results match the current filters."}
            </p>
          )}

          {filteredResults.map((result) => {
            const isExpanded = expandedResults.has(result.id);

            return (
              <div
                key={result.id}
                className={`rounded-lg border bg-card transition-colors ${
                  result.success
                    ? "border-l-2 border-l-redpincer border-t-border border-r-border border-b-border"
                    : "border-l-2 border-l-success border-t-border border-r-border border-b-border"
                }`}
              >
                <button
                  onClick={() => toggleExpand(result.id)}
                  className="flex w-full items-center gap-3 p-3 text-left"
                >
                  {statusIcon(result)}

                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium">
                      {result.payloadName}
                    </span>
                  </div>

                  <Badge
                    variant="outline"
                    className={`text-[10px] ${categoryBadgeClass(result.category)}`}
                  >
                    {CATEGORY_LABELS[result.category]}
                  </Badge>

                  <Badge
                    variant="outline"
                    className={`text-[10px] uppercase ${severityBadgeClass(result.severity)}`}
                  >
                    {result.severity}
                  </Badge>

                  <span
                    className={`text-xs font-medium ${
                      result.success ? "text-redpincer" : "text-success"
                    }`}
                  >
                    {result.success ? "BREACHED" : "BLOCKED"}
                  </span>

                  <span className="font-mono text-xs text-muted-foreground">
                    {result.durationMs}ms
                  </span>

                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-border px-4 py-3 space-y-3">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Prompt Sent
                      </p>
                      <pre className="rounded border border-border bg-sidebar p-2 font-mono text-xs text-muted-foreground whitespace-pre-wrap">
                        {result.prompt}
                      </pre>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Response
                      </p>
                      <pre className="rounded border border-border bg-sidebar p-2 font-mono text-xs text-muted-foreground whitespace-pre-wrap">
                        {result.response}
                      </pre>
                    </div>
                    {result.analysis && (
                      <div className="space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Analysis
                        </p>

                        {/* Classification + Confidence */}
                        <div className="flex items-center gap-3">
                          <Badge
                            variant="outline"
                            className={`text-[10px] uppercase ${classificationBadgeClass(result.analysis.classification)}`}
                          >
                            {classificationLabel(result.analysis.classification)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Confidence: {Math.round(result.analysis.confidence * 100)}%
                          </span>
                        </div>

                        {/* Severity Score Bar */}
                        <div>
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Severity Score</span>
                            <span className="font-mono font-medium text-foreground">
                              {result.analysis.severityScore}/10
                            </span>
                          </div>
                          <Progress
                            value={result.analysis.severityScore * 10}
                            className={`h-2 bg-secondary ${severityScoreColor(result.analysis.severityScore)}`}
                          />
                        </div>

                        {/* Reasoning */}
                        <p className="text-sm text-foreground">
                          {result.analysis.reasoning}
                        </p>

                        {/* Indicators */}
                        {result.analysis.indicators.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {result.analysis.indicators.map((indicator) => (
                              <Badge
                                key={indicator}
                                variant="outline"
                                className="border-border text-[10px] text-muted-foreground"
                              >
                                {indicator}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Leaked Data */}
                        {result.analysis.leakedData.length > 0 && (
                          <div className="rounded border border-redpincer/40 bg-redpincer/5 p-2">
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-redpincer">
                              Leaked Data ({result.analysis.leakedData.length})
                            </p>
                            <div className="space-y-1">
                              {result.analysis.leakedData.map((data, i) => (
                                <pre
                                  key={i}
                                  className="rounded bg-background/50 px-2 py-1 font-mono text-xs text-redpincer/80 whitespace-pre-wrap break-all"
                                >
                                  {data}
                                </pre>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
