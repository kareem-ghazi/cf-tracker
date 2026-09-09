"use client";

import React from "react";
import { ContestHeader } from "@/types/matrix";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface OverviewControlsProps {
  contests: ContestHeader[];
  selectedContestIds: Set<number>;
  onToggleContest: (contestId: number) => void;
  onSelectAllContests: (selectAll: boolean) => void;
  showPasses: boolean;
  onTogglePasses: (show: boolean) => void;
  showSolved: boolean;
  onToggleSolved: (show: boolean) => void;
  showAttendance: boolean;
  onToggleAttendance: (show: boolean) => void;
  showPoints: boolean;
  onTogglePoints: (show: boolean) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const OverviewControls: React.FC<OverviewControlsProps> = ({
  contests,
  selectedContestIds,
  onToggleContest,
  onSelectAllContests,
  showPasses,
  onTogglePasses,
  showSolved,
  onToggleSolved,
  showAttendance,
  onToggleAttendance,
  showPoints,
  onTogglePoints,
  searchQuery,
  onSearchChange,
}) => {
  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm mb-4">
      {/* Search & Bulk Contest Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search handle..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 bg-secondary/80 border-border"
          />
        </div>

        {/* Column visibility toggles */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-muted-foreground">
          <span className="text-foreground">Columns:</span>
          <label className="flex items-center space-x-1.5 cursor-pointer hover:text-foreground">
            <input
              type="checkbox"
              checked={showPasses}
              onChange={(e) => onTogglePasses(e.target.checked)}
              className="rounded bg-secondary border-border text-primary focus:ring-primary"
            />
            <span>Passes</span>
          </label>
          <label className="flex items-center space-x-1.5 cursor-pointer hover:text-foreground">
            <input
              type="checkbox"
              checked={showSolved}
              onChange={(e) => onToggleSolved(e.target.checked)}
              className="rounded bg-secondary border-border text-primary focus:ring-primary"
            />
            <span>Solved</span>
          </label>
          <label className="flex items-center space-x-1.5 cursor-pointer hover:text-foreground">
            <input
              type="checkbox"
              checked={showAttendance}
              onChange={(e) => onToggleAttendance(e.target.checked)}
              className="rounded bg-secondary border-border text-primary focus:ring-primary"
            />
            <span>Attendance</span>
          </label>
          <label className="flex items-center space-x-1.5 cursor-pointer hover:text-foreground">
            <input
              type="checkbox"
              checked={showPoints}
              onChange={(e) => onTogglePoints(e.target.checked)}
              className="rounded bg-secondary border-border text-primary focus:ring-primary"
            />
            <span>Points</span>
          </label>
        </div>
      </div>

      {/* Contest filter chips */}
      <div>
        <div className="flex items-center space-x-2 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Filter Contests:
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSelectAllContests(true)}
            className="h-6 text-xs px-2"
          >
            All ({contests.length})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSelectAllContests(false)}
            className="h-6 text-xs px-2"
          >
            None
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
          {contests.map((c) => {
            const isSelected = selectedContestIds.has(c.id);
            return (
              <button
                key={c.id}
                onClick={() => onToggleContest(c.id)}
                title={`${c.name} (${c.total_problems}P)`}
                className={`text-xs px-2.5 py-1 rounded-md border transition-colors text-left truncate max-w-[200px] ${
                  isSelected
                    ? "bg-primary/20 border-primary text-foreground font-medium"
                    : "bg-secondary/40 border-border text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                }`}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
