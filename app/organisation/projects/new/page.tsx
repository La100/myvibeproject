"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { ArrowLeft, Upload, X, AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Link from "next/link";

export default function NewProjectPage() {
  const router = useRouter();
  const { organization, isLoaded } = useOrganization();
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const onboardingStatus = useQuery(apiAny.onboarding.getStatus);

  const team = useQuery(apiAny.teams.getTeamByClerkOrg,
    organization?.id ? { clerkOrgId: organization.id } : "skip"
  );

  const createProject = useMutation(apiAny.projects.createProjectInOrg);
  const checkLimits = useQuery(apiAny.stripe.checkTeamLimits,
    team?._id ? {
      teamId: team._id,
      action: "create_project"
    } : "skip"
  );

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
    coverImage: null as File | null,
    currency: "PLN",
    measurements: "metric",
    tax: false,
  });

  useEffect(() => {
    if (onboardingStatus === undefined || !onboardingStatus.authenticated) {
      return;
    }
    if (!onboardingStatus.completed || (isLoaded && !organization?.id)) {
      router.replace("/onboarding");
    }
  }, [onboardingStatus, isLoaded, organization?.id, router]);

  if (!isLoaded || onboardingStatus === undefined || !organization) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground">Preparing project setup...</p>
        </div>
      </div>
    );
  }

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name || !organization?.id || !team?._id) return;

    if (checkLimits && !checkLimits.allowed) {
      setShowUpgradeDialog(true);
      return;
    }

    try {
      const fullAddress = [
        newProject.location,
        newProject.streetAddress2,
        newProject.city,
        newProject.state,
        newProject.postcode
      ].filter(Boolean).join(", ");

      const { slug: newProjectSlug } = await createProject({
        name: newProject.name,
        description: newProject.description || undefined,
        clerkOrgId: organization.id,
        teamId: team._id,
        customer: newProject.client || undefined,
        location: fullAddress || undefined,
        budget: newProject.budget ? parseFloat(newProject.budget) : undefined,
        startDate: newProject.startDate ? new Date(newProject.startDate).getTime() : undefined,
        endDate: newProject.endDate ? new Date(newProject.endDate).getTime() : undefined,
      });

      if (newProjectSlug) {
        router.push(`/organisation/projects/${newProjectSlug}`);
      }
    } catch (error) {
      console.error("Error creating project:", error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/organisation/projects">
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-0.5">
                  <span>Projects</span>
                  <span>›</span>
                  <span>New Project</span>
                </div>
              </div>
            </div>
            <Button
              onClick={handleCreateProject}
              size="lg"
              className="h-11 px-8 font-medium"
            >
              Create Project
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <form onSubmit={handleCreateProject} className="space-y-12">
          {/* Details Section */}
          <section className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-1">Details</h2>
              <p className="text-sm text-muted-foreground">
                Basic information about your project
              </p>
            </div>

            <div className="space-y-6 bg-card border rounded-lg p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">
                    Project name
                  </Label>
                  <Input
                    id="name"
                    placeholder="Enter project name"
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                    required
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="projectType" className="text-sm font-medium">
                    Project type
                  </Label>
                  <select
                    id="projectType"
                    value={newProject.projectType}
                    onChange={(e) => setNewProject({ ...newProject, projectType: e.target.value })}
                    className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">Select</option>
                    <option value="residential">Residential</option>
                    <option value="commercial">Commercial</option>
                    <option value="industrial">Industrial</option>
                    <option value="renovation">Renovation / Retrofit</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Timeframe <span className="text-muted-foreground font-normal">(Optional)</span>
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    type="date"
                    placeholder="Start date"
                    value={newProject.startDate}
                    onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })}
                    className="h-11"
                  />
                  <Input
                    type="date"
                    placeholder="End date"
                    value={newProject.endDate}
                    onChange={(e) => setNewProject({ ...newProject, endDate: e.target.value })}
                    className="h-11"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Choose a start and end date for your project.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Cover image <span className="text-muted-foreground font-normal">(Optional)</span>
                </Label>
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center hover:border-muted-foreground/50 transition-colors cursor-pointer">
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="rounded-full bg-muted p-4">
                      <Upload className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Drag and drop your files here or{" "}
                        <label htmlFor="coverImage" className="text-primary hover:underline cursor-pointer font-medium">
                          browse to upload
                        </label>
                      </p>
                      <input
                        id="coverImage"
                        type="file"
                        accept="image/*"
                        onChange={(e) => setNewProject({ ...newProject, coverImage: e.target.files?.[0] || null })}
                        className="hidden"
                      />
                    </div>
                    {newProject.coverImage && (
                      <div className="flex items-center gap-2 text-sm bg-muted px-4 py-2 rounded-md">
                        <span className="font-medium">{newProject.coverImage.name}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setNewProject({ ...newProject, coverImage: null });
                          }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium">
                  Project description <span className="text-muted-foreground font-normal">(Optional)</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder="Describe your project"
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  rows={4}
                  className="resize-none"
                />
              </div>
            </div>
          </section>

          {/* Address Section */}
          <section className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-1">Address</h2>
              <p className="text-sm text-muted-foreground">
                Project location details
              </p>
            </div>

            <div className="space-y-6 bg-card border rounded-lg p-8">
              <div className="space-y-2">
                <Label htmlFor="location" className="text-sm font-medium">
                  Street address
                </Label>
                <Input
                  id="location"
                  placeholder="Street address line 1"
                  value={newProject.location}
                  onChange={(e) => setNewProject({ ...newProject, location: e.target.value })}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="streetAddress2" className="text-sm font-medium">
                  Address line 2 <span className="text-muted-foreground font-normal">(Optional)</span>
                </Label>
                <Input
                  id="streetAddress2"
                  placeholder="Street address line 2"
                  value={newProject.streetAddress2}
                  onChange={(e) => setNewProject({ ...newProject, streetAddress2: e.target.value })}
                  className="h-11"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city" className="text-sm font-medium">
                    City
                  </Label>
                  <Input
                    id="city"
                    placeholder="City"
                    value={newProject.city}
                    onChange={(e) => setNewProject({ ...newProject, city: e.target.value })}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state" className="text-sm font-medium">
                    State
                  </Label>
                  <Input
                    id="state"
                    placeholder="State"
                    value={newProject.state}
                    onChange={(e) => setNewProject({ ...newProject, state: e.target.value })}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="postcode" className="text-sm font-medium">
                    Postcode
                  </Label>
                  <Input
                    id="postcode"
                    placeholder="Postcode"
                    value={newProject.postcode}
                    onChange={(e) => setNewProject({ ...newProject, postcode: e.target.value })}
                    className="h-11"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Currency & Measurements Section */}
          <section className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-1">Currency & Measurements</h2>
              <p className="text-sm text-muted-foreground">
                Set the currency and measurement system for this project. These will be used for quoting, invoicing, and appear on your schedule.
              </p>
            </div>

            <div className="space-y-6 bg-card border rounded-lg p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="currency" className="text-sm font-medium">
                    Project Currency
                  </Label>
                  <select
                    id="currency"
                    value={newProject.currency}
                    onChange={(e) => setNewProject({ ...newProject, currency: e.target.value })}
                    className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="PLN">Polish Zloty (PLN-zl)</option>
                    <option value="USD">US Dollar (USD-$)</option>
                    <option value="EUR">Euro (EUR-€)</option>
                    <option value="GBP">British Pound (GBP-£)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="measurements" className="text-sm font-medium">
                    Measurements
                  </Label>
                  <select
                    id="measurements"
                    value={newProject.measurements}
                    onChange={(e) => setNewProject({ ...newProject, measurements: e.target.value })}
                    className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="metric">Metric</option>
                    <option value="imperial">Imperial</option>
                  </select>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                <input
                  type="checkbox"
                  id="tax"
                  checked={newProject.tax}
                  onChange={(e) => setNewProject({ ...newProject, tax: e.target.checked })}
                  className="mt-1 h-4 w-4 rounded border-gray-300"
                />
                <div className="flex-1">
                  <label htmlFor="tax" className="text-sm font-medium cursor-pointer">
                    Tax
                  </label>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Turning tax on will result in tax calculated at the schedule level.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Client & Budget Section */}
          <section className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-1">Client & Budget</h2>
              <p className="text-sm text-muted-foreground">
                Financial and client information
              </p>
            </div>

            <div className="space-y-6 bg-card border rounded-lg p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="client" className="text-sm font-medium">
                    Client <span className="text-muted-foreground font-normal">(Optional)</span>
                  </Label>
                  <Input
                    id="client"
                    placeholder="Client name"
                    value={newProject.client}
                    onChange={(e) => setNewProject({ ...newProject, client: e.target.value })}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="budget" className="text-sm font-medium">
                    Budget <span className="text-muted-foreground font-normal">(Optional)</span>
                  </Label>
                  <Input
                    id="budget"
                    type="number"
                    placeholder="0.00"
                    value={newProject.budget}
                    onChange={(e) => setNewProject({ ...newProject, budget: e.target.value })}
                    className="h-11"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Bottom Actions */}
          <div className="flex items-center justify-end gap-4 pt-6 border-t">
            <Link href="/organisation/projects">
              <Button type="button" variant="outline" size="lg" className="h-11 px-8">
                Cancel
              </Button>
            </Link>
            <Button type="submit" size="lg" className="h-11 px-8 font-medium">
              Create Project
            </Button>
          </div>
        </form>
      </div>

      {/* Upgrade Dialog */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center sm:text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
              <AlertTriangle className="h-7 w-7 text-orange-600" />
            </div>
            <DialogTitle className="text-xl">Project limit reached</DialogTitle>
            <DialogDescription className="text-base">
              You&apos;ve reached the maximum number of projects ({checkLimits?.limit || 3}) for the Free plan.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 rounded-lg border bg-muted/50 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-semibold">AI Pro</p>
                <p className="text-sm text-muted-foreground">$39/month</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>20 projects</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>25 team members</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>AI Assistant & image generation</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>50 GB storage</span>
              </li>
            </ul>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
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
    </div>
  );
}
