import assert from "node:assert/strict";
import test from "node:test";

import {
  buildApprovalDecisionArtifacts,
  buildApprovalSummary,
  buildApprovalUpdateArtifacts,
  buildApprovalVersionRecord,
  buildApprovalViewedPatch,
  buildCreateApprovalRecord,
  filterVisibleApprovals,
} from "../../lib/projectApprovals.ts";

test("filterVisibleApprovals excludes drafts", () => {
  const approvals = filterVisibleApprovals([
    { _id: "1", status: "draft" },
    { _id: "2", status: "sent" },
    { _id: "3", status: "approved" },
  ]);

  assert.deepEqual(
    approvals.map((item) => item._id),
    ["2", "3"],
  );
});

test("buildApprovalSummary counts approval states", () => {
  const summary = buildApprovalSummary([
    { status: "draft" },
    { status: "sent" },
    { status: "viewed" },
    { status: "commented" },
    { status: "approved" },
    { status: "rejected" },
  ]);

  assert.deepEqual(summary, {
    total: 6,
    pending: 3,
    approved: 1,
    rejected: 1,
    drafts: 1,
  });
});

test("buildCreateApprovalRecord normalizes strings and send state", () => {
  const record = buildCreateApprovalRecord(
    {
      projectId: "project-1",
      teamId: "team-1",
      type: "material",
      title: "  Zatwierdzenie lamp  ",
      description: "  Prosimy o decyzje  ",
      summary: "  Wersja 1 ",
      details: "  Szczegoly  ",
      items: ["  Lampa A  ", "   ", "Lampa B"],
      referenceIds: [" ref-1 ", ""],
      dueDate: 500,
      sendNow: true,
      requesterUserId: "user-1",
    },
    123,
  );

  assert.deepEqual(record, {
    projectId: "project-1",
    teamId: "team-1",
    type: "material",
    title: "Zatwierdzenie lamp",
    description: "Prosimy o decyzje",
    status: "sent",
    dueDate: 500,
    currentVersion: 1,
    requesterUserId: "user-1",
    sentAt: 123,
    latestVersionSummary: "Wersja 1",
    latestVersionDetails: "Szczegoly",
    latestVersionItems: ["Lampa A", "Lampa B"],
    latestVersionReferenceIds: ["ref-1"],
    updatedAt: 123,
  });
});

test("buildApprovalVersionRecord trims text and removes empty list entries", () => {
  const version = buildApprovalVersionRecord(
    {
      approvalId: "approval-1",
      projectId: "project-1",
      teamId: "team-1",
      version: 2,
      title: "  Wersja 2  ",
      summary: "  Nowe ceny ",
      details: null,
      items: ["  Pozycja 1 ", " "],
      referenceIds: [" ref-2 "],
      dueDate: 700,
      createdBy: "user-1",
    },
    222,
  );

  assert.deepEqual(version, {
    approvalId: "approval-1",
    projectId: "project-1",
    teamId: "team-1",
    version: 2,
    title: "Wersja 2",
    summary: "Nowe ceny",
    details: undefined,
    items: ["Pozycja 1"],
    referenceIds: ["ref-2"],
    dueDate: 700,
    createdBy: "user-1",
    createdAt: 222,
  });
});

test("buildApprovalUpdateArtifacts creates the next version and resets prior client response state", () => {
  const artifacts = buildApprovalUpdateArtifacts(
    {
      type: "material",
      title: "Stara wersja",
      description: "Opis",
      dueDate: 300,
      currentVersion: 3,
      status: "approved",
      sentAt: 100,
      viewedAt: 120,
      decidedAt: 140,
      lastCommentAt: 150,
      clientDecision: "approved",
      clientComment: "OK",
      clientRespondentName: "Anna",
      clientRespondentKey: "client-1",
      resolvedVersion: 3,
      latestVersionSummary: "Summary",
      latestVersionDetails: "Details",
      latestVersionItems: ["A"],
      latestVersionReferenceIds: ["ref-1"],
    },
    {
      title: "  Nowa wersja ",
      summary: "  Nowe podsumowanie ",
      items: ["  Pozycja A ", ""],
      sendNow: false,
    },
    999,
  );

  assert.equal(artifacts.nextVersion, 4);
  assert.deepEqual(artifacts.versionRecord, {
    version: 4,
    title: "Nowa wersja",
    summary: "Nowe podsumowanie",
    details: "Details",
    items: ["Pozycja A"],
    referenceIds: ["ref-1"],
    dueDate: 300,
  });
  assert.deepEqual(artifacts.patch, {
    type: "material",
    title: "Nowa wersja",
    description: "Opis",
    dueDate: 300,
    currentVersion: 4,
    status: "draft",
    sentAt: 100,
    viewedAt: undefined,
    decidedAt: undefined,
    lastCommentAt: undefined,
    clientDecision: undefined,
    clientComment: undefined,
    clientRespondentName: undefined,
    clientRespondentKey: undefined,
    resolvedVersion: undefined,
    latestVersionSummary: "Nowe podsumowanie",
    latestVersionDetails: "Details",
    latestVersionItems: ["Pozycja A"],
    latestVersionReferenceIds: ["ref-1"],
    updatedAt: 999,
  });
});

test("buildApprovalViewedPatch updates only sent approvals", () => {
  const patch = buildApprovalViewedPatch(
    {
      type: "material",
      title: "Approval",
      currentVersion: 1,
      status: "sent",
      viewedAt: 10,
    },
    "  Anna  ",
    400,
  );

  assert.deepEqual(patch, {
    status: "viewed",
    viewedAt: 10,
    updatedAt: 400,
    clientRespondentName: "Anna",
  });
  assert.equal(
    buildApprovalViewedPatch(
      {
        type: "material",
        title: "Approval",
        currentVersion: 1,
        status: "approved",
      },
      "Anna",
      400,
    ),
    null,
  );
});

test("buildApprovalDecisionArtifacts returns patch, activity and response payloads", () => {
  const artifacts = buildApprovalDecisionArtifacts(
    {
      type: "material",
      title: "Lampy",
      currentVersion: 2,
      status: "viewed",
      viewedAt: 100,
      lastCommentAt: 90,
      clientRespondentName: "Anna",
    },
    {
      decision: "rejected",
      comment: "  Za drogo ",
      respondentName: "  Marek ",
      respondentKey: "  portal-user ",
    },
    555,
  );

  assert.deepEqual(artifacts.patch, {
    status: "rejected",
    viewedAt: 100,
    decidedAt: 555,
    lastCommentAt: 555,
    clientDecision: "rejected",
    clientComment: "Za drogo",
    clientRespondentName: "Marek",
    clientRespondentKey: "portal-user",
    resolvedVersion: 2,
    updatedAt: 555,
  });
  assert.deepEqual(artifacts.activity, {
    userId: "portal-user",
    actionType: "approval.client_decision",
    details: {
      title: "Lampy",
      decision: "rejected",
      comment: "Za drogo",
      respondentName: "Marek",
    },
  });
  assert.deepEqual(artifacts.response, {
    success: true,
    status: "rejected",
    decidedAt: 555,
  });
});
