"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { AlertTriangle, Check, ImagePlus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import Link from "next/link";

const currencySymbols: Record<string, string> = {
  PLN: "zł",
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "C$",
  AUD: "A$",
  JPY: "¥",
  CHF: "CHF",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
  CZK: "Kč",
  HUF: "Ft",
  CNY: "¥",
  INR: "₹",
  BRL: "R$",
  MXN: "$",
  KRW: "₩",
  SGD: "S$",
  HKD: "HK$",
};

export default function NewProjectPage() {
  const router = useRouter();
  const { organization } = useOrganization();
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const team = useQuery(apiAny.teams.getTeamByClerkOrg,
    organization?.id ? { clerkOrgId: organization.id } : "skip"
  );

  const createProject = useMutation(apiAny.projects.createProjectInOrg);
  const updateProject = useMutation(apiAny.projects.updateProject);
  const generateUploadUrl = useMutation(apiAny.files.generateUploadUrlWithCustomKey);
  const addFile = useMutation(apiAny.files.addFile);
  const checkLimits = useQuery(apiAny.stripe.checkTeamLimits,
    team?._id ? {
      teamId: team._id,
      action: "create_project"
    } : "skip"
  );

  const [useDefaultCurrency, setUseDefaultCurrency] = useState(true);
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImagePreviewUrl, setCoverImagePreviewUrl] = useState("");
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
    projectType: "",
    client: "",
    location: "",
    streetAddress2: "",
    city: "",
    state: "",
    postcode: "",
    budget: "",
    startDate: "",
    endDate: "",
    currency: "PLN",
    measurements: "metric",
    tax: false,
  });
  const selectedCurrency = useDefaultCurrency ? (team?.currency || "PLN") : newProject.currency;
  const selectedCurrencySymbol = currencySymbols[selectedCurrency] || selectedCurrency;

  useEffect(() => {
    if (!coverImageFile) {
      setCoverImagePreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(coverImageFile);
    setCoverImagePreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [coverImageFile]);

  const handleCoverImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setCoverImageFile(file);
  };

  const clearCoverImageFile = () => {
    setCoverImageFile(null);
    if (coverFileInputRef.current) {
      coverFileInputRef.current.value = "";
    }
  };

  const uploadProjectCoverImage = async (projectId: Id<"projects">, file: File) => {
    const uploadData = await generateUploadUrl({
      projectId,
      fileName: file.name,
      fileSize: file.size,
    });

    const uploadResponse = await fetch(uploadData.url, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": file.type,
      },
    });

    if (!uploadResponse.ok) {
      throw new Error(`Cover upload failed (${uploadResponse.status})`);
    }

    await addFile({
      projectId,
      folderId: undefined,
      fileKey: uploadData.key,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      origin: "general",
    });

    if (!uploadData.publicUrl) {
      throw new Error("Missing public URL for uploaded cover image");
    }

    return uploadData.publicUrl;
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name || !organization?.id || !team?._id || isSubmitting) return;

    if (checkLimits && !checkLimits.allowed) {
      setShowUpgradeDialog(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const fullAddress = [
        newProject.location,
        newProject.streetAddress2,
        newProject.city,
        newProject.state,
        newProject.postcode
      ].filter(Boolean).join(", ");

      const createdProject = await createProject({
        name: newProject.name,
        description: newProject.description || undefined,
        coverImageUrl: undefined,
        clerkOrgId: organization.id,
        teamId: team._id,
        customer: newProject.client || undefined,
        location: fullAddress || undefined,
        budget: newProject.budget ? parseFloat(newProject.budget) : undefined,
        startDate: newProject.startDate ? new Date(newProject.startDate).getTime() : undefined,
        endDate: newProject.endDate ? new Date(newProject.endDate).getTime() : undefined,
      });

      if (coverImageFile && createdProject?.id) {
        const uploadedCoverUrl = await uploadProjectCoverImage(createdProject.id, coverImageFile);
        await updateProject({
          projectId: createdProject.id,
          coverImageUrl: uploadedCoverUrl,
        });
      }

      if (createdProject?.slug) {
        toast.success("Project created");
        router.push(`/organisation/projects/${createdProject.slug}`);
      }
    } catch (error) {
      toast.error("Error creating project");
      console.error("Error creating project:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <form onSubmit={handleCreateProject} className="mx-auto max-w-2xl space-y-10">
        {/* Details */}
        <section className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold">Details</h2>
            <p className="text-sm text-muted-foreground">Basic information about your project</p>
          </div>

          <div className="space-y-5 rounded-lg border bg-card p-6">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Project name</Label>
                <Input
                  id="name"
                  placeholder="Enter project name"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Project type</Label>
                <Select value={newProject.projectType} onValueChange={(v) => setNewProject({ ...newProject, projectType: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="residential">Residential</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="industrial">Industrial</SelectItem>
                    <SelectItem value="renovation">Renovation / Retrofit</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>
                Timeframe <span className="font-normal text-muted-foreground">(Optional)</span>
              </Label>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input
                  type="date"
                  value={newProject.startDate}
                  onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })}
                />
                <Input
                  type="date"
                  value={newProject.endDate}
                  onChange={(e) => setNewProject({ ...newProject, endDate: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                Description <span className="font-normal text-muted-foreground">(Optional)</span>
              </Label>
              <Textarea
                id="description"
                placeholder="Describe your project"
                value={newProject.description}
                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label>
                Cover image <span className="font-normal text-muted-foreground">(Optional)</span>
              </Label>
              <input
                ref={coverFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverImageFileChange}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => coverFileInputRef.current?.click()}
                >
                  <ImagePlus className="mr-2 h-4 w-4" />
                  Upload image
                </Button>
                {coverImageFile ? (
                  <Button type="button" variant="ghost" size="sm" onClick={clearCoverImageFile}>
                    <X className="mr-2 h-4 w-4" />
                    Remove upload
                  </Button>
                ) : null}
              </div>
              {coverImagePreviewUrl ? (
                <div className="overflow-hidden rounded-md border bg-muted/30">
                  <img
                    src={coverImagePreviewUrl}
                    alt="Cover preview"
                    className="h-40 w-full object-cover"
                  />
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Upload an image to use it as project cover.
              </p>
            </div>
          </div>
        </section>

        {/* Address */}
        <section className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold">Address <span className="font-normal text-sm text-muted-foreground">(Optional)</span></h2>
            <p className="text-sm text-muted-foreground">Project location details</p>
          </div>

          <div className="space-y-5 rounded-lg border bg-card p-6">
            <div className="space-y-2">
              <Label htmlFor="location">Street address</Label>
              <Input
                id="location"
                placeholder="Street address line 1"
                value={newProject.location}
                onChange={(e) => setNewProject({ ...newProject, location: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="streetAddress2">
                Address line 2 <span className="font-normal text-muted-foreground">(Optional)</span>
              </Label>
              <Input
                id="streetAddress2"
                placeholder="Street address line 2"
                value={newProject.streetAddress2}
                onChange={(e) => setNewProject({ ...newProject, streetAddress2: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="City"
                  value={newProject.city}
                  onChange={(e) => setNewProject({ ...newProject, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  placeholder="State"
                  value={newProject.state}
                  onChange={(e) => setNewProject({ ...newProject, state: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postcode">Postcode</Label>
                <Input
                  id="postcode"
                  placeholder="Postcode"
                  value={newProject.postcode}
                  onChange={(e) => setNewProject({ ...newProject, postcode: e.target.value })}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Currency & Measurements */}
        <section className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold">Currency & Measurements</h2>
            <p className="text-sm text-muted-foreground">
              Set the currency and measurement system for this project.
            </p>
          </div>

          <div className="space-y-5 rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Use default settings</p>
                <p className="text-xs text-muted-foreground">{team?.currency || "PLN"}, Metric</p>
              </div>
              <Switch
                id="defaultCurrency"
                checked={useDefaultCurrency}
                onCheckedChange={setUseDefaultCurrency}
              />
            </div>

            {!useDefaultCurrency && (
              <>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Project Currency</Label>
                    <Select value={newProject.currency} onValueChange={(v) => setNewProject({ ...newProject, currency: v })}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PLN">Polish Zloty (PLN-zl)</SelectItem>
                        <SelectItem value="USD">US Dollar (USD-$)</SelectItem>
                        <SelectItem value="EUR">Euro (EUR-€)</SelectItem>
                        <SelectItem value="GBP">British Pound (GBP-£)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Measurements</Label>
                    <Select value={newProject.measurements} onValueChange={(v) => setNewProject({ ...newProject, measurements: v })}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="metric">Metric</SelectItem>
                        <SelectItem value="imperial">Imperial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-4">
                  <input
                    type="checkbox"
                    id="tax"
                    checked={newProject.tax}
                    onChange={(e) => setNewProject({ ...newProject, tax: e.target.checked })}
                    className="mt-1 h-4 w-4 rounded border-gray-300"
                  />
                  <div>
                    <label htmlFor="tax" className="cursor-pointer text-sm font-medium">Tax</label>
                    <p className="text-sm text-muted-foreground">
                      Turning tax on will result in tax calculated at the schedule level.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Client & Budget */}
        <section className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold">Client & Budget</h2>
            <p className="text-sm text-muted-foreground">Financial and client information</p>
          </div>

          <div className="space-y-5 rounded-lg border bg-card p-6">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="client">
                  Client <span className="font-normal text-muted-foreground">(Optional)</span>
                </Label>
                <Input
                  id="client"
                  placeholder="Client name"
                  value={newProject.client}
                  onChange={(e) => setNewProject({ ...newProject, client: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="budget">
                  Budget <span className="font-normal text-muted-foreground">(Optional)</span>
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {selectedCurrencySymbol}
                  </span>
                  <Input
                    id="budget"
                    type="number"
                    placeholder="0.00"
                    value={newProject.budget}
                    onChange={(e) => setNewProject({ ...newProject, budget: e.target.value })}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t pt-6">
          <Link href="/organisation">
            <Button type="button" variant="outline" size="sm">
              Cancel
            </Button>
          </Link>
          <Button type="submit" size="sm" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Project"}
          </Button>
        </div>
      </form>

      {/* Upgrade Dialog */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center sm:text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--ui-accent-copper)]/10">
              <AlertTriangle className="h-7 w-7 text-[var(--ui-accent-copper)]" />
            </div>
            <DialogTitle className="font-[var(--font-display-serif)] text-xl font-medium">Project limit reached</DialogTitle>
            <DialogDescription className="text-base">
              You&apos;ve reached the maximum number of projects ({checkLimits?.limit || 3}) for the Free plan.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 rounded-xl border bg-muted/50 p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="font-[var(--font-display-serif)] font-medium">AI Pro</p>
                <p className="text-sm text-muted-foreground">$39/month</p>
              </div>
            </div>
            <ul className="space-y-2.5 text-sm">
              {["20 projects", "25 team members", "AI Assistant & image generation", "50 GB storage"].map((feature) => (
                <li key={feature} className="flex items-center gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--ui-accent-brand)]/15 text-[var(--ui-accent-brand)]">
                    <Check className="h-3 w-3" strokeWidth={2.5} />
                  </span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="w-full h-11 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_8px_30px_rgba(44,42,37,0.15)]"
              onClick={() => {
                setShowUpgradeDialog(false);
                router.push("/organisation/settings?tab=subscription");
              }}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Upgrade to AI Pro
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setShowUpgradeDialog(false)}
            >
              Maybe later
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
