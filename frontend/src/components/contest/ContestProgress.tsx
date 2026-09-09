"use client";

import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FetchHistoryResponse } from "@/types/contest";

interface ContestProgressProps {
  history: FetchHistoryResponse[];
  contestName: string;
}

export const ContestProgress: React.FC<ContestProgressProps> = ({
  history,
  contestName,
}) => {
  const chartData = useMemo(() => {
    if (!history.length) return [];

    return history.map((h) => {
      const passRate =
        h.total_count > 0
          ? Math.round((h.passed_count / h.total_count) * 100)
          : 0;
      return {
        ...h,
        passRate,
        date: new Date(h.fetch_date),
        dateLabel: new Date(h.fetch_date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      };
    });
  }, [history]);

  const maxTotal = useMemo(
    () => Math.max(1, ...chartData.map((d) => d.total_count)),
    [chartData]
  );

  const trend = useMemo(() => {
    if (chartData.length < 2) return "neutral";
    const last = chartData[chartData.length - 1].passRate;
    const prev = chartData[chartData.length - 2].passRate;
    if (last > prev) return "up";
    if (last < prev) return "down";
    return "neutral";
  }, [chartData]);

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <BarChart3 className="h-12 w-12 opacity-20 mb-4" />
        <p className="text-sm font-medium">No Progress Data Yet</p>
        <p className="text-xs mt-1 opacity-60">
          Refresh the contest to start tracking progress over time
        </p>
      </div>
    );
  }

  const latestEntry = chartData[chartData.length - 1];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Current Pass Rate
            </p>
            {trend === "up" && (
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            )}
            {trend === "down" && (
              <TrendingDown className="h-4 w-4 text-rose-400" />
            )}
            {trend === "neutral" && (
              <Minus className="h-4 w-4 text-zinc-500" />
            )}
          </div>
          <p
            className={cn(
              "text-2xl font-bold tabular-nums",
              latestEntry.passRate >= 50
                ? "text-emerald-400"
                : "text-rose-400"
            )}
          >
            {latestEntry.passRate}%
          </p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4">
          <p className="text-xs text-emerald-400/80 uppercase tracking-wider mb-2">
            Latest Passed
          </p>
          <p className="text-2xl font-bold text-emerald-400 tabular-nums">
            {latestEntry.passed_count}
          </p>
        </div>
        <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-4">
          <p className="text-xs text-rose-400/80 uppercase tracking-wider mb-2">
            Latest Failed
          </p>
          <p className="text-2xl font-bold text-rose-400 tabular-nums">
            {latestEntry.failed_count}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Snapshots
            </p>
          </div>
          <p className="text-2xl font-bold tabular-nums">
            {chartData.length}
          </p>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Pass Rate Over Time
          <Badge variant="outline" className="ml-auto text-[10px]">
            {contestName}
          </Badge>
        </h3>

        {/* Chart Area */}
        <div className="relative">
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-6 w-10 flex flex-col justify-between text-[10px] text-muted-foreground tabular-nums">
            <span>100%</span>
            <span>75%</span>
            <span>50%</span>
            <span>25%</span>
            <span>0%</span>
          </div>

          {/* Chart content */}
          <div className="ml-12 relative">
            {/* Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="border-t border-border/40 w-full" />
              ))}
            </div>

            {/* Bars */}
            <div
              className="relative flex items-end gap-1 overflow-x-auto pb-6"
              style={{ height: "200px" }}
            >
              {chartData.map((entry, idx) => {
                const passedH = (entry.passed_count / maxTotal) * 100;
                const failedH = (entry.failed_count / maxTotal) * 100;
                const notPartH =
                  (entry.not_participated_count / maxTotal) * 100;

                return (
                  <div
                    key={entry.id}
                    className="flex flex-col items-center group relative"
                    style={{
                      minWidth: chartData.length > 15 ? "28px" : "44px",
                      flex: "1 0 auto",
                    }}
                  >
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 bg-card border border-border rounded-lg p-2.5 shadow-xl min-w-[140px]">
                      <p className="text-xs font-semibold mb-1.5">
                        {entry.dateLabel}
                      </p>
                      <div className="space-y-1 text-[10px]">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-emerald-400">Passed</span>
                          <span className="tabular-nums font-medium">
                            {entry.passed_count}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-rose-400">Failed</span>
                          <span className="tabular-nums font-medium">
                            {entry.failed_count}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-zinc-500">Not Entered</span>
                          <span className="tabular-nums font-medium">
                            {entry.not_participated_count}
                          </span>
                        </div>
                        <div className="border-t border-border pt-1 flex items-center justify-between gap-3 font-semibold">
                          <span>Pass Rate</span>
                          <span
                            className={
                              entry.passRate >= 50
                                ? "text-emerald-400"
                                : "text-rose-400"
                            }
                          >
                            {entry.passRate}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Stacked bar */}
                    <div className="w-full flex flex-col-reverse items-stretch rounded-t-sm overflow-hidden">
                      {/* Passed (bottom) */}
                      <div
                        className="bg-emerald-500/70 transition-all duration-300 group-hover:bg-emerald-400"
                        style={{ height: `${passedH * 1.94}px` }}
                      />
                      {/* Failed (middle) */}
                      <div
                        className="bg-rose-500/70 transition-all duration-300 group-hover:bg-rose-400"
                        style={{ height: `${failedH * 1.94}px` }}
                      />
                      {/* Not participated (top) */}
                      <div
                        className="bg-zinc-700/50 transition-all duration-300 group-hover:bg-zinc-600"
                        style={{ height: `${notPartH * 1.94}px` }}
                      />
                    </div>

                    {/* Date label */}
                    <span className="absolute -bottom-5 text-[9px] text-muted-foreground whitespace-nowrap">
                      {entry.dateLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-5 mt-6 ml-12 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-emerald-500/70" />
            <span>Passed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-rose-500/70" />
            <span>Failed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-zinc-700/50" />
            <span>Not Entered</span>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/60">
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Date
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-emerald-400/80">
                Passed
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-rose-400/80">
                Failed
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Not Entered
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Pass Rate
              </th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((entry) => (
              <tr
                key={entry.id}
                className="border-b border-border/50 hover:bg-accent/30 transition-colors"
              >
                <td className="px-4 py-3 text-muted-foreground">
                  {entry.date.toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </td>
                <td className="px-4 py-3 text-center tabular-nums text-emerald-400 font-medium">
                  {entry.passed_count}
                </td>
                <td className="px-4 py-3 text-center tabular-nums text-rose-400 font-medium">
                  {entry.failed_count}
                </td>
                <td className="px-4 py-3 text-center tabular-nums text-zinc-500">
                  {entry.not_participated_count}
                </td>
                <td className="px-4 py-3 text-center tabular-nums font-medium">
                  {entry.total_count}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="inline-flex items-center gap-2">
                    {/* Mini progress bar */}
                    <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          entry.passRate >= 50
                            ? "bg-emerald-500"
                            : "bg-rose-500"
                        )}
                        style={{ width: `${entry.passRate}%` }}
                      />
                    </div>
                    <span
                      className={cn(
                        "tabular-nums text-xs font-medium",
                        entry.passRate >= 50
                          ? "text-emerald-400"
                          : "text-rose-400"
                      )}
                    >
                      {entry.passRate}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
