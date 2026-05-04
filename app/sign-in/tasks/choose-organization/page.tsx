import { TaskChooseOrganization } from "@clerk/nextjs";
import { postAuthResolverUrl } from "@/lib/authRedirects";

export default function SignInChooseOrganizationTaskPage() {
  return <TaskChooseOrganization redirectUrlComplete={postAuthResolverUrl} />;
}
