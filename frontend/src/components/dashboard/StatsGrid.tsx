"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  FolderKanban,
  Trophy,
  Users,
  TrendingUp,
  Award,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardSummary } from "@/types/analytics";

interface StatsGridProps {
  summary: DashboardSummary;
}

export const StatsGrid: React.FC<StatsGridProps> = ({ summary }) => {
  const isHealthyPassRate = summary.overall_pass_rate >= 50;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Training Groups */}
      <Card className="bg-zinc-900/80 border-zinc-800/80 hover:border-zinc-700/80 transition-all shadow-sm">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Training Groups
            </p>
            <h3 className="text-2xl font-black text-white mt-1">
              {summary.total_groups}
            </h3>
            <p className="text-[11px] text-zinc-500 mt-1">Active rosters & cohorts</p>
          </div>
          <div className="p-3 bg-indigo-950/40 border border-indigo-800/40 rounded-xl text-indigo-400">
            <FolderKanban className="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      {/* 2. Tracked Contests */}
      <Card className="bg-zinc-900/80 border-zinc-800/80 hover:border-zinc-700/80 transition-all shadow-sm">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Tracked Contests
            </p>
            <h3 className="text-2xl font-black text-amber-400 mt-1">
              {summary.total_contests}
            </h3>
            <p className="text-[11px] text-zinc-500 mt-1">Codeforces problemsets</p>
          </div>
          <div className="p-3 bg-amber-950/40 border border-amber-800/40 rounded-xl text-amber-400">
            <Trophy className="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      {/* 3. Unique Participants */}
      <Card className="bg-zinc-900/80 border-zinc-800/80 hover:border-zinc-700/80 transition-all shadow-sm">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Total Participants
            </p>
            <h3 className="text-2xl font-black text-purple-400 mt-1">
              {summary.total_participants}
            </h3>
            <p className="text-[11px] text-zinc-500 mt-1">Unique student handles</p>
          </div>
          <div className="p-3 bg-purple-950/40 border border-purple-800/40 rounded-xl text-purple-400">
            <Users className="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      {/* 4. Overall Pass Rate */}
      <Card className="bg-zinc-900/80 border-zinc-800/80 hover:border-zinc-700/80 transition-all shadow-sm">
        <CardContent className="p-5 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Overall Pass Rate
            </p>
            <div className="flex items-baseline gap-2">
              <h3
                className={cn(
                  "text-2xl font-black",
                  isHealthyPassRate ? "text-emerald-400" : "text-amber-400"
                )}
              >
                {summary.overall_pass_rate}%
              </h3>
            </div>
            <div className="w-28 h-1.5 bg-zinc-800 rounded-full overflow-hidden mt-1.5">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  isHealthyPassRate ? "bg-emerald-500" : "bg-amber-500"
                )}
                style={{ width: `${Math.min(100, Math.max(0, summary.overall_pass_rate))}%` }}
              />
            </div>
          </div>
          <div
            className={cn(
              "p-3 rounded-xl border",
              isHealthyPassRate
                ? "bg-emerald-950/40 border-emerald-800/40 text-emerald-400"
                : "bg-amber-950/40 border-amber-800/40 text-amber-400"
            )}
          >
            <TrendingUp className="w-6 h-6" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
