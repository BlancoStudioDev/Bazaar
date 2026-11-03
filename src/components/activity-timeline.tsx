"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Check, ChevronDown } from "lucide-react";

import { MARKETPLACES } from "@/lib/marketplaces";
import type { ToolActivity } from "@/lib/types";
import { cn, formatDuration, marketplaceName } from "@/lib/ui";
import { Spinner } from "@/components/ui";

function ActivityRow({ activity }: { activity: ToolActivity }) {
  const meta = MARKETPLACES[activity.server as keyof typeof MARKETPLACES];
  const query = typeof activity.args.query === "string" ? activity.args.query : null;

  return (
    <li className="flex items-start gap-3 py-2">
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
        {activity.status === "running" ? (
          <Spinner className="h-4 w-4 text-accent" />
        ) : activity.status === "error" ? (
          <AlertCircle className="h-4 w-4 text-rose-600" />
        ) : (
          <Check className="h-4 w-4 text-muted" />
        )}
      </span>
      <div className="min-w-0 flex-1 text-[13px]">
        <p className="text-ink">
          {meta?.shortLabel || activity.label}
          {query ? <span className="text-muted"> · “{query}”</span> : null}
        </p>
        <p className="text-[12px] text-muted">
          {activity.status === "running"
            ? "In corso…"
            : activity.status === "error"
              ? activity.error || "Non riuscita"
              : `${activity.count ?? 0} ${activity.count === 1 ? "risultato" : "risultati"}`}
          {activity.durationMs != null ? ` · ${formatDuration(activity.durationMs)}` : ""}
        </p>
      </div>
    </li>
  );
}

export function ActivityTimeline({
  activities,
  streaming,
}: {
  activities: ToolActivity[];
  streaming: boolean;
}) {
  const [open, setOpen] = useState(false);
  const stats = useMemo(() => {
    const servers = new Set(activities.map((activity) => activity.server));
    const errors = activities.filter((activity) => activity.status === "error").length;
    const results = activities.reduce(
      (sum, activity) => sum + (activity.status === "done" ? activity.count ?? 0 : 0),
      0,
    );
    return { sources: servers.size, errors, results };
  }, [activities]);

  if (!activities.length) return null;

  const running = activities.some((activity) => activity.status === "running");
  const sourcesLabel = `${stats.sources} marketplace`;
  const summary = streaming
    ? running
      ? `Cerco su ${sourcesLabel}…`
      : "Confronto i risultati…"
    : `Cercato su ${sourcesLabel} · ${stats.results} ${stats.results === 1 ? "risultato" : "risultati"}${
        stats.errors ? ` · ${stats.errors} non ${stats.errors === 1 ? "riuscita" : "riuscite"}` : ""
      }`;
  const names = Array.from(new Set(activities.map((activity) => marketplaceName(activity.server))));

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="-ml-2 inline-flex min-h-10 max-w-full items-center gap-2 rounded-full px-2 text-left text-[12px] text-muted transition hover:text-ink"
        aria-expanded={open}
        title={names.join(", ")}
      >
        {streaming ? <Spinner className="h-4 w-4 shrink-0 text-accent" /> : null}
        <span className="truncate">{summary}</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 transition", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? (
        <ul className="mt-1 divide-y divide-line/70 border-l border-line pl-4">
          {activities.map((activity) => (
            <ActivityRow key={activity.id} activity={activity} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
