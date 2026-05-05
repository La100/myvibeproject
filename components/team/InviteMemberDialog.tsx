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

interface InviteMemberDialogProps {
  teamId: Id<"teams">;
  children: React.ReactNode;
}

type InvitationRole = "admin" | "member";

const getInviteErrorToast = (error: unknown) => {
  const message = toUserFacingErrorMessage(error);

  if (message === "Only organization admins can invite new team members.") {
    return {
      title: "Admin access required",
      description: message,
    };
  }

  if (message === "This user is already a member of this workspace.") {
    return {
      title: "Member already exists",
      description: message,
    };
  }

  if (message === "An invitation has already been sent to this email address.") {
    return {
      title: "Invitation already pending",
      description: message,
    };
  }

  if (message.startsWith("You've reached the maximum number of team members")) {
    return {
      title: "Team member limit reached",
      description: message,
    };
  }

  return {
    title: "Failed to send invitation",
    description: message,
  };
};

export function InviteMemberDialog({ teamId, children }: InviteMemberDialogProps) {
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
      toast.success("Invitation Sent", {
        description: `An invitation has been sent to ${email}.`,
      });
      setIsOpen(false);
      setEmail("");
      setRole("member");
    } catch (error) {
      const toastContent = getInviteErrorToast(error);
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
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Enter the email address and select a role to invite a new member to your team.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
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
                Role
              </Label>
              <Select value={role} onValueChange={(value) => setRole(value as InvitationRole)}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <Toaster />
    </Dialog>
  );
} 
