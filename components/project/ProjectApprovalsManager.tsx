"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Clock3, FileCheck, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { useProject } from "@/components/providers/ProjectProvider";
import { apiAny } from "@/lib/convexApiAny";
import { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ApprovalType =
  | "material"
  | "estimate"
  | "visualization"
  | "moodboard"
  | "scope"
  | "milestone"
  | "payment"
  | "other";

type ApprovalStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "commented"
  | "approved"
  | "rejected"
  | "expired";

type ApprovalRecord = {
  _id: Id<"projectApprovals">;
  type: ApprovalType;
  title: string;
  description?: string;
  status: ApprovalStatus;
  dueDate?: number;
  currentVersion: number;
  clientDecision?: "approved" | "rejected" | null;
  clientComment?: string | null;
  clientRespondentName?: string | null;
  decidedAt?: number;
  currentVersionRecord?: {
    summary?: string;
    details?: string;
    items?: string[];
    referenceIds?: string[];
  } | null;
};

type ApprovalSummary = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  drafts: number;
};

type ApprovalFormState = {
  type: ApprovalType;
  title: string;
  description: string;
  summary: string;
  details: string;
  items: string;
  referenceIds: string;
  dueDate: string;
};

const EMPTY_FORM: ApprovalFormState = {
  type: "material",
  title: "",
  description: "",
  summary: "",
  details: "",
  items: "",
  referenceIds: "",
  dueDate: "",
};

const approvalTypeLabels: Record<ApprovalType, string> = {
  material: "Material",
  estimate: "Estimate",
  visualization: "Visualization",
  moodboard: "Moodboard",
  scope: "Scope",
  milestone: "Milestone",
  payment: "Payment",
  other: "Other",
};

const statusClassNames: Record<ApprovalStatus, string> = {
  draft: "border-slate-200 bg-slate-50 text-slate-700",
  sent: "border-sky-200 bg-sky-50 text-sky-700",
  viewed: "border-indigo-200 bg-indigo-50 text-indigo-700",
  commented: "border-amber-200 bg-amber-50 text-amber-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-rose-200 bg-rose-50 text-rose-700",
  expired: "border-zinc-200 bg-zinc-50 text-zinc-700",
};

const formatDateInput = (timestamp?: number) => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return new Date(`${trimmed}T12:00:00`).getTime();
};

const buildInitialForm = (approval?: ApprovalRecord | null): ApprovalFormState => {
  if (!approval) return EMPTY_FORM;

  return {
    type: approval.type,
    title: approval.title,
    description: approval.description || "",
    summary: approval.currentVersionRecord?.summary || "",
    details: approval.currentVersionRecord?.details || "",
    items: (approval.currentVersionRecord?.items || []).join("\n"),
    referenceIds: (approval.currentVersionRecord?.referenceIds || []).join("\n"),
    dueDate: formatDateInput(approval.dueDate),
  };
};

