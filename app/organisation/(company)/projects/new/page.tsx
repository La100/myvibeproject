"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { AlertTriangle, Check, ImagePlus, Sparkles, X } from "lucide-react";
import { optimizeCoverImageForUpload } from "@/lib/coverImageUpload";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";
import { getCurrencySymbol } from "@/lib/utils";

interface TeamMemberOption {
  _id: Id<"teamMembers">;
  clerkUserId: string;
  role: "admin" | "member";
  isActive: boolean;
  name?: string;
  email?: string;
}

function parseDateInput(value: string) {
  if (!value) return undefined;

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;

  return new Date(year, month - 1, day);
}

function formatDateInput(date: Date | undefined) {
  if (!date) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function NewProjectPage() {
  const router = useRouter();
  const { organization } = useOrganization();
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOptimizingCoverImage, setIsOptimizingCoverImage] = useState(false);
  const projectAccessInitializedRef = useRef(false);

  const team = useQuery(apiAny.teams.getTeamByClerkOrg,
    organization?.id ? { clerkOrgId: organization.id } : "skip"
  );

  const createProject = useMutation(apiAny.projects.createProjectInOrg);
  const updateProject = useMutation(apiAny.projects.updateProject);
  const generateUploadUrl = useMutation(apiAny.files.generateUploadUrlWithCustomKey);
  const addFile = useMutation(apiAny.files.addFile);
  const teamMembers = useQuery(apiAny.teams.getTeamMembers, team?._id ? { teamId: team._id } : "skip");
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
    client: "",
    customerEmail: "",
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
  });
  const projectMemberOptions = ((teamMembers ?? []) as TeamMemberOption[]).filter(
    (member) => member.isActive && member.role === "member",
  );
  const [selectedProjectMemberIds, setSelectedProjectMemberIds] = useState<string[]>([]);
  const selectedCurrency = useDefaultCurrency ? (team?.currency || "PLN") : newProject.currency;
  const selectedCurrencySymbol = getCurrencySymbol(selectedCurrency);

  useEffect(() => {
    if (projectAccessInitializedRef.current || projectMemberOptions.length === 0) {
      return;
    }

    projectAccessInitializedRef.current = true;
    setSelectedProjectMemberIds(
      projectMemberOptions.map((member) => member.clerkUserId),
    );
  }, [projectMemberOptions]);

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

  const handleCoverImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setIsOptimizingCoverImage(true);

    try {
      const optimized = await optimizeCoverImageForUpload(file);
      setCoverImageFile(optimized.file);

      if (optimized.optimized) {
        const savedKb = Math.max(1, Math.round((optimized.originalSize - optimized.file.size) / 1024));
        toast.success("Cover image optimized", {
          description: `Reduced by about ${savedKb} KB before upload.`,
        });
      }
    } catch {
      setCoverImageFile(file);
    } finally {
      setIsOptimizingCoverImage(false);
    }
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

    return uploadData.key;
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name || !organization?.id || !team?._id || isSubmitting) return;

    const parsedStartDate = parseDateInput(newProject.startDate);
    const parsedEndDate = parseDateInput(newProject.endDate);

    if (
      parsedStartDate &&
      parsedEndDate &&
      parsedEndDate.getTime() < parsedStartDate.getTime()
    ) {
      toast.error("End date cannot be earlier than start date.");
      return;
    }

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
        customerEmail: newProject.customerEmail || undefined,
        location: fullAddress || undefined,
        budget: newProject.budget ? parseFloat(newProject.budget) : undefined,
        startDate: parsedStartDate?.getTime(),
        endDate: parsedEndDate?.getTime(),
        currency: selectedCurrency,
        measurements: newProject.measurements === "imperial" ? "imperial" : "metric",
        projectMemberClerkUserIds:
          projectMemberOptions.length > 0 ? selectedProjectMemberIds : undefined,
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
      toast.error("Error creating project", {
        description: toUserFacingErrorMessage(error),
      });
      console.error("Error creating project:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <form onSubmit={handleCreateProject} className="mx-auto flex max-w-2xl flex-col gap-10">
        <section className="flex flex-col gap-5">
          <div>
            <h2 className="text-lg font-semibold">Details</h2>
            <p className="text-sm text-muted-foreground">Basic information about your project</p>
          </div>

          <div className="flex flex-col gap-5 rounded-lg border bg-card p-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Project name</Label>
              <Input
                id="name"
                placeholder="Enter project name"
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>
                Timeframe <span className="font-normal text-muted-foreground">(Optional)</span>
              </Label>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <DatePicker
                  date={parseDateInput(newProject.startDate)}
                  onDateChange={(date) =>
                    setNewProject({ ...newProject, startDate: formatDateInput(date) })
                  }
                  placeholder="Select start date"
                />
                <DatePicker
                  date={parseDateInput(newProject.endDate)}
                  onDateChange={(date) =>
                    setNewProject({ ...newProject, endDate: formatDateInput(date) })
                  }
                  placeholder="Select end date"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
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

            <div className="flex flex-col gap-2">
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
                  disabled={isOptimizingCoverImage}
                >
                  <ImagePlus className="mr-2 h-4 w-4" />
                  {isOptimizingCoverImage ? "Optimizing..." : "Upload image"}
                </Button>
                {coverImageFile ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearCoverImageFile}
                    disabled={isOptimizingCoverImage}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Remove upload
                  </Button>
                ) : null}
              </div>
              {coverImagePreviewUrl ? (
                <div className="overflow-hidden rounded-md border bg-secondary/70">
                  <img
                    src={coverImagePreviewUrl}
                    alt="Cover preview"
                    className="h-40 w-full object-cover"
                  />
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Upload an image to use it as project cover. Large files are resized and compressed automatically.
              </p>
            </div>
          </div>
        </section>

        {projectMemberOptions.length > 0 ? (
          <section className="flex flex-col gap-5">
            <div>
              <h2 className="text-lg font-semibold">Project access</h2>
              <p className="text-sm text-muted-foreground">Choose which organization members can access this project.</p>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border bg-card p-6">
              {projectMemberOptions.map((member) => {
                const isSelected = selectedProjectMemberIds.includes(member.clerkUserId);
                const label = member.name || member.email || member.clerkUserId;

                return (
                  <button
                    key={member._id}
                    type="button"
                    onClick={() =>
                      setSelectedProjectMemberIds((current) =>
                        isSelected
                          ? current.filter((id) => id !== member.clerkUserId)
                          : [...current, member.clerkUserId],
                      )
                    }
                    className="flex items-center justify-between rounded-md border bg-background px-4 py-3 text-left text-sm transition-colors hover:bg-secondary/70"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{label}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {isSelected ? "Will have project access" : "No access to this project"}
                      </span>
                    </span>
                    <span className={isSelected ? "text-primary" : "text-muted-foreground"}>
                      {isSelected ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="flex flex-col gap-5">
          <div>
            <h2 className="text-lg font-semibold">Address <span className="font-normal text-sm text-muted-foreground">(Optional)</span></h2>
            <p className="text-sm text-muted-foreground">Project location details</p>
          </div>

          <div className="flex flex-col gap-5 rounded-lg border bg-card p-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="location">Street address</Label>
              <Input
                id="location"
                placeholder="Street address line 1"
                value={newProject.location}
                onChange={(e) => setNewProject({ ...newProject, location: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2">
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
              <div className="flex flex-col gap-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="City"
                  value={newProject.city}
                  onChange={(e) => setNewProject({ ...newProject, city: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  placeholder="State"
                  value={newProject.state}
                  onChange={(e) => setNewProject({ ...newProject, state: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
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

        <section className="flex flex-col gap-5">
          <div>
            <h2 className="text-lg font-semibold">Currency & Measurements</h2>
            <p className="text-sm text-muted-foreground">
              Set the currency and measurement system for this project.
            </p>
          </div>

          <div className="flex flex-col gap-5 rounded-lg border bg-card p-6">
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
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
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
              </div>
            )}

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="flex flex-col gap-2">
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
          </div>
        </section>

        <section className="flex flex-col gap-5">
          <div>
            <h2 className="text-lg font-semibold">Client & Budget</h2>
            <p className="text-sm text-muted-foreground">Financial and client information</p>
          </div>

          <div className="flex flex-col gap-5 rounded-lg border bg-card p-6">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="flex flex-col gap-2">
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

              <div className="flex flex-col gap-2">
                <Label htmlFor="customerEmail">
                  Customer Email <span className="font-normal text-muted-foreground">(Optional)</span>
                </Label>
                <Input
                  id="customerEmail"
                  type="email"
                  placeholder="client@example.com"
                  value={newProject.customerEmail}
                  onChange={(e) => setNewProject({ ...newProject, customerEmail: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-2 md:col-span-2">
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
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <AlertTriangle className="h-7 w-7 text-primary" />
            </div>
            <DialogTitle className="text-xl font-medium">Project limit reached</DialogTitle>
            <DialogDescription className="text-base">
              You&apos;ve reached the maximum number of projects ({checkLimits?.limit || 3}) for the Free plan.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 rounded-xl border bg-secondary/70 p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="font-medium">AI Pro</p>
                <p className="text-sm text-muted-foreground">$39/month</p>
              </div>
            </div>
            <ul className="flex flex-col gap-2.5 text-sm">
              {["20 projects", "25 team members", "AI Assistant & image generation", "50 GB storage"].map((feature) => (
                <li key={feature} className="flex items-center gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Check className="h-3 w-3" strokeWidth={2.5} />
                  </span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="h-11 w-full"
              onClick={() => {
                setShowUpgradeDialog(false);
                router.push("/organisation/subscription");
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
