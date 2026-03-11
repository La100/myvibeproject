"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Flag, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useProject } from "@/components/providers/ProjectProvider";
import { apiAny } from "@/lib/convexApiAny";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency } from "@/lib/utils";
import { Id } from "@/convex/_generated/dataModel";

type MilestoneStatus = "planned" | "in_progress" | "at_risk" | "blocked" | "completed";

type MilestoneRecord = {
  _id: Id<"projectMilestones">;
  name: string;
  description?: string;
  status: MilestoneStatus;
  progress: number;
  plannedStartDate?: number;
  plannedEndDate?: number;
  actualStartDate?: number;
  actualEndDate?: number;
  budgetAmount?: number;
  blockedReason?: string;
  ownerClerkUserId?: string | null;
  owner?: {
    clerkUserId: string;
    name: string;
    imageUrl?: string;
  } | null;
  taskCount: number;
  completedTaskCount: number;
  openTaskCount: number;
  isOverdue: boolean;
  tasks: Array<{
    _id: Id<"tasks">;
    title: string;
    status: "todo" | "in_progress" | "review" | "done";
  }>;
};

type TaskOption = {
  _id: Id<"tasks">;
  title: string;
  status: "todo" | "in_progress" | "review" | "done";
  milestoneId?: Id<"projectMilestones"> | null;
};

type TeamMember = {
  clerkUserId: string;
  name: string;
};

type MilestoneFormState = {
  name: string;
  description: string;
  status: MilestoneStatus;
  ownerClerkUserId: string;
  plannedStartDate: string;
  plannedEndDate: string;
  actualStartDate: string;
  actualEndDate: string;
  progress: string;
  blockedReason: string;
  budgetAmount: string;
  taskIds: string[];
};

const EMPTY_FORM: MilestoneFormState = {
  name: "",
  description: "",
  status: "planned",
  ownerClerkUserId: "none",
  plannedStartDate: "",
  plannedEndDate: "",
  actualStartDate: "",
  actualEndDate: "",
  progress: "0",
  blockedReason: "",
  budgetAmount: "",
  taskIds: [],
};

const statusLabels: Record<MilestoneStatus, string> = {
  planned: "Planned",
  in_progress: "In Progress",
  at_risk: "At Risk",
  blocked: "Blocked",
  completed: "Completed",
};

const statusClassNames: Record<MilestoneStatus, string> = {
  planned: "border-slate-200 bg-slate-50 text-slate-700",
  in_progress: "border-sky-200 bg-sky-50 text-sky-700",
  at_risk: "border-amber-200 bg-amber-50 text-amber-700",
  blocked: "border-rose-200 bg-rose-50 text-rose-700",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const formatDateInput = (timestamp?: number) => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return new Date(`${trimmed}T12:00:00`).getTime();
};

const formatPortalDate = (timestamp?: number) =>
  timestamp ? new Date(timestamp).toLocaleDateString() : "Not set";

function buildInitialForm(milestone?: MilestoneRecord | null): MilestoneFormState {
  if (!milestone) return EMPTY_FORM;

  return {
    name: milestone.name,
    description: milestone.description || "",
    status: milestone.status,
    ownerClerkUserId: milestone.ownerClerkUserId || "none",
    plannedStartDate: formatDateInput(milestone.plannedStartDate),
    plannedEndDate: formatDateInput(milestone.plannedEndDate),
    actualStartDate: formatDateInput(milestone.actualStartDate),
    actualEndDate: formatDateInput(milestone.actualEndDate),
    progress: String(milestone.progress || 0),
    blockedReason: milestone.blockedReason || "",
    budgetAmount: milestone.budgetAmount !== undefined ? String(milestone.budgetAmount) : "",
    taskIds: milestone.tasks.map((task) => String(task._id)),
  };
}

