"use client";

import { useQuery, useMutation } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Mail, UserX, Crown, User } from "lucide-react";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";

interface ProjectMembersProps {
  project: {
    _id: Id<"projects">;
    teamId: Id<"teams">;
    name: string;
  };
}

interface TeamMember {
  _id: Id<"teamMembers">;
  role: "admin" | "member" | "customer";
  name: string;
  email: string;
  imageUrl?: string;
  clerkUserId: string;
}

export default function ProjectMembers({ project }: ProjectMembersProps) {
  // Get all team members
  const teamMembers = useQuery(apiAny.teams.getTeamMembers, {
    teamId: project.teamId,
  });
  
  // Get current user's role
  const currentUserMember = useQuery(apiAny.teams.getCurrentUserTeamMember, {
    teamId: project.teamId,
  });

  const isCurrentUserAdmin = currentUserMember?.role === "admin";

  if (!teamMembers || !currentUserMember) {
    return <div>Loading members...</div>;
  }

  // Filter team members by role (only internal team members)
  const admins = teamMembers.filter((member: TeamMember) => member.role === "admin");
  const members = teamMembers.filter((member: TeamMember) => member.role === "member");

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Team Members Section */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg lg:text-xl">
            <Users className="h-4 w-4 lg:h-5 lg:w-5" />
            Team Members
          </CardTitle>
          <CardDescription className="text-sm">
            All team members have access to this project based on their team role.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 lg:px-6">
          {/* Admins */}
          {admins.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-500" />
                <h4 className="text-sm font-semibold">Administrators</h4>
                <Badge variant="default">{admins.length}</Badge>
              </div>
              <div className="space-y-2">
                {admins.map((member: TeamMember) => (
                  <MemberRow 
                    key={member._id} 
                    member={member} 
                    role="Admin"
                    description="Full project access"
                    canManage={false}
                    projectId={project._id}
                    teamId={project.teamId}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Members */}
          {members.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 pt-4 border-t">
                <User className="h-4 w-4 text-blue-500" />
                <h4 className="text-sm font-semibold">Members</h4>
                <Badge variant="secondary">{members.length}</Badge>
              </div>
              <div className="space-y-2">
                {members.map((member: TeamMember) => (
                  <MemberRow 
                    key={member._id} 
                    member={member} 
                    role="Member"
                    description="Can edit tasks and files"
                    canManage={isCurrentUserAdmin}
                    projectId={project._id}
                    teamId={project.teamId}
                  />
                ))}
              </div>
            </div>
          )}

        </CardContent>
      </Card>

    </div>
  );
}

// Member Row Component
function MemberRow({ 
  member, 
  role, 
  description,
  canManage,
  projectId,
  teamId
}: { 
  member: TeamMember; 
  role: string; 
  description: string;
  canManage: boolean;
  projectId: Id<"projects">;
  teamId: Id<"teams">;
}) {
  const removeTeamMember = useMutation(apiAny.teams.removeTeamMember);
  const inviteCustomerToProject = useMutation(apiAny.teams.inviteCustomerToProject);

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin': return 'default';
      case 'member': return 'secondary';
      default: return 'secondary';
    }
  };

  const handleRemoveMember = async () => {
    try {
      await removeTeamMember({
        clerkUserId: member.clerkUserId,
        teamId: teamId,
      });
      toast.success("Team member removed");
    } catch (error) {
      toast.error("Failed to remove team member: " + (error as Error).message);
    }
  };

  const handleChangeToCustomer = async () => {
    if (!member.email) {
      toast.error("Cannot convert member without an email address.");
      return;
    }

    try {
      await inviteCustomerToProject({
        email: member.email,
        projectId,
      });

      await removeTeamMember({
        clerkUserId: member.clerkUserId,
        teamId,
      });

      toast.success("Member converted to project customer");
    } catch (error) {
      toast.error("Failed to convert member: " + (error as Error).message);
    }
  };

  return (
    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
      <div className="flex items-center gap-2 lg:gap-3 min-w-0 flex-1">
        <Avatar className="h-6 w-6 lg:h-8 lg:w-8 flex-shrink-0">
          <AvatarImage src={member.imageUrl} />
          <AvatarFallback className="text-xs">
            {member.name ? member.name.split(' ').map((n: string) => n[0]).join('').toUpperCase() : 'U'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{member.name || 'Unknown'}</p>
          <p className="text-xs text-muted-foreground hidden sm:block">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Badge variant={getRoleColor(role) as "default" | "secondary" | "outline"} className="text-xs">{role}</Badge>
        {canManage && member.role === "member" && (
          <>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleChangeToCustomer}
              className="text-blue-600 hover:text-blue-700 h-6 w-6 lg:h-8 lg:w-8 p-0"
              title="Change to Project Customer"
            >
              <Mail className="h-3 w-3 lg:h-4 lg:w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleRemoveMember}
              className="text-red-600 hover:text-red-700 h-6 w-6 lg:h-8 lg:w-8 p-0"
              title="Remove from team"
            >
              <UserX className="h-3 w-3 lg:h-4 lg:w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

 
