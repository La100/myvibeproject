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
      <div className="flex flex-col gap-4 border-b px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Team Management</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Manage workspace members, roles, and invitations without the extra dashboard noise.
            </p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex justify-end">
          <InviteMemberDialog teamId={team._id}>
            <Button size="sm" className="h-10 px-4">
              <Mail className="mr-2 h-4 w-4" />
              Invite Member
            </Button>
          </InviteMemberDialog>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-4 sm:px-6">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="h-10">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="team">Team Members</TabsTrigger>
            <TabsTrigger value="invitations">Invitations</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-5">
            <div className="flex flex-col gap-4">
              <section className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
                <div className="rounded-2xl border bg-white p-4 sm:p-5">
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                          Workspace access
                        </p>
                        <h2 className="mt-1 text-lg font-semibold">Keep the team surface focused</h2>
                        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                          This view now stays centered on people, roles, and pending invites instead of mixing in project management.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border bg-muted/20 px-4 py-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Members</span>
                          <Users className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="mt-2 text-2xl font-semibold">{memberCount}</p>
                        <p className="text-xs text-muted-foreground">Internal seats in use</p>
                      </div>
                      <div className="rounded-xl border bg-muted/20 px-4 py-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Admins</span>
                          <Crown className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="mt-2 text-2xl font-semibold">{adminCount}</p>
                        <p className="text-xs text-muted-foreground">People with elevated access</p>
                      </div>
                      <div className="rounded-xl border bg-muted/20 px-4 py-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Invites</span>
                          <Mail className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="mt-2 text-2xl font-semibold">{visiblePendingInvitations.length}</p>
                        <p className="text-xs text-muted-foreground">Awaiting acceptance</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border bg-white p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold">Pending invitations</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Open invites stay visible here until accepted or revoked.
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {visiblePendingInvitations.length}
                    </Badge>
                  </div>

                  <div className="mt-4">
                    {visiblePendingInvitations.length > 0 ? (
                      <div className="space-y-2">
                        {visiblePendingInvitations.slice(0, 4).map((inv) => (
                          <div key={inv._id} className="flex items-center justify-between rounded-xl border px-3 py-2.5">
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
                      <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center">
                        <Mail className="mx-auto h-8 w-8 text-muted-foreground" />
                        <p className="mt-3 text-sm font-medium">No open invitations</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          New invitations will appear here as soon as they are sent.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border bg-white p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold">Recent members</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      The newest people added to this workspace.
                    </p>
                  </div>
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
                            className="flex items-center gap-3 rounded-xl border bg-muted/20 px-3 py-3 text-left transition-colors hover:bg-muted/40"
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
                <div>
                  <h3 className="text-lg font-semibold">Internal Team Members</h3>
                  <p className="text-sm text-muted-foreground">Manage core team member roles and permissions</p>
                </div>
                <InviteMemberDialog teamId={team._id}>
                  <Button size="sm" className="h-9">
                    <Mail className="mr-2 h-4 w-4" />
                    Invite Member
                  </Button>
                </InviteMemberDialog>
              </div>
                
              <Card className="rounded-2xl bg-background">
                <CardContent className="p-0">
                  <div className="flex flex-col gap-0">
                    {teamMembersOnly.map((member: TeamMember) => (
                      <div
                        key={member.clerkUserId}
                        className="flex items-center justify-between border-b px-4 py-3.5 last:border-b-0 hover:bg-muted/40 cursor-pointer transition-colors"
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
                        <p className="mb-4">Start by inviting your first team member.</p>
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
                <div>
                  <h3 className="text-lg font-semibold">Pending Invitations</h3>
                  <p className="text-sm text-muted-foreground">Manage team invitations and track their status</p>
                </div>
                {visiblePendingInvitations.length > 0 && currentUserMember?.role === 'admin' && (
                  <InviteMemberDialog teamId={team._id}>
                    <Button size="sm" className="h-9">
                      <Mail className="mr-2 h-4 w-4" />
                      Send Another Invitation
                    </Button>
                  </InviteMemberDialog>
                )}
              </div>

              <Card className="rounded-2xl bg-background">
                <CardContent className="pt-5">
                  {visiblePendingInvitations.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {visiblePendingInvitations.map((inv: PendingInvitation) => (
                        <div key={inv._id} className="flex items-center justify-between rounded-xl border px-4 py-3 hover:bg-muted/40 transition-colors">
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
                        <p className="text-muted-foreground mb-6 max-w-md">
                          All team invitations have been accepted or there are no pending invites. Invite new members to grow your team.
                        </p>
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

              {/* Invitation Info Card */}
              {visiblePendingInvitations.length > 0 && (
                <Card className="rounded-2xl border-border bg-muted/30">
                  <CardContent className="pt-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <Mail className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">About Invitations</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Invitations are sent via email and remain valid until accepted or revoked.
                          Invited users will receive full access based on their assigned role once they accept.
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Total pending: {visiblePendingInvitations.length} invitation{visiblePendingInvitations.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
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
