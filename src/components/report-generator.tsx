"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { CATEGORY_LABELS } from "@/lib/types";
import type { AttackCategory, AttackRun } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Copy,
  Download,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

function generateReport(run: AttackRun): string {
  const totalAttacks = run.results.length;
  const successfulAttacks = run.results.filter((r) => r.success).length;
  const successRate =
    totalAttacks > 0 ? ((successfulAttacks / totalAttacks) * 100).toFixed(1) : "0";
  const criticalFindings = run.results.filter(
    (r) => r.success && r.severity === "critical"
  ).length;
  const highFindings = run.results.filter(
    (r) => r.success && r.severity === "high"
  ).length;

  const dateStr = new Date(run.startTime).toLocaleString();
  const durationMs = (run.endTime ?? Date.now()) - run.startTime;
  const durationSec = (durationMs / 1000).toFixed(1);

  const categories: AttackCategory[] = [
    "injection",
    "jailbreak",
    "extraction",
    "bypass",
  ];

  let report = `# RedPincer Security Assessment Report

## Executive Summary

- **Target:** ${run.targetName}
- **Date:** ${dateStr}
- **Duration:** ${durationSec}s
- **Status:** ${run.status}
- **Total Attacks:** ${totalAttacks}
- **Successful Attacks:** ${successfulAttacks} (${successRate}%)
- **Critical Findings:** ${criticalFindings}
- **High Findings:** ${highFindings}

---

## Risk Assessment

`;

  if (criticalFindings > 0) {
    report += `**CRITICAL RISK** - ${criticalFindings} critical vulnerability(ies) found. Immediate remediation required.\n\n`;
  } else if (highFindings > 0) {
    report += `**HIGH RISK** - ${highFindings} high-severity vulnerability(ies) found. Remediation recommended.\n\n`;
  } else if (successfulAttacks > 0) {
    report += `**MODERATE RISK** - ${successfulAttacks} successful attack(s) found at lower severity levels.\n\n`;
  } else {
    report += `**LOW RISK** - No successful attacks detected. Target appears well-hardened.\n\n`;
  }

  report += `---

## Findings by Category

`;

  for (const cat of categories) {
    const catResults = run.results.filter((r) => r.category === cat);
    if (catResults.length === 0) continue;

    const catSuccess = catResults.filter((r) => r.success);
    report += `### ${CATEGORY_LABELS[cat]}\n\n`;
    report += `- **Tested:** ${catResults.length} | **Breached:** ${catSuccess.length} | **Blocked:** ${catResults.length - catSuccess.length}\n\n`;

    if (catSuccess.length > 0) {
      report += `#### Successful Attacks\n\n`;
      for (const r of catSuccess) {
        report += `- **${r.payloadName}** [${r.severity.toUpperCase()}]\n`;
        report += `  - Duration: ${r.durationMs}ms\n`;
        report += `  - Classification: ${r.analysis.classification.toUpperCase()} (severity: ${r.analysis.severityScore}/10)\n`;
        report += `  - Analysis: ${r.analysis.reasoning}\n`;
        if (r.analysis.leakedData.length > 0) {
          report += `  - Leaked data: ${r.analysis.leakedData.join(", ")}\n`;
        }
        report += `\n`;
      }
    } else {
      report += `All ${catResults.length} attack(s) were successfully blocked.\n\n`;
    }
  }

  report += `---

## Detailed Results

| # | Payload | Category | Severity | Status | Duration |
|---|---------|----------|----------|--------|----------|
`;

  run.results.forEach((r, i) => {
    report += `| ${i + 1} | ${r.payloadName} | ${CATEGORY_LABELS[r.category]} | ${r.severity.toUpperCase()} | ${r.success ? "BREACHED" : "BLOCKED"} | ${r.durationMs}ms |\n`;
  });

  report += `
---

## Recommendations

`;

  if (successfulAttacks === 0) {
    report += `1. Continue monitoring for new attack vectors as they emerge.\n`;
    report += `2. Regularly update model system prompts and guardrails.\n`;
    report += `3. Re-run assessments after any significant configuration changes.\n`;
  } else {
    if (
      run.results.some(
        (r) => r.success && r.category === "injection"
      )
    ) {
      report += `1. **Strengthen input sanitization** - Implement robust prompt injection detection and filtering.\n`;
    }
    if (
      run.results.some(
        (r) => r.success && r.category === "jailbreak"
      )
    ) {
      report += `2. **Improve safety alignment** - Review and reinforce system prompt instructions against jailbreak techniques.\n`;
    }
    if (
      run.results.some(
        (r) => r.success && r.category === "extraction"
      )
    ) {
      report += `3. **Protect sensitive data** - Ensure system prompts do not contain extractable secrets; implement output filtering.\n`;
    }
    if (
      run.results.some(
        (r) => r.success && r.category === "bypass"
      )
    ) {
      report += `4. **Enhance guardrails** - Deploy additional content safety layers and output validators.\n`;
    }
    report += `5. Remediate findings and re-run this assessment to verify fixes.\n`;
    report += `6. Consider implementing rate limiting and anomaly detection.\n`;
  }

  report += `
---

*Generated by RedPincer AI Red Team Suite*
*Report timestamp: ${new Date().toISOString()}*
`;

  return report;
}

