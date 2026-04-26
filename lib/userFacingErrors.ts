const extractRawErrorMessage = (error: unknown) => {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: { message?: string } }).data;
    if (typeof data?.message === "string" && data.message.trim().length > 0) {
      return data.message;
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return "Something went wrong.";
};

const normalizeErrorMessage = (message: string) => {
  const trimmedMessage = message.trim();

  const convexUncaughtMatch = trimmedMessage.match(
    /Uncaught Error:\s*([\s\S]*?)(?:\s+at\s+\w+\s+\(|\s+Called by client|$)/,
  );
  if (convexUncaughtMatch?.[1]) {
    return convexUncaughtMatch[1].trim();
  }

  if (trimmedMessage.startsWith("Clerk API Error:")) {
    return trimmedMessage.replace(/^Clerk API Error:\s*/, "").trim();
  }

  return trimmedMessage;
};

const getErrorMessage = (error: unknown) =>
  normalizeErrorMessage(extractRawErrorMessage(error));

export const toUserFacingErrorMessage = (error: unknown) => {
  const message = getErrorMessage(error);
  const normalizedLowercaseMessage = message.toLowerCase();

  if (message === "Only admins can invite members") {
    return "Only organization admins can invite new team members.";
  }

  if (message === "User already belongs to another workspace") {
    return "This email already belongs to another workspace. A user can belong to only one organization.";
  }

  if (message === "User is already a member of this workspace") {
    return "This user is already a member of this workspace.";
  }

  if (
    message === "An invitation has already been sent to this email address" ||
    normalizedLowercaseMessage.includes("already been invited") ||
    normalizedLowercaseMessage.includes("already has a pending invitation") ||
    normalizedLowercaseMessage.includes("pending invitation")
  ) {
    return "An invitation has already been sent to this email address.";
  }

  if (
    message === "Only admins can revoke invitations" ||
    message === "Only admins can remove team members" ||
    message === "Only admins can change member roles" ||
    message === "Only admins can update team settings" ||
    message === "Only admins can add AI tokens" ||
    message === "Only admins can manage subscriptions" ||
    message === "Not authorized - admin access required" ||
    /^Only admins can /i.test(message)
  ) {
    if (message === "Only admins can manage subscriptions") {
      return "Only organization admins can manage subscriptions.";
    }

    return "Only organization admins can perform this action.";
  }

  if (message === "Only team members can manage subscriptions") {
    return "Only workspace members can manage subscriptions.";
  }

  if (
    message === "Not authenticated" ||
    message === "Unauthorized" ||
    message === "You must be logged in to upload files"
  ) {
    return "Please sign in and try again.";
  }

  if (
    message === "Forbidden" ||
    message === "Not authorized" ||
    message === "Access denied" ||
    message === "Permission denied" ||
    message === "Permission denied." ||
    message === "Insufficient permissions" ||
    message.startsWith("Insufficient permissions to ") ||
    message.startsWith("Not authorized to ") ||
    message === "You don't have permission to update these settings." ||
    message === "No permission to delete this file" ||
    message === "No permission to manage customer portal files" ||
    message === "No permission to manage AI knowledge files"
  ) {
    return "You do not have permission to perform this action.";
  }

  if (
    message === "No access to this project" ||
    message === "Project does not belong to this team" ||
    message === "User is not a member of this team" ||
    message === "User is not a member of this organization" ||
    message === "Not authorized to view this team" ||
    message === "Not authorized to view this project usage" ||
    message === "Not authorized to view this team usage"
  ) {
    return "You do not have access to this resource.";
  }

  return message;
};
