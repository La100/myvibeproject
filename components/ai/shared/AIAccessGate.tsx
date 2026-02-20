import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { AISubscriptionWall } from "./AISubscriptionWall";
import type { Id } from "@/convex/_generated/dataModel";

type AIAccessStatus = {
  hasAccess: boolean;
  remainingTokens?: number;
  message?: string;
};

type AccessGateProps = {
  aiAccess: AIAccessStatus | undefined;
  team: { _id: Id<"teams">; slug: string } | null | undefined;
};

export const renderAccessGate = ({ aiAccess, team }: AccessGateProps) => {
  const hasTeam = !!team?._id;
  if (!hasTeam) return null;

  const isQuotaBlocked = !!(
    aiAccess &&
    !aiAccess.hasAccess &&
    (
      aiAccess.remainingTokens === 0 ||
      (aiAccess.message || "").toLowerCase().includes("exhaust")
    )
  );

  if (aiAccess !== undefined && !aiAccess.hasAccess && team?._id) {
    if (isQuotaBlocked) {
      const remainingTokens = aiAccess.remainingTokens ?? 0;

      return (
        <div className="flex min-h-screen items-center justify-center px-4 bg-background/50">
          <Card className="max-w-lg w-full border-border/50 shadow-2xl rounded-3xl overflow-hidden bg-card/80 backdrop-blur-xl">
            <CardHeader className="space-y-4 pb-2">
              <Badge
                variant="secondary"
                className="w-fit bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 border-0 px-3 py-1 rounded-lg"
              >
                Tokens exhausted
              </Badge>
              <div className="space-y-2">
                <CardTitle className="text-2xl font-display tracking-tight">No AI tokens available</CardTitle>
                <CardDescription className="text-base">{aiAccess.message}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="rounded-2xl border border-border/50 bg-muted/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    Remaining tokens
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {remainingTokens.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full"
                    style={{ width: "100%" }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Contact your administrator to add more tokens.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return <AISubscriptionWall teamId={team._id} teamSlug={team.slug} />;
  }

  if (aiAccess === undefined && team?._id) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Checking access...</p>
        </div>
      </div>
    );
  }

  return null;
};
