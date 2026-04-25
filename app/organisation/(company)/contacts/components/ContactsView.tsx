"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useOrganization } from "@clerk/nextjs";
import { apiAny } from "@/lib/convexApiAny";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Mail, Phone, MapPin } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ContactForm } from "./ContactForm";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";

export function ContactsView() {
  const { organization } = useOrganization();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Id<"contacts"> | null>(
    null,
  );
  const [assigningContact, setAssigningContact] =
    useState<Doc<"contacts"> | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<
    Id<"projects"> | ""
  >("");

  const team = useQuery(
    apiAny.teams.getTeamByClerkOrg,
    organization?.id ? { clerkOrgId: organization.id } : "skip",
  );

  const contacts = useQuery(
    apiAny.contacts.getContacts,
    team?.slug
      ? {
          teamSlug: team.slug,
          search: searchTerm || undefined,
          type:
            typeFilter === "all"
              ? undefined
              : (typeFilter as
                  | "contractor"
                  | "supplier"
                  | "subcontractor"
                  | "other"),
        }
      : "skip",
  ) as Doc<"contacts">[] | undefined;

  const projects = useQuery(
    apiAny.projects.listProjectsByClerkOrg,
    organization?.id ? { clerkOrgId: organization.id } : "skip",
  ) as Doc<"projects">[] | undefined;

  const contactProjects = useQuery(
    apiAny.contacts.getContactProjects,
    assigningContact ? { contactId: assigningContact._id } : "skip",
  ) as (Doc<"projects"> & { assignedAt?: number })[] | undefined;

  const assignContactToProject = useMutation(
    apiAny.contacts.assignContactToProject,
  );

  const assignedProjectIds = new Set(
    (contactProjects || []).map((project) => project._id),
  );
  const availableProjects = (projects || [])
    .filter((project) => !assignedProjectIds.has(project._id))
    .sort((left, right) => left.name.localeCompare(right.name));

  const openAssignDialog = (contact: Doc<"contacts">) => {
    setAssigningContact(contact);
    setSelectedProjectId("");
  };

  const closeAssignDialog = () => {
    setAssigningContact(null);
    setSelectedProjectId("");
  };

  const handleAssignToProject = async () => {
    if (!assigningContact || !selectedProjectId) {
      toast.error("Select a project first");
      return;
    }

    try {
      await assignContactToProject({
        projectId: selectedProjectId,
        contactId: assigningContact._id,
      });
      toast.success("Contact added to project");
      closeAssignDialog();
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
      other: "destructive",
    } as const;
    return variants[type as keyof typeof variants] || "outline";
  };

  const getInitials = (name: string, companyName?: string) => {
    if (companyName) {
      return companyName
        .split(" ")
        .map((word) => word[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Search and filters */}
      <Card className="p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[200px] h-11">
                <SelectValue placeholder="Contact Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="contractor">Contractors</SelectItem>
                <SelectItem value="supplier">Suppliers</SelectItem>
                <SelectItem value="subcontractor">Subcontractors</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Contact
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New Contact</DialogTitle>
                  <DialogDescription>
                    Fill in information about company or contractor
                  </DialogDescription>
                </DialogHeader>
                <ContactForm
                  onSuccess={() => setIsAddDialogOpen(false)}
                  onCancel={() => setIsAddDialogOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </Card>

      {/* Contacts grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {contacts?.map((contact) => (
          <Card
            key={contact._id}
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => setEditingContact(contact._id)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <Avatar className="h-12 w-12 flex-shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {getInitials(contact.name, contact.companyName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{contact.name}</CardTitle>
                    {contact.companyName && (
                      <CardDescription className="font-medium text-base">
                        {contact.companyName}
                      </CardDescription>
                    )}
                  </div>
                </div>
                <Badge variant={getTypeVariant(contact.type)}>
                  {getTypeLabel(contact.type)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {contact.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{contact.email}</span>
                </div>
              )}

              {contact.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{contact.phone}</span>
                </div>
              )}

              {(contact.city || contact.address) && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">
                    {contact.city}
                    {contact.address && contact.city && ", "}
                    {contact.address}
                  </span>
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-1 w-fit"
                onClick={(event) => {
                  event.stopPropagation();
                  openAssignDialog(contact);
                }}
              >
                <Plus data-icon="inline-start" />
                Add to Project
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {contacts && contacts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {searchTerm || typeFilter !== "all"
              ? "No contacts match your filters."
              : "You don't have any contacts yet. Add your first contact to get started."}
          </p>
        </div>
      )}

      {/* Edit contact dialog */}
      <Dialog
        open={!!editingContact}
        onOpenChange={() => setEditingContact(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
            <DialogDescription>Update contact information</DialogDescription>
          </DialogHeader>
          {editingContact && (
            <ContactForm
              contactId={editingContact}
              onSuccess={() => setEditingContact(null)}
              onCancel={() => setEditingContact(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!assigningContact}
        onOpenChange={(open) => !open && closeAssignDialog()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contact to Project</DialogTitle>
            <DialogDescription>
              Select a project for {assigningContact?.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <Select
              value={selectedProjectId}
              onValueChange={(value) =>
                setSelectedProjectId(value as Id<"projects">)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {availableProjects.map((project) => (
                  <SelectItem key={project._id} value={project._id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {projects && availableProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                This contact is already assigned to every available project.
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeAssignDialog}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleAssignToProject}
                disabled={!selectedProjectId}
              >
                Add to Project
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
