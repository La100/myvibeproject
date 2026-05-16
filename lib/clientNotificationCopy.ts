export const getClientActorName = (
  value?: string | null,
  fallback = "Client",
) => {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "Client (portal)") {
    return fallback;
  }

  return trimmed;
};
