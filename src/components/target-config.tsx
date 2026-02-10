"use client";
import { generateId } from "@/lib/uuid";

import { useState } from "react";
import { useStore } from "@/lib/store";
import type { TargetConfig } from "@/lib/types";
import { PROVIDER_PRESETS } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  Settings,
  Wifi,
  WifiOff,
  Loader2,
  CheckCircle,
  XCircle,
  Trash2,
  Pencil,
  X,
  Download,
} from "lucide-react";

type Provider = TargetConfig["provider"];

export function TargetConfig() {
  const { targets, addTarget, removeTarget, updateTarget, setActiveTarget, setView } =
    useStore();

  const [name, setName] = useState("");
  const [provider, setProvider] = useState<Provider>("openai");
  const [endpoint, setEndpoint] = useState(PROVIDER_PRESETS.openai.endpoint);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latency?: number;
    error?: string;
  } | null>(null);

  // Model fetching state
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [modelInputMode, setModelInputMode] = useState<"select" | "manual">("select");

  // Edit mode state
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleProviderChange = (value: string) => {
    const p = value as Provider;
    setProvider(p);
    setEndpoint(PROVIDER_PRESETS[p].endpoint);
    setTestResult(null);
    setFetchedModels([]);
    setFetchError(null);
    setModel("");
    setModelInputMode("select");
  };

  const fetchModels = async () => {
    if (!apiKey.trim()) return;

    setIsFetchingModels(true);
    setFetchError(null);

    try {
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint, apiKey, provider }),
      });

      const data = await res.json();

      if (data.error) {
        setFetchError(data.error);
        setFetchedModels([]);
        setModelInputMode("manual");
      } else if (data.models.length === 0) {
        setModelInputMode("manual");
        setFetchedModels([]);
      } else {
        setFetchedModels(data.models);
        setModelInputMode("select");
      }
    } catch {
      setFetchError("Failed to fetch models");
      setModelInputMode("manual");
    } finally {
      setIsFetchingModels(false);
    }
  };

  const testConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint, apiKey, model, provider }),
      });

      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({ success: false, error: "Network error" });
    } finally {
      setIsTesting(false);
    }
  };

  const resetForm = () => {
    setName("");
    setApiKey("");
    setModel("");
    setProvider("openai");
    setEndpoint(PROVIDER_PRESETS.openai.endpoint);
    setTestResult(null);
    setFetchedModels([]);
    setFetchError(null);
    setEditingId(null);
    setModelInputMode("select");
  };

  const saveTarget = () => {
    if (!name.trim() || !endpoint.trim() || !apiKey.trim() || !model.trim())
      return;

    if (editingId) {
      updateTarget(editingId, {
        name: name.trim(),
        endpoint: endpoint.trim(),
        apiKey: apiKey.trim(),
        model: model.trim(),
        provider,
        connected: testResult?.success ?? false,
      });
      resetForm();
    } else {
      const target: TargetConfig = {
        id: generateId(),
        name: name.trim(),
        endpoint: endpoint.trim(),
        apiKey: apiKey.trim(),
        model: model.trim(),
        provider,
        connected: testResult?.success ?? false,
      };

      addTarget(target);
      setActiveTarget(target.id);
      resetForm();
    }
  };

  const startEditing = (target: TargetConfig) => {
    setEditingId(target.id);
    setName(target.name);
    setProvider(target.provider);
    setEndpoint(target.endpoint);
    setApiKey(target.apiKey);
    setModel(target.model);
    setTestResult(null);
    setFetchedModels([]);
    setFetchError(null);
    setModelInputMode("manual");
  };

  const cancelEdit = () => {
    resetForm();
  };

  const canSave = name.trim() && endpoint.trim() && apiKey.trim() && model.trim();

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Settings className="h-6 w-6 text-redpincer" />
          Target Configuration
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure an AI/LLM endpoint to test against.
        </p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-lg">
            {editingId ? "Edit Target" : "New Target"}
          </CardTitle>
          <CardDescription>
            {editingId
              ? "Update connection details for this target."
              : "Set up connection details for the target LLM endpoint."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Target Name */}
          <div className="space-y-2">
            <Label htmlFor="target-name">Target Name</Label>
            <Input
              id="target-name"
              placeholder="e.g., Production GPT-4o"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-background"
            />
          </div>

          {/* Provider */}
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={provider} onValueChange={handleProviderChange}>
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder="Select a provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="openrouter">OpenRouter</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Endpoint */}
          <div className="space-y-2">
            <Label htmlFor="endpoint">API Endpoint</Label>
            <Input
              id="endpoint"
              placeholder="https://api.example.com/v1/chat/completions"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              className="bg-background font-mono text-sm"
            />
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              type="password"
              placeholder={PROVIDER_PRESETS[provider].placeholder}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="bg-background font-mono text-sm"
            />
          </div>

          {/* Model */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="model">Model</Label>
              <div className="flex items-center gap-2">
                {provider !== "custom" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchModels}
                    disabled={!apiKey.trim() || isFetchingModels}
                    className="h-7 gap-1.5 px-2 text-xs"
                  >
                    {isFetchingModels ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Fetching...
                      </>
                    ) : (
                      <>
                        <Download className="h-3 w-3" />
                        Fetch Models
                      </>
                    )}
                  </Button>
                )}
                {fetchedModels.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setModelInputMode(
                        modelInputMode === "select" ? "manual" : "select"
                      )
                    }
                    className="h-7 px-2 text-xs text-muted-foreground"
                  >
                    {modelInputMode === "select"
                      ? "Type manually"
                      : "Use dropdown"}
                  </Button>
                )}
              </div>
            </div>

            {fetchError && (
              <p className="text-xs text-redpincer">{fetchError}</p>
            )}

            {modelInputMode === "select" && fetchedModels.length > 0 ? (
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="w-full bg-background font-mono text-sm">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {fetchedModels.map((m) => (
                    <SelectItem key={m} value={m} className="font-mono text-sm">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="model"
                placeholder="e.g., gpt-4o, claude-sonnet-4-20250514, etc."
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="bg-background font-mono text-sm"
              />
            )}
          </div>

          <Separator />

          {/* Test Connection */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={testConnection}
              disabled={!endpoint.trim() || !apiKey.trim() || !model.trim() || isTesting}
              className="gap-2"
            >
              {isTesting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Wifi className="h-4 w-4" />
                  Test Connection
                </>
              )}
            </Button>

            {testResult && (
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-success" />
                    <span className="text-sm text-success">
                      Connected ({testResult.latency}ms)
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-redpincer" />
                    <span className="text-sm text-redpincer">
                      {testResult.error || "Connection failed"}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Save / Update / Cancel */}
          <div className="flex gap-2">
            <Button
              onClick={saveTarget}
              disabled={!canSave}
              className="flex-1 gap-2 bg-redpincer font-semibold text-redpincer-foreground hover:bg-redpincer/90"
            >
              <Target className="h-4 w-4" />
              {editingId ? "Update Target" : "Save Target"}
            </Button>
            {editingId && (
              <Button
                variant="outline"
                onClick={cancelEdit}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Saved Targets List */}
      {targets.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-lg">Saved Targets</CardTitle>
            <CardDescription>
              {targets.length} target{targets.length !== 1 ? "s" : ""} configured
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {targets.map((target) => (
                <div
                  key={target.id}
                  className={`flex items-center justify-between rounded-lg border p-3 ${
                    editingId === target.id
                      ? "border-redpincer bg-redpincer/5"
                      : "border-border bg-background"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${
                        target.connected ? "bg-success" : "bg-muted-foreground"
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium">{target.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {target.model} &middot; {target.provider}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={target.connected ? "default" : "secondary"}
                      className={
                        target.connected
                          ? "bg-success/20 text-success"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {target.connected ? "Connected" : "Untested"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditing(target)}
                      disabled={editingId === target.id}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTarget(target.id)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-redpincer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
