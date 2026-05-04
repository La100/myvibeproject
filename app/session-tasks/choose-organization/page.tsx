import { TaskChooseOrganization } from "@clerk/nextjs";
import { postAuthResolverUrl } from "@/lib/authRedirects";

export default function ChooseOrganizationTaskPage() {
  return <TaskChooseOrganization redirectUrlComplete={postAuthResolverUrl} />;
}
