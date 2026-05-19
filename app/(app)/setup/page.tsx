"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronRight, GitBranch, Globe, Rocket, Sparkles, User, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeOctaneData } from "@/lib/data/normalize-octane-data";
import { useOctaneStore } from "@/lib/store/octane-store";
import { getSupabaseClient } from "@/lib/supabase/client";
import { pushToSupabase } from "@/lib/supabase/sync";
import { cn } from "@/lib/utils";
import type { EntityType } from "@/lib/types";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SetupEntity {
  name: string;
  type: EntityType;
  githubRepo: string;
  websiteUrl: string;
  logoEmoji: string;
}

interface SetupProject {
  name: string;
  description: string;
  entityIndex: number | null; // which entity it belongs to
}

const ENTITY_TYPES: { value: EntityType; label: string }[] = [
  { value: "trust", label: "Trust" },
  { value: "llc", label: "LLC" },
  { value: "holding", label: "Holding company" },
  { value: "lab", label: "Lab / R&D" },
  { value: "product", label: "Product / SaaS" },
  { value: "subsidiary", label: "Subsidiary" },
  { value: "other", label: "Other" },
];

const EMOJI_OPTIONS = ["🏢", "🚀", "🔭", "⚡", "🔥", "💡", "🎯", "🌊", "🦅", "🧬", "🏛️", "💎"];

const STEPS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "entities", label: "Entities", icon: Building2 },
  { id: "projects", label: "Projects", icon: Rocket },
  { id: "finish", label: "Finish", icon: Sparkles },
];

// ─── Step components ─────────────────────────────────────────────────────────

