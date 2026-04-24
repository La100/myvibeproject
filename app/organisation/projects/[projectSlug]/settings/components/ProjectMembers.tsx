"use client";

import { useQuery, useMutation } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserX, Crown, User } from "lucide-react";
import { toast } from "sonner";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";
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
  role: "admin" | "member";
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
    <div className="flex flex-col gap-8">
      <div className="border-b border-border/70 pb-5">
        <h3 className="text-lg font-semibold text-foreground">Team Members</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          All team members have access to this project based on their team role.
        </p>
      </div>

      <div className="flex flex-col gap-8">
          {admins.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold">Administrators</h4>
                <Badge variant="default">{admins.length}</Badge>
              </div>
              <div className="flex flex-col gap-2">
                {admins.map((member: TeamMember) => (
                  <MemberRow 
                    key={member._id} 
                    member={member} 
                    role="Admin"
                    description="Full project access"
                    canManage={false}
                    teamId={project.teamId}
                  />
                ))}
              </div>
            </div>
          )}

          {members.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 border-t pt-4">
                <User className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold">Members</h4>
                <Badge variant="secondary">{members.length}</Badge>
              </div>
              <div className="flex flex-col gap-2">
                {members.map((member: TeamMember) => (
                  <MemberRow 
                    key={member._id} 
                    member={member} 
                    role="Member"
                    description="Can edit tasks and files"
                    canManage={isCurrentUserAdmin}
                    teamId={project.teamId}
                  />
                ))}
              </div>
            </div>
          )}
      </div>
    </div>
  );
}

// Member Row Component
function MemberRow({ 
  member, 
  role, 
  description,
  canManage,
  teamId
}: { 
  member: TeamMember; 
  role: string; 
  description: string;
  canManage: boolean;
  teamId: Id<"teams">;
}) {
  const removeTeamMember = useMutation(apiAny.teams.removeTeamMember);

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
      toast.error("Failed to remove team member", {
        description: toUserFacingErrorMessage(error),
      });
    }
  };

  return (
    <div className="flex items-center justify-between rounded-2xl bg-secondary/70 px-3 py-3.5">
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
              onClick={handleRemoveMember}
              className="h-6 w-6 p-0 text-destructive hover:text-destructive lg:h-8 lg:w-8"
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

 
