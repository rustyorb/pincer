import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  TargetConfig,
  AttackCategory,
  AttackRun,
  AttackResult,
} from "./types";

type ViewName = "config" | "attacks" | "results" | "reports" | "chains" | "session" | "editor";

interface AppState {
  // Targets
  targets: TargetConfig[];
  activeTargetId: string | null;
  addTarget: (target: TargetConfig) => void;
  updateTarget: (id: string, updates: Partial<TargetConfig>) => void;
  removeTarget: (id: string) => void;
  setActiveTarget: (id: string | null) => void;

  // Attack selection
  selectedCategories: AttackCategory[];
  toggleCategory: (category: AttackCategory) => void;
  setCategories: (categories: AttackCategory[]) => void;

  // Attack runs
  runs: AttackRun[];
  activeRunId: string | null;
  addRun: (run: AttackRun) => void;
  addResult: (runId: string, result: AttackResult) => void;
  completeRun: (runId: string) => void;
  setActiveRun: (id: string | null) => void;

  // UI state (not persisted)
  view: ViewName;
  setView: (view: ViewName) => void;
  isRunning: boolean;
  setIsRunning: (running: boolean) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // Targets
      targets: [],
      activeTargetId: null,
      addTarget: (target) =>
        set((state) => ({ targets: [...state.targets, target] })),
      updateTarget: (id, updates) =>
        set((state) => ({
          targets: state.targets.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        })),
      removeTarget: (id) =>
        set((state) => ({
          targets: state.targets.filter((t) => t.id !== id),
          activeTargetId:
            state.activeTargetId === id ? null : state.activeTargetId,
        })),
      setActiveTarget: (id) => set({ activeTargetId: id }),

      // Attack selection
      selectedCategories: ["injection", "jailbreak", "extraction", "bypass"],
      toggleCategory: (category) =>
        set((state) => ({
          selectedCategories: state.selectedCategories.includes(category)
            ? state.selectedCategories.filter((c) => c !== category)
            : [...state.selectedCategories, category],
        })),
      setCategories: (categories) => set({ selectedCategories: categories }),

      // Attack runs
      runs: [],
      activeRunId: null,
      addRun: (run) => set((state) => ({ runs: [run, ...state.runs] })),
      addResult: (runId, result) =>
        set((state) => ({
          runs: state.runs.map((r) =>
            r.id === runId ? { ...r, results: [...r.results, result] } : r
          ),
        })),
      completeRun: (runId) =>
        set((state) => ({
          runs: state.runs.map((r) =>
            r.id === runId
              ? { ...r, status: "completed" as const, endTime: Date.now() }
              : r
          ),
        })),
      setActiveRun: (id) => set({ activeRunId: id }),

      // UI state
      view: "config",
      setView: (view) => set({ view }),
      isRunning: false,
      setIsRunning: (running) => set({ isRunning: running }),
    }),
    {
      name: "redpincer-state",
      partialize: (state) => ({
        targets: state.targets,
        activeTargetId: state.activeTargetId,
        selectedCategories: state.selectedCategories,
        runs: state.runs,
        activeRunId: state.activeRunId,
      }),
    }
  )
);
