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
      toast.success("Invitation revoked");
    } catch (error) {
      toast.error("Failed to revoke invitation", {
        description: toUserFacingErrorMessage(error),
      });
    }
  };

  if (!isLoaded || !organization || !team || !teamMembers || !currentUserMember || !pendingInvitations) {
    return <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">Loading team...</div>;
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
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="border-b px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Team Management</h1>
          </div>
          <InviteMemberDialog teamId={team._id}>
            <Button size="sm" className="h-10 w-full px-4 sm:w-auto">
              <Mail className="mr-2 h-4 w-4" />
              Invite Member
            </Button>
          </InviteMemberDialog>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-4 sm:px-6">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="h-10 w-fit">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="team">Team Members</TabsTrigger>
            <TabsTrigger value="invitations">Invitations</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-5">
            <div className="flex flex-col gap-4">
              <section className="grid gap-4 xl:grid-cols-[minmax(0,760px)_minmax(320px,1fr)]">
                <div className="rounded-2xl border bg-white p-4 sm:p-5">
                  <div className="flex flex-col gap-3">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      Workspace access
                    </p>

                    <div className="grid w-full gap-2 sm:grid-cols-3 xl:max-w-[620px]">
                      <div className="rounded-xl border bg-muted px-4 py-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Members</span>
                          <Users className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="mt-4 text-3xl font-semibold leading-none">{memberCount}</p>
                      </div>
                      <div className="rounded-xl border bg-muted px-4 py-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Admins</span>
                          <Crown className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="mt-4 text-3xl font-semibold leading-none">{adminCount}</p>
                      </div>
                      <div className="rounded-xl border bg-muted px-4 py-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Invites</span>
                          <Mail className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="mt-4 text-3xl font-semibold leading-none">{visiblePendingInvitations.length}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border bg-white p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-semibold">Pending invitations</h3>
                    <Badge variant="outline" className="text-xs">
                      {visiblePendingInvitations.length}
                    </Badge>
                  </div>

                  <div className="mt-4">
                    {visiblePendingInvitations.length > 0 ? (
                      <div className="space-y-2">
                        {visiblePendingInvitations.slice(0, 4).map((inv) => (
                          <div key={inv._id} className="flex items-center justify-between rounded-xl border bg-muted px-3 py-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{inv.email}</p>
                              <p className="text-xs text-muted-foreground">
                                {inv.role === "admin" ? "Administrator" : "Member"} invited
                              </p>
                            </div>
                            <Badge variant="secondary" className="ml-3 text-[11px]">
                              {inv.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed bg-muted px-4 py-8 text-center">
                        <Mail className="mx-auto h-8 w-8 text-muted-foreground" />
                        <p className="mt-3 text-sm font-medium">No open invitations</p>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border bg-white p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold">Recent members</h3>
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
                            className="flex items-center gap-3 rounded-xl border bg-muted px-3 py-3 text-left transition-colors hover:bg-muted/80"
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
                              {member.role === "admin" ? "Admin" : "Member"}
                            </Badge>
                          </button>
                        ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed px-4 py-8 text-center text-muted-foreground">
                      <Users className="mx-auto mb-3 h-8 w-8" />
                      <p className="text-sm">No members yet</p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </TabsContent>


          <TabsContent value="team" className="mt-5">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Internal Team Members</h3>
              </div>
                
              <Card className="rounded-2xl bg-background">
                <CardContent className="p-0">
                  <div className="flex flex-col gap-0">
                    {teamMembersOnly.map((member: TeamMember) => (
                      <div
                        key={member.clerkUserId}
                        className="flex items-center justify-between border-b bg-muted px-4 py-3.5 last:border-b-0 hover:bg-muted/80 cursor-pointer transition-colors"
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
                              {member.role === 'admin' ? 'Administrator' : 'Member'}
                            </Badge>
                              {member.clerkUserId === currentUserMember?.clerkUserId && (
                                <Badge variant="outline" className="text-xs">You</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {teamMembersOnly.length === 0 && (
                      <div className="text-center py-12 text-muted-foreground">
                        <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No team members yet</h3>
                        <InviteMemberDialog teamId={team._id}>
                          <Button>
                            <Mail className="mr-2 h-4 w-4" />
                            Invite Team Member
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
                <h3 className="text-lg font-semibold">Pending Invitations</h3>
              </div>

              <Card className="rounded-2xl bg-background">
                <CardContent className="pt-5">
                  {visiblePendingInvitations.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {visiblePendingInvitations.map((inv: PendingInvitation) => (
                        <div key={inv._id} className="flex items-center justify-between rounded-xl border bg-muted px-4 py-3 hover:bg-muted/80 transition-colors">
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
                                  {inv.role === 'admin' ? 'Administrator' : inv.role === 'member' ? 'Member' : 'Customer'}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {inv.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Invited {new Date(inv._creationTime).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
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
                              Revoke
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                          <Mail className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">No pending invitations</h3>
                        <InviteMemberDialog teamId={team._id}>
                          <Button>
                            <Mail className="mr-2 h-4 w-4" />
                            Send New Invitation
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
