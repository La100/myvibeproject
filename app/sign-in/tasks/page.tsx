import { redirect } from "next/navigation";
import {
  postAuthResolverUrl,
  resolveLocalRedirectUrl,
} from "@/lib/authRedirects";

export default async function SignInTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const params = await searchParams;
  redirect(resolveLocalRedirectUrl(params.redirect_url, postAuthResolverUrl));
}
