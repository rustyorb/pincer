"use client";

import { useStore } from "@/lib/store";
import { Sidebar } from "@/components/sidebar";
import { TargetConfig } from "@/components/target-config";
import { AttackModules } from "@/components/attack-modules";
import { ResultsDashboard } from "@/components/results-dashboard";
import { ReportGenerator } from "@/components/report-generator";
import { ChainBuilder } from "@/components/chain-builder";
import { SessionManager } from "@/components/session-manager";
import { PayloadEditor } from "@/components/payload-editor";

export default function Home() {
  const view = useStore((s) => s.view);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {view === "config" && <TargetConfig />}
        {view === "attacks" && <AttackModules />}
        {view === "results" && <ResultsDashboard />}
        {view === "reports" && <ReportGenerator />}
        {view === "chains" && <ChainBuilder />}
        {view === "session" && <SessionManager />}
        {view === "editor" && <PayloadEditor />}
      </main>
    </div>
  );
}
