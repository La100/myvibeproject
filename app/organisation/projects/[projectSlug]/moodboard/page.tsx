"use client";

import { useMemo, useState } from "react";
import { useProject } from "@/components/providers/ProjectProvider";
import { useMutation, useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Button } from "@/components/ui/button";
import { Plus, Edit3, Trash2, Images } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ProjectPageLayout } from "@/components/project/ProjectPageLayout";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";

const DEFAULT_MOODBOARD_ROWS = [
  { id: "1", title: "CONCEPT" },
  { id: "2", title: "DETAILS" },
];

const formatMoodboardSectionLabel = (section: string) => {
  const normalized = section.trim();
  if (normalized === "1") return "CONCEPT";
  if (normalized === "2") return "DETAILS";
  return normalized.toUpperCase();
};

interface MoodboardImage {
  id: string;
  url: string;
}

interface MoodboardRow {
  id: string;
  title: string;
}

function MoodboardRowTitle({ title, isEditing, onEdit, onSave, onUpload, isUploading }: {
  title: string;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (newTitle: string) => void;
  onUpload: () => void;
  isUploading: boolean;
}) {
  const [editedTitle, setEditedTitle] = useState(title);

  const handleSave = () => {
    onSave(editedTitle);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 mb-6">
        <Input
          value={editedTitle}
          onChange={(e) => setEditedTitle(e.target.value)}
          className="text-xl font-bold tracking-wider max-w-xs"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') onEdit();
          }}
          autoFocus
        />
        <Button onClick={handleSave} size="sm">Save</Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 mb-6">
      <h2 className="text-xl font-bold tracking-wider">{title}</h2>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onUpload}
          disabled={isUploading}
          className="text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          {isUploading ? 'Uploading...' : 'Add images'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="opacity-50 hover:opacity-100 transition-opacity"
        >
          <Edit3 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function MoodboardRow({ row, onUpdateTitle }: {
  row: MoodboardRow;
  onUpdateTitle: (rowId: string, newTitle: string) => void;
}) {
  const { project } = useProject();
  const [selectedImage, setSelectedImage] = useState<MoodboardImage | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Get images for this specific section
  const sectionImages = useQuery(apiAny.files.getMoodboardImagesBySection, {
    projectId: project._id,
    section: row.id
  });

  const generateUploadUrl = useMutation(apiAny.files.generateUploadUrlWithCustomKey);
  const ensureMoodboardFolder = useMutation(apiAny.files.ensureMoodboardFolder);
  const addFile = useMutation(apiAny.files.addFile);
  const deleteFileByStorageId = useMutation(apiAny.files.deleteFileByStorageId);

  const handleTitleSave = (newTitle: string) => {
    onUpdateTitle(row.id, newTitle);
    setIsEditingTitle(false);
  };

  const handleUploadClick = () => {
    if (isUploading) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        handleImageUpload(files);
      }
    };
    input.click();
  };

  const handleImageUpload = async (files: FileList) => {
    const fileArray = Array.from(files);
    if (!fileArray.length) return;

    setIsUploading(true);

    try {
      const moodboardFolderId = await ensureMoodboardFolder({
        projectId: project._id,
      });

      for (const file of fileArray) {
        // Only process image files
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} is not an image file`);
          continue;
        }

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

        // 3. Extract the file key from the URL 
        const fileKey = uploadData.key;

        // 4. Attach file to project with moodboard section
        await addFile({
          projectId: project._id,
          folderId: moodboardFolderId,
          fileKey,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          moodboardSection: row.id, // Associate with this section
        });

        // Images will appear automatically via query refresh
      }

      toast.success("Images uploaded successfully");
    } catch (error) {
      toast.error("Failed to upload images", {
        description: (error as Error).message
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm("Are you sure you want to delete this image?")) {
      return;
    }

    try {
      await deleteFileByStorageId({
        projectId: project._id,
        storageId: imageId
      });
      toast.success("Image deleted successfully");
    } catch (error) {
      toast.error("Failed to delete image", {
        description: (error as Error).message
      });
    }
  };

  return (
    <div className="space-y-6">
      <MoodboardRowTitle
        title={row.title}
        isEditing={isEditingTitle}
        onEdit={() => setIsEditingTitle(!isEditingTitle)}
        onSave={handleTitleSave}
        onUpload={handleUploadClick}
        isUploading={isUploading}
      />

      {/* Masonry grid with natural image proportions - much larger images */}
      <div className="columns-1 sm:columns-2 md:columns-2 lg:columns-3 xl:columns-3 gap-6 space-y-6">
        {/* Images with natural aspect ratios - larger and more prominent */}
        {(sectionImages || []).map((image) => (
          <div
            key={image.id}
            className="break-inside-avoid mb-4 rounded-xl overflow-hidden hover:shadow-xl transition-all duration-300 group relative"
          >
            <img
              src={image.url}
              alt=""
              className="w-full h-auto object-contain cursor-pointer group-hover:scale-[1.02] transition-transform duration-300 bg-card rounded-xl"
              loading="lazy"
              onClick={() => setSelectedImage(image)}
            />

            {/* Delete button - larger and more visible */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteImage(image.id);
              }}
              className="absolute top-3 right-3 bg-red-500 hover:bg-red-600 text-primary-foreground rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 shadow-lg"
              title="Delete image"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Image Preview Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="max-w-6xl max-h-full">
            <img
              src={selectedImage.url}
              alt=""
              className="max-w-full max-h-full object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function MoodboardPage() {
  const { project } = useProject();
  const savedSections = useQuery(
    apiAny.files.getMoodboardSections,
    project?._id ? { projectId: project._id } : "skip",
  );
  const [localRows, setLocalRows] = useState<MoodboardRow[]>([]);
  const [titleOverrides, setTitleOverrides] = useState<Record<string, string>>({});

  const persistedSectionIds = useMemo(
    () => new Set(savedSections || []),
    [savedSections],
  );

  const rows = useMemo(() => {
    const merged: MoodboardRow[] = [];
    const seen = new Set<string>();

    for (const row of DEFAULT_MOODBOARD_ROWS) {
      merged.push({
        ...row,
        title: titleOverrides[row.id] || row.title,
      });
      seen.add(row.id);
    }

    for (const section of savedSections || []) {
      if (seen.has(section)) continue;
      merged.push({
        id: section,
        title: titleOverrides[section] || formatMoodboardSectionLabel(section),
      });
      seen.add(section);
    }

    for (const row of localRows) {
      if (seen.has(row.id)) continue;
      merged.push({
        ...row,
        title: titleOverrides[row.id] || row.title,
      });
      seen.add(row.id);
    }

    return merged;
  }, [localRows, savedSections, titleOverrides]);

  const handleUpdateTitle = (rowId: string, newTitle: string) => {
    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) return;

    setLocalRows((currentRows) =>
      currentRows.map((row) => {
        if (row.id !== rowId) return row;
        const canRenameSectionKey =
          row.id !== "1" && row.id !== "2" && !persistedSectionIds.has(row.id);

        return canRenameSectionKey
          ? { id: trimmedTitle, title: trimmedTitle.toUpperCase() }
          : { ...row, title: trimmedTitle.toUpperCase() };
      }),
    );

    setTitleOverrides((current) => ({
      ...current,
      [rowId]: trimmedTitle.toUpperCase(),
    }));
  };

  const handleAddRow = () => {
    const nextIndex = rows.length + 1;
    const sectionLabel = `SECTION ${nextIndex}`;
    const newRow: MoodboardRow = {
      id: sectionLabel,
      title: sectionLabel,
    };
    setLocalRows((currentRows) => [...currentRows, newRow]);
  };

  return (
    <ProjectPageLayout>
      <ProjectPageHeader
        title="Moodboard"
        icon={<Images className="h-8 w-8 text-[var(--ui-accent-brand)]" />}
        tags={
          <>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] px-4 py-2 text-sm font-medium text-[var(--ui-accent-brand)]">
              {project.name}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] px-4 py-2 text-sm font-medium text-[var(--ui-text-main)]">
              {rows.length} sections
            </span>
          </>
        }
        actions={
          <Button
            onClick={handleAddRow}
            className="rounded-lg bg-[var(--ui-action-bg)] px-6 text-[var(--primary-foreground)] shadow-[0_14px_36px_rgba(14,14,14,0.18)] hover:bg-[var(--ui-action-hover)] transition-transform hover:-translate-y-0.5"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Section
          </Button>
        }
      />

      {/* Moodboard Content */}
      <div className="w-full">
        <div className="space-y-16">
          {rows.map((row) => (
            <MoodboardRow
              key={row.id}
              row={row}
              onUpdateTitle={handleUpdateTitle}
            />
          ))}
        </div>

      </div>
    </ProjectPageLayout>
  );
}
