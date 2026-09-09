"use client";

import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Trophy, Calendar, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CodeforcesContestItem {
  id: number;
  name: string;
  type: string;
  phase: string;
  startTimeSeconds?: number | null;
}

interface ContestSearchInputProps {
  value: string;
  onChange: (val: string) => void;
  onSelectContest?: (contest: CodeforcesContestItem) => void;
  placeholder?: string;
  className?: string;
}

export const ContestSearchInput: React.FC<ContestSearchInputProps> = ({
  value,
  onChange,
  onSelectContest,
  placeholder = "Search by contest name or enter ID (e.g. 1980)...",
  className,
}) => {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<CodeforcesContestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external value
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/v1/codeforces/search?query=${encodeURIComponent(query.trim())}`
        );
        if (res.ok) {
          const data: CodeforcesContestItem[] = await res.json();
          setResults(data);
          setIsOpen(data.length > 0);
        }
      } catch (err) {
        console.error("Failed to search Codeforces contests:", err);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (contest: CodeforcesContestItem) => {
    onChange(String(contest.id));
    setQuery(String(contest.id));
    onSelectContest?.(contest);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="pl-9 pr-8 bg-zinc-800/80 border-zinc-700 text-zinc-100 text-sm font-mono placeholder:font-sans focus:ring-1 focus:ring-indigo-500"
        />
        {loading && (
          <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400 animate-spin" />
        )}
        {!loading && query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              onChange("");
              setResults([]);
              setIsOpen(false);
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-zinc-400 hover:text-zinc-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-lg bg-zinc-900 border border-zinc-700/90 shadow-2xl divide-y divide-zinc-800">
          {results.map((contest) => {
            const startDate = contest.startTimeSeconds
              ? new Date(contest.startTimeSeconds * 1000).toLocaleDateString()
              : null;

            return (
              <button
                key={contest.id}
                type="button"
                onClick={() => handleSelect(contest)}
                className="w-full text-left p-3 hover:bg-zinc-800/80 transition-colors flex items-start justify-between gap-3 group"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-indigo-400">
                      #{contest.id}
                    </span>
                    <span className="text-xs font-semibold text-zinc-200 truncate group-hover:text-white">
                      {contest.name}
                    </span>
                  </div>
                  {startDate && (
                    <div className="flex items-center gap-1 text-[11px] text-zinc-500">
                      <Calendar className="w-3 h-3" />
                      <span>{startDate}</span>
                    </div>
                  )}
                </div>

                <Badge
                  variant="outline"
                  className="shrink-0 text-[10px] bg-zinc-800 border-zinc-700 text-zinc-400"
                >
                  {contest.type}
                </Badge>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
