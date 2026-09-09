"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  FolderKanban,
  Trophy,
  Users,
  Search,
  ArrowRight,
  ArrowUpDown,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { GroupAnalyticsCard } from "@/types/analytics";

interface GroupsTableProps {
  groups: GroupAnalyticsCard[];
}

type SortField = "name" | "contest_count" | "participant_count" | "pass_rate";
type SortDirection = "asc" | "desc";

export const GroupsTable: React.FC<GroupsTableProps> = ({ groups }) => {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("contest_count");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const filteredAndSortedGroups = useMemo(() => {
    return groups
      .filter((g) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          g.name.toLowerCase().includes(q) ||
          (g.description && g.description.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === "name") {
          cmp = a.name.localeCompare(b.name);
        } else {
          cmp = (a[sortField] || 0) - (b[sortField] || 0);
        }
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [groups, search, sortField, sortDir]);

  return (
    <div className="space-y-4">
      {/* Table Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <BarChart3 className="w-4 h-4 text-indigo-400" />
          <span>
            Training Cohorts Performance ({filteredAndSortedGroups.length})
          </span>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter groups..."
            className="h-9 pl-8 text-xs bg-zinc-900 border-zinc-800 text-zinc-200 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Table Container */}
      <div className="border border-zinc-800/80 rounded-xl overflow-hidden bg-zinc-900/60 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-800/60 border-b border-zinc-800 text-zinc-400 font-semibold uppercase tracking-wider">
                <th
                  onClick={() => handleSort("name")}
                  className="px-4 py-3.5 cursor-pointer hover:text-zinc-200 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Training Group</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("contest_count")}
                  className="px-4 py-3.5 cursor-pointer hover:text-zinc-200 transition-colors text-center"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Contests</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("participant_count")}
                  className="px-4 py-3.5 cursor-pointer hover:text-zinc-200 transition-colors text-center"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Participants</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("pass_rate")}
                  className="px-4 py-3.5 cursor-pointer hover:text-zinc-200 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Cohort Pass Rate</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredAndSortedGroups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-500">
                    <FolderKanban className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                    <span>No training groups found</span>
                  </td>
                </tr>
              ) : (
                filteredAndSortedGroups.map((group) => {
                  const hasResults = group.total_results > 0;
                  const isHealthy = group.pass_rate >= 50;

                  return (
                    <tr
                      key={group.id}
                      className="hover:bg-zinc-800/40 transition-colors group"
                    >
                      {/* Name & Description */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-0.5">
                          <Link
                            href={`/groups/${group.id}`}
                            className="font-bold text-sm text-zinc-100 group-hover:text-indigo-400 transition-colors inline-flex items-center gap-1.5"
                          >
                            <span>{group.name}</span>
                          </Link>
                          {group.description && (
                            <p className="text-zinc-400 text-xs line-clamp-1">
                              {group.description}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Contest count */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-800/80 border border-zinc-700/60 font-semibold text-zinc-200">
                          <Trophy className="w-3 h-3 text-amber-400" />
                          <span>{group.contest_count}</span>
                        </div>
                      </td>

                      {/* Participant count */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-800/80 border border-zinc-700/60 font-semibold text-zinc-200">
                          <Users className="w-3 h-3 text-indigo-400" />
                          <span>{group.participant_count}</span>
                        </div>
                      </td>

                      {/* Pass Rate & Mini bar */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-1.5 max-w-[180px]">
                          <div className="flex items-center justify-between gap-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[11px] font-bold px-2 py-0.5",
                                !hasResults
                                  ? "bg-zinc-800 border-zinc-700 text-zinc-400"
                                  : isHealthy
                                  ? "bg-emerald-950/50 border-emerald-700/60 text-emerald-300"
                                  : "bg-amber-950/50 border-amber-700/60 text-amber-300"
                              )}
                            >
                              {!hasResults
                                ? "No data"
                                : `${group.pass_rate}%`}
                            </Badge>
                            <span className="text-[10px] text-zinc-500">
                              {group.passed_count} / {group.total_results} passes
                            </span>
                          </div>

                          {hasResults && (
                            <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  isHealthy ? "bg-emerald-500" : "bg-amber-500"
                                )}
                                style={{ width: `${Math.min(100, group.pass_rate)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/groups/${group.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs bg-indigo-950/30 border-indigo-800/50 hover:bg-indigo-900/50 text-indigo-300 hover:text-indigo-100 font-medium"
                            >
                              <span>Overview Matrix</span>
                              <ArrowRight className="w-3 h-3 ml-1" />
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
