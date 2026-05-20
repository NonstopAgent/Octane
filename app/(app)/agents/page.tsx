"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Bot } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/modules";
import {
  AgentCostSummary,
  AgentDetailPanel,
  AgentTable,
} from "@/components/modules/agents";
import { useOctaneStore } from "@/lib/store/octane-store";
import type { Agent, AgentStatus } from "@/lib/types";

export default function AgentsPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-zinc-500">Loading…</p>}>
      <AgentsPageContent />
    </Suspense>
  );
}

function AgentsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const agents = useOctaneStore((state) => state.agents);
  const projects = useOctaneStore((state) => state.projects);
  const tasks = useOctaneStore((state) => state.tasks);
  const agentLogs = useOctaneStore((state) => state.agentLogs);
  const agentRuns = useOctaneStore((state) => state.agentRuns);

  const getProjectById = useOctaneStore((state) => state.getProjectById);
  const getTaskById = useOctaneStore((state) => state.getTaskById);

  const updateAgentStatus = useOctaneStore((state) => state.updateAgentStatus);
  const assignAgentToProject = useOctaneStore((state) => state.assignAgentToProject);
  const assignAgentToTask = useOctaneStore((state) => state.assignAgentToTask);
  const addAgentLog = useOctaneStore((state) => state.addAgentLog);
  const startAgentRun = useOctaneStore((state) => state.startAgentRun);
  const completeAgentRun = useOctaneStore((state) => state.completeAgentRun);
  const clearAgentLogs = useOctaneStore((state) => state.clearAgentLogs);

  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Sync ?detail= query param
  useEffect(() => {
    const detail = searchParams.get("detail");
    if (detail) {
      const agent = agents.find((a) => a.id === detail);
      if (agent) {
        setSelectedAgent(agent);
        setDetailOpen(true);
      }
    }
  }, [searchParams, agents]);

  // Keep selectedAgent in sync when store changes (e.g. status update)
  useEffect(() => {
    if (selectedAgent) {
      const refreshed = agents.find((a) => a.id === selectedAgent.id);
      if (refreshed) setSelectedAgent(refreshed);
    }
  }, [agents, selectedAgent?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSelectAgent(agent: Agent) {
    setSelectedAgent(agent);
    setDetailOpen(true);
  }

  function handleDetailClose(open: boolean) {
    setDetailOpen(open);
    if (!open) {
      // Remove ?detail= from URL without a full navigation
      const params = new URLSearchParams(searchParams.toString());
      params.delete("detail");
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "/agents", { scroll: false });
    }
  }

  const handleSimulateRun = useCallback(
    (agentId: string) => {
      const agent = agents.find((a) => a.id === agentId);
      if (!agent) return;

      const runId = startAgentRun(agentId, agent.currentTask);

      addAgentLog({
        agentId,
        type: "run",
        message: "Manual run triggered",
        taskId: agent.currentTask,
      });
      addAgentLog({
        agentId,
        type: "info",
        message: "Processing task queue…",
        taskId: agent.currentTask,
      });

      // Simulate async completion after 2 seconds
      setTimeout(() => {
        const success = Math.random() > 0.25;
        if (success) {
          addAgentLog({
            agentId,
            type: "success",
            message: "Simulated run completed successfully",
            cost: Math.round(Math.random() * 50 + 5),
            taskId: agent.currentTask,
          });
          completeAgentRun(
            runId,
            "Run completed",
            Math.round(Math.random() * 50 + 5),
          );
        } else {
          addAgentLog({
            agentId,
            type: "error",
            message: "Run encountered an error",
            details: "Check agent configuration and retry.",
            taskId: agent.currentTask,
          });
          completeAgentRun(runId, "Run failed — check logs", 0);
        }
      }, 1500);
    },
    [agents, startAgentRun, addAgentLog, completeAgentRun],
  );

  const handleUpdateStatus = useCallback(
    (agentId: string, status: AgentStatus) => {
      updateAgentStatus(agentId, status);
    },
    [updateAgentStatus],
  );

  const handleAssignProject = useCallback(
    (agentId: string, projectId: string) => {
      assignAgentToProject(agentId, projectId);
    },
    [assignAgentToProject],
  );

  const handleAssignTask = useCallback(
    (agentId: string, taskId: string) => {
      assignAgentToTask(agentId, taskId);
    },
    [assignAgentToTask],
  );

  const handleClearLogs = useCallback(
    (agentId: string) => {
      clearAgentLogs(agentId);
    },
    [clearAgentLogs],
  );

  function getProjectName(id?: string) {
    if (!id) return "—";
    return getProjectById(id)?.name ?? "—";
  }

  function getTaskTitle(id?: string) {
    if (!id) return "—";
    return getTaskById(id)?.title ?? id;
  }

  if (agents.length === 0) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Agent Control Center"
          description="Monitor, control, and configure Octane's AI operators."
        />
        <EmptyState
          icon={Bot}
          title="No agents configured"
          description="Agents automate research, ops, and build loops. Add agents via Settings or create them via the coding workbench to track Nova, Forge, and Pixel runs."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Agent Control Center"
        description="Monitor, control, and configure Octane's AI operators."
      />

      {/* Cost summary cards */}
      <AgentCostSummary agents={agents} agentRuns={agentRuns} />

      {/* Agent table with filters */}
      <AgentTable
        agents={agents}
        agentRuns={agentRuns}
        getProjectName={getProjectName}
        getTaskTitle={getTaskTitle}
        onSelect={handleSelectAgent}
      />

      {/* Detail panel (sheet) */}
      <AgentDetailPanel
        agent={selectedAgent}
        open={detailOpen}
        onOpenChange={handleDetailClose}
        agentLogs={agentLogs}
        agentRuns={agentRuns}
        projects={projects}
        tasks={tasks}
        onUpdateStatus={handleUpdateStatus}
        onAssignProject={handleAssignProject}
        onAssignTask={handleAssignTask}
        onSimulateRun={handleSimulateRun}
        onClearLogs={handleClearLogs}
      />
    </div>
  );
}
