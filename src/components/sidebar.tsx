"use client";

import { useStore } from "@/lib/store";
import { allPayloads } from "@/lib/attacks";
import type { AttackCategory, AttackRun } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Shield,
  Target,
  Play,
  FileText,
  Loader2,
  Plus,
  Wifi,
  WifiOff,
  BarChart3,
  Link2,
  Database,
  Edit3,
} from "lucide-react";

const ATTACK_CATEGORIES: AttackCategory[] = [
  "injection",
  "jailbreak",
  "extraction",
  "bypass",
];

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
    setActiveRun,
  } = useStore();

  const canRun =
    activeTargetId !== null && selectedCategories.length > 0 && !isRunning;

  const runAttacks = async () => {
    const target = targets.find((t) => t.id === activeTargetId);
    if (!target) return;

    const runId = crypto.randomUUID();
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
          categories: selectedCategories,
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
              const result = JSON.parse(line);
              addResult(runId, result);
            } catch {
              // skip malformed lines
            }
          }
        }
      }
    } catch (err) {
      console.error("Attack run failed:", err);
    } finally {
      completeRun(runId);
      setIsRunning(false);
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

      <ScrollArea className="flex-1">
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
        </div>
      </ScrollArea>

      {/* RUN Button */}
      <div className="p-4">
        <Button
          className="w-full gap-2 bg-redpincer font-semibold text-redpincer-foreground hover:bg-redpincer/90 disabled:opacity-40"
          size="lg"
          disabled={!canRun}
          onClick={runAttacks}
        >
          {isRunning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              RUN ATTACK
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
