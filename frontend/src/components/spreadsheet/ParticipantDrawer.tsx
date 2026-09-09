"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { getWhatsAppUrl, getCodeforcesProfileUrl } from "@/lib/phone-formatter";
import { ExternalLink, MessageCircle, User } from "lucide-react";

interface ParticipantDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  handle: string;
  spreadsheetId?: number | null;
  phoneColumn?: string;
}

export const ParticipantDrawer: React.FC<ParticipantDrawerProps> = ({
  open,
  onOpenChange,
  handle,
  spreadsheetId,
  phoneColumn = "WhatsApp Number",
}) => {
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !handle || !spreadsheetId) {
      setData(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    apiClient
      .get<Record<string, any>>(
        `/spreadsheets/${spreadsheetId}/participant/${encodeURIComponent(handle)}`
      )
      .then((res) => {
        if (isMounted) setData(res);
      })
      .catch((err) => {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Participant metadata not found in spreadsheet"
          );
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, handle, spreadsheetId]);

  const phoneValue = data && phoneColumn ? data[phoneColumn] : null;
  const whatsappUrl = phoneValue ? getWhatsAppUrl(String(phoneValue)) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <div className="flex items-center space-x-2">
          <User className="h-5 w-5 text-primary" />
          <DialogTitle>Participant: {handle}</DialogTitle>
        </div>
      </DialogHeader>

      <div className="space-y-4 pt-2">
        {/* Quick External Actions */}
        <div className="flex flex-wrap gap-2 pb-3 border-b border-border">
          <a
            href={getCodeforcesProfileUrl(handle)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center space-x-1.5 text-xs text-primary hover:text-brand-cyan transition-colors font-medium bg-primary/10 px-3 py-1.5 rounded-md border border-primary/20"
          >
            <span>Codeforces Profile</span>
            <ExternalLink className="h-3 w-3" />
          </a>

          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center space-x-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-medium bg-emerald-950/40 px-3 py-1.5 rounded-md border border-emerald-500/30"
            >
              <MessageCircle className="h-3 w-3" />
              <span>WhatsApp Chat</span>
            </a>
          )}
        </div>

        {loading && (
          <div className="py-8 text-center text-sm text-muted-foreground animate-pulse">
            Loading spreadsheet metadata...
          </div>
        )}

        {error && (
          <div className="py-6 text-center text-sm text-amber-400/90 bg-amber-950/20 rounded-lg p-3 border border-amber-500/20">
            {error}
          </div>
        )}

        {data && (
          <div className="divide-y divide-border/50 text-sm">
            {Object.entries(data).map(([key, value]) => (
              <div
                key={key}
                className="py-2.5 flex justify-between items-start gap-4"
              >
                <span className="text-muted-foreground font-medium">{key}</span>
                <span className="text-foreground text-right font-mono text-xs break-all">
                  {String(value ?? "—")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
};
