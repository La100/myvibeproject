import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCreateMilestoneRecord,
  buildMilestonePatch,
  buildMilestoneViewModel,
  buildProjectMilestonesSummary,
  getMilestoneTaskUpdates,
  sortMilestoneTasks,
  sortMilestones,
} from "../../lib/projectMilestones.ts";

test("sortMilestones sorts by order and creation time", () => {
  const sorted = sortMilestones([
    { _id: "b", order: 2, _creationTime: 5 },
    { _id: "c", order: 1, _creationTime: 20 },
    { _id: "a", order: 1, _creationTime: 10 },
  ]);

  assert.deepEqual(
    sorted.map((item) => item._id),
    ["a", "c", "b"],
  );
});

test("sortMilestoneTasks sorts by due/start date and then title", () => {
  const sorted = sortMilestoneTasks([
    { _id: "3", title: "Gamma" },
    { _id: "2", title: "Beta", startDate: 20 },
    { _id: "1", title: "Alpha", endDate: 20 },
  ]);

  assert.deepEqual(
    sorted.map((item) => item._id),
    ["1", "2", "3"],
  );
});

test("buildMilestoneViewModel computes counts, overdue flag and sorted task payload", () => {
  const result = buildMilestoneViewModel(
    {
      _id: "m-1",
      _creationTime: 1,
      order: 0,
      name: "Stan surowy",
      status: "in_progress",
      progress: 40,
      plannedEndDate: 50,
    },
    [
      {
        _id: "t-2",
        title: "Wylanie stropu",
        status: "todo",
        startDate: 30,
        milestoneId: "m-1",
        assignedTo: "u-1",
      },
      {
        _id: "t-1",
        title: "Deskowanie",
        status: "done",
        endDate: 20,
        milestoneId: "m-1",
        priority: "high",
      },
      {
        _id: "t-3",
        title: "Obcy task",
        status: "todo",
        milestoneId: "m-2",
      },
    ],
    { clerkUserId: "u-1", name: "Jan", imageUrl: null },
    60,
  );

  assert.equal(result.taskCount, 2);
  assert.equal(result.completedTaskCount, 1);
  assert.equal(result.openTaskCount, 1);
  assert.equal(result.isOverdue, true);
  assert.deepEqual(
    result.tasks.map((task) => task._id),
    ["t-1", "t-2"],
  );
  assert.equal(result.tasks[0]?.priority, "high");
  assert.equal(result.tasks[1]?.assignedTo, "u-1");
});

test("buildProjectMilestonesSummary returns aggregate counters and next milestone", () => {
  const summary = buildProjectMilestonesSummary(
    [
      {
        _id: "m-1",
        _creationTime: 1,
        order: 1,
        name: "A",
        status: "completed",
        progress: 150,
      },
      {
        _id: "m-2",
        _creationTime: 2,
        order: 2,
        name: "B",
        status: "at_risk",
        progress: 25,
      },
      {
        _id: "m-3",
        _creationTime: 3,
        order: 3,
        name: "C",
        status: "blocked",
        progress: -20,
      },
    ],
    [{ milestoneId: "m-2" }, { milestoneId: "m-2" }, { milestoneId: "m-3" }],
  );

  assert.deepEqual(summary, {
    total: 3,
    completed: 1,
    atRisk: 1,
    blocked: 1,
    progress: 42,
    nextMilestone: {
      _id: "m-2",
      _creationTime: 2,
      order: 2,
      name: "B",
      status: "at_risk",
      progress: 25,
      taskCount: 2,
    },
  });
});

test("buildCreateMilestoneRecord trims values and clamps progress", () => {
  const record = buildCreateMilestoneRecord(
    {
      projectId: "project-1",
      teamId: "team-1",
      name: "  Fundamenty  ",
      description: "  Start prac  ",
      order: 4,
      progress: 120,
      blockedReason: "   ",
      color: "  #fff  ",
      createdBy: "user-1",
    },
    123,
  );

  assert.deepEqual(record, {
    projectId: "project-1",
    teamId: "team-1",
    name: "Fundamenty",
    description: "Start prac",
    order: 4,
    status: "planned",
    ownerClerkUserId: undefined,
    plannedStartDate: undefined,
    plannedEndDate: undefined,
    actualStartDate: undefined,
    actualEndDate: undefined,
    progress: 100,
    blockedReason: undefined,
    budgetAmount: undefined,
    color: "#fff",
    createdBy: "user-1",
    updatedAt: 123,
  });
});

test("buildMilestonePatch applies only provided fields and normalizes values", () => {
  const patch = buildMilestonePatch(
    {
      name: "  Final odbiorow ",
      description: null,
      progress: -10,
      blockedReason: "  Brak materialu ",
      budgetAmount: null,
    },
    456,
  );

  assert.deepEqual(patch, {
    updatedAt: 456,
    name: "Final odbiorow",
    description: undefined,
    progress: 0,
    blockedReason: "Brak materialu",
    budgetAmount: undefined,
  });
});

test("getMilestoneTaskUpdates returns only attach and detach operations", () => {
  const updates = getMilestoneTaskUpdates(
    [
      { _id: "t-1", milestoneId: "m-1" },
      { _id: "t-2", milestoneId: "m-2" },
      { _id: "t-3", milestoneId: null },
    ],
    "m-1",
    ["t-2", "t-3"],
    789,
  );

  assert.deepEqual(updates, [
    {
      taskId: "t-1",
      patch: { milestoneId: null, updatedAt: 789 },
    },
    {
      taskId: "t-2",
      patch: { milestoneId: "m-1", updatedAt: 789 },
    },
    {
      taskId: "t-3",
      patch: { milestoneId: "m-1", updatedAt: 789 },
    },
  ]);
});
