"use client";

import React, { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Plus,
  Layers,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Percent,
  Hash,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";
import { ContestSearchInput, CodeforcesContestItem } from "@/components/contest/ContestSearchInput";
import type {
  ContestCreatePayload,
  BatchContestCreatePayload,
  ContestResponse,
} from "@/types/contest";

interface AddContestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: number;
  onContestCreated?: (contest: ContestResponse | ContestResponse[]) => void;
}

type ThresholdMode = "absolute" | "percent";

export const AddContestModal: React.FC<AddContestModalProps> = ({
  open,
  onOpenChange,
  groupId,
  onContestCreated,
}) => {
  const [mode, setMode] = useState<"single" | "batch">("single");

  // Single add state
  const [cfContestId, setCfContestId] = useState("");
  const [contestName, setContestName] = useState("");
  const [thresholdMode, setThresholdMode] =
    useState<ThresholdMode>("absolute");
  const [thresholdValue, setThresholdValue] = useState("1");
  const [lockParticipants, setLockParticipants] = useState(false);

  // Batch add state
  const [batchIds, setBatchIds] = useState<number[]>([]);
  const [batchInput, setBatchInput] = useState("");
  const [batchThresholdMode, setBatchThresholdMode] =
    useState<ThresholdMode>("absolute");
  const [batchThresholdValue, setBatchThresholdValue] = useState("1");

  // Shared state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const resetForm = useCallback(() => {
    setCfContestId("");
    setContestName("");
    setThresholdMode("absolute");
    setThresholdValue("1");
    setLockParticipants(false);
    setBatchIds([]);
    setBatchInput("");
    setBatchThresholdMode("absolute");
    setBatchThresholdValue("1");
    setError(null);
    setSuccess(false);
  }, []);

  const handleClose = useCallback(() => {
    if (!submitting) {
      resetForm();
      onOpenChange(false);
    }
  }, [submitting, resetForm, onOpenChange]);

  const addBatchId = () => {
    const id = parseInt(batchInput.trim(), 10);
    if (!isNaN(id) && id > 0 && !batchIds.includes(id)) {
      setBatchIds((prev) => [...prev, id]);
      setBatchInput("");
    }
  };

  const removeBatchId = (id: number) => {
    setBatchIds((prev) => prev.filter((i) => i !== id));
  };

  const handleBatchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addBatchId();
    }
  };

  const handleSingleSubmit = async () => {
    const id = parseInt(cfContestId.trim(), 10);
    if (isNaN(id) || id <= 0) {
      setError("Please enter a valid Codeforces contest ID");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload: ContestCreatePayload = {
        group_id: groupId,
        cf_contest_id: id,
        name: contestName.trim() || undefined,
        min_solved: parseInt(thresholdValue, 10) || 1,
        min_solved_is_percent: thresholdMode === "percent",
        lock_participants: lockParticipants,
      };

      const result = await apiClient.post<ContestResponse>(
        "/contests",
        payload
      );
      setSuccess(true);
      onContestCreated?.(result);
      setTimeout(() => {
        handleClose();
      }, 1000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create contest"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleBatchSubmit = async () => {
    if (batchIds.length === 0) {
      setError("Add at least one contest ID");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload: BatchContestCreatePayload = {
        group_id: groupId,
        contest_ids: batchIds,
        min_solved: parseInt(batchThresholdValue, 10) || 1,
        min_solved_is_percent: batchThresholdMode === "percent",
      };

      const result = await apiClient.post<ContestResponse[]>(
        "/contests/batch",
        payload
      );
      setSuccess(true);
      onContestCreated?.(result);
      setTimeout(() => {
        handleClose();
      }, 1000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create contests"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const ThresholdInput: React.FC<{
    tMode: ThresholdMode;
    setTMode: (m: ThresholdMode) => void;
    value: string;
    setValue: (v: string) => void;
  }> = ({ tMode, setTMode, value, setValue }) => (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Pass Threshold
      </label>
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-lg border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setTMode("absolute")}
            className={cn(
              "px-3 py-2 text-xs font-medium transition-colors flex items-center gap-1.5",
              tMode === "absolute"
                ? "bg-primary/15 text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
            )}
          >
            <Hash className="h-3 w-3" />
            Count
          </button>
          <div className="w-px h-6 bg-border" />
          <button
            type="button"
            onClick={() => setTMode("percent")}
            className={cn(
              "px-3 py-2 text-xs font-medium transition-colors flex items-center gap-1.5",
              tMode === "percent"
                ? "bg-primary/15 text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
            )}
          >
            <Percent className="h-3 w-3" />
            Percentage
          </button>
        </div>
        <Input
          type="number"
          min={1}
          max={tMode === "percent" ? 100 : 99}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-20 bg-secondary/80 text-center tabular-nums"
        />
        <span className="text-xs text-muted-foreground">
          {tMode === "percent"
            ? "% of total problems"
            : `problem${parseInt(value) !== 1 ? "s" : ""} to pass`}
        </span>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Add Contest
          </DialogTitle>
        </DialogHeader>

        <Tabs
          value={mode}
          onValueChange={(v) => {
            setMode(v as "single" | "batch");
            setError(null);
            setSuccess(false);
          }}
        >
          <TabsList className="w-full">
            <TabsTrigger value="single" className="flex-1 gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Single
            </TabsTrigger>
            <TabsTrigger value="batch" className="flex-1 gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              Batch
            </TabsTrigger>
          </TabsList>

          {/* Single Add */}
          <TabsContent value="single">
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Codeforces Contest ID or Search *
                </label>
                <ContestSearchInput
                  value={cfContestId}
                  onChange={(val) => setCfContestId(val)}
                  onSelectContest={(c) => {
                    setCfContestId(String(c.id));
                    if (!contestName) {
                      setContestName(c.name);
                    }
                  }}
                  placeholder="Type ID or search contest name (e.g. 1980)..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Custom Name{" "}
                  <span className="text-muted-foreground/60">(optional)</span>
                </label>
                <Input
                  placeholder="Auto-fetched from Codeforces if empty"
                  value={contestName}
                  onChange={(e) => setContestName(e.target.value)}
                  className="bg-secondary/80"
                />
              </div>

              <ThresholdInput
                tMode={thresholdMode}
                setTMode={setThresholdMode}
                value={thresholdValue}
                setValue={setThresholdValue}
              />

              <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                <input
                  type="checkbox"
                  checked={lockParticipants}
                  onChange={(e) => setLockParticipants(e.target.checked)}
                  className="rounded bg-secondary border-border text-primary focus:ring-primary"
                />
                Lock participants (prevent auto-import from Codeforces)
              </label>
            </div>
          </TabsContent>

          {/* Batch Add */}
          <TabsContent value="batch">
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Contest IDs
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Enter contest ID..."
                    value={batchInput}
                    onChange={(e) => setBatchInput(e.target.value)}
                    onKeyDown={handleBatchKeyDown}
                    className="bg-secondary/80 tabular-nums"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addBatchId}
                    disabled={!batchInput.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Batch ID chips */}
              {batchIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {batchIds.map((id) => (
                    <Badge
                      key={id}
                      variant="outline"
                      className="gap-1 pr-1 pl-2.5"
                    >
                      <span className="tabular-nums">{id}</span>
                      <button
                        onClick={() => removeBatchId(id)}
                        className="ml-0.5 p-0.5 rounded hover:bg-destructive/20 hover:text-rose-400 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  <button
                    onClick={() => setBatchIds([])}
                    className="text-[10px] text-muted-foreground hover:text-rose-400 transition-colors flex items-center gap-0.5"
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear all
                  </button>
                </div>
              )}

              {batchIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {batchIds.length} contest
                  {batchIds.length !== 1 ? "s" : ""} queued
                </p>
              )}

              <ThresholdInput
                tMode={batchThresholdMode}
                setTMode={setBatchThresholdMode}
                value={batchThresholdValue}
                setValue={setBatchThresholdValue}
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Error / Success indicators */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-rose-400 bg-rose-950/20 border border-rose-500/20 rounded-lg px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p className="text-xs">{error}</p>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-950/20 border border-emerald-500/20 rounded-lg px-3 py-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <p className="text-xs">
              Contest{mode === "batch" ? "s" : ""} created successfully!
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={mode === "single" ? handleSingleSubmit : handleBatchSubmit}
            disabled={submitting || success}
            className="gap-2"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === "single" ? (
              <Plus className="h-4 w-4" />
            ) : (
              <Layers className="h-4 w-4" />
            )}
            {submitting
              ? "Creating..."
              : mode === "single"
                ? "Add Contest"
                : `Add ${batchIds.length} Contest${batchIds.length !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