export default function ProjectMilestonesView() {
  const { project } = useProject();
  const milestones = useQuery(apiAny.projectMilestones.listProjectMilestones, {
    projectId: project._id,
  }) as MilestoneRecord[] | undefined;
  const summary = useQuery(apiAny.projectMilestones.getProjectMilestonesSummary, {
    projectId: project._id,
  });
  const teamMembers = useQuery(apiAny.teams.getTeamMembers, {
    teamId: project.teamId,
  }) as TeamMember[] | undefined;
  const tasks = useQuery(apiAny.tasks.listProjectTasks, {
    projectId: project._id,
  }) as TaskOption[] | undefined;

  const createMilestone = useMutation(apiAny.projectMilestones.createProjectMilestone);
  const updateMilestone = useMutation(apiAny.projectMilestones.updateProjectMilestone);
  const deleteMilestone = useMutation(apiAny.projectMilestones.deleteProjectMilestone);
  const reorderMilestones = useMutation(apiAny.projectMilestones.reorderProjectMilestones);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<MilestoneRecord | null>(null);
  const [form, setForm] = useState<MilestoneFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const orderedMilestones = milestones || [];
  const availableTasks = useMemo(() => tasks || [], [tasks]);

  const openCreateDialog = () => {
    setEditingMilestone(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (milestone: MilestoneRecord) => {
    setEditingMilestone(milestone);
    setForm(buildInitialForm(milestone));
    setDialogOpen(true);
  };

  const handleMove = async (milestoneId: Id<"projectMilestones">, direction: "up" | "down") => {
    const currentIndex = orderedMilestones.findIndex((milestone) => milestone._id === milestoneId);
    if (currentIndex < 0) return;
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= orderedMilestones.length) return;

    const reorderedIds = [...orderedMilestones.map((milestone) => milestone._id)];
    const [moved] = reorderedIds.splice(currentIndex, 1);
    reorderedIds.splice(targetIndex, 0, moved);

    try {
      await reorderMilestones({
        projectId: project._id,
        milestoneIds: reorderedIds,
      });
    } catch (error) {
      toast.error("Failed to reorder milestones", {
        description: (error as Error).message,
      });
    }
  };

  const handleToggleTask = (taskId: string, checked: boolean) => {
    setForm((current) => ({
      ...current,
      taskIds: checked
        ? [...current.taskIds, taskId]
        : current.taskIds.filter((currentTaskId) => currentTaskId !== taskId),
    }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Milestone name is required");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        status: form.status,
        ownerClerkUserId: form.ownerClerkUserId === "none" ? null : form.ownerClerkUserId,
        plannedStartDate: parseDateInput(form.plannedStartDate),
        plannedEndDate: parseDateInput(form.plannedEndDate),
        actualStartDate: parseDateInput(form.actualStartDate),
        actualEndDate: parseDateInput(form.actualEndDate),
        progress: Number.parseInt(form.progress || "0", 10) || 0,
        blockedReason: form.blockedReason.trim() || null,
        budgetAmount:
          form.budgetAmount.trim().length > 0 ? Number.parseFloat(form.budgetAmount) : null,
        taskIds: form.taskIds.map((taskId) => taskId as Id<"tasks">),
      };

      if (editingMilestone) {
        await updateMilestone({
          milestoneId: editingMilestone._id,
          ...payload,
        });
        toast.success("Milestone updated");
      } else {
        await createMilestone({
          projectId: project._id,
          ...payload,
        });
        toast.success("Milestone created");
      }

      setDialogOpen(false);
      setEditingMilestone(null);
      setForm(EMPTY_FORM);
    } catch (error) {
      toast.error("Failed to save milestone", {
        description: (error as Error).message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (milestone: MilestoneRecord) => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(`Delete milestone "${milestone.name}"?`);
      if (!confirmed) return;
    }

    try {
      await deleteMilestone({ milestoneId: milestone._id });
      toast.success("Milestone deleted");
    } catch (error) {
      toast.error("Failed to delete milestone", {
        description: (error as Error).message,
      });
    }
  };

  return (
    <div className="space-y-6">
      <ProjectPageHeader
        title="Milestones"
        icon={<Flag className="h-8 w-8 text-[var(--ui-accent-brand)]" />}
        subtitle={`Track major project stages for ${project.name}`}
        actions={
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add milestone
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Project progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-2xl font-semibold">{summary?.progress || 0}%</div>
            <Progress value={summary?.progress || 0} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed stages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {summary?.completed || 0}/{summary?.total || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">At risk / blocked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {(summary?.atRisk || 0) + (summary?.blocked || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.atRisk || 0} at risk, {summary?.blocked || 0} blocked
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Next milestone</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-base font-semibold">
              {summary?.nextMilestone?.name || "No pending milestone"}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.nextMilestone?.plannedEndDate
                ? `Due ${formatPortalDate(summary.nextMilestone.plannedEndDate)}`
                : "No planned deadline"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {orderedMilestones.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No milestones yet. Create the main project stages first, then attach tasks to each stage.
            </CardContent>
          </Card>
        ) : (
          orderedMilestones.map((milestone, index) => (
            <Card key={milestone._id}>
              <CardContent className="space-y-5 p-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={statusClassNames[milestone.status]}>
                        {statusLabels[milestone.status]}
                      </Badge>
                      {milestone.isOverdue ? (
                        <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">
                          Overdue
                        </Badge>
                      ) : null}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-foreground">{milestone.name}</h3>
                      {milestone.description ? (
                        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                          {milestone.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      disabled={index === 0}
                      onClick={() => void handleMove(milestone._id, "up")}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      disabled={index === orderedMilestones.length - 1}
                      onClick={() => void handleMove(milestone._id, "down")}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="outline" onClick={() => openEditDialog(milestone)}>
                      Edit
                    </Button>
                    <Button type="button" variant="outline" onClick={() => void handleDelete(milestone)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Progress</p>
                    <p className="mt-2 text-xl font-semibold">{milestone.progress}%</p>
                    <Progress value={milestone.progress} className="mt-3" />
                  </div>
                  <div className="rounded-2xl border bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Timeline</p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {formatPortalDate(milestone.plannedStartDate)} - {formatPortalDate(milestone.plannedEndDate)}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Actual: {formatPortalDate(milestone.actualStartDate)} - {formatPortalDate(milestone.actualEndDate)}
                    </p>
                  </div>
                  <div className="rounded-2xl border bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Owner</p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {milestone.owner?.name || "Unassigned"}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">{milestone.openTaskCount} open tasks</p>
                  </div>
                  <div className="rounded-2xl border bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Budget</p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {milestone.budgetAmount !== undefined
                        ? formatCurrency(milestone.budgetAmount, project.currency || "PLN")
                        : "Not set"}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {milestone.completedTaskCount}/{milestone.taskCount} tasks completed
                    </p>
                  </div>
                </div>

                {milestone.blockedReason ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    <div className="flex items-center gap-2 font-medium">
                      <AlertTriangle className="h-4 w-4" />
                      Blocked reason
                    </div>
                    <p className="mt-2">{milestone.blockedReason}</p>
                  </div>
                ) : null}

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[var(--ui-accent-brand)]" />
                    <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Linked tasks
                    </h4>
                  </div>
                  {milestone.tasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tasks linked to this milestone yet.</p>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {milestone.tasks.map((task) => (
                        <div key={task._id} className="rounded-2xl border bg-background p-4">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{task.status.replace("_", " ")}</Badge>
                            <span className="font-medium">{task.title}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingMilestone ? "Edit milestone" : "Create milestone"}</DialogTitle>
            <DialogDescription>
              Define a high-level project stage, assign an owner, attach tasks and track progress.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="milestone-name">Name</Label>
              <Input
                id="milestone-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="e.g. Technical design approved"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="milestone-description">Description</Label>
              <Textarea
                id="milestone-description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
                rows={3}
                placeholder="What should be completed in this stage?"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, status: value as MilestoneStatus }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Owner</Label>
              <Select
                value={form.ownerClerkUserId}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, ownerClerkUserId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No owner</SelectItem>
                  {(teamMembers || []).map((member) => (
                    <SelectItem key={member.clerkUserId} value={member.clerkUserId}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="planned-start">Planned start</Label>
              <Input
                id="planned-start"
                type="date"
                value={form.plannedStartDate}
                onChange={(event) =>
                  setForm((current) => ({ ...current, plannedStartDate: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="planned-end">Planned end</Label>
              <Input
                id="planned-end"
                type="date"
                value={form.plannedEndDate}
                onChange={(event) =>
                  setForm((current) => ({ ...current, plannedEndDate: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="actual-start">Actual start</Label>
              <Input
                id="actual-start"
                type="date"
                value={form.actualStartDate}
                onChange={(event) =>
                  setForm((current) => ({ ...current, actualStartDate: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="actual-end">Actual end</Label>
              <Input
                id="actual-end"
                type="date"
                value={form.actualEndDate}
                onChange={(event) =>
                  setForm((current) => ({ ...current, actualEndDate: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="milestone-progress">Progress (%)</Label>
              <Input
                id="milestone-progress"
                type="number"
                min="0"
                max="100"
                value={form.progress}
                onChange={(event) =>
                  setForm((current) => ({ ...current, progress: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="milestone-budget">Budget</Label>
              <Input
                id="milestone-budget"
                type="number"
                min="0"
                step="0.01"
                value={form.budgetAmount}
                onChange={(event) =>
                  setForm((current) => ({ ...current, budgetAmount: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="blocked-reason">Blocked reason</Label>
              <Textarea
                id="blocked-reason"
                value={form.blockedReason}
                onChange={(event) =>
                  setForm((current) => ({ ...current, blockedReason: event.target.value }))
                }
                rows={2}
                placeholder="Optional blocker or risk"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Linked tasks</Label>
              <ScrollArea className="h-60 rounded-xl border p-4">
                <div className="space-y-3">
                  {availableTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tasks available in this project.</p>
                  ) : (
                    availableTasks.map((task) => {
                      const isAssignedElsewhere =
                        task.milestoneId &&
                        String(task.milestoneId) !== String(editingMilestone?._id || "");
                      const checked = form.taskIds.includes(String(task._id));
                      return (
                        <label
                          key={task._id}
                          className="flex items-start gap-3 rounded-xl border p-3 text-sm"
                        >
                          <Checkbox
                            checked={checked}
                            disabled={Boolean(isAssignedElsewhere)}
                            onCheckedChange={(nextChecked) =>
                              handleToggleTask(String(task._id), nextChecked === true)
                            }
                          />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{task.title}</span>
                              <Badge variant="outline">{task.status.replace("_", " ")}</Badge>
                            </div>
                            {isAssignedElsewhere ? (
                              <p className="text-xs text-muted-foreground">
                                Already assigned to another milestone
                              </p>
                            ) : null}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={submitting}>
              {submitting ? "Saving..." : editingMilestone ? "Save changes" : "Create milestone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
