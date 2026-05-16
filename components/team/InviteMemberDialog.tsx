"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Id } from "@/convex/_generated/dataModel";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";
import { useI18n } from "@/lib/i18n";

interface InviteMemberDialogProps {
  teamId: Id<"teams">;
  children: React.ReactNode;
}

type InvitationRole = "admin" | "member";

const getInviteErrorToast = (
  error: unknown,
  t: ReturnType<typeof useI18n>["t"],
) => {
  const message = toUserFacingErrorMessage(error);

  if (message === "Only organization admins can invite new team members.") {
    return {
      title: t("inviteMember", "adminAccessRequired"),
      description: t("inviteMember", "adminAccessRequiredDescription"),
    };
  }

  if (message === "This user is already a member of this workspace.") {
    return {
      title: t("inviteMember", "memberAlreadyExists"),
      description: t("inviteMember", "memberAlreadyExistsDescription"),
    };
  }

  if (message === "An invitation has already been sent to this email address.") {
    return {
      title: t("inviteMember", "invitationAlreadyPending"),
      description: t("inviteMember", "invitationAlreadyPendingDescription"),
    };
  }

  if (message.startsWith("You've reached the maximum number of team members")) {
    return {
      title: t("inviteMember", "teamMemberLimitReached"),
      description: message,
    };
  }

  return {
    title: t("inviteMember", "failedToSendInvitation"),
    description: message,
  };
};

export function InviteMemberDialog({ teamId, children }: InviteMemberDialogProps) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitationRole>("member");
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const inviteTeamMember = useMutation(apiAny.teams.inviteTeamMember);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await inviteTeamMember({ teamId, email, role });
      toast.success(t("inviteMember", "invitationSent"), {
        description: t("inviteMember", "invitationSentDescription", { email }),
      });
      setIsOpen(false);
      setEmail("");
      setRole("member");
    } catch (error) {
      const toastContent = getInviteErrorToast(error, t);
      toast.error(toastContent.title, {
        description: toastContent.description,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("inviteMember", "title")}</DialogTitle>
          <DialogDescription>
            {t("inviteMember", "description")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                {t("inviteMember", "email")}
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">
                {t("inviteMember", "role")}
              </Label>
              <Select value={role} onValueChange={(value) => setRole(value as InvitationRole)}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder={t("inviteMember", "selectRole")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    {t("inviteMember", "admin")}
                  </SelectItem>
                  <SelectItem value="member">
                    {t("inviteMember", "member")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                {t("inviteMember", "cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? t("inviteMember", "sending")
                : t("inviteMember", "sendInvitation")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <Toaster />
    </Dialog>
  );
} 
