"use client";

import React, { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Clipboard,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Users,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  CachedResultResponse,
  ContestResponse,
  ResultStatusFilter,
} from "@/types/contest";

interface ContestResultsProps {
  contest: ContestResponse;
  results: CachedResultResponse[];
  total: number;
  passed: number;
  failed: number;
  not_participated: number;
}

const STATUS_FILTERS: {
  key: ResultStatusFilter;
  label: string;
  icon: React.ElementType;
  color: string;
}[] = [
  { key: "all", label: "All", icon: Users, color: "text-foreground" },
  {
    key: "passed",
    label: "Passed",
    icon: CheckCircle2,
    color: "text-emerald-400",
  },
  { key: "failed", label: "Failed", icon: XCircle, color: "text-rose-400" },
  {
    key: "participated",
    label: "Participated",
    icon: Users,
    color: "text-primary",
  },
  {
    key: "not_participated",
    label: "Not Entered",
    icon: MinusCircle,
    color: "text-zinc-500",
  },
];

export const ContestResults: React.FC<ContestResultsProps> = ({
  contest,
  results,
  total,
  passed,
  failed,
  not_participated,
}) => {
  const [statusFilter, setStatusFilter] =
    useState<ResultStatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);

  const filteredResults = useMemo(() => {
    let filtered = results;

    // Apply status filter
    switch (statusFilter) {
      case "passed":
        filtered = filtered.filter((r) => r.passed);
        break;
      case "failed":
        filtered = filtered.filter((r) => r.participated && !r.passed);
        break;
      case "participated":
        filtered = filtered.filter((r) => r.participated);
        break;
      case "not_participated":
        filtered = filtered.filter((r) => !r.participated);
        break;
    }

    // Apply search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((r) => r.handle.toLowerCase().includes(q));
    }

    return filtered;
  }, [results, statusFilter, searchQuery]);

  const filterCounts: Record<ResultStatusFilter, number> = {
    all: total,
    passed,
    failed,
    participated: passed + failed,
    not_participated,
  };

  const handleCopyToClipboard = async () => {
    const lines = filteredResults.map(
      (r) =>
        `${r.handle}\t${r.solved_count}\t${r.passed ? "Passed" : r.participated ? "Failed" : "Not Entered"}\t${r.rank || "-"}`
    );
    const header = "Handle\tSolved\tStatus\tRank";
    const text = [header, ...lines].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getStatusIndicator = (result: CachedResultResponse) => {
    if (!result.participated) {
      return (
        <span className="inline-flex items-center gap-1.5 text-zinc-500">
          <MinusCircle className="h-3.5 w-3.5" />
          <span className="text-xs">Not Entered</span>
        </span>
      );
    }
    if (result.passed) {
      return (
        <span className="inline-flex items-center gap-1.5 text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">Passed</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-rose-400">
        <XCircle className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">Failed</span>
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-3.5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Total
          </p>
          <p className="text-2xl font-bold tabular-nums">{total}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3.5">
          <p className="text-xs text-emerald-400/80 uppercase tracking-wider mb-1">
            Passed
          </p>
          <p className="text-2xl font-bold text-emerald-400 tabular-nums">
            {passed}
          </p>
        </div>
        <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-3.5">
          <p className="text-xs text-rose-400/80 uppercase tracking-wider mb-1">
            Failed
          </p>
          <p className="text-2xl font-bold text-rose-400 tabular-nums">
            {failed}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3.5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Not Entered
          </p>
          <p className="text-2xl font-bold text-zinc-500 tabular-nums">
            {not_participated}
          </p>
        </div>
      </div>

      {/* Controls Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Status filter chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          {STATUS_FILTERS.map((sf) => (
            <button
              key={sf.key}
              onClick={() => setStatusFilter(sf.key)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap",
                statusFilter === sf.key
                  ? "bg-primary/15 border-primary/40 text-foreground shadow-sm"
                  : "bg-secondary/40 border-border text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
              )}
            >
              <sf.icon className={cn("h-3 w-3", sf.color)} />
              {sf.label}
              <span className="ml-0.5 opacity-60 tabular-nums">
                ({filterCounts[sf.key]})
              </span>
            </button>
          ))}
        </div>

        {/* Search + Export */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial sm:w-56">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search handle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-secondary/80 border-border"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyToClipboard}
            className="shrink-0 gap-1.5"
          >
            <Clipboard className="h-3.5 w-3.5" />
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
      </div>

      {/* Results Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/60">
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-12">
                #
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Handle
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-20">
                Solved
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-24">
                Status
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-20">
                Rank
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredResults.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Users className="h-8 w-8 opacity-30" />
                    <p className="text-sm">No results found</p>
                    <p className="text-xs opacity-60">
                      {searchQuery
                        ? "Try a different search query"
                        : "No participants match this filter"}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredResults.map((result, idx) => (
                <tr
                  key={result.id}
                  className={cn(
                    "border-b border-border/50 transition-colors hover:bg-accent/30",
                    result.passed && "hover:bg-emerald-950/15",
                    result.participated &&
                      !result.passed &&
                      "hover:bg-rose-950/15"
                  )}
                >
                  <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                    {idx + 1}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`https://codeforces.com/profile/${result.handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 hover:underline font-medium transition-colors"
                    >
                      {result.handle}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums">
                    <span className="font-medium">{result.solved_count}</span>
                    <span className="text-muted-foreground text-xs ml-0.5">
                      /{contest.total_problems}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {getStatusIndicator(result)}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums text-muted-foreground">
                    {result.rank > 0 ? result.rank : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          Showing {filteredResults.length} of {total} participants
        </span>
        <span>
          Pass threshold:{" "}
          <Badge variant="outline" className="ml-1">
            {contest.min_solved_is_percent
              ? `${contest.min_solved}%`
              : `${contest.required_solved} problem${contest.required_solved !== 1 ? "s" : ""}`}
          </Badge>
        </span>
      </div>
    </div>
  );
};
