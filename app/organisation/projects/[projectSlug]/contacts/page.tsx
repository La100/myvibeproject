"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { useProject } from "@/components/providers/ProjectProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ContactForm } from "@/app/organisation/(company)/contacts/components/ContactForm";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { ProjectPageLayout } from "@/components/project/ProjectPageLayout";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";

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
      toast.error("Error removing contact");
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
      toast.error("Error adding contact to project");
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

  return (
    <ProjectPageLayout>
      <div>
        <ProjectPageHeader
          title="Contacts"
          icon={<User className="h-8 w-8 text-primary" />}
        />

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg lg:text-xl">
                  Project Contacts
                </CardTitle>
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

                      {organizationContacts &&
                      availableContacts.length === 0 ? (
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
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
          </CardHeader>

          <CardContent className="px-4 lg:px-6">
            {projectContacts && projectContacts.length > 0 ? (
              <div className="flex flex-col gap-4">
                {projectContacts.map((contact) => (
                  <div
                    key={contact._id}
                    className="rounded-xl border border-border/70 p-4 transition-colors hover:bg-secondary/70"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-2">
                          <h3 className="font-semibold">{contact.name}</h3>
                          {contact.type && (
                            <Badge variant={getTypeVariant(contact.type)}>
                              {getTypeLabel(contact.type)}
                            </Badge>
                          )}
                        </div>

                        {contact.companyName && (
                          <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
                            <Building2 className="h-4 w-4" />
                            <span>{contact.companyName}</span>
                          </div>
                        )}

                        {contact.projectRole && (
                          <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-4 w-4" />
                            <span className="font-medium">
                              {contact.projectRole}
                            </span>
                          </div>
                        )}

                        <div className="mb-2 flex items-center gap-4 text-sm text-muted-foreground">
                          {contact.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="h-4 w-4" />
                              <span>{contact.email}</span>
                            </div>
                          )}

                          {contact.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-4 w-4" />
                              <span>{contact.phone}</span>
                            </div>
                          )}

                          {contact.city && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              <span>{contact.city}</span>
                            </div>
                          )}
                        </div>

                        {contact.projectNotes && (
                          <p className="mt-2 rounded-lg bg-muted p-2 text-sm text-muted-foreground">
                            {contact.projectNotes}
                          </p>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          contact._id && handleRemoveContact(contact._id)
                        }
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  No contacts assigned to this project yet
                </p>
                <p className="text-sm text-muted-foreground">
                  Add an existing company contact or create a new one for this
                  project.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProjectPageLayout>
  );
}
