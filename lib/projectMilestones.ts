export type MilestoneStatus =
  | "planned"
  | "in_progress"
  | "at_risk"
  | "blocked"
  | "completed";

export type MilestoneRecord = {
  _id: string;
  _creationTime: number;
  order: number;
  name: string;
  status: MilestoneStatus;
  progress?: number | null;
  ownerClerkUserId?: string | null;
  plannedEndDate?: number | null;
};

export type MilestoneTask = {
  _id: string;
  title: string;
  status: string;
  priority?: string | null;
  milestoneId?: string | null;
  endDate?: number | null;
  startDate?: number | null;
  assignedTo?: string | null;
};

export type MilestoneOwner = {
  clerkUserId: string;
  name: string;
  imageUrl?: string | null;
} | null;

export type MilestoneDraft = {
  projectId: string;
  teamId: string;
  name: string;
  description?: string | null;
  status?: MilestoneStatus;
  ownerClerkUserId?: string | null;
  plannedStartDate?: number | null;
  plannedEndDate?: number | null;
  actualStartDate?: number | null;
  actualEndDate?: number | null;
  progress?: number | null;
  blockedReason?: string | null;
  budgetAmount?: number | null;
  color?: string | null;
  createdBy: string;
  order: number;
};

export type MilestoneUpdateInput = {
  name?: string;
  description?: string | null;
  status?: MilestoneStatus;
  ownerClerkUserId?: string | null;
  plannedStartDate?: number | null;
  plannedEndDate?: number | null;
  actualStartDate?: number | null;
  actualEndDate?: number | null;
  progress?: number;
  blockedReason?: string | null;
  budgetAmount?: number | null;
  color?: string | null;
};

export function sortMilestones<T extends { order: number; _creationTime: number }>(
  milestones: T[],
): T[] {
  return [...milestones].sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order;
    }
    return left._creationTime - right._creationTime;
  });
}

export function sortMilestoneTasks<
  T extends { endDate?: number | null; startDate?: number | null; title: string },
>(tasks: T[]): T[] {
  return [...tasks].sort((left, right) => {
    const leftDate = left.endDate || left.startDate || Number.MAX_SAFE_INTEGER;
    const rightDate = right.endDate || right.startDate || Number.MAX_SAFE_INTEGER;
    if (leftDate !== rightDate) return leftDate - rightDate;
    return left.title.localeCompare(right.title);
  });
}

export function buildMilestoneViewModel(
  milestone: MilestoneRecord,
  tasks: MilestoneTask[],
  owner: MilestoneOwner,
  now: number = Date.now(),
) {
  const linkedTasks = tasks.filter((task) => task.milestoneId === milestone._id);
  const completedTasks = linkedTasks.filter((task) => task.status === "done");
  const plannedEndDate = milestone.plannedEndDate ?? null;
  const isOverdue =
    milestone.status !== "completed" &&
    typeof plannedEndDate === "number" &&
    plannedEndDate < now;

  return {
    ...milestone,
    owner,
    taskCount: linkedTasks.length,
    completedTaskCount: completedTasks.length,
    openTaskCount: linkedTasks.length - completedTasks.length,
    tasks: sortMilestoneTasks(linkedTasks).map((task) => ({
      _id: task._id,
      title: task.title,
      status: task.status,
      priority: task.priority ?? null,
      endDate: task.endDate,
      assignedTo: task.assignedTo ?? null,
    })),
    isOverdue,
  };
}

export function buildProjectMilestonesSummary(
  milestones: MilestoneRecord[],
  tasks: Array<{ milestoneId?: string | null }>,
) {
  if (milestones.length === 0) {
    return {
      total: 0,
      completed: 0,
      atRisk: 0,
      blocked: 0,
      progress: 0,
      nextMilestone: null,
    };
  }

  const orderedMilestones = sortMilestones(milestones);
  const completed = orderedMilestones.filter(
    (milestone) => milestone.status === "completed",
  ).length;
  const atRisk = orderedMilestones.filter(
    (milestone) => milestone.status === "at_risk",
  ).length;
  const blocked = orderedMilestones.filter(
    (milestone) => milestone.status === "blocked",
  ).length;
  const nextMilestone =
    orderedMilestones.find((milestone) => milestone.status !== "completed") ||
    null;
  const aggregateProgress = Math.round(
    orderedMilestones.reduce(
      (sum, milestone) =>
        sum + Math.max(0, Math.min(100, milestone.progress || 0)),
      0,
    ) / Math.max(orderedMilestones.length, 1),
  );

  return {
    total: orderedMilestones.length,
    completed,
    atRisk,
    blocked,
    progress: aggregateProgress,
    nextMilestone: nextMilestone
      ? {
          ...nextMilestone,
          taskCount: tasks.filter(
            (task) => task.milestoneId === nextMilestone._id,
          ).length,
        }
      : null,
  };
}

