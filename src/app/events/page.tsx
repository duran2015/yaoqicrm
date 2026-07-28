"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import type { ListResponse, MedEvent } from "@/lib/types";
import { fmtCurrency, fmtDateTime } from "@/lib/utils";
import { Badge, Card, Empty, ErrorBox, Loading, PageHeader, TierBadge } from "@/components/ui";

export default function EventsPage() {
  const [events, setEvents] = useState<MedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MedEvent | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiGet<ListResponse<MedEvent>>("/api/events")
      .then((res) => {
        setEvents(res.data);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "加载失败");
        setLoading(false);
      });
  }, []);

  useEffect(load, [load]);

  function toggle(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(id);
    setDetail(null);
    setDetailLoading(true);
    apiGet<MedEvent>(`/api/events/${id}`)
      .then((res) => setDetail(res))
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }

  return (
    <div>
      <PageHeader title="医学会议" desc="科室会 / 城市会 / 学术研讨会" />

      {error && <ErrorBox message={error} onRetry={load} />}
      {loading && <Loading text="正在加载会议列表…" />}

      {!loading && !error && events.length === 0 && (
        <Card>
          <Empty text="暂无会议安排" />
        </Card>
      )}

      {!loading && !error && events.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {events.map((ev) => (
            <Card key={ev.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-800">{ev.name}</h3>
                    <Badge tone="teal">{ev.type}</Badge>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-slate-500">
                    <div>时间:{fmtDateTime(ev.eventDate)}</div>
                    <div>地点:{ev.location ?? "—"}</div>
                    <div>
                      预算:{fmtCurrency(ev.budget)} · 参会 {ev._count?.attendees ?? 0} 人
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => toggle(ev.id)}
                  className="shrink-0 rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                >
                  {expandedId === ev.id ? "收起 ▲" : "参会医生 ▼"}
                </button>
              </div>

              {expandedId === ev.id && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  {detailLoading && <div className="py-2 text-xs text-slate-400">加载参会名单…</div>}
                  {!detailLoading && (!detail || (detail.attendees ?? []).length === 0) && (
                    <div className="py-2 text-xs text-slate-400">暂无参会医生</div>
                  )}
                  {!detailLoading && detail && (detail.attendees ?? []).length > 0 && (
                    <ul className="space-y-1.5">
                      {(detail.attendees ?? []).map((a) => (
                        <li key={a.id} className="flex items-center justify-between text-sm">
                          <span className="text-slate-700">
                            {a.hcp.name}
                            <span className="ml-1 text-xs text-slate-400">{a.hcp.title}</span>
                          </span>
                          <span className="flex items-center gap-2 text-xs text-slate-400">
                            {a.hcp.hco?.name}
                            {a.hcp.tier && <TierBadge tier={a.hcp.tier} />}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
