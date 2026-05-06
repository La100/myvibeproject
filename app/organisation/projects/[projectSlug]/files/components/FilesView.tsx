/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Id } from "@/convex/_generated/dataModel";
import { useProject } from "@/components/providers/ProjectProvider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import PDFThumbnail from "@/components/ui/PDFThumbnail";
import PDFViewer from "@/components/ui/PDFViewer";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import {
  Upload,
  Image as ImageIcon,
  FileText,
  Trash2,
  Download,
  Eye,
  FolderOpen,
  FolderPlus,
  Play
} from "lucide-react";

import { toast } from "sonner";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";
import { formatDistanceToNow } from "date-fns";
import { Spinner } from "@/components/ui/spinner";
import { ProjectPageLayout } from "@/components/project/ProjectPageLayout";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";

export function FilesViewLoading() {
  return <Spinner className="p-6" />;
}

export default function FilesView() {
  const [currentFolderId, setCurrentFolderId] = useState<Id<"folders"> | undefined>(undefined);
  const [folderPath, setFolderPath] = useState<Array<{ id: Id<"folders"> | undefined, name: string }>>([]);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);
  const [aiKnowledgeBusyFileId, setAiKnowledgeBusyFileId] = useState<Id<"files"> | null>(null);
  const [fileForPreview, setFileForPreview] = useState<{
    _id: string;
    name: string;
    fileType: string;
    url: string | null;
    _creationTime: number;
    mimeType: string;
    origin?: "ai" | "general";
    aiPrompt?: string;
  } | null>(null);

  const { project } = useProject();

  const content = useQuery(apiAny.files.getProjectContent, {
    projectId: project._id,
    folderId: currentFolderId
  });

  const currentFolder = useQuery(
    apiAny.files.getFolder,
    currentFolderId ? { folderId: currentFolderId } : "skip"
  );

  const generateUploadUrl = useMutation(apiAny.files.generateUploadUrlWithCustomKey);
  const addFile = useMutation(apiAny.files.addFile);
  const createFolder = useMutation(apiAny.files.createFolder);
  const deleteFile = useMutation(apiAny.files.deleteFile);
  const deleteFolder = useMutation(apiAny.files.deleteFolder);
  const setFileCustomerPortalVisibility = useMutation(apiAny.files.setFileCustomerPortalVisibility);
  const setFileAiKnowledgeInclusion = useMutation(apiAny.files.setFileAiKnowledgeInclusion);

  // Navigation functions
  const navigateToFolder = (folderId: Id<"folders"> | undefined, folderName: string) => {
    setCurrentFolderId(folderId);

    if (folderId === undefined) {
      // Going to root
      setFolderPath([]);
    } else {
      // Find if folder is already in path (going back)
      const existingIndex = folderPath.findIndex(f => f.id === folderId);
      if (existingIndex >= 0) {
        // Going back to a parent folder
        setFolderPath(folderPath.slice(0, existingIndex + 1));
      } else {
        // Going deeper into a new folder
        setFolderPath([...folderPath, { id: folderId, name: folderName }]);
      }
    }
  };

  const navigateToBreadcrumb = (index: number) => {
    if (index === 0) {
      // Going to root
      navigateToFolder(undefined, "Files");
    } else {
      const targetFolder = folderPath[index - 1];
      if (targetFolder) {
        navigateToFolder(targetFolder.id, targetFolder.name);
      }
    }
  };

  // Build breadcrumbs
  const breadcrumbItems = [
    {
      name: "Files",
      onClick: () => navigateToBreadcrumb(0)
    },
    ...folderPath.map((folder, index) => ({
      id: folder.id,
      name: folder.name,
      onClick: index < folderPath.length - 1 ? () => navigateToBreadcrumb(index + 1) : undefined
    }))
  ];

  if (!project || !content || (currentFolderId && !currentFolder)) {
    if (!project) {
      return <div>Project not found.</div>;
    }
    return null;
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingFile(true);
    setUploadingFileName(file.name);
    try {
      // 1. Generate upload URL with custom folder structure
      const uploadData = await generateUploadUrl({
        projectId: project._id,
        fileName: file.name,
        fileSize: file.size,
      });

      // 2. Upload file to R2 using the presigned URL
      const response = await fetch(uploadData.url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }

      // 3. Extract the file key from the URL (everything after the last slash and before query params)
      const fileKey = uploadData.key;

      // 4. Attach file to project
      await addFile({
        projectId: project._id,
        folderId: currentFolderId,
        fileKey,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      });

      toast.success("File uploaded successfully");
    } catch (error) {
      toast.error("Failed to upload file", {
        description: toUserFacingErrorMessage(error)
      });
    } finally {
      setIsUploadingFile(false);
      setUploadingFileName(null);
      event.target.value = ""; // Reset file input
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      await createFolder({
        projectId: project._id,
        name: newFolderName.trim(),
        parentFolderId: currentFolderId,
      });

      toast.success("Folder created successfully");
      setNewFolderName("");
      setShowCreateFolder(false);
    } catch (error) {
      toast.error("Failed to create folder", {
        description: toUserFacingErrorMessage(error)
      });
    }
  };

  const handleDeleteFile = async (fileId: Id<"files">) => {
    try {
      await deleteFile({ fileId });
      toast.success("File deleted successfully");
    } catch (error) {
      toast.error("Failed to delete file", {
        description: toUserFacingErrorMessage(error)
      });
    }
  };

  const handleDeleteFolder = async (folderId: Id<"folders">) => {
    try {
      await deleteFolder({ folderId });
      toast.success("Folder deleted successfully");
    } catch (error) {
      toast.error("Failed to delete folder", {
        description: toUserFacingErrorMessage(error)
      });
    }
  };

  const handleSetCustomerPortalVisibility = async (
    fileId: Id<"files">,
    showInClientPortal: boolean
  ) => {
    try {
      await setFileCustomerPortalVisibility({ fileId, showInClientPortal });
      toast.success(
        showInClientPortal
          ? "File is now visible in customer portal"
          : "File hidden from customer portal"
      );
    } catch (error) {
      toast.error("Failed to update customer portal visibility", {
        description: toUserFacingErrorMessage(error),
      });
    }
  };

  const handleSetAiKnowledgeInclusion = async (
    fileId: Id<"files">,
    enabled: boolean,
  ) => {
    setAiKnowledgeBusyFileId(fileId);
    try {
      await setFileAiKnowledgeInclusion({ fileId, enabled });
      toast.success(
        enabled
          ? "File added to AI knowledge"
          : "File removed from AI knowledge",
      );
    } catch (error) {
      toast.error("Failed to update AI knowledge", {
        description: toUserFacingErrorMessage(error),
      });
    } finally {
      setAiKnowledgeBusyFileId(null);
    }
  };

  const getFileTypeIcon = (fileType: string) => {
    if (fileType === "image") return <ImageIcon className="h-8 w-8" />;
    if (fileType === "video") return <Play className="h-8 w-8" />;
    if (fileType === "document") return <FileText className="h-8 w-8" />;
    return <FileText className="h-8 w-8" />;
  };

  const isVideoFile = (file: { fileType?: string; mimeType?: string } | null) => {
    if (!file) return false;
    return file.fileType === "video" || file.mimeType?.startsWith("video/");
  };

  const isImageFile = (file: { fileType?: string; mimeType?: string } | null) => {
    if (!file) return false;
    return (file.fileType === "image" || file.mimeType?.startsWith("image/")) && !isVideoFile(file);
  };

  const isPdfFile = (file: { name?: string; mimeType?: string } | null) => {
    if (!file) return false;
    return file.mimeType === "application/pdf" || file.name?.toLowerCase().endsWith(".pdf") === true;
  };

  const getAiKnowledgeBadgeVariant = (status?: string) => {
    if (status === "failed") return "destructive" as const;
    if (status === "pending") return "outline" as const;
    return "secondary" as const;
  };

  const getAiKnowledgeStatusText = (file: Record<string, unknown>) => {
    if (aiKnowledgeBusyFileId === file._id) {
      return "Updating AI knowledge status...";
    }

    if (file.aiKnowledgeEnabled !== true) {
      return null;
    }

    if (file.aiKnowledgeStatus === "pending") {
      return "Indexing document for AI search...";
    }

    if (file.aiKnowledgeStatus === "failed") {
      return "AI indexing failed.";
    }

    if (typeof file.aiKnowledgeIndexedAt === "number") {
      return `Indexed ${formatDistanceToNow(new Date(file.aiKnowledgeIndexedAt), { addSuffix: true })}`;
    }

    return "Indexed and ready for AI search.";
  };

  return (
    <ProjectPageLayout>
      <div>
        <div className="mb-6">
          <ProjectPageHeader
            title="Files"
            icon={<FolderOpen className="h-8 w-8 text-primary" />}
            actions={
              currentFolderId && currentFolder ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-destructive/30 text-destructive hover:bg-destructive/10"
                  onClick={async () => {
                    await handleDeleteFolder(currentFolderId);
                    if (folderPath.length > 1) {
                      const parentFolder = folderPath[folderPath.length - 2];
                      navigateToFolder(parentFolder.id, parentFolder.name);
                    } else {
                      navigateToFolder(undefined, "Files");
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Folder
                </Button>
              ) : undefined
            }
          />

          <Breadcrumbs items={breadcrumbItems} className="mb-2" />
        </div>

        {/* Actions */}
        <div className="flex gap-4 mb-6">
          <Dialog open={showCreateFolder} onOpenChange={setShowCreateFolder}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FolderPlus className="h-4 w-4 mr-2" />
                New Folder
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Folder</DialogTitle>
                <DialogDescription>
                  Create a new folder to organize your files.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <Input
                  placeholder="Folder name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowCreateFolder(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
                    Create Folder
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <div className="relative">
            <input
              type="file"
              onChange={handleFileUpload}
              accept="image/*,video/*,application/pdf,.dwg,.dxf,.doc,.docx,.mp4,.avi,.mov,.wmv,.flv,.webm,.mkv"
              className="absolute inset-0 opacity-0 cursor-pointer"
              id="file-upload"
              disabled={isUploadingFile}
            />
            <Button asChild disabled={isUploadingFile}>
              <label
                htmlFor="file-upload"
                className={isUploadingFile ? "cursor-not-allowed" : "cursor-pointer"}
              >
                {isUploadingFile ? <Spinner fullHeight={false} className="py-0 mr-2" iconClassName="size-4" /> : <Upload className="h-4 w-4 mr-2" />}
                {isUploadingFile ? "Uploading..." : "Upload File"}
              </label>
            </Button>
          </div>
        </div>

        {isUploadingFile && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-border/70 bg-secondary/70 px-4 py-3 text-sm text-muted-foreground">
            <Spinner fullHeight={false} className="py-0" iconClassName="size-4" />
            <span>
              Uploading {uploadingFileName ? `"${uploadingFileName}"` : "file"}.
              Larger files can take a while.
            </span>
          </div>
        )}

        {/* Content Grid */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-5">
          {/* Folders */}
          {content.folders.map((folder) => (
            <Card
              key={folder._id}
              className="aspect-square border-border/70 bg-card shadow-sm transition-shadow hover:shadow-lg cursor-pointer"
              onClick={() => navigateToFolder(folder._id, folder.name)}
            >
              <CardContent className="p-4 h-full flex flex-col justify-center items-center">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/70 text-primary">
                    <FolderOpen className="h-8 w-8" />
                  </div>
                  <h3 className="font-medium text-sm leading-tight truncate w-full" title={folder.name}>
                    {folder.name}
                  </h3>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Files */}
          {content.files.map((file) => (
            <Card
              key={file._id}
              className="group overflow-hidden border-border/70 bg-card py-0 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
            >
              <CardContent className="p-3 sm:p-4">
                <div className="relative mb-3">
                  <div className="flex aspect-[5/4] items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-secondary/70">
                    {isImageFile(file) && file.url ? (
                      <img
                        src={file.url}
                        alt={file.name}
                        className="h-full w-full cursor-pointer object-cover"
                        width={100}
                        height={100}
                        onClick={() => setFileForPreview(file)}
                      />
                    ) : isVideoFile(file) && file.url ? (
                      <div
                        className="relative h-full w-full cursor-pointer"
                        onClick={() => setFileForPreview(file)}
                      >
                        <video
                          src={file.url + "#t=0.1"}
                          className="h-full w-full object-cover"
                          muted
                          preload="metadata"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                          <Play className="h-8 w-8 text-background" />
                        </div>
                      </div>
                    ) : file.fileType === "document" && file.url && file.mimeType === "application/pdf" ? (
                      <PDFThumbnail
                        url={file.url}
                        className="h-full w-full rounded-xl"
                        onClick={() => setFileForPreview(file)}
                      />
                    ) : (
                      <div className="text-muted-foreground">
                        {getFileTypeIcon(file.fileType)}
                      </div>
                    )}
                  </div>

                  {file.url && (
                    <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-border/80 bg-card p-1 opacity-100 shadow-sm backdrop-blur-sm sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                      <Button
                        size="icon-xs"
                        variant="outline"
                        className="rounded-full bg-card"
                        onClick={() => window.open(file.url, "_blank")}
                        aria-label={`Preview ${file.name}`}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="outline"
                        className="rounded-full bg-card"
                        onClick={() => {
                          const a = document.createElement("a");
                          a.href = file.url!;
                          a.download = file.name;
                          a.click();
                        }}
                        aria-label={`Download ${file.name}`}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <h3 className="line-clamp-2 text-sm font-semibold leading-snug" title={file.name}>
                    {file.name}
                  </h3>

                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="bg-secondary/80 text-[11px]">
                      {isVideoFile(file) ? "video" : file.fileType}
                    </Badge>
                    {file.size > 0 && (
                      <Badge variant="outline" className="text-[11px]">
                        {(file.size / 1024 / 1024).toFixed(1)}MB
                      </Badge>
                    )}
                    {file.aiPrompt && (
                      <Badge variant="secondary" className="text-[11px]">
                        AI
                      </Badge>
                    )}
                    {isPdfFile(file) && file.aiKnowledgeEnabled === true && (
                      <Badge
                        variant={getAiKnowledgeBadgeVariant(file.aiKnowledgeStatus)}
                        className="text-[11px]"
                      >
                        {file.aiKnowledgeStatus === "pending"
                          ? "AI pending"
                          : file.aiKnowledgeStatus === "failed"
                            ? "AI failed"
                            : "AI knowledge"}
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-secondary/70 p-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="whitespace-nowrap text-xs font-medium text-foreground/80">Customer portal</span>
                      <Switch
                        checked={file.showInClientPortal === true}
                        onCheckedChange={(checked) =>
                          void handleSetCustomerPortalVisibility(file._id, checked)
                        }
                      />
                    </div>
                    {isPdfFile(file) && (
                      <>
                        <div className="h-px bg-border/70" />
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-foreground/80">
                            {aiKnowledgeBusyFileId === file._id
                              ? "AI knowledge updating..."
                              : "AI knowledge"}
                          </span>
                          <Switch
                            checked={file.aiKnowledgeEnabled === true}
                            disabled={aiKnowledgeBusyFileId === file._id}
                            onCheckedChange={(checked) =>
                              void handleSetAiKnowledgeInclusion(file._id, checked)
                            }
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {isPdfFile(file) && getAiKnowledgeStatusText(file) && (
                    <p
                      className={`text-xs ${
                        file.aiKnowledgeStatus === "failed"
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }`}
                    >
                      {getAiKnowledgeStatusText(file)}
                    </p>
                  )}

                  {isPdfFile(file) && file.aiKnowledgeError && (
                    <p className="text-xs text-destructive">
                      {file.aiKnowledgeError}
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <p className="text-[11px] text-muted-foreground">
                      Uploaded {formatDistanceToNow(new Date(file._creationTime), { addSuffix: true })}
                    </p>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteFile(file._id)}
                      aria-label={`Delete ${file.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {content.folders.length === 0 && content.files.length === 0 && (
          <Card className="border-border/70 bg-card p-8 text-center shadow-sm">
            <div className="mb-4 text-muted-foreground">
              <FolderOpen className="h-12 w-12 mx-auto" />
            </div>
            <p className="mb-4 font-medium text-foreground">
              This folder is empty. Create a folder or upload files to get started.
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => setShowCreateFolder(true)}>
                <FolderPlus className="h-4 w-4 mr-2" />
                Create Folder
              </Button>
              <Button asChild>
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload File
                </label>
              </Button>
            </div>
          </Card>
        )}

        {/* File Preview Dialog */}
        <Dialog open={!!fileForPreview} onOpenChange={() => setFileForPreview(null)}>
          <DialogContent className="!max-w-[95vw] !max-h-[95vh] !w-[95vw] !h-[95vh] flex flex-col p-0">
            <DialogHeader className="p-6 pb-2">
              <DialogTitle className="flex items-center gap-2">
                {fileForPreview?.name}
                {fileForPreview?.aiPrompt && (
                  <Badge variant="secondary" className="text-xs">
                    AI Generated
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                {fileForPreview?.fileType} - Uploaded {fileForPreview && formatDistanceToNow(new Date(fileForPreview._creationTime), { addSuffix: true })}
              </DialogDescription>
              {fileForPreview?.aiPrompt && (
                <div className="mt-3 rounded-2xl border border-border/70 bg-secondary/70 p-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Prompt:</p>
                  <p className="text-sm text-foreground">{fileForPreview.aiPrompt}</p>
                </div>
              )}
            </DialogHeader>
            <div className="flex-1 overflow-auto flex items-center justify-center p-2">
              {isImageFile(fileForPreview) && fileForPreview?.url && (
                <img
                  src={fileForPreview.url}
                  alt={fileForPreview.name}
                  className="max-w-full max-h-full object-contain"
                  width={1200}
                  height={1200}
                />
              )}
              {isVideoFile(fileForPreview) && fileForPreview?.url && (
                <video
                  src={fileForPreview.url}
                  controls
                  className="max-w-full max-h-full"
                  preload="metadata"
                >
                  Your browser does not support the video tag.
                </video>
              )}
              {fileForPreview?.fileType === 'document' && fileForPreview?.url && fileForPreview?.mimeType === 'application/pdf' && (
                <div className="w-full h-full">
                  <PDFViewer
                    url={fileForPreview.url}
                    fileName={fileForPreview.name}
                  />
                </div>
              )}
              {fileForPreview?.fileType === 'document' && fileForPreview?.url && fileForPreview?.mimeType !== 'application/pdf' && (
                <iframe
                  src={`https://docs.google.com/gview?url=${encodeURIComponent(fileForPreview.url)}&embedded=true`}
                  className="w-full h-full min-h-[70vh]"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ProjectPageLayout>
  );
}
