"use client";

import React, { useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { OverviewData } from "@/types/matrix";
import { getWhatsAppUrl, getCodeforcesProfileUrl } from "@/lib/phone-formatter";
import { Badge } from "@/components/ui/badge";

interface OverviewMatrixProps {
  overviewData: OverviewData;
  selectedContestIds: Set<number>;
  showPasses: boolean;
  showSolved: boolean;
  showAttendance: boolean;
  showPoints: boolean;
  searchQuery: string;
  onOpenDrawer: (handle: string) => void;
}

export const OverviewMatrix: React.FC<OverviewMatrixProps> = ({
  overviewData,
  selectedContestIds,
  showPasses,
  showSolved,
  showAttendance,
  showPoints,
  searchQuery,
  onOpenDrawer,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);

  // Filter contests based on selected chip IDs
  const activeContests = useMemo(() => {
    return overviewData.contests.filter((c) => selectedContestIds.has(c.id));
  }, [overviewData.contests, selectedContestIds]);

  // Recalculate participant performance dynamic metrics for the active contest subset
  const calculatedRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const rows = overviewData.participants
      .filter((p) => !query || p.handle.toLowerCase().includes(query))
      .map((p) => {
        let passes = 0;
        let totalSolved = 0;

        for (const contest of activeContests) {
          const res = p.results[String(contest.id)];
          if (res && res.participated) {
            if (res.passed) passes += 1;
            totalSolved += res.solved_count || 0;
          }
        }

        const attendance = p.attendance || 0;
        // Points formula: (Passes * 5) + (Solved * 1) + (Attendance * 1)
        const points = passes * 5 + totalSolved * 1 + attendance * 1;

        return {
          ...p,
          dynamicPasses: passes,
          dynamicSolved: totalSolved,
          dynamicAttendance: attendance,
          dynamicPoints: points,
        };
      });

    // Rank sort: passes (desc) -> totalSolved (desc) -> attendance (desc)
    rows.sort((a, b) => {
      if (b.dynamicPasses !== a.dynamicPasses)
        return b.dynamicPasses - a.dynamicPasses;
      if (b.dynamicSolved !== a.dynamicSolved)
        return b.dynamicSolved - a.dynamicSolved;
      return b.dynamicAttendance - a.dynamicAttendance;
    });

    return rows;
  }, [overviewData.participants, activeContests, searchQuery]);

  // Virtualizer for smooth rendering across hundreds of participant rows
  const rowVirtualizer = useVirtualizer({
    count: calculatedRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 10,
  });

  if (calculatedRows.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground border border-border rounded-xl bg-card">
        No participants match the current search or contest filter.
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="relative max-h-[72vh] overflow-auto rounded-xl border border-border bg-card shadow-md"
    >
      <table className="w-full border-collapse text-left text-xs">
        {/* Sticky Table Header */}
        <thead className="sticky top-0 z-30 bg-secondary/95 backdrop-blur-sm border-b border-border shadow-sm">
          <tr className="h-11 font-semibold text-muted-foreground">
            {/* Sticky Rank Column */}
            <th className="sticky left-0 z-40 bg-secondary px-3 py-2 text-center w-12 border-r border-border">
              #
            </th>

            {/* Sticky Handle Column */}
            <th className="sticky left-12 z-40 bg-secondary px-4 py-2 min-w-[170px] border-r border-border text-foreground">
              Handle
            </th>

            {showPasses && (
              <th className="px-3 py-2 text-center w-16 border-r border-border/50 text-foreground">
                Passes
              </th>
            )}

            {showSolved && (
              <th className="px-3 py-2 text-center w-16 border-r border-border/50 text-foreground">
                Solved
              </th>
            )}

            {showAttendance && (
              <th className="px-3 py-2 text-center w-24 border-r border-border/50 text-foreground">
                Attendance
              </th>
            )}

            {showPoints && (
              <th
                className="px-3 py-2 text-center w-16 border-r border-border text-amber-400 font-bold"
                title="Points = (Passes × 5) + (Solved × 1) + (Attendance × 1)"
              >
                Points
              </th>
            )}

            {/* Contest Columns */}
            {activeContests.map((c) => (
              <th
                key={c.id}
                className="px-3 py-1.5 text-center min-w-[130px] border-r border-border/50 truncate max-w-[160px]"
                title={c.name}
              >
                <div className="font-semibold text-foreground truncate">
                  {c.name}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono">
                  {c.total_problems}P /{" "}
                  {c.min_solved_is_percent
                    ? `${c.min_solved}%`
                    : c.required_solved}
                </div>
              </th>
            ))}
          </tr>
        </thead>

        {/* Virtualized Body */}
        <tbody
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const index = virtualRow.index;
            const participant = calculatedRows[index];
            const rank = index + 1;

            let rankBadgeVariant: "gold" | "silver" | "bronze" | "default" =
              "default";
            if (rank === 1) rankBadgeVariant = "gold";
            else if (rank === 2) rankBadgeVariant = "silver";
            else if (rank === 3) rankBadgeVariant = "bronze";

            return (
              <tr
                key={participant.handle}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className={`h-11 border-b border-border/50 transition-colors hover:bg-secondary/40 ${
                  rank === 1
                    ? "bg-amber-500/5"
                    : rank === 2
                    ? "bg-slate-400/5"
                    : rank === 3
                    ? "bg-amber-800/5"
                    : ""
                }`}
              >
                {/* Sticky Rank Cell */}
                <td className="sticky left-0 z-20 bg-card px-3 py-2 text-center w-12 border-r border-border">
                  {rank <= 3 ? (
                    <Badge variant={rankBadgeVariant} className="px-1.5 py-0">
                      {rank}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground font-mono">
                      {rank}
                    </span>
                  )}
                </td>

                {/* Sticky Handle Cell */}
                <td className="sticky left-12 z-20 bg-card px-4 py-2 min-w-[170px] border-r border-border flex items-center justify-between gap-2 h-11">
                  <a
                    href={getCodeforcesProfileUrl(participant.handle)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary hover:text-brand-cyan truncate max-w-[120px]"
                    title={`View ${participant.handle} on Codeforces`}
                  >
                    {participant.handle}
                  </a>

                  {participant.in_spreadsheet && (
                    <button
                      onClick={() => onOpenDrawer(participant.handle)}
                      className="text-xs p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                      title="View spreadsheet metadata"
                    >
                      📋
                    </button>
                  )}
                </td>

                {showPasses && (
                  <td className="px-3 py-2 text-center w-16 border-r border-border/50 font-semibold text-emerald-400">
                    {participant.dynamicPasses}
                  </td>
                )}

                {showSolved && (
                  <td className="px-3 py-2 text-center w-16 border-r border-border/50 text-foreground font-mono">
                    {participant.dynamicSolved}
                  </td>
                )}

                {showAttendance && (
                  <td className="px-3 py-2 text-center w-24 border-r border-border/50 text-muted-foreground font-mono">
                    {participant.dynamicAttendance} /{" "}
                    {overviewData.total_attendance_sheets}
                  </td>
                )}

                {showPoints && (
                  <td className="px-3 py-2 text-center w-16 border-r border-border font-bold text-amber-400 font-mono">
                    {participant.dynamicPoints}
                  </td>
                )}

                {/* Contest Results Matrix Cells */}
                {activeContests.map((c) => {
                  const res = participant.results[String(c.id)];

                  if (!res) {
                    return (
                      <td
                        key={c.id}
                        className="px-3 py-2 text-center border-r border-border/30 text-muted-foreground/40 font-mono"
                      >
                        —
                      </td>
                    );
                  }

                  if (!res.participated) {
                    return (
                      <td
                        key={c.id}
                        className="px-3 py-2 text-center border-r border-border/30 cell-not-participated text-sm"
                        title="Not entered contest"
                      >
                        ⚪
                      </td>
                    );
                  }

                  if (res.passed) {
                    return (
                      <td
                        key={c.id}
                        className="px-3 py-2 text-center border-r border-border/30 cell-passed font-mono"
                        title={`Passed: solved ${res.solved_count}`}
                      >
                        ✅ {res.solved_count}
                      </td>
                    );
                  }

                  return (
                    <td
                      key={c.id}
                      className="px-3 py-2 text-center border-r border-border/30 cell-failed font-mono"
                      title={`Did not pass: solved ${res.solved_count}`}
                    >
                      ❌ {res.solved_count}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