export function ProjectApprovalsManager() {
  const { project } = useProject();
  const approvalsData = useQuery(apiAny.projectApprovals.listProjectApprovals, {
    projectId: project._id,
  }) as { items: ApprovalRecord[]; summary: ApprovalSummary | null } | undefined;

  const createApproval = useMutation(apiAny.projectApprovals.createProjectApproval);
  const updateApproval = useMutation(apiAny.projectApprovals.updateProjectApproval);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingApproval, setEditingApproval] = useState<ApprovalRecord | null>(null);
  const [form, setForm] = useState<ApprovalFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const approvals = approvalsData?.items ?? [];
  const summary = approvalsData?.summary;
  const sortedApprovals = approvals;

  const openCreateDialog = () => {
    setEditingApproval(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (approval: ApprovalRecord) => {
    setEditingApproval(approval);
    setForm(buildInitialForm(approval));
    setDialogOpen(true);
  };

  const handleSubmit = async (sendNow: boolean) => {
    if (!form.title.trim()) {
      toast.error("Approval title is required");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        type: form.type,
        title: form.title.trim(),
        description: form.description.trim() || null,
        summary: form.summary.trim() || null,
        details: form.details.trim() || null,
        items: form.items
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        referenceIds: form.referenceIds
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        dueDate: parseDateInput(form.dueDate) ?? null,
        sendNow,
      };

      if (editingApproval) {
        await updateApproval({
          approvalId: editingApproval._id,
          ...payload,
        });
        toast.success(sendNow ? "Approval updated and sent" : "Approval updated");
      } else {
        await createApproval({
          projectId: project._id,
          ...payload,
        });
        toast.success(sendNow ? "Approval created and sent" : "Approval draft created");
      }

      setDialogOpen(false);
      setEditingApproval(null);
      setForm(EMPTY_FORM);
    } catch (error) {
      toast.error("Failed to save approval", {
        description: (error as Error).message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickSend = async (approval: ApprovalRecord) => {
    try {
      await updateApproval({
        approvalId: approval._id,
        sendNow: true,
      });
      toast.success("Approval sent");
    } catch (error) {
      toast.error("Failed to send approval", {
        description: (error as Error).message,
      });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Client approvals</h2>
          <p className="text-sm text-muted-foreground">
            Send formal approval requests for materials, estimates, moodboards and other decisions.
          </p>
        </div>
        <Button type="button" onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          New approval
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary?.pending || 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary?.approved || 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary?.rejected || 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Drafts</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary?.drafts || 0}</CardContent>
        </Card>
      </div>

      {sortedApprovals.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No approval requests yet. Create your first formal client decision request here.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedApprovals.map((approval) => (
            <Card key={approval._id}>
              <CardContent className="space-y-4 p-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={statusClassNames[approval.status]}>
                        {approval.status.replace("_", " ")}
                      </Badge>
                      <Badge variant="secondary">{approvalTypeLabels[approval.type]}</Badge>
                      <Badge variant="outline">v{approval.currentVersion}</Badge>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">{approval.title}</h3>
                      {approval.description ? (
                        <p className="mt-1 text-sm text-muted-foreground">{approval.description}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {approval.status === "draft" ? (
                      <Button type="button" variant="outline" onClick={() => void handleQuickSend(approval)}>
                        <Send className="mr-2 h-4 w-4" />
                        Send
                      </Button>
                    ) : null}
                    <Button type="button" variant="outline" onClick={() => openEditDialog(approval)}>
                      Edit
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                  <div className="rounded-2xl border p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Summary</p>
                    <p className="mt-2 text-sm text-foreground">
                      {approval.currentVersionRecord?.summary || "No short summary provided"}
                    </p>
                  </div>
                  <div className="rounded-2xl border p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Due date</p>
                    <p className="mt-2 text-sm text-foreground">
                      {approval.dueDate ? new Date(approval.dueDate).toLocaleDateString() : "No deadline"}
                    </p>
                  </div>
                  <div className="rounded-2xl border p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Client response</p>
                    <p className="mt-2 text-sm text-foreground">
                      {approval.clientDecision
                        ? `${approval.clientDecision} by ${approval.clientRespondentName || "client"}`
                        : "Awaiting decision"}
                    </p>
                  </div>
                </div>

                {approval.currentVersionRecord?.items?.length ? (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Requested items</p>
                    <div className="flex flex-wrap gap-2">
                      {approval.currentVersionRecord.items.map((item) => (
                        <Badge key={item} variant="secondary">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

                {approval.currentVersionRecord?.details ? (
                  <div className="rounded-2xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                    {approval.currentVersionRecord.details}
                  </div>
                ) : null}

                {approval.clientComment ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    <div className="flex items-center gap-2 font-medium">
                      <Clock3 className="h-4 w-4" />
                      Client comment
                    </div>
                    <p className="mt-2">{approval.clientComment}</p>
                    {approval.decidedAt ? (
                      <p className="mt-2 text-xs">
                        {new Date(approval.decidedAt).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingApproval ? "Edit approval request" : "New approval request"}</DialogTitle>
            <DialogDescription>
              Build a formal approval package that the client can approve or reject from the portal.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, type: value as ApprovalType }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(approvalTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="approval-due-date">Decision deadline</Label>
              <Input
                id="approval-due-date"
                type="date"
                value={form.dueDate}
                onChange={(event) =>
                  setForm((current) => ({ ...current, dueDate: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="approval-title">Title</Label>
              <Input
                id="approval-title"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="e.g. Approve kitchen worktop variant"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="approval-description">Description</Label>
              <Textarea
                id="approval-description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
                rows={2}
                placeholder="Short context shown on the team side"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="approval-summary">Client-facing summary</Label>
              <Textarea
                id="approval-summary"
                value={form.summary}
                onChange={(event) =>
                  setForm((current) => ({ ...current, summary: event.target.value }))
                }
                rows={2}
                placeholder="What exactly the client should decide"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="approval-details">Details</Label>
              <Textarea
                id="approval-details"
                value={form.details}
                onChange={(event) =>
                  setForm((current) => ({ ...current, details: event.target.value }))
                }
                rows={4}
                placeholder="Explain options, constraints, risks or consequences"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="approval-items">Items</Label>
              <Textarea
                id="approval-items"
                value={form.items}
                onChange={(event) =>
                  setForm((current) => ({ ...current, items: event.target.value }))
                }
                rows={4}
                placeholder={"One item per line\nEgger Oak\nQuartz White"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="approval-reference-ids">Reference IDs</Label>
              <Textarea
                id="approval-reference-ids"
                value={form.referenceIds}
                onChange={(event) =>
                  setForm((current) => ({ ...current, referenceIds: event.target.value }))
                }
                rows={4}
                placeholder={"One reference per line\nshopping:item-123\nestimation:abc"}
              />
            </div>
          </div>

          <DialogFooter className="justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileCheck className="h-4 w-4" />
              Saving an update creates a new version of the request.
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="outline" onClick={() => void handleSubmit(false)} disabled={submitting}>
                Save draft
              </Button>
              <Button onClick={() => void handleSubmit(true)} disabled={submitting}>
                {submitting ? "Saving..." : "Save and send"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
