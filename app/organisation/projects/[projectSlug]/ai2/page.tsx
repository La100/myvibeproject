import { redirect } from "next/navigation";

export default async function AI2Page({
  params,
}: {
  params: Promise<{ projectSlug: string }>;
}) {
  const { projectSlug } = await params;
  redirect(`/organisation/projects/${projectSlug}/ai`);
}
