"use client";

import { useState } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Mail, Calendar, Shield, Trash2, Building2,
  CheckCircle2, Clock
} from "lucide-react";
import { toast } from "sonner";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";
import { useI18n } from "@/lib/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

interface MemberDetailsModalProps {
  member: TeamMember | null;
  isOpen: boolean;
  onClose: () => void;
  currentUserRole: string;
  currentUserClerkId: string;
}

export default function MemberDetailsModal({
  member,
  isOpen,
  onClose,
  currentUserRole,
  currentUserClerkId,
}: MemberDetailsModalProps) {
  const { t } = useI18n();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  const changeTeamMemberRole = useMutation(apiAny.teams.changeTeamMemberRole);
  const removeTeamMember = useMutation(apiAny.teams.removeTeamMember);

  if (!member) return null;

  const canManageMember = currentUserRole === 'admin' && member.clerkUserId !== currentUserClerkId;

  const handleRoleChange = async (newRole: "admin" | "member") => {
    if (!canManageMember) return;

    setIsUpdatingRole(true);
    try {
      await changeTeamMemberRole({
        clerkUserId: member.clerkUserId,
        teamId: member.teamId,
        role: newRole,
      });
      toast.success(t("memberDetails", "roleUpdated"));
    } catch (error) {
      toast.error(t("memberDetails", "failedToUpdateRole"), {
        description: toUserFacingErrorMessage(error),
      });
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!canManageMember) return;

    try {
      await removeTeamMember({
        clerkUserId: member.clerkUserId,
        teamId: member.teamId,
      });
      toast.success(t("memberDetails", "memberRemoved"));
      onClose();
    } catch (error) {
      toast.error(t("memberDetails", "failedToRemoveMember"), {
        description: toUserFacingErrorMessage(error),
      });
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'default';
      case 'member':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t("memberDetails", "title")}</DialogTitle>
            <DialogDescription>
              {t("memberDetails", "description")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-6">
            {/* Profile Section */}
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <Avatar className="h-16 w-16">
                {member.imageUrl && <AvatarImage src={member.imageUrl} />}
                <AvatarFallback className="text-lg">
                  {member.name ? member.name[0].toUpperCase() : 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{member.name}</h3>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {member.email}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={getRoleBadgeVariant(member.role)}>
                    {member.role === "admin"
                      ? t("memberDetails", "administrator")
                      : member.role === "member"
                        ? t("memberDetails", "member")
                        : t("memberDetails", "unknown")}
                  </Badge>
                  {member.clerkUserId === currentUserClerkId && (
                    <Badge variant="outline" className="text-xs">
                      {t("memberDetails", "you")}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Information Grid */}
            <div className="grid gap-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">
                    {t("memberDetails", "joined")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {member.joinedAt
                      ? new Date(member.joinedAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : t("memberDetails", "unknown")}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Shield className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">
                    {t("memberDetails", "permissions")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {member.permissions && member.permissions.length > 0
                      ? member.permissions.join(', ')
                      : t("memberDetails", "standardPermissions")}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                {member.isActive ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                ) : (
                  <Clock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm font-medium">
                    {t("memberDetails", "status")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {member.isActive
                      ? t("memberDetails", "active")
                      : t("memberDetails", "inactive")}
                  </p>
                </div>
              </div>

              {member.projectIds && member.projectIds.length > 0 && (
                <div className="flex items-start gap-3">
                  <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">
                      {t("memberDetails", "projectAccess")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t(
                        "memberDetails",
                        member.projectIds.length === 1
                          ? "projectAccessSingular"
                          : "projectAccessPlural",
                        { count: member.projectIds.length },
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Management Section - Only for admins */}
            {canManageMember && (
              <div className="flex flex-col gap-4 border-t pt-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">
                    {t("memberDetails", "changeRole")}
                  </label>
                  <Select
                    value={member.role}
                    onValueChange={(value) => handleRoleChange(value as "admin" | "member")}
                    disabled={isUpdatingRole}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">
                        {t("memberDetails", "administrator")}
                      </SelectItem>
                      <SelectItem value="member">
                        {t("memberDetails", "member")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("memberDetails", "removeFromTeam")}
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              {t("memberDetails", "close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("memberDetails", "removeTeamMember")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("memberDetails", "removeConfirmPrefix")}{" "}
              <strong>{member.name}</strong>{" "}
              {t("memberDetails", "removeConfirmSuffix")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("memberDetails", "cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("memberDetails", "removeMember")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
