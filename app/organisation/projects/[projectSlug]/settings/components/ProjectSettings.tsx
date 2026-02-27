"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useForm, type UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useRef, useState, Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Users, Settings, Shield, AlertTriangle, Sparkles, ImagePlus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TaskStatusSettings from "./TaskStatusSettings";
import ProjectMembers from "./ProjectMembers";
import AISettings from "./AISettings";
import { Spinner } from "@/components/ui/spinner";
import { useOrganization } from "@clerk/nextjs";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";


const settingsFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  coverImageUrl: z.string().optional().or(z.literal("")),
  customer: z.string().optional(),
  budget: z.coerce.number().positive("Budget must be positive").optional().or(z.literal("")),
  location: z.string().optional(),
  status: z.enum([
    "planning",
    "active", 
    "on_hold",
    "completed",
    "cancelled"
  ]).optional(),
  currency: z.enum([
    "USD", "EUR", "PLN", "GBP", "CAD", "AUD", "JPY", "CHF", "SEK", "NOK", 
    "DKK", "CZK", "HUF", "CNY", "INR", "BRL", "MXN", "KRW", "SGD", "HKD"
  ]).optional(),
});

const deleteFormSchema = z.object({
  confirmName: z.string().min(1, "Please enter the project name to confirm deletion")
});

function ProjectSettingsSkeleton() {
  return <Spinner className="pb-8" />;
}

