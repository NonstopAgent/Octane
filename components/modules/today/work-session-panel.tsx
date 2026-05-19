"use client";

import { differenceInMinutes, format, formatDistanceToNow, parseISO } from "date-fns";
import { Clock, Play, Square, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { EmptyState } from "@/components/modules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useOctaneStore } from "@/lib/store/octane-store";
import type { Project, Task, WorkSession } from "@/lib/types";

import { TodaySection } from "./today-section";

export function WorkSessionPanel({
  showStartForm,
  onShowStartFormChange,
}: {
  showStartForm: boolean;
  onShowStartFormChange: (open: boolean) => void;
}) {
  const workSessions = useOctaneStore((s) => s.workSessions);
  const projects = useOctaneStore((s) => s.projects);
  const tasks = useOctaneStore((s) => s.tasks);
  const startWorkSession = useOctaneStore((s) => s.startWorkSession);
  const completeWorkSession = useOctaneStore((s) => s.completeWorkSession);
  const abandonWorkSession = useOctaneStore((s) => s.abandonWorkSession);

  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState("");
  const [, tick] = useState(0);

  const activeSession = useMemo(
    () =>
      [...workSessions]
        .filter((s) => s.status === "active")
        .sort(
          (a, b) =>
            new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
        )[0],
    [workSessions],
  );

  const sessionHistory = useMemo(
    () =>
      [...workSessions]
        .filter((s) => s.status === "completed" || s.status === "abandoned")
        .sort((a, b) => {
          const aEnd = a.endedAt ?? a.updatedAt;
          const bEnd = b.endedAt ?? b.updatedAt;
          return new Date(bEnd).getTime() - new Date(aEnd).getTime();
        })
        .slice(0, 5),
    [workSessions],
  );

  const projectNames = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p.name])),
    [projects],
  );

  const taskOptions = useMemo(() => {
    const open = tasks.filter((t) => t.status !== "done");
    if (!projectId) return open;
    return open.filter((t) => t.projectId === projectId);
  }, [tasks, projectId]);

  useEffect(() => {
    if (!activeSession) return;
    const id = window.setInterval(() => tick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, [activeSession]);

  useEffect(() => {
    if (activeSession) onShowStartFormChange(false);
  }, [activeSession, onShowStartFormChange]);

  function resetForm() {
    setTitle("");
    setProjectId("");
    setTaskId("");
    setNotes("");
    setOutcome("");
  }

  function handleStart(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    startWorkSession({
      title: trimmed,
      projectId: projectId || undefined,
      taskId: taskId || undefined,
      notes: notes.trim() || undefined,
    });
    resetForm();
    onShowStartFormChange(false);
  }

  function handleComplete() {
    if (!activeSession) return;
    completeWorkSession(activeSession.id, {
      outcome: outcome.trim() || undefined,
      notes: notes.trim() || activeSession.notes,
    });
    setOutcome("");
    setNotes("");
  }

  function handleAbandon() {
    if (!activeSession) return;
    abandonWorkSession(activeSession.id, {
      notes: notes.trim() || activeSession.notes,
    });
    setNotes("");
  }

  return (
    <TodaySection
      title="Work session"
      description="Deep work block tied to a project or task"
      icon={Clock}
    >
      {activeSession ? (
        <ActiveSessionCard
          session={activeSession}
          projects={projects}
          tasks={tasks}
          notes={notes}
          outcome={outcome}
          onNotesChange={setNotes}
          onOutcomeChange={setOutcome}
          onComplete={handleComplete}
          onAbandon={handleAbandon}
        />
      ) : showStartForm ? (
        <form onSubmit={handleStart} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="session-title">Title</Label>
            <Input
              id="session-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What are you working on?"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="session-project">Project</Label>
              <Select
                id="session-project"
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setTaskId("");
                }}
              >
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-task">Task</Label>
              <Select
                id="session-task"
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
              >
                <option value="">None</option>
                {taskOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="session-notes">Notes</Label>
            <Textarea
              id="session-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional focus notes…"
              rows={2}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit">
              <Play className="size-4" aria-hidden />
              Start session
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onShowStartFormChange(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <EmptyState
          icon={Play}
          title="No active session"
          description="Start a focused work block to track time and outcomes."
          action={{
            label: "Start session",
            onClick: () => onShowStartFormChange(true),
          }}
        />
      )}

      {sessionHistory.length > 0 ? (
        <div className="mt-6 border-t border-zinc-800/80 pt-6">
          <p className="mb-3 text-sm font-medium text-zinc-300">Recent sessions</p>
          <ul className="space-y-2">
            {sessionHistory.map((session) => (
              <SessionHistoryRow
                key={session.id}
                session={session}
                projectNames={projectNames}
                tasks={tasks}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </TodaySection>
  );
}

function ActiveSessionCard({
  session,
  projects,
  tasks,
  notes,
  outcome,
  onNotesChange,
  onOutcomeChange,
  onComplete,
  onAbandon,
}: {
  session: WorkSession;
  projects: Project[];
  tasks: Task[];
  notes: string;
  outcome: string;
  onNotesChange: (v: string) => void;
  onOutcomeChange: (v: string) => void;
  onComplete: () => void;
  onAbandon: () => void;
}) {
  const elapsed = differenceInMinutes(new Date(), parseISO(session.startedAt));
  const linkedTask = session.taskId
    ? tasks.find((t) => t.id === session.taskId)
    : undefined;
  const linkedProject = session.projectId
    ? projects.find((p) => p.id === session.projectId)
    : undefined;

  return (
    <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-zinc-100">{session.title}</p>
          <p className="mt-1 text-xs text-zinc-500">
            Started {formatDistanceToNow(parseISO(session.startedAt), { addSuffix: true })}
            {linkedProject ? ` · ${linkedProject.name}` : null}
            {linkedTask ? ` · ${linkedTask.title}` : null}
          </p>
        </div>
        <span className="text-sm font-medium tabular-nums text-amber-300">
          {elapsed < 1 ? "<1 min" : `${elapsed} min`}
        </span>
      </div>
      <div className="mt-4 space-y-3">
        <div className="space-y-2">
          <Label htmlFor="active-outcome">Outcome</Label>
          <Input
            id="active-outcome"
            value={outcome}
            onChange={(e) => onOutcomeChange(e.target.value)}
            placeholder="What did you ship?"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="active-notes">Notes</Label>
          <Textarea
            id="active-notes"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder={session.notes ?? "Session notes…"}
            rows={2}
          />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={onComplete}>
          <Square className="size-4" aria-hidden />
          Complete
        </Button>
        <Button type="button" variant="outline" onClick={onAbandon}>
          <XCircle className="size-4" aria-hidden />
          Abandon
        </Button>
      </div>
    </div>
  );
}

function SessionHistoryRow({
  session,
  projectNames,
  tasks,
}: {
  session: WorkSession;
  projectNames: Record<string, string>;
  tasks: Task[];
}) {
  const taskTitle = session.taskId
    ? tasks.find((t) => t.id === session.taskId)?.title
    : undefined;
  const ended = session.endedAt ?? session.updatedAt;

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800/90 bg-zinc-950/40 px-3 py-2 text-sm">
      <div>
        <p className="text-zinc-200">{session.title}</p>
        <p className="text-xs text-zinc-500">
          {session.projectId ? projectNames[session.projectId] : "No project"}
          {taskTitle ? ` · ${taskTitle}` : ""}
          {" · "}
          {format(parseISO(ended), "MMM d, h:mm a")}
        </p>
      </div>
      <span
        className={
          session.status === "completed"
            ? "text-xs text-emerald-400"
            : "text-xs text-zinc-500"
        }
      >
        {session.status === "completed" ? "Completed" : "Abandoned"}
        {session.durationMinutes != null ? ` · ${session.durationMinutes}m` : ""}
      </span>
    </li>
  );
}
