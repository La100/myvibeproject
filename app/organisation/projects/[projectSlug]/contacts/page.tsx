"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { useProject } from "@/components/providers/ProjectProvider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Building2,
  User,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";
import { ContactForm } from "@/app/organisation/(company)/contacts/components/ContactForm";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { ProjectPageLayout } from "@/components/project/ProjectPageLayout";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";
import { cn } from "@/lib/utils";

export default function ContactsPage() {
  const { project, team } = useProject();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<
    Id<"contacts"> | ""
  >("");

  // Get project contacts
  const projectContacts = useQuery(apiAny.contacts.getProjectContacts, {
    projectId: project._id,
  }) as
    | (Doc<"contacts"> & {
        projectRole?: string;
        projectNotes?: string;
      })[]
    | undefined;

  const organizationContacts = useQuery(
    apiAny.contacts.getContacts,
    team?.slug ? { teamSlug: team.slug } : "skip",
  ) as Doc<"contacts">[] | undefined;

  // Mutations
  const removeContact = useMutation(apiAny.contacts.removeContactFromProject);
  const assignContact = useMutation(apiAny.contacts.assignContactToProject);

  const assignedContactIds = new Set(
    (projectContacts || []).map((contact) => contact._id),
  );
  const availableContacts = (organizationContacts || [])
    .filter((contact) => !assignedContactIds.has(contact._id))
    .sort((left, right) => left.name.localeCompare(right.name));

  const handleRemoveContact = async (contactId: Id<"contacts">) => {
    try {
      await removeContact({
        projectId: project._id,
        contactId,
      });

      toast.success("Contact removed from project");
    } catch (error) {
      toast.error("Error removing contact", {
        description: toUserFacingErrorMessage(error),
      });
      console.error(error);
    }
  };

  const handleContactCreated = () => {
    setIsCreateDialogOpen(false);
  };

  const handleAssignContact = async () => {
    if (!selectedContactId) {
      toast.error("Select a contact first");
      return;
    }

    try {
      await assignContact({
        projectId: project._id,
        contactId: selectedContactId,
      });
      setSelectedContactId("");
      setIsAssignDialogOpen(false);
      toast.success("Contact added to project");
    } catch (error) {
      toast.error("Error adding contact to project", {
        description: toUserFacingErrorMessage(error),
      });
      console.error(error);
    }
  };

  const getTypeLabel = (type: string) => {
    const labels = {
      contractor: "Contractor",
      supplier: "Supplier",
      subcontractor: "Subcontractor",
      other: "Other",
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getTypeVariant = (type: string) => {
    const variants = {
      contractor: "default",
      supplier: "secondary",
      subcontractor: "outline",
      other: "outline",
    } as const;
    return variants[type as keyof typeof variants] || "outline";
  };

  const getTypeTone = (type?: string) => {
    const tones = {
      contractor: "bg-foreground text-background border-foreground",
      supplier: "bg-secondary text-foreground border-border/70",
      subcontractor: "bg-card text-foreground border-border/70",
      other: "bg-card text-muted-foreground border-border/70",
    };
    return tones[type as keyof typeof tones] || tones.other;
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "C";

  return (
    <ProjectPageLayout>
      <div>
        <ProjectPageHeader
          title="Contacts"
          icon={<User className="h-8 w-8 text-primary" />}
        />

        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Project Contacts
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                People and vendors tied to this project.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Dialog
                open={isAssignDialogOpen}
                onOpenChange={setIsAssignDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <UserPlus data-icon="inline-start" />
                    Add Existing
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Existing Contact</DialogTitle>
                    <DialogDescription>
                      Select a contact from the company address book.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="flex flex-col gap-4">
                    <Select
                      value={selectedContactId}
                      onValueChange={(value) =>
                        setSelectedContactId(value as Id<"contacts">)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select contact" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableContacts.map((contact) => (
                          <SelectItem key={contact._id} value={contact._id}>
                            {contact.name}
                            {contact.companyName
                              ? `, ${contact.companyName}`
                              : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {organizationContacts && availableContacts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        All company contacts are already assigned to this
                        project.
                      </p>
                    ) : null}

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsAssignDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={handleAssignContact}
                        disabled={!selectedContactId}
                      >
                        Add to Project
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button>
                    <Plus data-icon="inline-start" />
                    Create Contact
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create New Contact</DialogTitle>
                    <DialogDescription>
                      Create a company contact and assign it to this project.
                    </DialogDescription>
                  </DialogHeader>

                  <ContactForm
                    projectId={project._id}
                    onSuccess={handleContactCreated}
                    onCancel={() => setIsCreateDialogOpen(false)}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {projectContacts && projectContacts.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {projectContacts.map((contact) => (
                <article
                  key={contact._id}
                  className="group flex min-h-[220px] flex-col rounded-2xl border border-border/80 bg-card p-4 shadow-[0_16px_44px_-36px_rgba(24,20,16,0.38)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-border hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-secondary/60 text-xs font-semibold text-foreground shadow-sm">
                        {getInitials(contact.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-base font-semibold leading-tight tracking-tight">
                            {contact.name}
                          </h3>
                          {contact.type ? (
                            <Badge
                              variant={getTypeVariant(contact.type)}
                              className={cn(
                                "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                                getTypeTone(contact.type),
                              )}
                            >
                              {getTypeLabel(contact.type)}
                            </Badge>
                          ) : null}
                        </div>

                        <div className="mt-1.5 flex flex-col gap-1 text-[13px] text-muted-foreground">
                          {contact.companyName ? (
                            <div className="flex min-w-0 items-center gap-2">
                              <Building2 className="h-4 w-4 shrink-0" />
                              <span className="truncate">
                                {contact.companyName}
                              </span>
                            </div>
                          ) : null}

                          {contact.projectRole ? (
                            <div className="flex min-w-0 items-center gap-2">
                              <User className="h-4 w-4 shrink-0" />
                              <span className="truncate font-medium text-foreground/75">
                                {contact.projectRole}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() =>
                        contact._id && handleRemoveContact(contact._id)
                      }
                      className="shrink-0 rounded-full text-muted-foreground opacity-70 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-2 text-[13px] sm:grid-cols-2">
                    {contact.email ? (
                      <a
                        href={`mailto:${contact.email}`}
                        className="flex min-w-0 items-center gap-2 rounded-xl border border-border/60 bg-secondary/35 px-3 py-2 text-muted-foreground transition-colors hover:bg-secondary/55 hover:text-foreground"
                      >
                        <Mail className="h-4 w-4 shrink-0" />
                        <span className="truncate">{contact.email}</span>
                      </a>
                    ) : null}

                    {contact.phone ? (
                      <a
                        href={`tel:${contact.phone}`}
                        className="flex min-w-0 items-center gap-2 rounded-xl border border-border/60 bg-secondary/35 px-3 py-2 text-muted-foreground transition-colors hover:bg-secondary/55 hover:text-foreground"
                      >
                        <Phone className="h-4 w-4 shrink-0" />
                        <span className="truncate">{contact.phone}</span>
                      </a>
                    ) : null}

                    {contact.city ? (
                      <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border/60 bg-secondary/35 px-3 py-2 text-muted-foreground sm:col-span-2">
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span className="truncate">{contact.city}</span>
                      </div>
                    ) : null}
                  </div>

                  {contact.projectNotes ? (
                    <p className="mt-auto pt-4 text-[13px] leading-5 text-muted-foreground">
                      <span className="block rounded-xl bg-secondary/55 px-3 py-2.5">
                        {contact.projectNotes}
                      </span>
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/70 bg-card px-6 py-12 text-center">
              <p className="font-medium text-foreground">
                No contacts assigned to this project yet
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Add an existing company contact or create a new one for this
                project.
              </p>
            </div>
          )}
        </section>
      </div>
    </ProjectPageLayout>
  );
}
