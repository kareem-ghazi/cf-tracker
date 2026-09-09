"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  FolderKanban,
  Trophy,
  Users,
  FileSpreadsheet,
  Plus,
  ArrowRight,
  RefreshCw,
  Loader2,
  AlertCircle,
  Sparkles,
  Zap,
} from "lucide-react";
import { StatsGrid } from "@/components/dashboard/StatsGrid";
import { GroupsTable } from "@/components/dashboard/GroupsTable";
import type { AnalyticsResponse } from "@/types/analytics";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/analytics");
      if (!res.ok) {
        throw new Error(`Failed to load analytics: ${res.statusText}`);
      }
      const analyticsData: AnalyticsResponse = await res.json();
      setData(analyticsData);
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              ICPC NMU Training Dashboard
            </h1>
            <Badge
              variant="outline"
              className="border-indigo-500/40 text-indigo-400 bg-indigo-950/30 text-xs font-semibold"
            >
              <Sparkles className="w-3 h-3 mr-1" />
              Live Analytics
            </Badge>
          </div>
          <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
            Real-time performance telemetry, Codeforces solve metrics, and training cohort overviews.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={fetchAnalytics}
            disabled={loading}
            className="border-zinc-800 text-zinc-300 hover:bg-zinc-900 text-xs"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 mr-2", loading && "animate-spin")} />
            Refresh Telemetry
          </Button>

          <Link href="/groups">
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20">
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Manage Groups
            </Button>
          </Link>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Stats Grid */}
      {loading && !data ? (
        <div className="flex flex-col items-center justify-center py-24 text-zinc-500 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          <p className="text-sm">Aggregating telemetry across all groups & contests...</p>
        </div>
      ) : data ? (
        <div className="space-y-8">
          {/* Summary Metric Cards */}
          <StatsGrid summary={data.summary} />

          {/* Quick Shortcuts Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/groups" className="group">
              <Card className="bg-zinc-900/60 border-zinc-800/80 hover:border-indigo-500/50 hover:bg-zinc-900 transition-all p-5 shadow-sm h-full flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-lg bg-indigo-950/50 border border-indigo-800/40 text-indigo-400 flex items-center justify-center">
                    <FolderKanban className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-sm text-zinc-100 group-hover:text-indigo-400 transition-colors">
                    Training Groups & Rosters
                  </h4>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Configure cohorts, link CSV spreadsheets, and batch-apply default participants.
                  </p>
                </div>
                <div className="pt-4 flex items-center text-xs font-semibold text-indigo-400 group-hover:translate-x-1 transition-transform">
                  <span>Explore Groups</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </Card>
            </Link>

            <Link href="/spreadsheets" className="group">
              <Card className="bg-zinc-900/60 border-zinc-800/80 hover:border-emerald-500/50 hover:bg-zinc-900 transition-all p-5 shadow-sm h-full flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-lg bg-emerald-950/50 border border-emerald-800/40 text-emerald-400 flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-sm text-zinc-100 group-hover:text-emerald-400 transition-colors">
                    Spreadsheet Store
                  </h4>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Upload CSV directories, auto-detect WhatsApp columns, and view session attendance.
                  </p>
                </div>
                <div className="pt-4 flex items-center text-xs font-semibold text-emerald-400 group-hover:translate-x-1 transition-transform">
                  <span>Manage Spreadsheets</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </Card>
            </Link>

            <div className="group">
              <Card className="bg-zinc-900/60 border-zinc-800/80 p-5 shadow-sm h-full flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-lg bg-amber-950/50 border border-amber-800/40 text-amber-400 flex items-center justify-center">
                    <Zap className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-sm text-zinc-100">
                    High-Frequency Scoring Formula
                  </h4>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Matrix Point Model:{" "}
                    <code className="px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300 font-mono text-[11px]">
                      (Passes × 5) + (Solved × 1) + (Attendance × 1)
                    </code>
                  </p>
                </div>
                <div className="pt-4 text-xs text-zinc-500 font-medium">
                  Auto-evaluates at 60fps on overview tables
                </div>
              </Card>
            </div>
          </div>

          {/* Groups Performance Overview */}
          <div className="space-y-4 pt-2">
            <GroupsTable groups={data.groups} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
