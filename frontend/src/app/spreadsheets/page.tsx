"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileSpreadsheet,
  Plus,
  Users,
  CalendarCheck,
  Search,
  Trash2,
  Eye,
  Download,
  AlertCircle,
  Loader2,
  Sparkles,
  Link2,
  RefreshCw,
  FolderKanban,
} from "lucide-react";
import { SpreadsheetUploadModal } from "@/components/spreadsheet/SpreadsheetUploadModal";
import type { Spreadsheet, SpreadsheetData, SpreadsheetType } from "@/types/spreadsheet";
import { cn } from "@/lib/utils";

export default function SpreadsheetsPage() {
  const [spreadsheets, setSpreadsheets] = useState<Spreadsheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [defaultUploadType, setDefaultUploadType] = useState<SpreadsheetType>("participants");

  // Filter & Search state
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Data view modal state
  const [selectedSheetData, setSelectedSheetData] = useState<SpreadsheetData | null>(null);
  const [dataModalOpen, setDataModalOpen] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataSearch, setDataSearch] = useState("");

  // Delete state
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchSpreadsheets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/spreadsheets");
      if (!res.ok) {
        throw new Error(`Failed to load spreadsheets: ${res.statusText}`);
      }
      const data: Spreadsheet[] = await res.json();
      setSpreadsheets(data);
    } catch (err: any) {
      setError(err.message || "Failed to load spreadsheets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSpreadsheets();
  }, [fetchSpreadsheets]);

  const viewSheetData = async (sheetId: number) => {
    setDataModalOpen(true);
    setDataLoading(true);
    setDataSearch("");
    try {
      const res = await fetch(`/api/v1/spreadsheets/${sheetId}/data`);
      if (!res.ok) throw new Error("Failed to fetch spreadsheet data");
      const data: SpreadsheetData = await res.json();
      setSelectedSheetData(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setDataLoading(false);
    }
  };

  const deleteSheet = async (sheetId: number) => {
    if (!confirm("Are you sure you want to delete this spreadsheet? Any group linkages will be unlinked.")) {
      return;
    }
    setDeletingId(sheetId);
    try {
      const res = await fetch(`/api/v1/spreadsheets/${sheetId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete spreadsheet");
      setSpreadsheets((prev) => prev.filter((s) => s.id !== sheetId));
    } catch (err: any) {
      alert(err.message || "Could not delete spreadsheet");
    } finally {
      setDeletingId(null);
    }
  };

  // KPIs
  const totalCount = spreadsheets.length;
  const participantCount = spreadsheets.filter((s) => s.spreadsheet_type === "participants").length;
  const attendanceCount = spreadsheets.filter((s) => s.spreadsheet_type === "attendance").length;
  const totalRows = spreadsheets.reduce((acc, s) => acc + s.row_count, 0);

  // Filtered sheets
  const filteredSheets = useMemo(() => {
    return spreadsheets.filter((s) => {
      if (activeTab === "participants" && s.spreadsheet_type !== "participants") return false;
      if (activeTab === "attendance" && s.spreadsheet_type !== "attendance") return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.filename.toLowerCase().includes(q) ||
          s.handle_column.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [spreadsheets, activeTab, searchQuery]);

  // Filtered rows for viewer modal
  const filteredRows = useMemo(() => {
    if (!selectedSheetData) return [];
    if (!dataSearch.trim()) return selectedSheetData.rows;
    const q = dataSearch.toLowerCase();
    return selectedSheetData.rows.filter((r) =>
      Object.values(r).some((val) => String(val).toLowerCase().includes(q))
    );
  }, [selectedSheetData, dataSearch]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              Spreadsheets & Rosters
            </h1>
            <Badge variant="outline" className="border-indigo-500/40 text-indigo-400 bg-indigo-950/30">
              CSV Store
            </Badge>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Manage student participant rosters, metadata, and multi-session attendance logs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={fetchSpreadsheets}
            disabled={loading}
            className="border-zinc-800 text-zinc-300 hover:bg-zinc-900"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>

          <Button
            onClick={() => {
              setDefaultUploadType("participants");
              setUploadModalOpen(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4 mr-2" />
            Upload CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-zinc-900/70 border-zinc-800/80 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Total Sheets</p>
              <h3 className="text-2xl font-bold text-white mt-1">{totalCount}</h3>
            </div>
            <div className="p-3 bg-zinc-800/80 rounded-xl text-zinc-300">
              <FileSpreadsheet className="w-6 h-6 text-indigo-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/70 border-zinc-800/80 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Participant Rosters</p>
              <h3 className="text-2xl font-bold text-indigo-400 mt-1">{participantCount}</h3>
            </div>
            <div className="p-3 bg-indigo-950/40 border border-indigo-800/40 rounded-xl text-indigo-300">
              <Users className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/70 border-zinc-800/80 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Attendance Logs</p>
              <h3 className="text-2xl font-bold text-emerald-400 mt-1">{attendanceCount}</h3>
            </div>
            <div className="p-3 bg-emerald-950/40 border border-emerald-800/40 rounded-xl text-emerald-300">
              <CalendarCheck className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/70 border-zinc-800/80 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Indexed Entries</p>
              <h3 className="text-2xl font-bold text-purple-400 mt-1">{totalRows.toLocaleString()}</h3>
            </div>
            <div className="p-3 bg-purple-950/40 border border-purple-800/40 rounded-xl text-purple-300">
              <Sparkles className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs & Search Filter */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
            <TabsList className="bg-zinc-900 border border-zinc-800 p-1">
              <TabsTrigger value="all" className="data-[state=active]:bg-zinc-800">
                All ({spreadsheets.length})
              </TabsTrigger>
              <TabsTrigger value="participants" className="data-[state=active]:bg-indigo-950/60 data-[state=active]:text-indigo-300">
                Participants ({participantCount})
              </TabsTrigger>
              <TabsTrigger value="attendance" className="data-[state=active]:bg-emerald-950/60 data-[state=active]:text-emerald-300">
                Attendance ({attendanceCount})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search spreadsheets..."
              className="pl-9 bg-zinc-900 border-zinc-800 text-zinc-200 text-sm focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-300">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Spreadsheets Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            <p className="text-sm">Loading spreadsheets...</p>
          </div>
        ) : filteredSheets.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/30">
            <FileSpreadsheet className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-zinc-200">No spreadsheets found</h3>
            <p className="text-sm text-zinc-500 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? "No spreadsheets match your current search query."
                : "Upload your first CSV spreadsheet to begin linking participant rosters to training groups."}
            </p>
            <Button
              onClick={() => setUploadModalOpen(true)}
              className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Upload Spreadsheet
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredSheets.map((sheet) => {
              const isParticipant = sheet.spreadsheet_type === "participants";
              return (
                <Card
                  key={sheet.id}
                  className="bg-zinc-900/80 border-zinc-800/80 hover:border-zinc-700 transition-all flex flex-col justify-between"
                >
                  <CardHeader className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <CardTitle className="text-base font-semibold text-zinc-100 hover:text-indigo-400 transition-colors line-clamp-1">
                          {sheet.name}
                        </CardTitle>
                        <p className="text-xs text-zinc-500 font-mono line-clamp-1">
                          {sheet.filename || "Uploaded File"}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 text-[11px] font-medium capitalize",
                          isParticipant
                            ? "bg-indigo-950/40 text-indigo-300 border-indigo-800/60"
                            : "bg-emerald-950/40 text-emerald-300 border-emerald-800/60"
                        )}
                      >
                        {isParticipant ? (
                          <Users className="w-3 h-3 mr-1" />
                        ) : (
                          <CalendarCheck className="w-3 h-3 mr-1" />
                        )}
                        {sheet.spreadsheet_type}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 pt-0 space-y-4">
                    {/* Metadata specs */}
                    <div className="grid grid-cols-2 gap-2 py-3 border-y border-zinc-800/60 text-xs text-zinc-400">
                      <div>
                        <span className="text-zinc-500">Rows:</span>{" "}
                        <span className="text-zinc-200 font-semibold">{sheet.row_count}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">Columns:</span>{" "}
                        <span className="text-zinc-200 font-semibold">{sheet.columns.length}</span>
                      </div>
                      <div className="col-span-2 truncate">
                        <span className="text-zinc-500">Handle Col:</span>{" "}
                        <span className="text-indigo-300 font-mono text-[11px]">
                          {sheet.handle_column}
                        </span>
                      </div>
                      {sheet.phone_column && (
                        <div className="col-span-2 truncate">
                          <span className="text-zinc-500">Phone Col:</span>{" "}
                          <span className="text-emerald-300 font-mono text-[11px]">
                            {sheet.phone_column}
                          </span>
                        </div>
                      )}
                      <div className="col-span-2 flex items-center gap-1.5 pt-1 text-[11px] text-zinc-500">
                        <FolderKanban className="w-3 h-3 text-zinc-400" />
                        <span>Linked to {sheet.group_count} training group(s)</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-between pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => viewSheetData(sheet.id)}
                        className="border-zinc-700 bg-zinc-800/60 hover:bg-zinc-800 text-zinc-200 text-xs"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                        View Table ({sheet.row_count})
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteSheet(sheet.id)}
                        disabled={deletingId === sheet.id}
                        className="text-zinc-500 hover:text-red-400 hover:bg-red-950/30 p-2"
                      >
                        {deletingId === sheet.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload Modal Component */}
      <SpreadsheetUploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        defaultType={defaultUploadType}
        onUploaded={(newSheet) => {
          setSpreadsheets((prev) => [newSheet, ...prev]);
        }}
      />

      {/* Full Data Viewer Dialog */}
      <Dialog open={dataModalOpen} onOpenChange={setDataModalOpen}>
        <DialogContent className="max-w-5xl bg-zinc-900 border-zinc-800 text-zinc-100 max-h-[90vh] flex flex-col">
          <DialogHeader className="pb-3 border-b border-zinc-800">
            <div className="flex items-center justify-between pr-6">
              <div className="space-y-1">
                <DialogTitle className="flex items-center gap-2 text-lg font-bold text-white">
                  <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                  {selectedSheetData?.name}
                </DialogTitle>
                <p className="text-xs text-zinc-400">
                  {selectedSheetData?.row_count} total entries • Handle Column:{" "}
                  <span className="text-indigo-300 font-mono">
                    {selectedSheetData?.handle_column}
                  </span>
                </p>
              </div>

              <div className="w-64">
                <Input
                  value={dataSearch}
                  onChange={(e) => setDataSearch(e.target.value)}
                  placeholder="Filter rows..."
                  className="h-8 text-xs bg-zinc-800/80 border-zinc-700"
                />
              </div>
            </div>
          </DialogHeader>

          {dataLoading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-3 text-zinc-500">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
              <span className="text-sm">Loading spreadsheet rows...</span>
            </div>
          ) : selectedSheetData ? (
            <div className="flex-1 overflow-auto border border-zinc-800 rounded-lg mt-3 bg-zinc-950/60">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-zinc-800 z-10 shadow-sm">
                  <tr className="border-b border-zinc-700">
                    <th className="px-3 py-2 text-zinc-400 font-medium w-12 text-center">#</th>
                    {selectedSheetData.columns.map((col) => (
                      <th
                        key={col}
                        className={cn(
                          "px-3 py-2 font-medium whitespace-nowrap",
                          col === selectedSheetData.handle_column && "text-indigo-400 bg-indigo-950/40",
                          col === selectedSheetData.phone_column && "text-emerald-400 bg-emerald-950/40"
                        )}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {filteredRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-3 py-2 text-center text-zinc-500 font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      {selectedSheetData.columns.map((col) => (
                        <td
                          key={col}
                          className={cn(
                            "px-3 py-2 whitespace-nowrap text-zinc-300 font-mono text-[11px]",
                            col === selectedSheetData.handle_column &&
                              "text-indigo-300 font-semibold bg-indigo-950/10",
                            col === selectedSheetData.phone_column &&
                              "text-emerald-300 bg-emerald-950/10"
                          )}
                        >
                          {String(row[col] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