export function ReportGenerator() {
  const { runs, activeRunId } = useStore();
  const activeRun = runs.find((r) => r.id === activeRunId) ?? runs[0];
  const [showReport, setShowReport] = useState(false);

  const report = useMemo(() => {
    if (!activeRun) return "";
    return generateReport(activeRun);
  }, [activeRun]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(report);
      toast.success("Report copied to clipboard");
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const downloadReport = () => {
    const blob = new Blob([report], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `redpincer-report-${activeRun?.targetName?.replace(/\s+/g, "-").toLowerCase() ?? "unknown"}-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  };

  if (!activeRun) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-muted-foreground">
        <FileText className="h-16 w-16 opacity-30" />
        <p className="text-lg">No runs available</p>
        <p className="text-sm">
          Complete an attack run to generate a report.
        </p>
      </div>
    );
  }

  const totalAttacks = activeRun.results.length;
  const successfulAttacks = activeRun.results.filter((r) => r.success).length;
  const criticalFindings = activeRun.results.filter(
    (r) => r.success && r.severity === "critical"
  ).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      {/* Header */}
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <FileText className="h-6 w-6 text-redpincer" />
          Report Generator
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate a security assessment report for the latest attack run.
        </p>
      </div>

      {/* Run Summary */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-lg">Run Summary</CardTitle>
          <CardDescription>
            {activeRun.targetName} &middot;{" "}
            {new Date(activeRun.startTime).toLocaleString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{totalAttacks}</p>
              <p className="text-xs text-muted-foreground">Total Attacks</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-redpincer">
                {successfulAttacks}
              </p>
              <p className="text-xs text-muted-foreground">Breached</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-redpincer">
                {criticalFindings}
              </p>
              <p className="text-xs text-muted-foreground">Critical</p>
            </div>
          </div>

          {activeRun.status === "running" && (
            <div className="mt-4 flex items-center gap-2 text-sm text-warning">
              <Loader2 className="h-4 w-4 animate-spin" />
              Run still in progress. Report will be partial.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => setShowReport(true)}
          className="gap-2 bg-redpincer font-semibold text-redpincer-foreground hover:bg-redpincer/90"
          disabled={totalAttacks === 0}
        >
          <FileText className="h-4 w-4" />
          Generate Report
        </Button>

        {showReport && (
          <>
            <Button
              variant="outline"
              onClick={copyToClipboard}
              className="gap-2"
            >
              <Copy className="h-4 w-4" />
              Copy to Clipboard
            </Button>

            <Button
              variant="outline"
              onClick={downloadReport}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download .md
            </Button>
          </>
        )}
      </div>

      {/* Report Preview */}
      {showReport && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <FileText className="h-4 w-4" />
              Report Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <div className="rounded border border-border bg-sidebar p-4">
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted-foreground">
                  {report}
                </pre>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Past Runs */}
      {runs.length > 1 && (
        <>
          <Separator />
          <div>
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">
              Past Runs
            </h3>
            <div className="space-y-2">
              {runs.map((run) => {
                const runSuccess = run.results.filter(
                  (r) => r.success
                ).length;
                const isActive = run.id === activeRunId;

                return (
                  <button
                    key={run.id}
                    onClick={() => useStore.getState().setActiveRun(run.id)}
                    className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-accent/50 ${
                      isActive
                        ? "border-redpincer/50 bg-accent/30"
                        : "border-border bg-background"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium">{run.targetName}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(run.startTime).toLocaleString()} &middot;{" "}
                        {run.results.length} attacks
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {runSuccess > 0 ? (
                        <Badge className="bg-redpincer/20 text-redpincer border-transparent">
                          {runSuccess} breached
                        </Badge>
                      ) : (
                        <Badge className="bg-success/20 text-success border-transparent">
                          All blocked
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={
                          run.status === "running"
                            ? "text-warning"
                            : "text-muted-foreground"
                        }
                      >
                        {run.status}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