export function buildCreateMilestoneRecord(
  draft: MilestoneDraft,
  now: number = Date.now(),
) {
  return {
    projectId: draft.projectId,
    teamId: draft.teamId,
    name: draft.name.trim(),
    description: draft.description?.trim() || undefined,
    order: draft.order,
    status: draft.status || "planned",
    ownerClerkUserId: draft.ownerClerkUserId ?? undefined,
    plannedStartDate: draft.plannedStartDate ?? undefined,
    plannedEndDate: draft.plannedEndDate ?? undefined,
    actualStartDate: draft.actualStartDate ?? undefined,
    actualEndDate: draft.actualEndDate ?? undefined,
    progress: Math.max(0, Math.min(100, Math.round(draft.progress ?? 0))),
    blockedReason: draft.blockedReason?.trim() || undefined,
    budgetAmount: draft.budgetAmount ?? undefined,
    color: draft.color?.trim() || undefined,
    createdBy: draft.createdBy,
    updatedAt: now,
  };
}

export function buildMilestonePatch(
  input: MilestoneUpdateInput,
  now: number = Date.now(),
) {
  const patch: Record<string, unknown> = { updatedAt: now };

  if (input.name !== undefined) {
    patch.name = input.name.trim();
  }
  if (input.description !== undefined) {
    patch.description = input.description?.trim() || undefined;
  }
  if (input.status !== undefined) {
    patch.status = input.status;
  }
  if (input.ownerClerkUserId !== undefined) {
    patch.ownerClerkUserId = input.ownerClerkUserId ?? undefined;
  }
  if (input.plannedStartDate !== undefined) {
    patch.plannedStartDate = input.plannedStartDate ?? undefined;
  }
  if (input.plannedEndDate !== undefined) {
    patch.plannedEndDate = input.plannedEndDate ?? undefined;
  }
  if (input.actualStartDate !== undefined) {
    patch.actualStartDate = input.actualStartDate ?? undefined;
  }
  if (input.actualEndDate !== undefined) {
    patch.actualEndDate = input.actualEndDate ?? undefined;
  }
  if (input.progress !== undefined) {
    patch.progress = Math.max(0, Math.min(100, Math.round(input.progress)));
  }
  if (input.blockedReason !== undefined) {
    patch.blockedReason = input.blockedReason?.trim() || undefined;
  }
  if (input.budgetAmount !== undefined) {
    patch.budgetAmount = input.budgetAmount ?? undefined;
  }
  if (input.color !== undefined) {
    patch.color = input.color?.trim() || undefined;
  }

  return patch;
}

export function getMilestoneTaskUpdates(
  tasks: Array<{ _id: string; milestoneId?: string | null }>,
  milestoneId: string,
  desiredTaskIds: readonly string[],
  now: number = Date.now(),
): Array<{
  taskId: string;
  patch: { milestoneId: string | null; updatedAt: number };
}> {
  const desiredIds = new Set(desiredTaskIds.map(String));
  const updates: Array<{
    taskId: string;
    patch: { milestoneId: string | null; updatedAt: number };
  }> = [];

  for (const task of tasks) {
    if (task.milestoneId === milestoneId && !desiredIds.has(String(task._id))) {
      updates.push({
        taskId: task._id,
        patch: { milestoneId: null, updatedAt: now },
      });
      continue;
    }

    if (desiredIds.has(String(task._id)) && task.milestoneId !== milestoneId) {
      updates.push({
        taskId: task._id,
        patch: { milestoneId, updatedAt: now },
      });
    }
  }

  return updates;
}
