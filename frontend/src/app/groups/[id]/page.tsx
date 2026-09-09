"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { OverviewData } from "@/types/matrix";
import { apiClient } from "@/lib/api-client";
import { OverviewControls } from "@/components/matrix/OverviewControls";
import { OverviewMatrix } from "@/components/matrix/OverviewMatrix";
import { ParticipantDrawer } from "@/components/spreadsheet/ParticipantDrawer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, Trophy, Users } from "lucide-react";

export default function GroupOverviewPage() {
  const params = useParams();
  const groupId = params.id as string;

  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Toggle State
  const [selectedContestIds, setSelectedContestIds] = useState<Set<number>>(
    new Set()
  );
  const [showPasses, setShowPasses] = useState<boolean>(true);
  const [showSolved, setShowSolved] = useState<boolean>(true);
  const [showAttendance, setShowAttendance] = useState<boolean>(true);
  const [showPoints, setShowPoints] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Drawer State
  const [drawerHandle, setDrawerHandle] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  const fetchOverview = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<OverviewData>(
        `/groups/${groupId}/overview`
      );
      setData(res);
      // Default: select all contests
      setSelectedContestIds(new Set(res.contests.map((c) => c.id)));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load group overview"
      );
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const handleToggleContest = (contestId: number) => {
    setSelectedContestIds((prev) => {
      const next = new Set(prev);
      if (next.has(contestId)) {
        next.delete(contestId);
      } else {
        next.add(contestId);
      }
      return next;
    });
  };

  const handleSelectAllContests = (selectAll: boolean) => {
    if (!data) return;
    if (selectAll) {
      setSelectedContestIds(new Set(data.contests.map((c) => c.id)));
    } else {
      setSelectedContestIds(new Set());
    }
  };

  const handleOpenDrawer = (handle: string) => {
    setDrawerHandle(handle);
    setDrawerOpen(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 sm:p-8 space-y-6">
      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center space-x-3">
          <Link href="/groups">
            <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {data ? data.group.name : "Loading group..."}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data?.group.description || "Training group contest overview"}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchOverview}
            disabled={loading}
            className="h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Matrix
          </Button>
        </div>
      </div>

      {loading && (
        <div className="py-24 text-center text-muted-foreground animate-pulse text-sm">
          Loading virtualized overview matrix...
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {/* Matrix Controls */}
          <OverviewControls
            contests={data.contests}
            selectedContestIds={selectedContestIds}
            onToggleContest={handleToggleContest}
            onSelectAllContests={handleSelectAllContests}
            showPasses={showPasses}
            onTogglePasses={setShowPasses}
            showSolved={showSolved}
            onToggleSolved={setShowSolved}
            showAttendance={showAttendance}
            onToggleAttendance={setShowAttendance}
            showPoints={showPoints}
            onTogglePoints={setShowPoints}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />

          {/* Virtualized Table Matrix */}
          <OverviewMatrix
            overviewData={data}
            selectedContestIds={selectedContestIds}
            showPasses={showPasses}
            showSolved={showSolved}
            showAttendance={showAttendance}
            showPoints={showPoints}
            searchQuery={searchQuery}
            onOpenDrawer={handleOpenDrawer}
          />

          {/* Participant Drawer Modal */}
          {drawerHandle && (
            <ParticipantDrawer
              open={drawerOpen}
              onOpenChange={setDrawerOpen}
              handle={drawerHandle}
              spreadsheetId={data.group.spreadsheet_id}
            />
          )}
        </div>
      )}
    </div>
  );
}
