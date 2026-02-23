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
import Image from "next/image";
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
import { formatDistanceToNow } from "date-fns";
import { Spinner } from "@/components/ui/spinner";
import { ProjectPageLayout } from "@/components/project/ProjectPageLayout";

export function FilesViewSkeleton() {
  return <Spinner className="p-6" />;
}

export default function FilesView() {
  const [currentFolderId, setCurrentFolderId] = useState<Id<"folders"> | undefined>(undefined);
  const [folderPath, setFolderPath] = useState<Array<{ id: Id<"folders"> | undefined, name: string }>>([]);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
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

  const hasAccess = useQuery(apiAny.projects.checkUserProjectAccess, {
    projectId: project._id,
  });

  const generateUploadUrl = useMutation(apiAny.files.generateUploadUrlWithCustomKey);
  const addFile = useMutation(apiAny.files.addFile);
  const createFolder = useMutation(apiAny.files.createFolder);
  const deleteFile = useMutation(apiAny.files.deleteFile);
  const deleteFolder = useMutation(apiAny.files.deleteFolder);
  const setFileCustomerPortalVisibility = useMutation(apiAny.files.setFileCustomerPortalVisibility);

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

  if (!project || !content || hasAccess === false || (currentFolderId && !currentFolder)) {
    // This will be handled by Suspense
    if (hasAccess === false) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You don't have permission to access this project.</p>
        </div>
      );
    }
    if (!project) {
      return <div>Project not found.</div>;
    }
    return null;
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // 1. Generate upload URL with custom folder structure
      const uploadData = await generateUploadUrl({
        projectId: project._id,
        fileName: file.name,
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
      event.target.value = ""; // Reset file input
    } catch (error) {
      toast.error("Failed to upload file", {
        description: (error as Error).message
      });
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
        description: (error as Error).message
      });
    }
  };

  const handleDeleteFile = async (fileId: Id<"files">) => {
    try {
      await deleteFile({ fileId });
      toast.success("File deleted successfully");
    } catch (error) {
      toast.error("Failed to delete file", {
        description: (error as Error).message
      });
    }
  };

  const handleDeleteFolder = async (folderId: Id<"folders">) => {
    try {
      await deleteFolder({ folderId });
      toast.success("Folder deleted successfully");
    } catch (error) {
      toast.error("Failed to delete folder", {
        description: (error as Error).message
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
        description: (error as Error).message,
      });
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

  return (
    <ProjectPageLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <h1 className="text-3xl font-bold">{project.name} - Files</h1>
            </div>

            <Breadcrumbs items={breadcrumbItems} className="mb-2" />

            <p className="font-medium text-[var(--ui-text-main)]">Organize your project files in folders</p>
          </div>

          {/* Delete folder button when inside a folder */}
          {currentFolderId && currentFolder && (
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:bg-red-50 border-red-200"
              onClick={async () => {
                await handleDeleteFolder(currentFolderId);
                // Go back to parent folder
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
          )}
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
              <div className="space-y-4">
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
            />
            <Button asChild>
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="h-4 w-4 mr-2" />
                Upload File
              </label>
            </Button>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {/* Folders */}
          {content.folders.map((folder) => (
            <Card
              key={folder._id}
              className="hover:shadow-lg transition-shadow cursor-pointer aspect-square"
              onClick={() => navigateToFolder(folder._id, folder.name)}
            >
              <CardContent className="p-4 h-full flex flex-col justify-center items-center">
                <div className="flex flex-col items-center space-y-3 text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FolderOpen className="h-8 w-8 text-blue-600" />
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
            <Card key={file._id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <div className="aspect-square bg-gray-50 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                  {isImageFile(file) && file.url ? (
                    <Image
                      src={file.url}
                      alt={file.name}
                      className="w-full h-full object-cover cursor-pointer rounded-lg"
                      width={100}
                      height={100}
                      onClick={() => setFileForPreview(file)}
                    />
                  ) : isVideoFile(file) && file.url ? (
                    <div className="relative w-full h-full cursor-pointer" onClick={() => setFileForPreview(file)}>
                      <video
                        src={file.url + "#t=0.1"}
                        className="w-full h-full object-cover rounded-lg"
                        muted
                        preload="metadata"
                      />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center rounded-lg">
                        <Play className="h-8 w-8 text-white" />
                      </div>
                    </div>
                  ) : file.fileType === "document" && file.url && file.mimeType === "application/pdf" ? (
                    <PDFThumbnail
                      url={file.url}
                      className="w-full h-full"
                      onClick={() => setFileForPreview(file)}
                    />
                  ) : (
                    <div className="text-gray-400">
                      {getFileTypeIcon(file.fileType)}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium text-sm truncate" title={file.name}>
                    {file.name}
                  </h3>

                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary" className="text-xs">
                      {isVideoFile(file) ? "video" : file.fileType}
                    </Badge>
                    {file.size > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {(file.size / 1024 / 1024).toFixed(1)}MB
                      </Badge>
                    )}
                    {file.aiPrompt && (
                      <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                        AI
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between rounded-md border border-[var(--ui-border-soft)] px-2 py-1">
                    <span className="text-xs text-muted-foreground">Customer portal</span>
                    <Switch
                      checked={file.showInClientPortal === true}
                      onCheckedChange={(checked) =>
                        void handleSetCustomerPortalVisibility(file._id, checked)
                      }
                    />
                  </div>

                  <div className="flex gap-1">
                    {file.url && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() => window.open(file.url, '_blank')}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            const a = document.createElement('a');
                            a.href = file.url!;
                            a.download = file.name;
                            a.click();
                          }}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                      onClick={() => handleDeleteFile(file._id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {content.folders.length === 0 && content.files.length === 0 && (
          <Card className="p-8 text-center">
            <div className="text-gray-400 mb-4">
              <FolderOpen className="h-12 w-12 mx-auto" />
            </div>
            <p className="font-medium text-[var(--ui-text-main)] mb-4">
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
                  <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                    AI Generated
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                {fileForPreview?.fileType} - Uploaded {fileForPreview && formatDistanceToNow(new Date(fileForPreview._creationTime), { addSuffix: true })}
              </DialogDescription>
              {fileForPreview?.aiPrompt && (
                <div className="mt-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-xs font-medium text-purple-700 mb-1">Prompt:</p>
                  <p className="text-sm text-purple-900">{fileForPreview.aiPrompt}</p>
                </div>
              )}
            </DialogHeader>
            <div className="flex-1 overflow-auto flex items-center justify-center p-2">
              {isImageFile(fileForPreview) && fileForPreview?.url && (
                <Image
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
