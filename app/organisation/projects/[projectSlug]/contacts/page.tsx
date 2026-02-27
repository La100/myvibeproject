"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { useProject } from "@/components/providers/ProjectProvider";
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
import {
  Plus,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Building2,
  User
} from "lucide-react";
import { toast } from "sonner";
import { ContactForm } from "@/app/organisation/(company)/contacts/components/ContactForm";
import { Id } from "@/convex/_generated/dataModel";
import { ProjectPageLayout } from "@/components/project/ProjectPageLayout";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";

export default function ContactsPage() {
  const { project } = useProject();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);


  // Get project contacts
  const projectContacts = useQuery(apiAny.contacts.getProjectContacts, {
    projectId: project._id,
  });

  // Mutations
  const removeContact = useMutation(apiAny.contacts.removeContactFromProject);

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
    setIsAddDialogOpen(false);
    toast.success("Contact created successfully");
  };

  const getTypeLabel = (type: string) => {
    const labels = {
      contractor: "Contractor",
      supplier: "Supplier",
      subcontractor: "Subcontractor",
      other: "Other"
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getTypeColor = (type: string) => {
    const colors = {
      contractor: "bg-blue-100 text-blue-800",
      supplier: "bg-green-100 text-green-800",
      subcontractor: "bg-purple-100 text-purple-800",
      other: "bg-gray-100 text-gray-800"
    };
    return colors[type as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };


  return (
    <ProjectPageLayout>
      <div>
        <ProjectPageHeader
          title="Contacts"
          icon={<User className="h-8 w-8 text-[var(--ui-accent-brand)]" />}
          subtitle={`Manage contacts for ${project.name}`}
        />

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg lg:text-xl">Project Contacts</CardTitle>
                <CardDescription className="text-sm">
                  Create and manage contacts for this project
                </CardDescription>
              </div>

              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Contact
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create New Contact</DialogTitle>
                    <DialogDescription>
                      Create a new contact for this project
                    </DialogDescription>
                  </DialogHeader>

                  <ContactForm
                    onSuccess={handleContactCreated}
                    onCancel={() => setIsAddDialogOpen(false)}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>

          <CardContent className="px-4 lg:px-6">
            {projectContacts && projectContacts.length > 0 ? (
              <div className="space-y-4">
                {projectContacts.map((contact) => (
                  <div
                    key={contact._id}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">{contact.name}</h3>
                          {contact.type && (
                            <Badge className={getTypeColor(contact.type)}>
                              {getTypeLabel(contact.type)}
                            </Badge>
                          )}
                        </div>

                        {contact.companyName && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <Building2 className="h-4 w-4" />
                            <span>{contact.companyName}</span>
                          </div>
                        )}

                        {contact.projectRole && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <User className="h-4 w-4" />
                            <span className="font-medium">{contact.projectRole}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
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
                          <p className="text-sm text-muted-foreground mt-2 p-2 bg-muted rounded">
                            {contact.projectNotes}
                          </p>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => contact._id && handleRemoveContact(contact._id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
                  Click "Add Contact" to create new contacts for this project
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProjectPageLayout>
  );
}