function ProjectSettingsContent() {
  const params = useParams<{ projectSlug: string }>();
  const router = useRouter();
  const { organization } = useOrganization();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"general" | "members" | "taskstatus" | "ai" | "advanced">("general");
  
  const project = useQuery(
    apiAny.projects.getProjectBySlugInClerkOrg,
    organization?.id
      ? { clerkOrgId: organization.id, projectSlug: params.projectSlug }
      : "skip"
  );

  const teamMember = useQuery(apiAny.teams.getCurrentUserTeamMember, 
    project ? { teamId: project.teamId } : "skip"
  );

  const updateProject = useMutation(apiAny.projects.updateProject);
  const deleteProject = useMutation(apiAny.projects.deleteProject);

  const settingsForm = useForm<z.infer<typeof settingsFormSchema>>({
    resolver: zodResolver(settingsFormSchema),
    values: project ? { 
      name: project.name,
      description: project.description || "",
      coverImageUrl: project.coverImageUrl || "",
      customer: project.customer || "",
      budget: project.budget || "",
      location: project.location || "",
      status: project.status || "planning",
      currency: project.currency || "PLN",
    } : { name: "", description: "", coverImageUrl: "", customer: "", budget: "", location: "", status: "planning", currency: "PLN" },
  });

  const deleteForm = useForm<z.infer<typeof deleteFormSchema>>({
    resolver: zodResolver(deleteFormSchema),
    defaultValues: { confirmName: "" },
  });

  if (!project || !teamMember) {
    // Let suspense handle the rest
    return null;
  }
  
  const canEdit = teamMember && (teamMember.role === "admin" || teamMember.role === "member");

  if (!canEdit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <h1 className="text-2xl font-bold text-orange-600 mb-2">Read Only</h1>
        <p className="text-muted-foreground">You can view this project but cannot modify its settings.</p>
      </div>
    );
  }

  async function onSettingsSubmit(values: z.infer<typeof settingsFormSchema>) {
    try {
      const result = await updateProject({ 
        projectId: project!._id, 
        name: values.name,
        description: values.description || undefined,
        coverImageUrl: values.coverImageUrl?.trim() || "",
        customer: values.customer || undefined,
        budget: values.budget ? Number(values.budget) : undefined,
        location: values.location || undefined,
        status: values.status,
        currency: values.currency,
      });
      toast.success("Project settings updated");
      
      if (result?.slug && result.slug !== params.projectSlug) {
        router.push(`/organisation/projects/${result.slug}/settings`);
      }
    } catch (error) {
      toast.error("Error updating project settings", {
        description: (error as Error).message || "There was a problem updating the project settings."
      });
    }
  }

  async function onDeleteSubmit(values: z.infer<typeof deleteFormSchema>) {
    if (values.confirmName !== project!.name) {
      deleteForm.setError("confirmName", {
        message: "Project name doesn't match. Please type the exact project name."
      });
      return;
    }

    try {
      await deleteProject({ projectId: project!._id });
      toast.success("Project deleted successfully");
      setDeleteDialogOpen(false);
      router.push("/organisation");
    } catch (error) {
      toast.error("Error deleting project", {
        description: (error as Error).message || "There was a problem deleting the project."
      });
    }
  }

  return (
    <div className="pb-8">
      <ProjectPageHeader
        title="Project Settings"
        icon={<Settings className="h-8 w-8 text-[var(--ui-accent-brand)]" />}
        subtitle="Manage your project configuration and access."
      />

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="w-full">
        <TabsList className="grid w-full grid-cols-5 h-auto p-1 mb-6">
          <TabsTrigger value="general" className="flex flex-col items-center gap-1 p-2 text-xs data-[state=active]:bg-background">
            <Settings className="h-4 w-4" />
            <span className="text-xs">General</span>
          </TabsTrigger>
          <TabsTrigger value="members" className="flex flex-col items-center gap-1 p-2 text-xs data-[state=active]:bg-background">
            <Users className="h-4 w-4" />
            <span className="text-xs">Members</span>
          </TabsTrigger>
          <TabsTrigger value="taskstatus" className="flex flex-col items-center gap-1 p-2 text-xs data-[state=active]:bg-background">
            <Shield className="h-4 w-4" />
            <span className="text-xs">Status</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex flex-col items-center gap-1 p-2 text-xs data-[state=active]:bg-background">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs">AI</span>
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex flex-col items-center gap-1 p-2 text-xs data-[state=active]:bg-background">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs">Advanced</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-0">
          <GeneralTab 
            projectId={project._id}
            settingsForm={settingsForm}
            onSettingsSubmit={onSettingsSubmit}
          />
        </TabsContent>

        <TabsContent value="members" className="mt-0">
           <Suspense fallback={<Card><CardContent className="p-4"><Spinner fullHeight={false} /></CardContent></Card>}>
            <MembersTab project={project} />
          </Suspense>
        </TabsContent>

        <TabsContent value="taskstatus" className="mt-0">
          <Suspense fallback={<Card><CardContent className="p-4"><Spinner fullHeight={false} /></CardContent></Card>}>
            <TaskStatusTab project={project} />
          </Suspense>
        </TabsContent>

        <TabsContent value="ai" className="mt-0">
          <Suspense fallback={<Card><CardContent className="p-4"><Spinner fullHeight={false} /></CardContent></Card>}>
            <AISettings projectId={project._id} />
          </Suspense>
        </TabsContent>

        <TabsContent value="advanced" className="mt-0">
          <AdvancedTab 
            project={project}
            deleteForm={deleteForm}
            deleteDialogOpen={deleteDialogOpen}
            setDeleteDialogOpen={setDeleteDialogOpen}
            onDeleteSubmit={onDeleteSubmit}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ProjectSettings() {
  return (
    <Suspense fallback={<ProjectSettingsSkeleton />}>
      <ProjectSettingsContent />
    </Suspense>
  );
}

// General Settings Tab
function GeneralTab({ 
  projectId,
  settingsForm, 
  onSettingsSubmit 
}: {
  projectId: Id<"projects">;
  settingsForm: UseFormReturn<z.infer<typeof settingsFormSchema>>;
  onSettingsSubmit: (values: z.infer<typeof settingsFormSchema>) => void;
}) {
  const generateUploadUrl = useMutation(apiAny.files.generateUploadUrlWithCustomKey);
  const addFile = useMutation(apiAny.files.addFile);
  const [uploadingCoverImage, setUploadingCoverImage] = useState(false);
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const coverPreviewUrl = settingsForm.watch("coverImageUrl");

  const handleCoverImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setUploadingCoverImage(true);
    try {
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

      settingsForm.setValue("coverImageUrl", uploadData.publicUrl, {
        shouldDirty: true,
        shouldTouch: true,
      });
      toast.success("Cover image uploaded. Save changes to apply.");
    } catch (error) {
      toast.error("Failed to upload cover image", {
        description: (error as Error).message,
      });
    } finally {
      setUploadingCoverImage(false);
      if (coverFileInputRef.current) {
        coverFileInputRef.current.value = "";
      }
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg lg:text-xl">General Settings</CardTitle>
        <CardDescription className="text-sm">
          Manage your project's basic information and preferences.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 lg:px-6">
        <Form {...settingsForm}>
          <form onSubmit={settingsForm.handleSubmit(onSettingsSubmit)} className="space-y-4 lg:space-y-6">
            <FormField
              control={settingsForm.control}
              name="name"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-sm font-medium">Project Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Project name" 
                      {...field} 
                      className="w-full h-10 text-base" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={settingsForm.control}
              name="description"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-sm font-medium">Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Project description"
                      {...field}
                      className="w-full min-h-[80px] text-base resize-none"
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={settingsForm.control}
              name="coverImageUrl"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-sm font-medium">Cover Image URL</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://example.com/project-cover.jpg"
                      {...field}
                      className="w-full h-10 text-base"
                    />
                  </FormControl>
                  <input
                    ref={coverFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleCoverImageUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => coverFileInputRef.current?.click()}
                    disabled={uploadingCoverImage}
                  >
                    <ImagePlus className="mr-2 h-4 w-4" />
                    {uploadingCoverImage ? "Uploading..." : "Upload image"}
                  </Button>
                  {coverPreviewUrl && /^https?:\/\//i.test(coverPreviewUrl) ? (
                    <div className="overflow-hidden rounded-md border bg-muted/30">
                      <img
                        src={coverPreviewUrl}
                        alt="Cover preview"
                        className="h-40 w-full object-cover"
                      />
                    </div>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={settingsForm.control}
              name="status"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-sm font-medium">Project Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full h-10">
                        <SelectValue placeholder="Select project status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="planning">Planning</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={settingsForm.control}
              name="customer"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-sm font-medium">Client</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Client name" 
                      {...field} 
                      className="w-full h-10 text-base" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={settingsForm.control}
              name="location"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-sm font-medium">Location</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Project location" 
                      {...field} 
                      className="w-full h-10 text-base" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={settingsForm.control}
              name="budget"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-sm font-medium">Budget</FormLabel>
                  <FormControl>
                    <Input 
                      type="number"
                      placeholder="Project budget" 
                      {...field} 
                      className="w-full h-10 text-base" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={settingsForm.control}
              name="currency"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-sm font-medium">Currency</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full h-10">
                        <SelectValue placeholder="Select project currency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="PLN">PLN (zł)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                      <SelectItem value="CAD">CAD (C$)</SelectItem>
                      <SelectItem value="AUD">AUD (A$)</SelectItem>
                      <SelectItem value="JPY">JPY (¥)</SelectItem>
                      <SelectItem value="CHF">CHF</SelectItem>
                      <SelectItem value="SEK">SEK</SelectItem>
                      <SelectItem value="NOK">NOK</SelectItem>
                      <SelectItem value="DKK">DKK</SelectItem>
                      <SelectItem value="CZK">CZK</SelectItem>
                      <SelectItem value="HUF">HUF</SelectItem>
                      <SelectItem value="CNY">CNY (¥)</SelectItem>
                      <SelectItem value="INR">INR (₹)</SelectItem>
                      <SelectItem value="BRL">BRL (R$)</SelectItem>
                      <SelectItem value="MXN">MXN ($)</SelectItem>
                      <SelectItem value="KRW">KRW (₩)</SelectItem>
                      <SelectItem value="SGD">SGD (S$)</SelectItem>
                      <SelectItem value="HKD">HKD (HK$)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="pt-2">
              <Button 
                type="submit" 
                disabled={settingsForm.formState.isSubmitting}
                className="w-full h-10 text-base font-medium"
              >
                {settingsForm.formState.isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// Members Tab
function MembersTab({ project }: { project: { _id: Id<"projects">; teamId: Id<"teams">; name: string } }) {
  return <ProjectMembers project={project} />;
}

// Task Status Tab
function TaskStatusTab({ project }: { project: { _id: string; taskStatusSettings?: unknown } }) {
  return (
    <div>
              {project && project.taskStatusSettings ? (
          <TaskStatusSettings projectId={project._id as Id<"projects">} initialSettings={project.taskStatusSettings as { todo: { name: string; color: string }; in_progress: { name: string; color: string }; review: { name: string; color: string }; done: { name: string; color: string } }} />
        ) : (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg lg:text-xl">Task Status Settings</CardTitle>
            <CardDescription className="text-sm">
              Configure custom task statuses for this project.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 lg:px-6">
            <p className="text-muted-foreground text-sm">Task status settings will be available here.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Advanced Tab with Danger Zone
function AdvancedTab({
  project,
  deleteForm,
  deleteDialogOpen,
  setDeleteDialogOpen,
  onDeleteSubmit
}: {
  project: { name: string };
  deleteForm: UseFormReturn<z.infer<typeof deleteFormSchema>>;
  deleteDialogOpen: boolean;
  setDeleteDialogOpen: (open: boolean) => void;
  onDeleteSubmit: (values: z.infer<typeof deleteFormSchema>) => void;
}) {
  return (
    <div className="space-y-4 lg:space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg lg:text-xl">Advanced Settings</CardTitle>
          <CardDescription className="text-sm">
            Advanced configuration options for this project.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 lg:px-6">
          <p className="text-muted-foreground text-sm">Advanced settings will be available here in future updates.</p>
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-red-600 text-lg lg:text-xl">Danger Zone</CardTitle>
          <CardDescription className="text-sm">
            Irreversible and destructive actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 lg:px-6">
          <div>
            <h4 className="text-sm font-medium text-red-600 mb-2">Delete Project</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Once you delete a project, there is no going back. This will permanently delete the project,
              all its tasks, files, comments, and related data.
            </p>
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" className="w-full sm:w-auto">
                  Delete Project
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] mx-4">
                <DialogHeader>
                  <DialogTitle className="text-lg">Delete Project</DialogTitle>
                  <DialogDescription className="text-sm">
                    This action cannot be undone. This will permanently delete the "{project.name}" project
                    and remove all associated data from our servers.
                  </DialogDescription>
                </DialogHeader>
                <Form {...deleteForm}>
                  <form onSubmit={deleteForm.handleSubmit(onDeleteSubmit)} className="space-y-4 lg:space-y-6">
                    <FormField
                      control={deleteForm.control}
                      name="confirmName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">
                            Type <span className="font-mono font-semibold">{project.name}</span> to confirm:
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder={project.name}
                              {...field}
                              autoComplete="off"
                              className="w-full"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setDeleteDialogOpen(false)}
                        className="w-full sm:w-auto"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="destructive"
                        disabled={deleteForm.formState.isSubmitting}
                        className="w-full sm:w-auto"
                      >
                        {deleteForm.formState.isSubmitting ? "Deleting..." : "Delete Project"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 
