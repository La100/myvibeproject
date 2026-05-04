import { TaskChooseOrganization } from "@clerk/nextjs";
import { postAuthResolverUrl } from "@/lib/authRedirects";

export default function SignUpChooseOrganizationTaskPage() {
  return <TaskChooseOrganization redirectUrlComplete={postAuthResolverUrl} />;
}
