"use client";

import { useState } from "react";
import { useOrganization } from "@clerk/nextjs";
import { useQuery } from "convex/react";

import { Users, Mail, Search, Crown, Trash2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiAny } from "@/lib/convexApiAny";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { InviteMemberDialog } from "@/components/team/InviteMemberDialog";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";
import MemberDetailsModal from "@/components/team/MemberDetailsModal";

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
  const teamProjects = useQuery(apiAny.projects.listProjectsByTeam, team ? { teamId: team._id } : "skip");

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
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
        description: (error as Error).message,
      });
    }
  };

  if (!isLoaded || !organization || !team || !teamMembers || !currentUserMember || !pendingInvitations || !teamProjects) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  const filteredMembers = teamMembers.filter((member: TeamMember) => {
    const nameMatch = member.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const emailMatch = member.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const roleMatch = roleFilter === 'all' || member.role === roleFilter;
    return (nameMatch || emailMatch) && roleMatch;
  });

  // Only internal team members (no more organizational customers)
  const teamMembersOnly = filteredMembers.filter((member: TeamMember) => 
    member.role === 'admin' || member.role === 'member'
  );
  const visiblePendingInvitations = pendingInvitations.filter(
    (inv: PendingInvitation) => !optimisticallyRevokedInvitationIds.has(inv._id),
  );

  const handleMemberClick = (member: TeamMember) => {
    setSelectedMember(member);
    setIsMemberModalOpen(true);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Team Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage your organization members and permissions
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <InviteMemberDialog teamId={team._id}>
              <Button>
                <Mail className="mr-2 h-4 w-4" />
                Invite Member
              </Button>
            </InviteMemberDialog>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search team members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="member">Member</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="team">Team Members</TabsTrigger>
            <TabsTrigger value="invitations">Invitations</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="flex flex-col gap-6">
              {/* Team Overview Stats */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <CardTitle className="text-sm font-medium">Team Members</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{teamMembersOnly.length}</div>
                    <p className="text-xs text-muted-foreground">Internal team members</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <CardTitle className="text-sm font-medium">Administrators</CardTitle>
                    <Crown className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{teamMembersOnly.filter(m => m.role === 'admin').length}</div>
                    <p className="text-xs text-muted-foreground">Admin users</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <CardTitle className="text-sm font-medium">Projects</CardTitle>
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{teamProjects.length}</div>
                    <p className="text-xs text-muted-foreground">{teamProjects.filter(p => p.status === 'active').length} active</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <CardTitle className="text-sm font-medium">Pending Invites</CardTitle>
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{pendingInvitations.length}</div>
                    <p className="text-xs text-muted-foreground">Awaiting response</p>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions */}
              <Card>
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                    <CardDescription>Common team management tasks</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-4">
                    <InviteMemberDialog teamId={team._id}>
                      <Button>
                        <Mail className="mr-2 h-4 w-4" />
                        Invite Team Member
                      </Button>
                    </InviteMemberDialog>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Members & Projects Grid */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* Recent Members */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Members</CardTitle>
                    <CardDescription>Latest team members joined</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {teamMembersOnly.length > 0 ? (
                      <div className="flex flex-col gap-3">
                        {teamMembersOnly
                          .sort((a, b) => (b.joinedAt || 0) - (a.joinedAt || 0))
                          .slice(0, 5)
                          .map((member) => (
                            <div
                              key={member.clerkUserId}
                              className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-lg cursor-pointer transition-colors"
                              onClick={() => handleMemberClick(member)}
                            >
                              <Avatar className="h-8 w-8">
                                {member.imageUrl && <AvatarImage src={member.imageUrl} />}
                                <AvatarFallback className="text-xs">
                                  {member.name ? member.name[0].toUpperCase() : 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{member.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                              </div>
                              <Badge variant={member.role === 'admin' ? 'default' : 'secondary'} className="text-xs">
                                {member.role}
                              </Badge>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-sm">No members yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Projects */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Projects</CardTitle>
                    <CardDescription>Latest projects in this team</CardDescription>
                  </CardHeader>
                <CardContent>
                  {teamProjects.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {teamProjects.slice(0, 5).map((project) => (
                        <div
                          key={project._id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => window.location.href = `/organisation/projects/${project.slug}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                              <Building2 className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{project.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {project.customer || 'No customer'} • {project.location || 'No location'}
                              </p>
                            </div>
                          </div>
                          <Badge variant={
                            project.status === 'active' ? 'default' :
                            project.status === 'completed' ? 'secondary' :
                            project.status === 'planning' ? 'outline' : 'destructive'
                          }>
                            {project.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p>No projects yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
              </div>
            </div>
          </TabsContent>


          <TabsContent value="team" className="mt-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold">Internal Team Members</h3>
                  <p className="text-muted-foreground">Manage core team member roles and permissions</p>
                </div>
                <InviteMemberDialog teamId={team._id}>
                  <Button>
                    <Mail className="mr-2 h-4 w-4" />
                    Invite Member
                  </Button>
                </InviteMemberDialog>
              </div>
                
              <Card>
                <CardContent className="p-0">
                  <div className="flex flex-col gap-0">
                    {teamMembersOnly.map((member: TeamMember) => (
                      <div
                        key={member.clerkUserId}
                        className="flex items-center justify-between p-4 border-b last:border-b-0 hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => handleMemberClick(member)}
                      >
                        <div className="flex items-center gap-4">
                          <Avatar>
                            {member.imageUrl && <AvatarImage src={member.imageUrl} />}
                            <AvatarFallback>{member.name ? member.name[0].toUpperCase() : 'U'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold">{member.name}</p>
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

          <TabsContent value="invitations" className="mt-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold">Pending Invitations</h3>
                  <p className="text-muted-foreground">Manage team invitations and track their status</p>
                </div>
                {visiblePendingInvitations.length > 0 && currentUserMember?.role === 'admin' && (
                  <InviteMemberDialog teamId={team._id}>
                    <Button>
                      <Mail className="mr-2 h-4 w-4" />
                      Send Another Invitation
                    </Button>
                  </InviteMemberDialog>
                )}
              </div>

              <Card>
                <CardContent className="pt-6">
                  {visiblePendingInvitations.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {visiblePendingInvitations.map((inv: PendingInvitation) => (
                        <div key={inv._id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
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
                <Card className="border-border bg-muted/30">
                  <CardContent className="pt-6">
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
