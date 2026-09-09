"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  FolderKanban,
  Plus,
  Users,
  Trophy,
  ArrowRight,
  Settings,
  Trash2,
  Share2,
  FileSpreadsheet,
  CalendarCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  Sparkles,
  RefreshCw,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Group, Spreadsheet, ApplyParticipantsResponse } from "@/types/spreadsheet";

export default function GroupsManagementPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [spreadsheets, setSpreadsheets] = useState<Spreadsheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Create / Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formSpreadsheetId, setFormSpreadsheetId] = useState<number | null>(null);
  const [formAttendanceIds, setFormAttendanceIds] = useState<number[]>([]);
  const [formParticipantsInput, setFormParticipantsInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Apply participants notification
  const [applyingId, setApplyingId] = useState<number | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Delete state
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [groupsRes, sheetsRes] = await Promise.all([
        fetch("/api/v1/groups"),
        fetch("/api/v1/spreadsheets"),
      ]);

      if (!groupsRes.ok) throw new Error("Failed to load training groups");
      const groupsData: Group[] = await groupsRes.json();
      setGroups(groupsData);

      if (sheetsRes.ok) {
        const sheetsData: Spreadsheet[] = await sheetsRes.json();
        setSpreadsheets(sheetsData);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreateModal = () => {
    setEditingGroup(null);
    setFormName("");
    setFormDescription("");
    setFormSpreadsheetId(null);
    setFormAttendanceIds([]);
    setFormParticipantsInput("");
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (group: Group) => {
    setEditingGroup(group);
    setFormName(group.name);
    setFormDescription(group.description || "");
    setFormSpreadsheetId(group.spreadsheet_id || null);
    setFormAttendanceIds(group.attendance_spreadsheets?.map((s) => s.id) || []);
    setFormParticipantsInput(group.default_participants?.join("\n") || "");
    setFormError(null);
    setModalOpen(true);
  };

  const handleImportHandlesFromSheet = async (sheetId: number) => {
    try {
      const res = await fetch(`/api/v1/spreadsheets/${sheetId}/data`);
      if (!res.ok) throw new Error("Could not load spreadsheet handles");
      const data = await res.json();
      const handleCol = data.handle_column;
      const handles: string[] = [];
      for (const row of data.rows || []) {
        const h = String(row[handleCol] || "").trim();
        if (h && !handles.includes(h)) {
          handles.push(h);
        }
      }
      if (handles.length > 0) {
        // Merge with existing
        const current = formParticipantsInput
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        const merged = Array.from(new Set([...current, ...handles]));
        setFormParticipantsInput(merged.join("\n"));
        setActionSuccessMsg(`Imported ${handles.length} handles from spreadsheet.`);
        setTimeout(() => setActionSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      setFormError(err.message || "Failed to import handles");
    }
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError("Group name is required");
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const parsedParticipants = formParticipantsInput
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      if (editingGroup) {
        // Update
        const payload = {
          name: formName.trim(),
          description: formDescription.trim(),
          default_participants: parsedParticipants,
          spreadsheet_id: formSpreadsheetId,
          attendance_spreadsheet_ids: formAttendanceIds,
        };

        const res = await fetch(`/api/v1/groups/${editingGroup.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.detail || "Failed to update group");
        }

        const updated: Group = await res.json();
        setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
      } else {
        // Create
        const payload = {
          name: formName.trim(),
          description: formDescription.trim(),
          default_participants: parsedParticipants,
          spreadsheet_id: formSpreadsheetId,
        };

        const res = await fetch("/api/v1/groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.detail || "Failed to create group");
        }

        const created: Group = await res.json();
        setGroups((prev) => [created, ...prev]);
      }

      setModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || "Failed to save group");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplyParticipants = async (group: Group) => {
    if (!group.default_participants || group.default_participants.length === 0) {
      alert("Please configure default participants for this group before applying.");
      return;
    }

    const confirmMsg = `Apply roster of ${group.default_participants.length} default participants to all ${group.contest_count} contest(s) in "${group.name}"? This will overwrite individual contest participant rosters.`;
    if (!confirm(confirmMsg)) return;

    setApplyingId(group.id);
    try {
      const res = await fetch(`/api/v1/groups/${group.id}/apply-participants`, {
        method: "POST",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "Failed to apply participants");
      }
      const data: ApplyParticipantsResponse = await res.json();
      setActionSuccessMsg(
        `Applied roster to ${data.contests_updated} contest(s) (${data.participants_applied} participants each).`
      );
      setTimeout(() => setActionSuccessMsg(null), 5000);
    } catch (err: any) {
      alert(err.message || "Failed to apply participants");
    } finally {
      setApplyingId(null);
    }
  };

  const handleDeleteGroup = async (groupId: number, groupName: string) => {
    if (!confirm(`Are you sure you want to delete group "${groupName}"? All contests and results inside will be deleted.`)) {
      return;
    }
    setDeletingId(groupId);
    try {
      const res = await fetch(`/api/v1/groups/${groupId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete group");
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
    } catch (err: any) {
      alert(err.message || "Could not delete group");
    } finally {
      setDeletingId(null);
    }
  };

  // Participant spreadsheets for dropdown
  const participantSheets = useMemo(
    () => spreadsheets.filter((s) => s.spreadsheet_type === "participants"),
    [spreadsheets]
  );

  const attendanceSheets = useMemo(
    () => spreadsheets.filter((s) => s.spreadsheet_type === "attendance"),
    [spreadsheets]
  );

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase();
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.description && g.description.toLowerCase().includes(q))
    );
  }, [groups, searchQuery]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              Training Groups
            </h1>
            <Badge variant="outline" className="border-indigo-500/40 text-indigo-400 bg-indigo-950/30">
              ICPC NMU
            </Badge>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Configure training groups, manage default student rosters, and link attendance sheets.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={fetchData}
            disabled={loading}
            className="border-zinc-800 text-zinc-300 hover:bg-zinc-900"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>

          <Button
            onClick={openCreateModal}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Group
          </Button>
        </div>
      </div>

      {/* Success Notification */}
      {actionSuccessMsg && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-sm animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-red-950/50 border border-red-800 text-red-300 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Search & Stats Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-sm text-zinc-400">
          <span>
            Showing <strong className="text-zinc-200">{filteredGroups.length}</strong> of{" "}
            <strong className="text-zinc-200">{groups.length}</strong> group(s)
          </span>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search training groups..."
            className="pl-9 bg-zinc-900 border-zinc-800 text-zinc-200 text-sm focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Groups Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          <p className="text-sm">Loading training groups...</p>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/30">
          <FolderKanban className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-zinc-200">No training groups found</h3>
          <p className="text-sm text-zinc-500 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? "No groups match your search query."
              : "Get started by creating your first training group to organize contests and track student standings."}
          </p>
          <Button
            onClick={openCreateModal}
            className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Create Training Group
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGroups.map((group) => {
            const rosterCount = group.default_participants?.length || 0;
            const attendanceCount = group.attendance_spreadsheets?.length || 0;

            return (
              <Card
                key={group.id}
                className="bg-zinc-900/80 border-zinc-800/80 hover:border-zinc-700 transition-all flex flex-col justify-between shadow-sm"
              >
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <CardTitle className="text-lg font-bold text-zinc-100 hover:text-indigo-400 transition-colors">
                        <Link href={`/groups/${group.id}`}>{group.name}</Link>
                      </CardTitle>
                      {group.description && (
                        <p className="text-xs text-zinc-400 line-clamp-2">
                          {group.description}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-5 pt-0 space-y-4">
                  {/* KPI Chips */}
                  <div className="grid grid-cols-2 gap-2 py-3 border-y border-zinc-800/60 text-xs">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Trophy className="w-3.5 h-3.5 text-amber-400" />
                      <span>
                        <strong className="text-zinc-200 font-semibold">{group.contest_count}</strong>{" "}
                        contests
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-zinc-400">
                      <Users className="w-3.5 h-3.5 text-indigo-400" />
                      <span>
                        <strong className="text-zinc-200 font-semibold">{rosterCount}</strong> roster
                      </span>
                    </div>

                    {group.spreadsheet ? (
                      <div className="col-span-2 flex items-center gap-1.5 text-[11px] text-zinc-400 truncate">
                        <FileSpreadsheet className="w-3 h-3 text-indigo-400 shrink-0" />
                        <span className="truncate">Roster: {group.spreadsheet.name}</span>
                      </div>
                    ) : (
                      <div className="col-span-2 text-[11px] text-zinc-500">
                        No participant spreadsheet linked
                      </div>
                    )}

                    {attendanceCount > 0 && (
                      <div className="col-span-2 flex items-center gap-1.5 text-[11px] text-emerald-400">
                        <CalendarCheck className="w-3 h-3 shrink-0" />
                        <span>{attendanceCount} attendance sheet(s) linked</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-2">
                      <Link href={`/groups/${group.id}`} className="flex-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-between bg-zinc-800/60 border-zinc-700/80 hover:bg-zinc-800 text-zinc-200 text-xs font-medium"
                        >
                          <span>Overview Matrix</span>
                          <ArrowRight className="w-3.5 h-3.5 ml-1 text-indigo-400" />
                        </Button>
                      </Link>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModal(group)}
                        title="Edit Group & Roster"
                        className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 p-2"
                      >
                        <Settings className="w-4 h-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteGroup(group.id, group.name)}
                        disabled={deletingId === group.id}
                        title="Delete Group"
                        className="text-zinc-500 hover:text-red-400 hover:bg-red-950/30 p-2"
                      >
                        {deletingId === group.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>

                    {/* Bulk Apply to Contests Button */}
                    {rosterCount > 0 && group.contest_count > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleApplyParticipants(group)}
                        disabled={applyingId === group.id}
                        className="w-full border-dashed border-indigo-900/60 bg-indigo-950/20 hover:bg-indigo-950/50 text-indigo-300 text-xs"
                      >
                        {applyingId === group.id ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <Share2 className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                        )}
                        Apply Roster to All {group.contest_count} Contests
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Group Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl bg-zinc-900 border-zinc-800 text-zinc-100 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <FolderKanban className="w-5 h-5 text-indigo-400" />
              {editingGroup ? `Edit Group: ${editingGroup.name}` : "Create Training Group"}
            </DialogTitle>
          </DialogHeader>

          {formError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-950/50 border border-red-800 text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSaveGroup} className="space-y-4">
            {/* Group Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Group Name <span className="text-rose-400">*</span>
              </label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., ICPC Juniors 2026 Phase 1"
                className="bg-zinc-800/60 border-zinc-700 text-zinc-100"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Description
              </label>
              <Input
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Training schedule, target level, notes..."
                className="bg-zinc-800/60 border-zinc-700 text-zinc-100"
              />
            </div>

            {/* Link Participant Spreadsheet */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-400" />
                  Link Participant Roster Spreadsheet
                </label>
                {formSpreadsheetId && (
                  <button
                    type="button"
                    onClick={() => handleImportHandlesFromSheet(formSpreadsheetId)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    Load Handles Into Roster
                  </button>
                )}
              </div>
              <select
                value={formSpreadsheetId ?? ""}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  setFormSpreadsheetId(val);
                }}
                className="w-full h-10 px-3 rounded-md bg-zinc-800/80 border border-zinc-700 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">None (No spreadsheet linked)</option>
                {participantSheets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.row_count} rows)
                  </option>
                ))}
              </select>
            </div>

            {/* Link Attendance Spreadsheets */}
            {attendanceSheets.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <CalendarCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Link Attendance Sheets
                </label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 rounded-lg bg-zinc-800/40 border border-zinc-700/60">
                  {attendanceSheets.map((s) => {
                    const isSelected = formAttendanceIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setFormAttendanceIds((prev) =>
                            isSelected ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                          );
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-xs font-medium border transition-all flex items-center gap-1.5",
                          isSelected
                            ? "bg-emerald-950/60 border-emerald-500 text-emerald-300"
                            : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200"
                        )}
                      >
                        {isSelected && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Default Participants Roster Editor */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  Default Participant Handles
                </label>
                <span className="text-xs text-zinc-500">
                  {
                    formParticipantsInput
                      .split(/[\n,]+/)
                      .map((s) => s.trim())
                      .filter(Boolean).length
                  }{" "}
                  handles
                </span>
              </div>
              <textarea
                value={formParticipantsInput}
                onChange={(e) => setFormParticipantsInput(e.target.value)}
                placeholder="Enter Codeforces handles separated by commas or line breaks&#10;tourist&#10;Benq&#10;ecnerwala"
                rows={5}
                className="w-full p-3 rounded-md bg-zinc-800/60 border border-zinc-700 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={submitting}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {editingGroup ? "Save Changes" : "Create Group"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
