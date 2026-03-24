"use client";
import { useRef, useState, useEffect } from "react";
import { generateId } from "@/lib/uuid";

import { useStore } from "@/lib/store";
import type { AttackCategory, AttackRun } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { getTargetKeyFields } from "@/lib/target-utils";
import {
  Shield,
  Target,
  Play,
  Square,
  FileText,
  Loader2,
  Plus,
  Wifi,
  WifiOff,
  BarChart3,
  Link2,
  Database,
  Edit3,
  GitCompareArrows,
  Brain,
  Grid3X3,
  GitBranch,
  Calculator,
  LogOut,
  Zap,
  Minus,
} from "lucide-react";
import { useAuth } from "@/lib/use-auth";

const ATTACK_CATEGORIES: AttackCategory[] = [
  "injection",
  "jailbreak",
  "extraction",
  "bypass",
  "tool_abuse",
  "multi_turn",
  "encoding",
];

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

function RunProgressDisplay({
  progress,
}: {
  progress: { total: number; completed: number; startTime: number };
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const { total, completed, startTime } = progress;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const elapsed = now - startTime;
  const avgPerPayload = completed > 0 ? elapsed / completed : 0;
  const remaining = completed > 0 ? Math.round(avgPerPayload * (total - completed)) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono font-semibold text-foreground">
          {completed}/{total}
        </span>
        <span className="text-muted-foreground">{percent}%</span>
      </div>
      <Progress value={percent} className="h-2 [&>[data-slot=progress-indicator]]:bg-redpincer" />
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{formatDuration(elapsed)} elapsed</span>
        {completed > 0 && completed < total && (
          <span>~{formatDuration(remaining)} left</span>
        )}
        {completed === total && total > 0 && <span>Done!</span>}
      </div>
    </div>
  );
}

