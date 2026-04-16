const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong.";

export const toUserFacingErrorMessage = (error: unknown) => {
  const message = getErrorMessage(error);

  if (message === "Only admins can invite members") {
    return "Only organization admins can invite new team members.";
  }

  if (
    message === "Only admins can revoke invitations" ||
    message === "Only admins can remove team members" ||
    message === "Only admins can change member roles" ||
    message === "Only admins can update team settings" ||
    message === "Only admins can add AI tokens" ||
    message === "Not authorized - admin access required" ||
    /^Only admins can /i.test(message)
  ) {
    return "Only organization admins can perform this action.";
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
