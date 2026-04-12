import { ConvexHttpClient } from "convex/browser";

import { apiAny } from "@/lib/convexApiAny";

function getConvexUrl() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!convexUrl) {
    throw new Error("Missing NEXT_PUBLIC_CONVEX_URL environment variable.");
  }
  return convexUrl;
}

export function getServerConvexClient(convexToken: string) {
  const token = convexToken.trim();
  if (!token) {
    throw new Error("Missing Convex token.");
  }

  const client = new ConvexHttpClient(getConvexUrl());
  client.setAuth(token);
  return client;
}

export async function verifyProjectScope(
  convexToken: string,
  projectId: string,
  teamId: string,
) {
  const client = getServerConvexClient(convexToken);
  const project = await client.query(apiAny.projects.getProject, {
    projectId: projectId as never,
  });

  if (!project) {
    throw new Error("Project not found or access denied.");
  }

  if (String(project.teamId) !== teamId) {
    throw new Error("Project does not belong to the provided team.");
  }

  return project;
}

export async function verifyTeamScope(
  convexToken: string,
  teamId: string,
) {
  const client = getServerConvexClient(convexToken);
  const team = await client.query(apiAny.teams.getTeamById, {
    teamId: teamId as never,
  });

  if (!team) {
    throw new Error("Team not found or access denied.");
  }

  return team;
}

export async function verifyAssistantAccess(
  convexToken: string,
  teamId: string,
) {
  const client = getServerConvexClient(convexToken);
  const access = await client.query(apiAny.stripe.checkTeamAIAccess, {
    teamId: teamId as never,
  });

  if (!access?.hasAccess) {
    throw new Error(access?.message || "AI access denied.");
  }

  return access;
}
