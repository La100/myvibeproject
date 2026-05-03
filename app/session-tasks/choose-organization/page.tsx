import { redirect } from "next/navigation";
import { postAuthResolverUrl } from "@/lib/authRedirects";

export default function ChooseOrganizationTaskPage() {
  redirect(postAuthResolverUrl);
}
