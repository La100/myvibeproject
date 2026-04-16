import { redirect } from "next/navigation";
import {
  chooseOrganizationUrl,
  resolveLocalRedirectUrl,
} from "@/lib/authRedirects";

export default async function SignUpTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const params = await searchParams;
  redirect(resolveLocalRedirectUrl(params.redirect_url, chooseOrganizationUrl));
}
