"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPatch, apiPost, ApiError } from "@/lib/api-client";
import type { Hcp, ListResponse, MedEvent } from "@/lib/types";
import { fmtCurrency, fmtDateTime } from "@/lib/utils";
import { Badge, Button, Card, Dialog, Empty, ErrorBox, Field, Input, Loading, Notice, PageHeader, Select, TierBadge } from "@/components/ui";
import { useUser } from "@/lib/context";

export default function EventsPage() {
  const { current } = useUser();
  const [events, setEvents] = useState<MedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MedEvent | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [hcps, setHcps] = useState<Hcp[]>([]);
  const [name, setName] = useState("");
  const [eventType, setEventType] = useState("科室会");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [followUpTitle, setFollowUpTitle] = useState("会议后续跟进");
  const [followUpDueDate, setFollowUpDueDate] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

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

  useEffect(() => {
    apiGet<ListResponse<Hcp>>("/api/hcp", { pageSize: 200 })
      .then((res) => setHcps(res.data))
      .catch(() => setHcps([]));
  }, []);

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

  function refreshDetail(id: string) {
    return apiGet<MedEvent>(`/api/events/${id}`).then(setDetail);
  }

  async function createEvent() {
    try {
      await apiPost("/api/events", {
        name, type: eventType, eventDate, location: location || undefined,
        attendeeHcpIds: attendeeIds,
      });
      setDialogOpen(false);
      setName(""); setEventDate(""); setLocation(""); setAttendeeIds([]);
      setNotice("会议已创建");
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "创建失败");
    }
  }

  async function changeStatus(event: MedEvent, status: "OPEN" | "COMPLETED" | "CANCELLED") {
    try {
      await apiPatch(`/api/events/${event.id}`, { status });
      setNotice(status === "OPEN" ? "会议已开始" : status === "COMPLETED" ? "会议已结束" : "会议已取消");
      await refreshDetail(event.id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    }
  }

  async function markAttendance(eventId: string, attendanceId: string, status: "CHECKED_IN" | "ABSENT") {
    try {
      await apiPatch(`/api/events/${eventId}/attendees/${attendanceId}`, { status });
      await refreshDetail(eventId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "签到失败");
    }
  }

  async function generateTasks(eventId: string) {
    if (!current) return;
    try {
      const result = await apiPost<{ created: number; skipped: number }>(`/api/events/${eventId}/follow-up-tasks`, {
        assigneeId: current.id,
        title: followUpTitle,
        dueDate: followUpDueDate || undefined,
      });
      setNotice(`已生成 ${result.created} 条跟进任务${result.skipped ? `，跳过 ${result.skipped} 条重复任务` : ""}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成任务失败");
    }
  }

  return (
    <div>
      <PageHeader title="医学会议" desc="科室会 / 城市会 / 学术研讨会" extra={<Button onClick={() => setDialogOpen(true)}>创建会议</Button>} />

      {notice && <Notice kind="success" text={notice} onClose={() => setNotice(null)} />}
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
                    <Badge tone={ev.status === "COMPLETED" ? "emerald" : ev.status === "OPEN" ? "blue" : ev.status === "CANCELLED" ? "red" : "slate"}>
                      {ev.status === "COMPLETED" ? "已结束" : ev.status === "OPEN" ? "进行中" : ev.status === "CANCELLED" ? "已取消" : "草稿"}
                    </Badge>
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
                    <ul className="space-y-2">
                      {(detail.attendees ?? []).map((a) => (
                        <li key={a.id} className="flex items-center justify-between text-sm">
                          <span className="text-slate-700">
                            {a.hcp.name}
                            <span className="ml-1 text-xs text-slate-400">{a.hcp.title}</span>
                          </span>
                          <span className="flex items-center gap-2 text-xs text-slate-400">
                            {a.hcp.hco?.name}
                            {a.hcp.tier && <TierBadge tier={a.hcp.tier} />}
                            <Badge tone={a.status === "CHECKED_IN" ? "emerald" : a.status === "ABSENT" ? "red" : "slate"}>
                              {a.status === "CHECKED_IN" ? "已签到" : a.status === "ABSENT" ? "缺席" : "已邀请"}
                            </Badge>
                            {detail.status === "OPEN" && (
                              <>
                                <Button size="sm" onClick={() => markAttendance(detail.id, a.id, "CHECKED_IN")}>签到</Button>
                                <Button size="sm" variant="ghost" onClick={() => markAttendance(detail.id, a.id, "ABSENT")}>缺席</Button>
                              </>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!detailLoading && detail && (
                    <div className="mt-4 border-t border-slate-100 pt-3">
                      {detail.status === "DRAFT" && <div className="flex gap-2"><Button size="sm" onClick={() => changeStatus(detail, "OPEN")}>开始会议</Button><Button size="sm" variant="ghost" onClick={() => changeStatus(detail, "CANCELLED")}>取消会议</Button></div>}
                      {detail.status === "OPEN" && <Button size="sm" onClick={() => changeStatus(detail, "COMPLETED")}>结束会议</Button>}
                      {detail.status === "COMPLETED" && (
                        <div className="grid gap-2 md:grid-cols-[1fr_160px_auto]">
                          <Input value={followUpTitle} onChange={(e) => setFollowUpTitle(e.target.value)} placeholder="跟进任务标题" />
                          <Input type="date" value={followUpDueDate} onChange={(e) => setFollowUpDueDate(e.target.value)} />
                          <Button size="sm" onClick={() => generateTasks(detail.id)}>为已签到医生生成任务</Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="创建会议" wide>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="会议名称" required><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="会议类型" required>
              <Select className="w-full" value={eventType} onChange={(e) => setEventType(e.target.value)}>
                {["科室会", "城市会", "学术研讨会", "卫星会"].map((type) => <option key={type}>{type}</option>)}
              </Select>
            </Field>
            <Field label="时间" required><Input type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} /></Field>
            <Field label="地点"><Input value={location} onChange={(e) => setLocation(e.target.value)} /></Field>
          </div>
          <Field label="邀请医生">
            <div className="grid max-h-64 gap-2 overflow-y-auto rounded-md border border-slate-200 p-3 md:grid-cols-2">
              {hcps.map((hcp) => (
                <label key={hcp.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={attendeeIds.includes(hcp.id)} onChange={(e) => setAttendeeIds((ids) => e.target.checked ? [...ids, hcp.id] : ids.filter((id) => id !== hcp.id))} />
                  {hcp.name} · {hcp.hco?.name ?? "未关联机构"}
                </label>
              ))}
            </div>
          </Field>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setDialogOpen(false)}>取消</Button><Button disabled={!name || !eventDate} onClick={createEvent}>保存草稿</Button></div>
        </div>
      </Dialog>
    </div>
  );
}