function StepProfile({
  name,
  role,
  onChange,
}: {
  name: string;
  role: string;
  onChange: (field: "name" | "role", value: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="profile-name">Your name *</Label>
        <Input
          id="profile-name"
          value={name}
          onChange={(e) => onChange("name", e.target.value)}
          placeholder="Logan"
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="profile-role">Your role</Label>
        <Input
          id="profile-role"
          value={role}
          onChange={(e) => onChange("role", e.target.value)}
          placeholder="Founder & CEO"
        />
      </div>
      <p className="text-xs text-zinc-500">
        This is how Octane AI will address you and tailor its recommendations.
      </p>
    </div>
  );
}

function EntityForm({
  entity,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  entity: SetupEntity;
  index: number;
  onChange: (index: number, field: keyof SetupEntity, value: string) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          Entity {index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="text-zinc-600 hover:text-red-400 transition-colors"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Emoji picker */}
      <div>
        <Label className="text-xs mb-2 block">Logo</Label>
        <div className="flex flex-wrap gap-1.5">
          {EMOJI_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onChange(index, "logoEmoji", emoji)}
              className={cn(
                "size-8 rounded-lg text-lg transition-all",
                entity.logoEmoji === emoji
                  ? "bg-amber-950/60 border border-amber-700/60 ring-1 ring-amber-600/40"
                  : "bg-zinc-900 border border-zinc-800 hover:border-zinc-700",
              )}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Name *</Label>
          <Input
            value={entity.name}
            onChange={(e) => onChange(index, "name", e.target.value)}
            placeholder="Octane Holdings Trust"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Type</Label>
          <select
            value={entity.type}
            onChange={(e) => onChange(index, "type", e.target.value)}
            className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 text-sm text-zinc-200"
          >
            {ENTITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">
          <GitBranch className="inline size-3 mr-1" />
          GitHub repo (owner/name)
        </Label>
        <Input
          value={entity.githubRepo}
          onChange={(e) => onChange(index, "githubRepo", e.target.value)}
          placeholder="NonstopAgent/Octane-Core"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">
          <Globe className="inline size-3 mr-1" />
          Website URL
        </Label>
        <Input
          value={entity.websiteUrl}
          onChange={(e) => onChange(index, "websiteUrl", e.target.value)}
          placeholder="https://octane.dev"
        />
      </div>
    </div>
  );
}

function StepEntities({
  entities,
  onChange,
  onAdd,
  onRemove,
}: {
  entities: SetupEntity[];
  onChange: (index: number, field: keyof SetupEntity, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400">
        Add your companies, trusts, labs, or products. You can always add more later.
      </p>
      {entities.map((entity, i) => (
        <EntityForm
          key={i}
          entity={entity}
          index={i}
          onChange={onChange}
          onRemove={onRemove}
          canRemove={entities.length > 1}
        />
      ))}
      {entities.length < 6 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAdd}
          className="w-full border-dashed border-zinc-700 text-zinc-400 hover:text-zinc-200"
        >
          + Add another entity
        </Button>
      )}
    </div>
  );
}

function ProjectForm({
  project,
  index,
  entities,
  onChange,
  onRemove,
  canRemove,
}: {
  project: SetupProject;
  index: number;
  entities: SetupEntity[];
  onChange: (index: number, field: keyof SetupProject, value: string | number | null) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          Project {index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="text-zinc-600 hover:text-red-400 transition-colors"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Project name *</Label>
        <Input
          value={project.name}
          onChange={(e) => onChange(index, "name", e.target.value)}
          placeholder="Octane Core v2"
          autoFocus={index === 0}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">What are you building?</Label>
        <Input
          value={project.description}
          onChange={(e) => onChange(index, "description", e.target.value)}
          placeholder="Internal OS for managing the Octane portfolio"
        />
      </div>

      {entities.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs">Belongs to entity</Label>
          <select
            value={project.entityIndex ?? ""}
            onChange={(e) =>
              onChange(
                index,
                "entityIndex",
                e.target.value === "" ? null : parseInt(e.target.value),
              )
            }
            className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 text-sm text-zinc-200"
          >
            <option value="">— None —</option>
            {entities.map((e, ei) => (
              <option key={ei} value={ei}>
                {e.logoEmoji} {e.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function StepProjects({
  projects,
  entities,
  onChange,
  onAdd,
  onRemove,
}: {
  projects: SetupProject[];
  entities: SetupEntity[];
  onChange: (index: number, field: keyof SetupProject, value: string | number | null) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400">
        Add your active projects — things you&apos;re actively building or shipping. Skip what&apos;s not relevant yet.
      </p>
      {projects.map((proj, i) => (
        <ProjectForm
          key={i}
          project={proj}
          index={i}
          entities={entities}
          onChange={onChange}
          onRemove={onRemove}
          canRemove={projects.length > 1}
        />
      ))}
      {projects.length < 8 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAdd}
          className="w-full border-dashed border-zinc-700 text-zinc-400 hover:text-zinc-200"
        >
          + Add another project
        </Button>
      )}
    </div>
  );
}

function StepFinish({ name }: { name: string }) {
  return (
    <div className="space-y-6 text-center py-4">
      <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-amber-800/40 bg-amber-950/30">
        <Sparkles className="size-8 text-amber-400" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-zinc-100">
          You&apos;re all set{name ? `, ${name}` : ""}
        </h3>
        <p className="mt-2 text-sm text-zinc-400 max-w-sm mx-auto">
          Your workspace is ready. Everything you just entered will be saved to your account — no fake data, no placeholders.
        </p>
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 text-left space-y-2">
        <p className="text-xs font-medium text-zinc-400">What&apos;s next:</p>
        <div className="space-y-1.5 text-sm text-zinc-300">
          <p>→ Add your Anthropic API key to unlock Octane AI</p>
          <p>→ Set up agents to automate work across your projects</p>
          <p>→ Connect GitHub and Vercel for real-time repo tracking</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SetupPage() {
  const router = useRouter();
  const store = useOctaneStore();
  const [step, setStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [profileName, setProfileName] = useState("");
  const [profileRole, setProfileRole] = useState("");

  const [entities, setEntities] = useState<SetupEntity[]>([
    { name: "", type: "llc", githubRepo: "", websiteUrl: "", logoEmoji: "🏢" },
  ]);

  const [projects, setProjects] = useState<SetupProject[]>([
    { name: "", description: "", entityIndex: null },
  ]);

  // Profile handlers
  function handleProfileChange(field: "name" | "role", value: string) {
    if (field === "name") setProfileName(value);
    else setProfileRole(value);
  }

  // Entity handlers
  function handleEntityChange(index: number, field: keyof SetupEntity, value: string) {
    setEntities((prev) =>
      prev.map((e, i) => (i === index ? { ...e, [field]: value } : e)),
    );
  }
  function addEntity() {
    setEntities((prev) => [
      ...prev,
      { name: "", type: "llc", githubRepo: "", websiteUrl: "", logoEmoji: "🚀" },
    ]);
  }
  function removeEntity(index: number) {
    setEntities((prev) => prev.filter((_, i) => i !== index));
  }

  // Project handlers
  function handleProjectChange(
    index: number,
    field: keyof SetupProject,
    value: string | number | null,
  ) {
    setProjects((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
    );
  }
  function addProject() {
    setProjects((prev) => [
      ...prev,
      { name: "", description: "", entityIndex: null },
    ]);
  }
  function removeProject(index: number) {
    setProjects((prev) => prev.filter((_, i) => i !== index));
  }

  // Validation
  function canProceed(): boolean {
    if (step === 0) return profileName.trim().length > 0;
    if (step === 1) return entities.some((e) => e.name.trim().length > 0);
    if (step === 2) return projects.some((p) => p.name.trim().length > 0);
    return true;
  }

  async function skipToOctane() {
    setIsSaving(true);
    try {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      store.clearToBlank();
      if (profileName.trim()) {
        store.updateProfile({
          name: profileName.trim(),
          role: profileRole.trim() || "Founder",
          email: user?.email ?? "",
        });
      }
      const normalized = normalizeOctaneData(useOctaneStore.getState());
      useOctaneStore.setState(normalized);
      toast.success("Welcome to Octane — add projects anytime.");
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      console.error("Skip setup error:", err);
      toast.error("Could not enter workspace. Try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleFinish() {
    setIsSaving(true);

    try {
      // 1. Get Supabase user to get the email
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      const email = user?.email ?? "";

      // 2. Wipe all fake/seed data — start from a truly blank state
      store.clearToBlank();

      // 3. Update profile
      store.updateProfile({
        name: profileName.trim(),
        role: profileRole.trim() || "Founder",
        email,
      });

      // 4. Create real entities
      const validEntities = entities.filter((e) => e.name.trim());
      const createdEntityIds: string[] = [];

      for (const e of validEntities) {
        const entity = store.createEntity({
          name: e.name.trim(),
          type: e.type,
          status: "active",
          logoEmoji: e.logoEmoji,
          githubRepo: e.githubRepo.trim() || undefined,
          websiteUrl: e.websiteUrl.trim() || undefined,
          linkedProjectIds: [],
        });
        createdEntityIds.push(entity.id);
      }

      // 5. Create real projects + link to entities
      const validProjects = projects.filter((p) => p.name.trim());

      for (const p of validProjects) {
        const project = store.createProject({
          name: p.name.trim(),
          description: p.description.trim() || "",
          status: "building",
          priority: "high",
          owner: profileName.trim(),
          progress: 0,
          revenueStatus: "pre_revenue",
        });

        // Link project to entity
        if (p.entityIndex !== null && createdEntityIds[p.entityIndex]) {
          const entityId = createdEntityIds[p.entityIndex];
          const entity = store.getEntityById(entityId);
          if (entity) {
            store.updateEntity(entityId, {
              linkedProjectIds: [...(entity.linkedProjectIds ?? []), project.id],
            });
          }
        }
      }

      // 6. Normalize persisted slices (prevents /projects crash on partial data)
      const normalized = normalizeOctaneData(useOctaneStore.getState());
      useOctaneStore.setState(normalized);

      // 7. Push everything to Supabase
      const storeState = useOctaneStore.getState();
      await pushToSupabase({
        profile: storeState.profile,
        entities: storeState.entities,
        projects: storeState.projects,
        tasks: storeState.tasks,
        agents: storeState.agents,
        transactions: storeState.transactions,
        decisions: storeState.decisions,
        documents: storeState.documents,
        founderNotes: storeState.founderNotes,
        roadmapItems: storeState.roadmapItems,
      });

      toast.success("Workspace saved — welcome to Octane Core!");
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      console.error("Setup error:", err);
      toast.error("Something went wrong saving your data. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  const currentStep = STEPS[step];
  const isLastStep = step === STEPS.length - 1;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-950">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-amber-950/60 border border-amber-800/40">
            <span className="text-2xl">⚡</span>
          </div>
          <h1 className="text-xl font-bold text-zinc-100">Set up your workspace</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Optional quick start — or ask Octane to build your portfolio with you in Chat.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSaving}
              onClick={() => void skipToOctane()}
              className="border-zinc-700"
            >
              Skip setup / Enter Octane
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isSaving}
              onClick={() => router.push("/outlook#ask-octane")}
              className="text-amber-400/90 hover:text-amber-300"
            >
              Set this up with Octane Chat →
            </Button>
          </div>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-xs font-medium transition-all",
                  i < step
                    ? "bg-emerald-600 text-white"
                    : i === step
                    ? "bg-amber-600 text-white"
                    : "bg-zinc-800 text-zinc-500",
                )}
              >
                {i < step ? "✓" : i + 1}
              </div>
              <span
                className={cn(
                  "text-xs",
                  i === step ? "text-zinc-200 font-medium" : "text-zinc-600",
                )}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <ChevronRight className="size-3 text-zinc-700 mx-1" />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <Card className="border border-zinc-800 bg-zinc-900/70">
          <CardContent className="p-6">
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-1">
                <currentStep.icon className="size-4 text-amber-400" />
                <h2 className="font-semibold text-zinc-100">{currentStep.label}</h2>
              </div>
            </div>

            {step === 0 && (
              <StepProfile
                name={profileName}
                role={profileRole}
                onChange={handleProfileChange}
              />
            )}
            {step === 1 && (
              <StepEntities
                entities={entities}
                onChange={handleEntityChange}
                onAdd={addEntity}
                onRemove={removeEntity}
              />
            )}
            {step === 2 && (
              <StepProjects
                projects={projects}
                entities={entities.filter((e) => e.name.trim())}
                onChange={handleProjectChange}
                onAdd={addProject}
                onRemove={removeProject}
              />
            )}
            {step === 3 && <StepFinish name={profileName} />}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || isSaving}
            className="text-zinc-500 hover:text-zinc-300"
          >
            ← Back
          </Button>

          <div className="flex items-center gap-3">
            {/* Skip (not on last step) */}
            {step < STEPS.length - 1 && step > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStep((s) => s + 1)}
                className="text-zinc-600 hover:text-zinc-400"
              >
                Skip
              </Button>
            )}

            {isLastStep ? (
              <Button
                type="button"
                onClick={handleFinish}
                disabled={isSaving}
                className="bg-amber-600 hover:bg-amber-500 text-white"
              >
                {isSaving ? "Saving…" : "Enter Octane Core →"}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                disabled={!canProceed()}
                className="bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-40"
              >
                Continue →
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
