import { TaskChooseOrganization } from "@clerk/nextjs";
import { postAuthResolverUrl } from "@/lib/authRedirects";

const chooseOrganizationAppearance = {
  elements: {
    rootBox: "mx-auto w-full max-w-[760px]",
    cardBox: "mx-auto w-full max-w-[760px]",
    card: "mx-auto w-full max-w-[760px]",
  },
} as const;

export function ChooseOrganizationTaskShell() {
  return (
    <main className="min-h-screen bg-background px-5 pb-8 pt-6 sm:px-8 sm:pt-8">
      <div className="mx-auto w-full max-w-[760px]">
        <TaskChooseOrganization
          appearance={chooseOrganizationAppearance}
          redirectUrlComplete={postAuthResolverUrl}
        />
      </div>
    </main>
  );
}