export function Sidebar() {
  const {
    targets,
    activeTargetId,
    setActiveTarget,
    selectedCategories,
    toggleCategory,
    isRunning,
    setIsRunning,
    view,
    setView,
    addRun,
    addResult,
    completeRun,
    cancelRun,
    setActiveRun,
    concurrency,
    setConcurrency,
    runProgress,
    setRunProgress,
    incrementRunProgress,
  } = useStore();

  const { authEnabled, username, logout } = useAuth();
  const abortRef = useRef<AbortController | null>(null);

  const canRun =
    activeTargetId !== null && selectedCategories.length > 0 && !isRunning;

  const stopAttacks = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  };

  const runAttacks = async () => {
    const target = targets.find((t) => t.id === activeTargetId);
    if (!target) return;

    const controller = new AbortController();
    abortRef.current = controller;

    const runId = generateId();
    const run: AttackRun = {
      id: runId,
      targetId: target.id,
      targetName: target.name,
      categories: selectedCategories,
      results: [],
      startTime: Date.now(),
      status: "running",
    };

    addRun(run);
    setActiveRun(runId);
    setIsRunning(true);
    setRunProgress({ total: 0, completed: 0, startTime: Date.now() });
    setView("results");

    let wasCancelled = false;

    try {
      const res = await fetch("/api/attack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: target.endpoint,
          ...getTargetKeyFields(target),
          model: target.model,
          provider: target.provider,
          categories: selectedCategories,
          concurrency,
        }),
        signal: controller.signal,
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
              const parsed = JSON.parse(line);
              if (parsed.type === "meta" && typeof parsed.totalPayloads === "number") {
                setRunProgress({ total: parsed.totalPayloads, completed: 0, startTime: Date.now() });
              } else {
                addResult(runId, parsed);
                incrementRunProgress();
              }
            } catch {
              // skip malformed lines
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        wasCancelled = true;
      } else {
        console.error("Attack run failed:", err);
      }
    } finally {
      if (wasCancelled) {
        cancelRun(runId);
      } else {
        completeRun(runId);
      }
      setIsRunning(false);
      setRunProgress(null);
      abortRef.current = null;
    }
  };

  return (
    <aside className="flex h-screen w-[280px] shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-5">
        <span className="text-2xl" role="img" aria-label="lobster">
          🦞
        </span>
        <h1 className="text-xl font-bold tracking-tight text-redpincer">
          RedPincer
        </h1>
      </div>

      <Separator />

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-1 p-4">
          {/* TARGETS Section */}
          <div className="mb-4">
            <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Target className="h-3.5 w-3.5" />
              Targets
            </h2>

            <div className="flex flex-col gap-1">
              {targets.length === 0 && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground italic">
                  No targets configured
                </p>
              )}

              {targets.map((target) => (
                <button
                  key={target.id}
                  onClick={() => setActiveTarget(target.id)}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent ${
                    activeTargetId === target.id
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground"
                  }`}
                >
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      target.connected ? "bg-success" : "bg-muted-foreground"
                    }`}
                  />
                  <span className="truncate">{target.name}</span>
                  {target.connected ? (
                    <Wifi className="ml-auto h-3 w-3 text-success" />
                  ) : (
                    <WifiOff className="ml-auto h-3 w-3 text-muted-foreground" />
                  )}
                </button>
              ))}

              <Button
                variant="ghost"
                size="sm"
                className="mt-1 justify-start gap-2 text-muted-foreground hover:text-foreground"
                onClick={() => setView("config")}
              >
                <Plus className="h-3.5 w-3.5" />
                New Target
              </Button>
            </div>
          </div>

          <Separator />

          {/* ATTACKS Section */}
          <div className="my-4">
            <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Shield className="h-3.5 w-3.5" />
              Attacks
            </h2>

            <div className="flex flex-col gap-2">
              {ATTACK_CATEGORIES.map((cat) => (
                <label
                  key={cat}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors hover:bg-sidebar-accent"
                >
                  <Checkbox
                    checked={selectedCategories.includes(cat)}
                    onCheckedChange={() => toggleCategory(cat)}
                    className="border-muted-foreground data-[state=checked]:border-redpincer data-[state=checked]:bg-redpincer"
                  />
                  <span>{CATEGORY_LABELS[cat]}</span>
                </label>
              ))}
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
              onClick={() => setView("attacks")}
            >
              <Shield className="h-3.5 w-3.5" />
              Browse Modules
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
              onClick={() => setView("editor")}
            >
              <Edit3 className="h-3.5 w-3.5" />
              Payload Editor
            </Button>
          </div>

          <Separator />

          {/* Navigation */}
          <div className="my-4 flex flex-col gap-1">
            <button
              onClick={() => setView("chains")}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent ${
                view === "chains"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground"
              }`}
            >
              <Link2 className="h-4 w-4" />
              Chains
            </button>

            <button
              onClick={() => setView("results")}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent ${
                view === "results"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground"
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              Results
            </button>

            <button
              onClick={() => setView("reports")}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent ${
                view === "reports"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground"
              }`}
            >
              <FileText className="h-4 w-4" />
              Reports
            </button>

            <button
              onClick={() => setView("session")}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent ${
                view === "session"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground"
              }`}
            >
              <Database className="h-4 w-4" />
              Session
            </button>
          </div>

          <Separator />

          {/* Advanced Tools */}
          <div className="my-4 flex flex-col gap-1">
            <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Advanced
            </h2>

            <button
              onClick={() => setView("comparison")}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent ${
                view === "comparison"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground"
              }`}
            >
              <GitCompareArrows className="h-4 w-4" />
              Compare
            </button>

            <button
              onClick={() => setView("adaptive")}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent ${
                view === "adaptive"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground"
              }`}
            >
              <Brain className="h-4 w-4" />
              Adaptive
            </button>

            <button
              onClick={() => setView("heatmap")}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent ${
                view === "heatmap"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground"
              }`}
            >
              <Grid3X3 className="h-4 w-4" />
              Heatmap
            </button>

            <button
              onClick={() => setView("regression")}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent ${
                view === "regression"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground"
              }`}
            >
              <GitBranch className="h-4 w-4" />
              Regression
            </button>

            <button
              onClick={() => setView("scoring")}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent ${
                view === "scoring"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground"
              }`}
            >
              <Calculator className="h-4 w-4" />
              Scoring
            </button>
          </div>
        </div>
      </ScrollArea>

      {/* RUN / STOP Buttons */}
      <div className="shrink-0 border-t border-border p-4 space-y-2">
        {/* Concurrency selector */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Zap className="h-3 w-3" />
            Concurrency
          </label>
          <div className="flex items-center gap-1">
            <button
              className="flex h-6 w-6 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
              onClick={() => setConcurrency(concurrency - 1)}
              disabled={concurrency <= 1 || isRunning}
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="w-6 text-center text-xs font-mono font-semibold text-foreground">
              {concurrency}
            </span>
            <button
              className="flex h-6 w-6 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
              onClick={() => setConcurrency(concurrency + 1)}
              disabled={concurrency >= 10 || isRunning}
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>

        {isRunning && runProgress && runProgress.total > 0 && (
          <RunProgressDisplay progress={runProgress} />
        )}

        {isRunning ? (
          <Button
            className="w-full gap-2 bg-destructive font-semibold text-destructive-foreground hover:bg-destructive/90"
            size="lg"
            onClick={stopAttacks}
          >
            <Square className="h-4 w-4" />
            STOP
          </Button>
        ) : (
          <Button
            className="w-full gap-2 bg-redpincer font-semibold text-redpincer-foreground hover:bg-redpincer/90 disabled:opacity-40"
            size="lg"
            disabled={!canRun}
            onClick={runAttacks}
          >
            <Play className="h-4 w-4" />
            RUN ATTACK
          </Button>
        )}

        {authEnabled && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted-foreground truncate">
              {username || "authenticated"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={logout}
            >
              <LogOut className="h-3 w-3" />
              Logout
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
