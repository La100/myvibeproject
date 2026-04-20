export const getClientActorName = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "Client (portal)") {
    return "Client";
  }

  return trimmed;
};
