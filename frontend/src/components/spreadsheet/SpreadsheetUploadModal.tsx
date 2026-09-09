"use client";

import React, { useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Users,
  CalendarCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Spreadsheet, SpreadsheetType, CSVPreviewResponse } from "@/types/spreadsheet";

interface SpreadsheetUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded?: (sheet: Spreadsheet) => void;
  defaultType?: SpreadsheetType;
}

export const SpreadsheetUploadModal: React.FC<SpreadsheetUploadModalProps> = ({
  open,
  onOpenChange,
  onUploaded,
  defaultType = "participants",
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [sheetName, setSheetName] = useState("");
  const [sheetType, setSheetType] = useState<SpreadsheetType>(defaultType);
  const [handleColumn, setHandleColumn] = useState("");
  const [phoneColumn, setPhoneColumn] = useState("");

  const [preview, setPreview] = useState<CSVPreviewResponse | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = useCallback(() => {
    setFile(null);
    setSheetName("");
    setSheetType(defaultType);
    setHandleColumn("");
    setPhoneColumn("");
    setPreview(null);
    setError(null);
    setUploading(false);
    setPreviewing(false);
  }, [defaultType]);

  const handleFile = useCallback(async (selectedFile: File) => {
    if (!selectedFile.name.endsWith(".csv")) {
      setError("Please select a valid .csv file.");
      return;
    }

    setFile(selectedFile);
    setError(null);

    // Default sheet name from file name
    const rawName = selectedFile.name.replace(/\.[^/.]+$/, "");
    setSheetName(rawName);

    // Call preview endpoint
    setPreviewing(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/v1/spreadsheets/preview", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Preview failed: ${res.statusText}`);
      }

      const previewData: CSVPreviewResponse = await res.json();
      setPreview(previewData);

      // Auto-set suggested columns
      if (previewData.suggested_handle_column) {
        setHandleColumn(previewData.suggested_handle_column);
      } else if (previewData.columns.length > 0) {
        setHandleColumn(previewData.columns[0]);
      }

      if (previewData.suggested_phone_column) {
        setPhoneColumn(previewData.suggested_phone_column);
      }
    } catch (err: any) {
      setError(err.message || "Failed to preview CSV file.");
    } finally {
      setPreviewing(false);
    }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a file to upload.");
      return;
    }
    if (!sheetName.trim()) {
      setError("Please enter a spreadsheet name.");
      return;
    }
    if (!handleColumn) {
      setError("Please specify the Codeforces Handle column.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", sheetName.trim());
      formData.append("spreadsheet_type", sheetType);
      formData.append("handle_column", handleColumn);
      if (phoneColumn) {
        formData.append("phone_column", phoneColumn);
      }

      const res = await fetch("/api/v1/spreadsheets/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Upload failed: ${res.statusText}`);
      }

      const createdSheet: Spreadsheet = await res.json();
      onUploaded?.(createdSheet);
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Failed to upload spreadsheet.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) resetForm();
        onOpenChange(isOpen);
      }}
    >
      <DialogContent className="max-w-2xl bg-zinc-900 border-zinc-800 text-zinc-100 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
            Upload CSV Spreadsheet
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-red-950/50 border border-red-800/60 text-red-300 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Sheet Type Toggle */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Spreadsheet Category
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSheetType("participants")}
                className={cn(
                  "flex items-center gap-3 p-3.5 rounded-lg border text-left transition-all",
                  sheetType === "participants"
                    ? "bg-indigo-950/40 border-indigo-500/80 text-white shadow-sm ring-1 ring-indigo-500/30"
                    : "bg-zinc-800/40 border-zinc-700/60 text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200"
                )}
              >
                <Users
                  className={cn(
                    "w-5 h-5",
                    sheetType === "participants" ? "text-indigo-400" : "text-zinc-500"
                  )}
                />
                <div>
                  <div className="text-sm font-semibold">Participants Roster</div>
                  <div className="text-xs text-zinc-400">
                    Metadata, WhatsApp numbers, student profiles
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSheetType("attendance")}
                className={cn(
                  "flex items-center gap-3 p-3.5 rounded-lg border text-left transition-all",
                  sheetType === "attendance"
                    ? "bg-emerald-950/40 border-emerald-500/80 text-white shadow-sm ring-1 ring-emerald-500/30"
                    : "bg-zinc-800/40 border-zinc-700/60 text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200"
                )}
              >
                <CalendarCheck
                  className={cn(
                    "w-5 h-5",
                    sheetType === "attendance" ? "text-emerald-400" : "text-zinc-500"
                  )}
                />
                <div>
                  <div className="text-sm font-semibold">Session Attendance</div>
                  <div className="text-xs text-zinc-400">
                    Daily or weekly session check-in logs
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Drag & Drop File Zone */}
          {!file ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all",
                dragActive
                  ? "border-indigo-500 bg-indigo-950/20"
                  : "border-zinc-700/80 bg-zinc-900/50 hover:bg-zinc-800/40 hover:border-zinc-600"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFile(e.target.files[0]);
                }}
              />
              <UploadCloud className="w-10 h-10 text-indigo-400 mb-3" />
              <div className="text-sm font-medium text-zinc-200">
                Click to browse or drag and drop your CSV file here
              </div>
              <div className="text-xs text-zinc-500 mt-1">
                Supports UTF-8 CSV with header rows
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3.5 rounded-lg bg-zinc-800/60 border border-zinc-700/80">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-6 h-6 text-indigo-400 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-zinc-200">{file.name}</div>
                  <div className="text-xs text-zinc-400">
                    {(file.size / 1024).toFixed(1)} KB • {preview?.total_rows ?? 0} rows found
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setPreview(null);
                }}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Parsing Spinner */}
          {previewing && (
            <div className="flex items-center justify-center gap-2.5 py-4 text-sm text-indigo-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Analyzing CSV structure...</span>
            </div>
          )}

          {/* Form Settings & Column Mapping (Visible once file is picked) */}
          {preview && (
            <div className="space-y-4 pt-2 border-t border-zinc-800">
              {/* Spreadsheet Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Spreadsheet Title
                </label>
                <Input
                  value={sheetName}
                  onChange={(e) => setSheetName(e.target.value)}
                  placeholder="e.g., Juniors Training Attendance Sheet"
                  className="bg-zinc-800/60 border-zinc-700 text-zinc-100"
                  required
                />
              </div>

              {/* Column Mapping Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* CF Handle Column */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      CF Handle Column <span className="text-rose-400">*</span>
                    </label>
                    {preview.suggested_handle_column && (
                      <Badge variant="outline" className="text-[10px] bg-indigo-950/40 text-indigo-300 border-indigo-700/60">
                        <Sparkles className="w-2.5 h-2.5 mr-1" /> Auto-detected
                      </Badge>
                    )}
                  </div>
                  <select
                    value={handleColumn}
                    onChange={(e) => setHandleColumn(e.target.value)}
                    className="w-full h-10 px-3 rounded-md bg-zinc-800/80 border border-zinc-700 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="" disabled>Select handle column</option>
                    {preview.columns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>

                {/* WhatsApp / Phone Column */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      Phone / WhatsApp Column
                    </label>
                    {preview.suggested_phone_column && (
                      <Badge variant="outline" className="text-[10px] bg-emerald-950/40 text-emerald-300 border-emerald-700/60">
                        <Sparkles className="w-2.5 h-2.5 mr-1" /> Auto-detected
                      </Badge>
                    )}
                  </div>
                  <select
                    value={phoneColumn}
                    onChange={(e) => setPhoneColumn(e.target.value)}
                    className="w-full h-10 px-3 rounded-md bg-zinc-800/80 border border-zinc-700 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">None / Not Applicable</option>
                    {preview.columns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sample Preview Table */}
              <div className="space-y-1.5 pt-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Data Preview (First 5 Rows)
                </div>
                <div className="border border-zinc-800 rounded-lg overflow-x-auto max-h-48 bg-zinc-950/50">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-800/80 border-b border-zinc-800 text-zinc-300">
                        {preview.columns.map((col) => (
                          <th
                            key={col}
                            className={cn(
                              "px-3 py-2 whitespace-nowrap font-medium",
                              col === handleColumn && "text-indigo-400 bg-indigo-950/30",
                              col === phoneColumn && "text-emerald-400 bg-emerald-950/30"
                            )}
                          >
                            {col}
                            {col === handleColumn && " (Handle)"}
                            {col === phoneColumn && " (Phone)"}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {preview.sample_rows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-zinc-800/30">
                          {preview.columns.map((col) => (
                            <td
                              key={col}
                              className={cn(
                                "px-3 py-1.5 whitespace-nowrap text-zinc-300 font-mono text-[11px]",
                                col === handleColumn && "text-indigo-300 font-semibold bg-indigo-950/10",
                                col === phoneColumn && "text-emerald-300 bg-emerald-950/10"
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
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={uploading}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!file || !preview || uploading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Import Spreadsheet
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
