import { TaskChooseOrganization } from "@clerk/nextjs";
import { postAuthResolverUrl } from "@/lib/authRedirects";
import { authClerkAppearance } from "@/lib/authClerkAppearance";

export default function ChooseOrganizationTaskPage() {
  return (
    <TaskChooseOrganization
      redirectUrlComplete={postAuthResolverUrl}
      appearance={authClerkAppearance}
    />
  );
}
