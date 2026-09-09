"use client";

import React, { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Search,
  Trophy,
  Medal,
  Crown,
  Users,
  ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  CachedResultResponse,
  ContestResponse,
} from "@/types/contest";

interface ContestStandingsProps {
  contest: ContestResponse;
  standings: CachedResultResponse[];
  summary: {
    total: number;
    participated: number;
    not_participated: number;
  };
}

type SortField = "rank" | "solved" | "handle";
type SortDir = "asc" | "desc";

const getRankBadge = (position: number) => {
  if (position === 1)
    return (
      <Badge variant="gold" className="gap-1">
        <Crown className="h-3 w-3" /> 1st
      </Badge>
    );
  if (position === 2)
    return (
      <Badge variant="silver" className="gap-1">
        <Medal className="h-3 w-3" /> 2nd
      </Badge>
    );
  if (position === 3)
    return (
      <Badge variant="bronze" className="gap-1">
        <Trophy className="h-3 w-3" /> 3rd
      </Badge>
    );
  return null;
};

const getRankGlow = (position: number) => {
  if (position === 1) return "ring-1 ring-amber-500/30 bg-amber-500/5";
  if (position === 2) return "ring-1 ring-slate-400/20 bg-slate-400/5";
  if (position === 3) return "ring-1 ring-amber-800/20 bg-amber-800/5";
  return "";
};

export const ContestStandings: React.FC<ContestStandingsProps> = ({
  contest,
  standings,
  summary,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "solved" ? "desc" : "asc");
    }
  };

  const sortedStandings = useMemo(() => {
    let list = [...standings];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((s) => s.handle.toLowerCase().includes(q));
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "rank":
          // Unranked (rank=0 or not participated) go to the bottom
          if (!a.participated && !b.participated) cmp = 0;
          else if (!a.participated) cmp = 1;
          else if (!b.participated) cmp = -1;
          else if (a.rank === 0 && b.rank === 0) cmp = 0;
          else if (a.rank === 0) cmp = 1;
          else if (b.rank === 0) cmp = -1;
          else cmp = a.rank - b.rank;
          break;
        case "solved":
          cmp = a.solved_count - b.solved_count;
          break;
        case "handle":
          cmp = a.handle.localeCompare(b.handle);
          break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return list;
  }, [standings, searchQuery, sortField, sortDir]);

  // Find the podium positions (top 3 participated by rank)
  const podiumRanks = useMemo(() => {
    const participated = standings
      .filter((s) => s.participated && s.rank > 0)
      .sort((a, b) => a.rank - b.rank);
    const ranks = new Map<number, number>();
    let position = 0;
    let lastRank = -1;
    for (const s of participated) {
      if (s.rank !== lastRank) {
        position++;
        lastRank = s.rank;
      }
      if (position <= 3) ranks.set(s.id, position);
      else break;
    }
    return ranks;
  }, [standings]);

  const SortHeader: React.FC<{
    field: SortField;
    label: string;
    className?: string;
  }> = ({ field, label, className }) => (
    <th
      className={cn(
        "px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors group",
        className
      )}
      onClick={() => toggleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown
          className={cn(
            "h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity",
            sortField === field && "opacity-100 text-primary"
          )}
        />
      </span>
    </th>
  );

  return (
    <div className="space-y-4">
      {/* Summary Bar */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Total:</span>
          <span className="font-bold tabular-nums">{summary.total}</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Participated:</span>
          <span className="font-bold text-primary tabular-nums">
            {summary.participated}
          </span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Not Entered:</span>
          <span className="font-bold text-zinc-500 tabular-nums">
            {summary.not_participated}
          </span>
        </div>
        <div className="ml-auto">
          <Badge variant="outline">
            Req: {contest.required_solved} problem
            {contest.required_solved !== 1 ? "s" : ""}
          </Badge>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search handle..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-secondary/80 border-border"
        />
      </div>

      {/* Standings Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/60">
              <SortHeader
                field="rank"
                label="Rank"
                className="text-center w-20"
              />
              <SortHeader field="handle" label="Handle" className="text-left" />
              <SortHeader
                field="solved"
                label="Solved"
                className="text-center w-24"
              />
              <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-24">
                Status
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-28">
                Award
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedStandings.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Trophy className="h-8 w-8 opacity-30" />
                    <p className="text-sm">No standings available</p>
                  </div>
                </td>
              </tr>
            ) : (
              sortedStandings.map((s) => {
                const podiumPos = podiumRanks.get(s.id);
                return (
                  <tr
                    key={s.id}
                    className={cn(
                      "border-b border-border/50 transition-all hover:bg-accent/30",
                      podiumPos && getRankGlow(podiumPos)
                    )}
                  >
                    <td className="px-4 py-3 text-center tabular-nums font-medium">
                      {s.participated && s.rank > 0 ? (
                        <span
                          className={cn(
                            podiumPos === 1 && "text-amber-300 font-bold",
                            podiumPos === 2 && "text-slate-300 font-bold",
                            podiumPos === 3 && "text-amber-600 font-bold"
                          )}
                        >
                          {s.rank}
                        </span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`https://codeforces.com/profile/${s.handle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "hover:underline font-medium transition-colors",
                          podiumPos
                            ? "text-foreground"
                            : "text-primary hover:text-primary/80"
                        )}
                      >
                        {s.handle}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">
                      <span className="font-medium">{s.solved_count}</span>
                      <span className="text-muted-foreground text-xs ml-0.5">
                        /{contest.total_problems}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {s.passed ? (
                        <Badge variant="success" className="text-[10px]">
                          Passed
                        </Badge>
                      ) : s.participated ? (
                        <Badge variant="destructive" className="text-[10px]">
                          Failed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-zinc-500">
                          N/A
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {podiumPos ? getRankBadge(podiumPos) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
