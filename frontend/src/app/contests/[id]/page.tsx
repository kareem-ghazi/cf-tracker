"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  RefreshCw,
  ClipboardList,
  Trophy,
  BarChart3,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { ContestResults } from "@/components/contest/ContestResults";
import { ContestStandings } from "@/components/contest/ContestStandings";
import { ContestProgress } from "@/components/contest/ContestProgress";
import type {
  ContestResponse,
  ContestResultsResponse,
  ContestStandingsResponse,
  FetchHistoryResponse,
  TaskDispatchResponse,
  TaskStatusResponse,
} from "@/types/contest";

type RefreshState =
  | { status: "idle" }
  | { status: "queued"; taskId: string }
  | { status: "progress"; taskId: string; progress: number; message: string }
  | { status: "success" }
  | { status: "error"; message: string };

export default function ContestDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const contestId = parseInt(params.id, 10);

  const [contest, setContest] = useState<ContestResponse | null>(null);
  const [resultsData, setResultsData] =
    useState<ContestResultsResponse | null>(null);
  const [standingsData, setStandingsData] =
    useState<ContestStandingsResponse | null>(null);
  const [progressData, setProgressData] = useState<FetchHistoryResponse[]>([]);
  const [activeTab, setActiveTab] = useState("results");
  const [loading, setLoading] = useState(true);
  const [refreshState, setRefreshState] = useState<RefreshState>({
    status: "idle",
  });

  const fetchContestData = useCallback(async () => {
    try {
      const [contestRes, resultsRes, standingsRes, progressRes] =
        await Promise.all([
          apiClient.get<ContestResponse>(`/contests/${contestId}`),
          apiClient.get<ContestResultsResponse>(
            `/contests/${contestId}/results`
          ),
          apiClient.get<ContestStandingsResponse>(
            `/contests/${contestId}/standings`
          ),
          apiClient.get<FetchHistoryResponse[]>(
            `/contests/${contestId}/progress`
          ),
        ]);

      setContest(contestRes);
      setResultsData(resultsRes);
      setStandingsData(standingsRes);
      setProgressData(progressRes);
    } catch (err) {
      console.error("Failed to fetch contest data:", err);
    } finally {
      setLoading(false);
    }
  }, [contestId]);

  useEffect(() => {
    fetchContestData();
  }, [fetchContestData]);

  // Refresh polling
  useEffect(() => {
    if (
      refreshState.status !== "queued" &&
      refreshState.status !== "progress"
    )
      return;

    const taskId =
      refreshState.status === "queued"
        ? refreshState.taskId
        : refreshState.taskId;

    const interval = setInterval(async () => {
      try {
        const status = await apiClient.get<TaskStatusResponse>(
          `/tasks/${taskId}`
        );

        if (status.status === "PROGRESS") {
          setRefreshState({
            status: "progress",
            taskId,
            progress: status.progress || 0,
            message: status.message || "Processing...",
          });
        } else if (status.status === "SUCCESS") {
          setRefreshState({ status: "success" });
          // Re-fetch data after successful refresh
          await fetchContestData();
          setTimeout(() => setRefreshState({ status: "idle" }), 3000);
        } else if (status.status === "FAILURE") {
          setRefreshState({
            status: "error",
            message: status.error || "Refresh failed",
          });
          setTimeout(() => setRefreshState({ status: "idle" }), 5000);
        }
      } catch {
        // Keep polling
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [refreshState, fetchContestData]);

  const handleRefresh = async () => {
    try {
      const dispatch = await apiClient.post<TaskDispatchResponse>(
        `/contests/${contestId}/refresh`
      );
      setRefreshState({ status: "queued", taskId: dispatch.task_id });
    } catch (err) {
      setRefreshState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to queue refresh",
      });
      setTimeout(() => setRefreshState({ status: "idle" }), 5000);
    }
  };

  const isRefreshing =
    refreshState.status === "queued" || refreshState.status === "progress";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Loading contest...</p>
        </div>
      </div>
    );
  }

  if (!contest) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-muted-foreground">
        <AlertCircle className="h-12 w-12 opacity-30 mb-4" />
        <p className="text-lg font-medium">Contest not found</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-2">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {contest.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className="gap-1">
              CF #{contest.cf_contest_id}
            </Badge>
            <Badge variant="outline" className="gap-1">
              {contest.total_problems} problems
            </Badge>
            <Badge
              variant={contest.min_solved_is_percent ? "warning" : "default"}
              className="gap-1"
            >
              Pass:{" "}
              {contest.min_solved_is_percent
                ? `${contest.min_solved}%`
                : `≥${contest.required_solved}`}
            </Badge>
            {contest.start_date && (
              <span className="text-xs">
                <Clock className="inline h-3 w-3 mr-1" />
                {new Date(contest.start_date).toLocaleDateString()}
              </span>
            )}
            <a
              href={`https://codeforces.com/contest/${contest.cf_contest_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              <span className="text-xs">Codeforces</span>
            </a>
          </div>
        </div>

        {/* Refresh Button */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Refresh status indicator */}
          {refreshState.status === "progress" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-24 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${(refreshState as { progress: number }).progress}%` }}
                />
              </div>
              <span className="tabular-nums">
                {(refreshState as { progress: number }).progress}%
              </span>
            </div>
          )}
          {refreshState.status === "success" && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Updated!
            </span>
          )}
          {refreshState.status === "error" && (
            <span className="inline-flex items-center gap-1 text-xs text-rose-400 max-w-[200px] truncate">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {(refreshState as { message: string }).message}
            </span>
          )}

          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Last refreshed */}
      {contest.last_refreshed && (
        <p className="text-xs text-muted-foreground">
          Last refreshed:{" "}
          {new Date(contest.last_refreshed).toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="results" className="gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" />
            Results
          </TabsTrigger>
          <TabsTrigger value="standings" className="gap-1.5">
            <Trophy className="h-3.5 w-3.5" />
            Standings
          </TabsTrigger>
          <TabsTrigger value="progress" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Progress
          </TabsTrigger>
        </TabsList>

        <TabsContent value="results">
          {resultsData ? (
            <ContestResults
              contest={resultsData.contest}
              results={resultsData.results}
              total={resultsData.total}
              passed={resultsData.passed}
              failed={resultsData.failed}
              not_participated={resultsData.not_participated}
            />
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <p>No results available. Refresh to fetch data.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="standings">
          {standingsData ? (
            <ContestStandings
              contest={standingsData.contest}
              standings={standingsData.standings}
              summary={standingsData.summary}
            />
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <p>No standings available. Refresh to fetch data.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="progress">
          <ContestProgress
            history={progressData}
            contestName={contest.name}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
