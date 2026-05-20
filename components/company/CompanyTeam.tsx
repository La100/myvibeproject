"use client";

import { useState } from "react";
import { useOrganization } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";

import { Users, Mail, Crown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiAny } from "@/lib/convexApiAny";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { InviteMemberDialog } from "@/components/team/InviteMemberDialog";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";
import MemberDetailsModal from "@/components/team/MemberDetailsModal";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";
import { AppLoadingState } from "@/components/ui/loading-state";
import { useI18n } from "@/lib/i18n";

// Define TeamMember type based on the structure returned by getTeamMembers
type TeamMember = {
  _id: Id<"teamMembers">;
  _creationTime: number;
  teamId: Id<"teams">;
  clerkUserId: string;
  clerkOrgId: string;
  role: string;
  permissions: string[];
  name: string;
  email: string;
  imageUrl?: string;
  joinedAt?: number;
  projectIds?: Id<"projects">[];
  isActive: boolean;
};

// Define PendingInvitation type based on actual structure
type PendingInvitation = {
  _id: Id<"invitations">;
  _creationTime: number;
  email: string;
  role: string;
  teamId: Id<"teams">;
  status: string;
  invitedBy: string;
  clerkInvitationId: string;
};

export default function CompanyTeam() {
  const { locale, t } = useI18n();
  const { organization, isLoaded } = useOrganization();

  const team = useQuery(
    apiAny.teams.getTeamByClerkOrg,
    organization?.id ? { clerkOrgId: organization.id } : "skip"
  );
  const teamMembers = useQuery(apiAny.teams.getTeamMembers, team ? { teamId: team._id } : "skip");
  const currentUserMember = useQuery(apiAny.teams.getCurrentUserTeamMember, team ? { teamId: team._id } : "skip");
  const pendingInvitations = useQuery(apiAny.teams.getPendingInvitations, team ? { teamId: team._id } : "skip");

  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [optimisticallyRevokedInvitationIds, setOptimisticallyRevokedInvitationIds] = useState<Set<Id<"invitations">>>(new Set());

  const revokeInvitation = useMutation(apiAny.teams.revokeInvitation);

  const handleRevoke = async (invitationId: Id<"invitations">) => {
    try {
      await revokeInvitation({ invitationId });
      setOptimisticallyRevokedInvitationIds((prev) => {
        const next = new Set(prev);
        next.add(invitationId);
        return next;
      });
      toast.success(t("companyTeam", "invitationRevoked"));
    } catch (error) {
      toast.error(t("companyTeam", "failedToRevokeInvitation"), {
        description: toUserFacingErrorMessage(error),
      });
    }
  };

  if (!isLoaded || !organization || !team || !teamMembers || !currentUserMember || !pendingInvitations) {
    return (
      <AppLoadingState
        variant="section"
        title={t("companyTeam", "loadingTitle")}
        description={t("companyTeam", "loadingDescription")}
        className="min-h-[40vh]"
      />
    );
  }

  // Only internal team members (no more organizational customers)
  const teamMembersOnly = teamMembers.filter((member: TeamMember) =>
    member.role === 'admin' || member.role === 'member'
  );
  const visiblePendingInvitations = pendingInvitations.filter(
    (inv: PendingInvitation) => !optimisticallyRevokedInvitationIds.has(inv._id),
  );
  const adminCount = teamMembersOnly.filter((member) => member.role === "admin").length;
  const memberCount = teamMembersOnly.length;

  const handleMemberClick = (member: TeamMember) => {
    setSelectedMember(member);
    setIsMemberModalOpen(true);
  };

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      {/* Header */}
      <div className="border-b px-4 py-4 sm:px-6">
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("companyTeam", "teamManagement")}
            </h1>
          </div>
          <InviteMemberDialog teamId={team._id}>
            <Button size="sm" className="h-10 w-full px-4 sm:ml-auto sm:w-auto">
              <Mail className="mr-2 h-4 w-4" />
              {t("companyTeam", "inviteMember")}
            </Button>
          </InviteMemberDialog>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-4 sm:px-6">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="h-10 w-fit">
            <TabsTrigger value="overview">{t("companyTeam", "overview")}</TabsTrigger>
            <TabsTrigger value="team">{t("companyTeam", "teamMembers")}</TabsTrigger>
            <TabsTrigger value="invitations">{t("companyTeam", "invitations")}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-5">
            <div className="flex flex-col gap-4">
              <section className="grid gap-4 xl:grid-cols-[minmax(0,760px)_minmax(320px,1fr)]">
                <div className="rounded-2xl border bg-card p-4 sm:p-5">
                  <div className="flex flex-col gap-3">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      {t("companyTeam", "workspaceAccess")}
                    </p>

                    <div className="grid w-full gap-2 sm:grid-cols-3 xl:max-w-[620px]">
                      <div className="rounded-xl border bg-secondary/70 px-4 py-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">{t("companyTeam", "members")}</span>
                          <Users className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="mt-4 text-3xl font-semibold leading-none">{memberCount}</p>
                      </div>
                      <div className="rounded-xl border bg-secondary/70 px-4 py-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">{t("companyTeam", "admins")}</span>
                          <Crown className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="mt-4 text-3xl font-semibold leading-none">{adminCount}</p>
                      </div>
                      <div className="rounded-xl border bg-secondary/70 px-4 py-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">{t("companyTeam", "invites")}</span>
                          <Mail className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="mt-4 text-3xl font-semibold leading-none">{visiblePendingInvitations.length}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border bg-card p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-semibold">
                      {t("companyTeam", "pendingInvitations")}
                    </h3>
                    <Badge variant="outline" className="text-xs">
                      {visiblePendingInvitations.length}
                    </Badge>
                  </div>

                  <div className="mt-4">
                    {visiblePendingInvitations.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {visiblePendingInvitations.slice(0, 4).map((inv) => (
                          <div key={inv._id} className="flex items-center justify-between rounded-xl border bg-secondary/70 px-3 py-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{inv.email}</p>
                              <p className="text-xs text-muted-foreground">
                                {t("companyTeam", inv.role === "admin" ? "administratorInvited" : "memberInvited")}
                              </p>
                            </div>
                            <Badge variant="secondary" className="ml-3 text-[11px]">
                              {inv.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed bg-secondary/70 px-4 py-8 text-center">
                        <Mail className="mx-auto h-8 w-8 text-muted-foreground" />
                        <p className="mt-3 text-sm font-medium">
                          {t("companyTeam", "noOpenInvitations")}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border bg-card p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold">
                    {t("companyTeam", "recentMembers")}
                  </h3>
                  <Badge variant="outline" className="text-xs">
                    {memberCount}
                  </Badge>
                </div>

                <div className="mt-4">
                  {teamMembersOnly.length > 0 ? (
                    <div className="grid gap-2">
                      {teamMembersOnly
                        .sort((a, b) => (b.joinedAt || 0) - (a.joinedAt || 0))
                        .slice(0, 5)
                        .map((member) => (
                          <button
                            key={member.clerkUserId}
                            type="button"
                            className="flex items-center gap-3 rounded-xl border bg-secondary/70 px-3 py-3 text-left transition-colors hover:bg-secondary"
                            onClick={() => handleMemberClick(member)}
                          >
                            <Avatar className="h-9 w-9">
                              {member.imageUrl && <AvatarImage src={member.imageUrl} />}
                              <AvatarFallback className="text-xs">
                                {member.name ? member.name[0].toUpperCase() : "U"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{member.name}</p>
                              <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                            </div>
                            <Badge variant={member.role === "admin" ? "default" : "secondary"} className="text-[11px]">
                              {member.role === "admin"
                                ? t("companyTeam", "admin")
                                : t("companyTeam", "member")}
                            </Badge>
                          </button>
                        ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed px-4 py-8 text-center text-muted-foreground">
                      <Users className="mx-auto mb-3 h-8 w-8" />
                      <p className="text-sm">{t("companyTeam", "noMembersYet")}</p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </TabsContent>


          <TabsContent value="team" className="mt-5">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  {t("companyTeam", "internalTeamMembers")}
                </h3>
              </div>
                
              <Card className="rounded-2xl bg-card">
                <CardContent className="p-0">
                  <div className="flex flex-col gap-0">
                    {teamMembersOnly.map((member: TeamMember) => (
                      <div
                        key={member.clerkUserId}
                        className="flex items-center justify-between border-b bg-secondary/70 px-4 py-3.5 last:border-b-0 hover:bg-secondary cursor-pointer transition-colors"
                        onClick={() => handleMemberClick(member)}
                      >
                        <div className="flex items-center gap-4">
                          <Avatar className="h-10 w-10">
                            {member.imageUrl && <AvatarImage src={member.imageUrl} />}
                            <AvatarFallback>{member.name ? member.name[0].toUpperCase() : 'U'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-semibold">{member.name}</p>
                            <p className="text-sm text-muted-foreground">{member.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={member.role === 'admin' ? 'default' : 'secondary'} className="text-xs">
                              {member.role === "admin"
                                ? t("companyTeam", "administrator")
                                : t("companyTeam", "member")}
                            </Badge>
                              {member.clerkUserId === currentUserMember?.clerkUserId && (
                                <Badge variant="outline" className="text-xs">
                                  {t("companyTeam", "you")}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {teamMembersOnly.length === 0 && (
                      <div className="text-center py-12 text-muted-foreground">
                        <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">
                          {t("companyTeam", "noTeamMembersYet")}
                        </h3>
                        <InviteMemberDialog teamId={team._id}>
                          <Button>
                            <Mail className="mr-2 h-4 w-4" />
                            {t("companyTeam", "inviteTeamMember")}
                          </Button>
                        </InviteMemberDialog>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="invitations" className="mt-5">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  {t("companyTeam", "pendingInvitations")}
                </h3>
              </div>

              <Card className="rounded-2xl bg-card">
                <CardContent className="pt-5">
                  {visiblePendingInvitations.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {visiblePendingInvitations.map((inv: PendingInvitation) => (
                        <div key={inv._id} className="flex items-center justify-between rounded-xl border bg-secondary/70 px-4 py-3 hover:bg-secondary transition-colors">
                          <div className="flex items-center gap-4 flex-1">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {inv.email[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{inv.email}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-xs">
                                  {inv.role === "admin"
                                    ? t("companyTeam", "administrator")
                                    : inv.role === "member"
                                      ? t("companyTeam", "member")
                                      : t("companyTeam", "customer")}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {inv.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {t("companyTeam", "invitedDate", {
                                  date: new Date(inv._creationTime).toLocaleDateString(locale, {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                  }),
                                })}
                              </p>
                            </div>
                          </div>
                          {currentUserMember?.role === 'admin' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRevoke(inv._id);
                              }}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t("companyTeam", "revoke")}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary/70 mx-auto mb-4">
                          <Mail className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">
                          {t("companyTeam", "noPendingInvitations")}
                        </h3>
                        <InviteMemberDialog teamId={team._id}>
                          <Button>
                            <Mail className="mr-2 h-4 w-4" />
                            {t("companyTeam", "sendNewInvitation")}
                          </Button>
                        </InviteMemberDialog>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>
          </TabsContent>

        </Tabs>
      </div>

      {/* Member Details Modal */}
      <MemberDetailsModal
        member={selectedMember}
        isOpen={isMemberModalOpen}
        onClose={() => {
          setIsMemberModalOpen(false);
          setSelectedMember(null);
        }}
        currentUserRole={currentUserMember?.role || ''}
        currentUserClerkId={currentUserMember?.clerkUserId || ''}
      />
    </div>
  );
}
