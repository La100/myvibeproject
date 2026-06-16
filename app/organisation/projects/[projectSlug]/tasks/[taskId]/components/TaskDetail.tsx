"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Id } from "@/convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Paperclip, File as FileIcon, Upload } from "lucide-react";
import { useState } from "react";
import TaskEditor from "@/components/ui/advanced-editor/TaskEditor";
import TaskDetailSidebar from "./TaskDetailSidebar";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import ActivityLog from "@/components/dashboard/ActivityLog";
import { ProjectPageLayout } from "@/components/project/ProjectPageLayout";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";
import { useProject } from "@/components/providers/ProjectProvider";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";
import { useI18n } from "@/lib/i18n";

type TaskPriority = "low" | "medium" | "high" | "urgent" | null;

const priorityTone: Record<Exclude<TaskPriority, null>, "secondary" | "outline" | "default" | "destructive"> = {
  low: "secondary",
  medium: "outline",
  high: "default",
  urgent: "destructive",
};

const statusTone: Record<string, "secondary" | "outline"> = {
  todo: "secondary",
  in_progress: "outline",
  review: "outline",
  completed: "secondary",
};

export default function TaskDetail() {
  const { t } = useI18n();
  const params = useParams<{ projectSlug: string; taskId: string }>();
  const router = useRouter();
  const { user, isLoaded: isUserLoaded } = useUser();
  const { project } = useProject();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [newComment, setNewComment] = useState("");

  const task = useQuery(
    apiAny.tasks.getTask,
    params.taskId ? { taskId: params.taskId as Id<"tasks"> } : "skip",
  );

  const comments = useQuery(
    apiAny.comments.getCommentsForTask,
    task ? { taskId: task._id } : "skip",
  );

  const files = useQuery(
    apiAny.files.getFilesForTask,
    task ? { taskId: task._id } : "skip",
  );

  const generateUploadUrl = useMutation(
    apiAny.files.generateUploadUrlWithCustomKey,
  );
  const addFile = useMutation(apiAny.files.addFile);
  const updateTask = useMutation(apiAny.tasks.updateTask);
  const addComment = useMutation(apiAny.comments.addComment);

  if (
    !isUserLoaded ||
    task === undefined
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner />
      </div>
    );
  }

  if (!user || !task || !project) {
    return (
      <ProjectPageLayout>
        <div className="flex flex-col gap-6">
          <ProjectPageHeader
            title={t("taskDetail", "taskUnavailable")}
            actions={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="mr-1 h-5 w-5 stroke-[2.4]" />
                {t("taskDetail", "backToTasks")}
              </Button>
            }
          />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Empty className="border-border bg-background">
              <EmptyHeader>
                <EmptyTitle>{t("taskDetail", "taskNotFound")}</EmptyTitle>
                <EmptyDescription>
                  {t("taskDetail", "taskNotFoundDescription")}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        </div>
      </ProjectPageLayout>
    );
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { url, key } = await generateUploadUrl({
        projectId: project._id,
        taskId: task._id,
        fileName: file.name,
        fileSize: file.size,
      });

      const result = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!result.ok) {
        throw new Error(`Upload failed: ${await result.text()}`);
      }

      await addFile({
        projectId: project._id,
        taskId: task._id,
        fileKey: key,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      });

      toast.success(t("taskDetail", "fileUploadedSuccessfully"));
    } catch (error) {
      toast.error(t("taskDetail", "errorUploadingFile"), {
        description: toUserFacingErrorMessage(error),
      });
      console.error(error);
    } finally {
      input.value = "";
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !task) return;

    try {
      await addComment({
        taskId: task._id,
        content: newComment.trim(),
      });
      setNewComment("");
      toast.success(t("taskDetail", "commentAddedSuccessfully"));
    } catch {
      toast.error(t("taskDetail", "errorAddingComment"));
    }
  };

  const handleDeleteTask = () => {
    router.back();
  };

  const handleTitleUpdate = async () => {
    if (!titleValue.trim() || titleValue === task.title) {
      setIsEditingTitle(false);
      setTitleValue("");
      return;
    }

    try {
      await updateTask({
        taskId: task._id,
        title: titleValue.trim(),
      });
      toast.success(t("taskDetail", "titleUpdatedSuccessfully"));
      setIsEditingTitle(false);
      setTitleValue("");
    } catch {
      toast.error(t("taskDetail", "errorUpdatingTitle"));
    }
  };

  const startEditingTitle = () => {
    setTitleValue(task.title);
    setIsEditingTitle(true);
  };

  return (
    <ProjectPageLayout>
      <div className="flex flex-col gap-6">
        <ProjectPageHeader
          title={task.title}
          subtitle={project.name}
          actions={
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="mr-1 h-5 w-5 stroke-[2.4]" />
                {t("taskDetail", "backToTasks")}
              </Button>
              {task.priority && task.priority !== null && (
                <Badge
                  variant={priorityTone[task.priority as Exclude<TaskPriority, null>]}
                >
                  {t("taskDetail", task.priority)}
                </Badge>
              )}
              <Badge
                variant={statusTone[task.status] ?? "outline"}
              >
                {project.taskStatusSettings?.[task.status]?.name || task.status}
              </Badge>
            </div>
          }
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Main content */}
            <div className="lg:col-span-3 flex flex-col gap-8">
              {/* Editable Title */}
              {isEditingTitle ? (
                <div className="mb-4">
                  <Input
                    value={titleValue}
                    onChange={(e) => setTitleValue(e.target.value)}
                    onBlur={handleTitleUpdate}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleTitleUpdate();
                      } else if (e.key === "Escape") {
                        setIsEditingTitle(false);
                        setTitleValue("");
                      }
                    }}
                    className="text-3xl font-bold bg-transparent border-none p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("taskDetail", "titleEditHint")}
                  </p>
                </div>
              ) : (
                <h1
                  className="mb-2 cursor-pointer rounded-md p-2 -m-2 text-3xl font-bold text-foreground transition-colors hover:bg-muted"
                  onClick={startEditingTitle}
                  title={t("taskDetail", "clickToEditTitle")}
                >
                  {task.title}
                </h1>
              )}

              <div className="max-w-none">
                <TaskEditor
                  taskId={params.taskId}
                  initialContent={task.content || task.description || ""}
                  placeholder={t("taskDetail", "editorPlaceholder")}
                />
              </div>

              {/* Attachments Section */}
              <div>
                <h2 className="mb-4 flex items-center text-2xl font-bold text-foreground">
                  <Paperclip className="mr-2 h-6 w-6" />
                  {t("taskDetail", "attachments")}
                </h2>
                <div className="flex flex-col gap-4 rounded-lg border bg-background p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {files?.map(
                      (file: {
                        _id: Id<"files">;
                        url: string | null;
                        name: string;
                      }) =>
                        file.url ? (
                          <a
                            key={file._id}
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-secondary/70 hover:bg-secondary p-3 rounded-md flex items-center gap-3 transition-colors"
                          >
                            <FileIcon className="h-6 w-6 text-muted-foreground" />
                            <span className="text-sm font-medium truncate flex-1">
                              {file.name}
                            </span>
                          </a>
                        ) : (
                          <div
                            key={file._id}
                            className="bg-secondary/70 border border-dashed p-3 rounded-md flex items-center gap-3 text-muted-foreground"
                          >
                            <FileIcon className="h-6 w-6" />
                            <div className="min-w-0 flex-1">
                              <span className="block text-sm font-medium truncate">
                                {file.name}
                              </span>
                              <span className="text-xs">
                                {t("taskDetail", "fileLinkUnavailable")}
                              </span>
                            </div>
                          </div>
                        ),
                    )}
                  </div>
                  {files?.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      {t("taskDetail", "noAttachmentsYet")}
                    </p>
                  )}
                  <Button
                    asChild
                    variant="outline"
                    className="w-full cursor-pointer"
                  >
                    <label>
                      <Upload className="mr-2 h-4 w-4" />
                      {t("taskDetail", "addFile")}
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </label>
                  </Button>
                </div>
              </div>

              {/* Comments Section */}
              <div>
                <h2 className="mb-4 text-2xl font-bold text-foreground">
                  {t("taskDetail", "comments")}
                </h2>
                <div className="flex flex-col gap-6">
                  {/* Add comment form */}
                  <div className="flex items-start gap-4">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.imageUrl} />
                      <AvatarFallback>
                        {user.firstName?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <Textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder={t("taskDetail", "addCommentPlaceholder")}
                        className="mb-2 bg-background"
                      />
                      <Button
                        onClick={handleAddComment}
                        disabled={!newComment.trim()}
                      >
                        {t("taskDetail", "addComment")}
                      </Button>
                    </div>
                  </div>

                  {/* Comments list */}
                  {comments?.map((comment) => (
                    <div
                      key={comment._id}
                      className="flex items-start gap-4"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={comment.authorImageUrl} />
                        <AvatarFallback>
                          {comment.authorName?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 bg-background rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-foreground">
                            {comment.authorName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(comment._creationTime).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:hidden">
                <TaskDetailSidebar
                  task={task}
                  project={project}
                  onDelete={handleDeleteTask}
                  className="static top-auto"
                />
              </div>

              {/* Activity Log Section */}
              <div>
                <h2 className="mb-4 text-2xl font-bold text-foreground">
                  {t("taskDetail", "activityLog")}
                </h2>
                <div className="bg-background rounded-lg border p-4">
                  <ActivityLog taskId={task._id} />
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="hidden lg:col-span-2 lg:block">
              <TaskDetailSidebar
                task={task}
                project={project}
                onDelete={handleDeleteTask}
              />
            </div>
          </div>
        </div>
      </div>
    </ProjectPageLayout>
  );
}
