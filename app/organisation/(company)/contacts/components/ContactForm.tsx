"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useOrganization } from "@clerk/nextjs";
import { apiAny } from "@/lib/convexApiAny";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";

interface ContactFormProps {
  contactId?: Id<"contacts">;
  projectId?: Id<"projects">;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ContactForm({
  contactId,
  projectId,
  onSuccess,
  onCancel,
}: ContactFormProps) {
  const { organization } = useOrganization();
  const [formData, setFormData] = useState({
    name: "",
    companyName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    postalCode: "",
    website: "",
    taxId: "",
    type: "contractor" as "contractor" | "supplier" | "subcontractor" | "other",
    notes: "",
  });

  const contact = useQuery(
    apiAny.contacts.getContact,
    contactId ? { contactId } : "skip",
  );

  const createContact = useMutation(apiAny.contacts.createContact);
  const updateContact = useMutation(apiAny.contacts.updateContact);
  const assignContactToProject = useMutation(
    apiAny.contacts.assignContactToProject,
  );
  const team = useQuery(
    apiAny.teams.getTeamByClerkOrg,
    organization?.id ? { clerkOrgId: organization.id } : "skip",
  );

  useEffect(() => {
    if (contact) {
      setFormData({
        name: contact.name,
        companyName: contact.companyName || "",
        email: contact.email || "",
        phone: contact.phone || "",
        address: contact.address || "",
        city: contact.city || "",
        postalCode: contact.postalCode || "",
        website: contact.website || "",
        taxId: contact.taxId || "",
        type: contact.type,
        notes: contact.notes || "",
      });
    }
  }, [contact]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Contact name is required");
      return;
    }

    try {
      const contactData = {
        ...formData,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        address: formData.address || undefined,
        city: formData.city || undefined,
        postalCode: formData.postalCode || undefined,
        website: formData.website || undefined,
        taxId: formData.taxId || undefined,
        notes: formData.notes || undefined,
        companyName: formData.companyName || undefined,
      };

      if (contactId) {
        await updateContact({
          contactId,
          ...contactData,
        });
        toast.success("Contact updated successfully");
      } else {
        if (!team?.slug) {
          toast.error("Organization is not ready yet");
          return;
        }
        const createdContactId = (await createContact({
          teamSlug: team.slug,
          ...contactData,
        })) as Id<"contacts">;

        if (projectId) {
          await assignContactToProject({
            projectId,
            contactId: createdContactId,
          });
          toast.success("Contact added to project");
        } else {
          toast.success("Contact added successfully");
        }
      }

      onSuccess();
    } catch (error) {
      toast.error("Error saving contact", {
        description: toUserFacingErrorMessage(error),
      });
      console.error(error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <Label htmlFor="name">Contact Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, name: e.target.value }))
            }
            required
          />
        </div>

        <div className="flex flex-col gap-3">
          <Label htmlFor="companyName">Company Name</Label>
          <Input
            id="companyName"
            value={formData.companyName}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, companyName: e.target.value }))
            }
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, email: e.target.value }))
            }
          />
        </div>

        <div className="flex flex-col gap-3">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, phone: e.target.value }))
            }
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Label htmlFor="address">Address</Label>
        <Input
          id="address"
          value={formData.address}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, address: e.target.value }))
          }
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={formData.city}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, city: e.target.value }))
            }
          />
        </div>

        <div className="flex flex-col gap-3">
          <Label htmlFor="postalCode">Postal Code</Label>
          <Input
            id="postalCode"
            value={formData.postalCode}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, postalCode: e.target.value }))
            }
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            value={formData.website}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, website: e.target.value }))
            }
          />
        </div>

        <div className="flex flex-col gap-3">
          <Label htmlFor="taxId">Tax ID</Label>
          <Input
            id="taxId"
            value={formData.taxId}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, taxId: e.target.value }))
            }
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <Label htmlFor="type">Contact Type</Label>
          <Select
            value={formData.type}
            onValueChange={(
              value: "contractor" | "supplier" | "subcontractor" | "other",
            ) => setFormData((prev) => ({ ...prev, type: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="contractor">Contractor</SelectItem>
              <SelectItem value="supplier">Supplier</SelectItem>
              <SelectItem value="subcontractor">Subcontractor</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, notes: e.target.value }))
          }
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {contactId ? "Save Changes" : "Add Contact"}
        </Button>
      </div>
    </form>
  );
}
