"use client";

import React, { useState } from 'react';
import { useMutation, useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { useUser } from "@clerk/nextjs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { ShoppingCart, Package } from "lucide-react";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent } from "@/components/ui/card";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";
import { useI18n } from "@/lib/i18n";

interface AddToProjectModalProps {
  product: { _id: string; name: string; brand?: string; imageUrl?: string; };
  teamId: Id<"teams">;
  onClose: () => void;
}

export function AddToProjectModal({ product, teamId, onClose }: AddToProjectModalProps) {
  const { t } = useI18n();
  const { user } = useUser();
  const addToShoppingList = useMutation(apiAny.productLibrary.addToShoppingList);
  
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [quantity, setQuantity] = useState("1");
  const [sectionId, setSectionId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get team projects via clerk org
  const team = useQuery(apiAny.teams.getTeamById, { teamId });
  const projects = useQuery(
    apiAny.projects.listProjectsByClerkOrg, 
    team ? { clerkOrgId: team.clerkOrgId } : "skip"
  );

  // Get shopping list sections for selected project
  const sections = useQuery(
    apiAny.shopping.getShoppingListSections, 
    selectedProjectId ? { 
      projectId: selectedProjectId as Id<"projects"> 
    } : "skip"
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProjectId) {
      toast.error(t("productLibrary", "pleaseSelectProject"));
      return;
    }
    
    if (!quantity || parseFloat(quantity) <= 0) {
      toast.error(t("productLibrary", "pleaseValidQuantity"));
      return;
    }

    setIsSubmitting(true);
    try {
      await addToShoppingList({
        productId: product._id as Id<"productLibrary">,
        projectId: selectedProjectId as Id<"projects">,
        teamId,
        quantity: parseFloat(quantity),
        sectionId: (sectionId && sectionId !== "none") ? (sectionId as Id<"shoppingListSections">) : undefined,
        createdBy: user?.id ?? "",
        notes: notes || undefined,
      });

      const selectedProject = projects?.find(p => p._id === selectedProjectId);
      toast.success(
        t("productLibrary", "addedToProject")
          .replace("{product}", product.name)
          .replace("{project}", selectedProject?.name ?? ""),
      );
      onClose();
    } catch (error) {
      console.error("Error adding to shopping list:", error);
      toast.error(t("productLibrary", "failedAddToProject"), {
        description: toUserFacingErrorMessage(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            {t("productLibrary", "addToProject")}
          </DialogTitle>
        </DialogHeader>

        {/* Product Preview */}
        <Card className="gap-0 rounded-2xl bg-secondary/70 p-0 shadow-none">
          <CardContent className="flex items-center gap-3 p-3">
          {product.imageUrl && (
            <img 
              src={product.imageUrl} 
              alt={product.name}
              className="h-12 w-12 rounded-xl object-cover"
            />
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{product.name}</span>
            </div>
            {product.brand && (
              <p className="text-sm text-muted-foreground">{product.brand}</p>
            )}
          </div>
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Project Selection */}
          <div>
            <Label htmlFor="project">{t("productLibrary", "selectProject")}</Label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={t("productLibrary", "chooseProject")} />
              </SelectTrigger>
              <SelectContent>
                {projects?.map(project => (
                  <SelectItem key={project._id} value={project._id}>
                    <div className="flex items-center gap-2">
                      <span>{project.name}</span>
                      {project.status && (
                        <span className="text-xs text-muted-foreground">
                          ({project.status})
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Section Selection */}
          {sections && sections.length > 0 && (
            <div>
              <Label htmlFor="section">{t("productLibrary", "shoppingListSectionOptional")}</Label>
              <Select value={sectionId} onValueChange={setSectionId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={t("productLibrary", "chooseSection")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("productLibrary", "noSpecificSection")}</SelectItem>
                  {sections.map(section => (
                    <SelectItem key={section._id} value={section._id}>
                      {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Quantity */}
          <div>
            <Label htmlFor="quantity">{t("productLibrary", "quantity")}</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={t("productLibrary", "enterQuantity")}
              required
              className="mt-1"
            />
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">{t("productLibrary", "notesOptional")}</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("productLibrary", "additionalNotesShortPlaceholder")}
              rows={3}
              className="mt-1"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              {t("productLibrary", "cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting || !selectedProjectId}>
              {isSubmitting ? t("productLibrary", "adding") : t("productLibrary", "addToProject")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
