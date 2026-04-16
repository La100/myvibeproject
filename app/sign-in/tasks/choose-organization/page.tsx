import { redirect } from "next/navigation";
import { clerkChooseOrganizationTaskUrl } from "@/lib/authRedirects";

export default function SignInChooseOrganizationTaskPage() {
  redirect(clerkChooseOrganizationTaskUrl);
}
