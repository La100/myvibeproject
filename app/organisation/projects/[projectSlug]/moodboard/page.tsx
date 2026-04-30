"use client";

import { type ReactNode, useCallback, useMemo, useState } from "react";
import { useProject } from "@/components/providers/ProjectProvider";
import { useMutation, useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Edit3, Trash2, Images, GripVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ProjectPageLayout } from "@/components/project/ProjectPageLayout";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

interface MoodboardImage {
  id: string;
  url: string;
  name?: string;
  order?: number;
}

interface MoodboardRow {
  id: string;
  title: string;
  order: number;
}

function MoodboardRowTitle({
  title,
  dragHandle,
  isEditing,
  onEdit,
  onSave,
  onUpload,
  isUploading,
  onDelete,
  isDeleting,
}: {
  title: string;
  dragHandle?: ReactNode;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (newTitle: string) => void;
  onUpload: () => void;
  isUploading: boolean;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const [editedTitle, setEditedTitle] = useState(title);

  const handleSave = () => {
    onSave(editedTitle);
  };

  if (isEditing) {
    return (
      <div className="mb-6 flex items-center gap-2">
        <Input
          value={editedTitle}
          onChange={(e) => setEditedTitle(e.target.value)}
          className="max-w-xs text-xl font-semibold tracking-tight"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") onEdit();
          }}
          autoFocus
        />
        <Button onClick={handleSave} size="sm">
          Save
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      {dragHandle}
      <h2 className="font-serif text-2xl font-medium tracking-[-0.035em]">
        {title}
      </h2>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onUpload}
          disabled={isUploading || isDeleting}
          className="text-xs"
        >
          <Plus className="mr-1 h-3 w-3" />
          {isUploading ? "Uploading..." : "Add images"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          disabled={isDeleting}
          className="opacity-50 transition-opacity hover:opacity-100"
        >
          <Edit3 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={isUploading || isDeleting}
          className="text-destructive opacity-50 transition-opacity hover:text-destructive hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

const moodboardSectionDropId = (sectionId: string) =>
  `moodboard-section:${sectionId}`;
const moodboardSectionDragId = (sectionId: string) =>
  `moodboard-section-drag:${sectionId}`;
const moodboardSectionSortDropId = (sectionId: string) =>
  `moodboard-section-sort:${sectionId}`;

function MoodboardImageCard({
  image,
  sectionId,
  index,
  onPreview,
  onDelete,
}: {
  image: MoodboardImage;
  sectionId: string;
  index: number;
  onPreview: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: image.id,
    data: {
      type: "moodboard-image",
      image,
      sectionId,
      index,
    },
  });
  const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({
    id: `moodboard-image:${image.id}`,
    data: {
      type: "moodboard-image-target",
      sectionId,
      index,
    },
  });
  const setNodeRef = useCallback(
    (node: HTMLDivElement | null) => {
      setDraggableNodeRef(node);
      setDroppableNodeRef(node);
    },
    [setDraggableNodeRef, setDroppableNodeRef],
  );
  const style = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative overflow-hidden border-border/70 bg-card py-0 transition-[box-shadow,transform,opacity] hover:-translate-y-0.5 hover:shadow-md",
        isDragging && "opacity-30",
        isOver && "ring-2 ring-primary/50",
      )}
    >
      <CardContent className="p-0">
        <button
          type="button"
          className="block w-full"
          onClick={onPreview}
          aria-label={image.name ? `Preview ${image.name}` : "Preview image"}
        >
          <img
            src={image.url}
            alt={image.name || ""}
            className="h-auto w-full cursor-pointer object-contain transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
          />
        </button>
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          className="absolute left-3 top-3 cursor-grab border border-border bg-card/90 opacity-0 transition-opacity duration-200 hover:bg-muted group-hover:opacity-100"
          aria-label="Drag image"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="icon-sm"
          className="absolute right-3 top-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="Delete image"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

function MoodboardImageDragPreview({ image }: { image: MoodboardImage }) {
  return (
    <div className="w-64 overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
      <img
        src={image.url}
        alt={image.name || ""}
        className="h-auto w-full object-contain"
      />
    </div>
  );
}

function MoodboardSectionShell({
  row,
  index,
  children,
}: {
  row: MoodboardRow;
  index: number;
  children: (dragHandle: ReactNode) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: moodboardSectionDragId(row.id),
    data: {
      type: "moodboard-section",
      sectionId: row.id,
      index,
    },
  });
  const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({
    id: moodboardSectionSortDropId(row.id),
    data: {
      type: "moodboard-section-drop",
      sectionId: row.id,
      index,
    },
  });
  const setNodeRef = useCallback(
    (node: HTMLDivElement | null) => {
      setDraggableNodeRef(node);
      setDroppableNodeRef(node);
    },
    [setDraggableNodeRef, setDroppableNodeRef],
  );
  const style = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
  };
  const dragHandle = (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="cursor-grab text-muted-foreground hover:text-foreground"
      aria-label="Drag section"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-4 w-4" />
    </Button>
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-2xl transition-[opacity,outline-color]",
        isDragging && "opacity-40",
        isOver && "outline outline-2 outline-primary/40",
      )}
    >
      {children(dragHandle)}
    </div>
  );
}

function MoodboardRow({
  row,
  dragHandle,
  onUpdateTitle,
  onDeleteSection,
}: {
  row: MoodboardRow;
  dragHandle?: ReactNode;
  onUpdateTitle: (rowId: string, newTitle: string) => Promise<void>;
  onDeleteSection: (row: MoodboardRow) => Promise<void>;
}) {
  const { project } = useProject();
  const [selectedImage, setSelectedImage] = useState<MoodboardImage | null>(
    null,
  );
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeletingSection, setIsDeletingSection] = useState(false);

  const sectionImages = useQuery(apiAny.files.getMoodboardImagesBySection, {
    projectId: project._id,
    section: row.id,
  });

  const generateUploadUrl = useMutation(
    apiAny.files.generateUploadUrlWithCustomKey,
  );
  const ensureMoodboardFolder = useMutation(apiAny.files.ensureMoodboardFolder);
  const addFile = useMutation(apiAny.files.addFile);
  const deleteFileByStorageId = useMutation(apiAny.files.deleteFileByStorageId);
  const { setNodeRef: setSectionDropRef, isOver: isSectionOver } =
    useDroppable({
      id: moodboardSectionDropId(row.id),
      data: {
        type: "moodboard-section-target",
        sectionId: row.id,
      },
    });

  const handleTitleSave = async (newTitle: string) => {
    await onUpdateTitle(row.id, newTitle);
    setIsEditingTitle(false);
  };

  const handleUploadClick = () => {
    if (isUploading || isDeletingSection) return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        void handleImageUpload(files);
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
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} is not an image file`);
          continue;
        }

        const uploadData = await generateUploadUrl({
          projectId: project._id,
          fileName: file.name,
          fileSize: file.size,
        });

        const response = await fetch(uploadData.url, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
          },
        });

        if (!response.ok) {
          throw new Error(
            `Upload failed: ${response.status} ${response.statusText}`,
          );
        }

        await addFile({
          projectId: project._id,
          folderId: moodboardFolderId,
          fileKey: uploadData.key,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          moodboardSection: row.id,
        });
      }

      toast.success("Images uploaded successfully");
    } catch (error) {
      toast.error("Failed to upload images", {
        description: toUserFacingErrorMessage(error),
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
        storageId: imageId,
      });
      toast.success("Image deleted successfully");
    } catch (error) {
      toast.error("Failed to delete image", {
        description: toUserFacingErrorMessage(error),
      });
    }
  };

  const handleDeleteSection = async () => {
    const imageCount = sectionImages?.length || 0;
    const confirmationMessage =
      imageCount > 0
        ? `Delete "${row.title}" and remove ${imageCount} image${imageCount === 1 ? "" : "s"} from this section?`
        : `Delete "${row.title}" section?`;

    if (!confirm(confirmationMessage)) {
      return;
    }

    setIsDeletingSection(true);
    try {
      await onDeleteSection(row);
    } finally {
      setIsDeletingSection(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <MoodboardRowTitle
        title={row.title}
        dragHandle={dragHandle}
        isEditing={isEditingTitle}
        onEdit={() => setIsEditingTitle((current) => !current)}
        onSave={(newTitle) => {
          void handleTitleSave(newTitle);
        }}
        onUpload={handleUploadClick}
        isUploading={isUploading}
        onDelete={() => {
          void handleDeleteSection();
        }}
        isDeleting={isDeletingSection}
      />

      <div
        ref={setSectionDropRef}
        className={cn(
          "grid min-h-28 grid-cols-1 gap-6 rounded-2xl transition-colors sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4",
          isSectionOver && "bg-primary/5 outline outline-2 outline-primary/30",
        )}
      >
        {(sectionImages || []).map((image, index) => (
          <MoodboardImageCard
            key={image.id}
            image={image}
            sectionId={row.id}
            index={index}
            onPreview={() => setSelectedImage(image)}
            onDelete={() => {
              void handleDeleteImage(image.id);
            }}
          />
        ))}
      </div>

      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="max-h-full max-w-6xl">
            <img
              src={selectedImage.url}
              alt=""
              className="max-h-full max-w-full object-contain"
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
  const createMoodboardSection = useMutation(
    apiAny.files.createMoodboardSection,
  );
  const renameMoodboardSection = useMutation(
    apiAny.files.renameMoodboardSection,
  );
  const deleteMoodboardSection = useMutation(
    apiAny.files.deleteMoodboardSection,
  );
  const reorderMoodboardSections = useMutation(
    apiAny.files.reorderMoodboardSections,
  );
  const moveMoodboardImage = useMutation(apiAny.files.moveMoodboardImage);
  const [activeDragImage, setActiveDragImage] =
    useState<MoodboardImage | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
  );

  const rows = useMemo(() => {
    return ((savedSections as MoodboardRow[] | undefined) || []).map(
      (section) => ({
        id: section.id,
        title: section.title,
        order: section.order,
      }),
    );
  }, [savedSections]);

  const handleUpdateTitle = async (rowId: string, newTitle: string) => {
    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) return;

    try {
      await renameMoodboardSection({
        projectId: project._id,
        sectionId: rowId,
        title: trimmedTitle,
      });
      toast.success("Section updated");
    } catch (error) {
      toast.error("Failed to update section", {
        description: toUserFacingErrorMessage(error),
      });
      throw error;
    }
  };

  const handleAddRow = async () => {
    const existingTitles = new Set(
      rows.map((row) => row.title.trim().toUpperCase()),
    );
    let nextIndex = rows.length + 1;
    let sectionLabel = `SECTION ${nextIndex}`;

    while (existingTitles.has(sectionLabel)) {
      nextIndex += 1;
      sectionLabel = `SECTION ${nextIndex}`;
    }

    try {
      await createMoodboardSection({
        projectId: project._id,
        title: sectionLabel,
      });
      toast.success("Section created");
    } catch (error) {
      toast.error("Failed to create section", {
        description: toUserFacingErrorMessage(error),
      });
    }
  };

  const handleDeleteSection = async (row: MoodboardRow) => {
    try {
      const result = await deleteMoodboardSection({
        projectId: project._id,
        sectionId: row.id,
      });

      toast.success(
        result.deletedFilesCount > 0
          ? `Section deleted with ${result.deletedFilesCount} image${result.deletedFilesCount === 1 ? "" : "s"}`
          : "Section deleted",
      );
    } catch (error) {
      toast.error("Failed to delete section", {
        description: toUserFacingErrorMessage(error),
      });
      throw error;
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const activeData = event.active.data.current as
      | { type?: string; image?: MoodboardImage }
      | undefined;
    if (activeData?.type === "moodboard-image" && activeData.image) {
      setActiveDragImage(activeData.image);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragImage(null);
    const activeData = event.active.data.current as
      | {
          type?: string;
          sectionId?: string;
          index?: number;
        }
      | undefined;
    const overData = event.over?.data.current as
      | {
          type?: string;
          sectionId?: string;
          index?: number;
        }
      | undefined;

    if (!activeData || !overData) return;

    if (
      activeData.type === "moodboard-section" &&
      overData.type === "moodboard-section-drop" &&
      activeData.sectionId &&
      overData.sectionId &&
      activeData.sectionId !== overData.sectionId
    ) {
      const currentIndex = rows.findIndex((row) => row.id === activeData.sectionId);
      const nextIndex = rows.findIndex((row) => row.id === overData.sectionId);
      if (currentIndex < 0 || nextIndex < 0) return;

      const reorderedRows = [...rows];
      const [movedRow] = reorderedRows.splice(currentIndex, 1);
      reorderedRows.splice(nextIndex, 0, movedRow);

      try {
        await reorderMoodboardSections({
          projectId: project._id,
          orderedSectionIds: reorderedRows.map((row) => row.id),
        });
      } catch (error) {
        toast.error("Failed to reorder sections", {
          description: toUserFacingErrorMessage(error),
        });
      }
      return;
    }

    if (activeData.type !== "moodboard-image") return;
    const targetSectionId = overData.sectionId;
    if (!targetSectionId) return;

    const targetIndex =
      overData.type === "moodboard-image-target" &&
      typeof overData.index === "number"
        ? overData.index
        : Number.MAX_SAFE_INTEGER;

    if (
      activeData.sectionId === targetSectionId &&
      typeof activeData.index === "number" &&
      activeData.index === targetIndex
    ) {
      return;
    }

    try {
      await moveMoodboardImage({
        projectId: project._id,
        storageId: String(event.active.id),
        targetSectionId,
        targetIndex,
      });
    } catch (error) {
      toast.error("Failed to move image", {
        description: toUserFacingErrorMessage(error),
      });
    }
  };

  return (
    <ProjectPageLayout>
      <div className="w-full">
        <ProjectPageHeader
          title="Moodboard"
          icon={<Images className="h-8 w-8 text-primary" />}
          subtitle="Curate visual references, material studies, and room direction in one calm studio board."
          tags={
            <>
              <Badge
                variant="outline"
                className="px-4 py-2 text-sm font-medium text-foreground/82"
              >
                {project.name}
              </Badge>
              <Badge
                variant="outline"
                className="border-border bg-card px-4 py-2 text-sm font-medium text-foreground"
              >
                {rows.length} sections
              </Badge>
            </>
          }
          actions={
            <Button
              onClick={() => {
                void handleAddRow();
              }}
              className="px-6 transition-transform hover:-translate-y-0.5"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Section
            </Button>
          }
        />

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragCancel={() => setActiveDragImage(null)}
          onDragEnd={(event) => {
            void handleDragEnd(event);
          }}
        >
          <div className="vibe-panel flex flex-col gap-16 p-5 sm:p-8">
            {rows.map((row, index) => (
              <MoodboardSectionShell key={row.id} row={row} index={index}>
                {(dragHandle) => (
                  <MoodboardRow
                    row={row}
                    dragHandle={dragHandle}
                    onUpdateTitle={handleUpdateTitle}
                    onDeleteSection={handleDeleteSection}
                  />
                )}
              </MoodboardSectionShell>
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeDragImage ? (
              <MoodboardImageDragPreview image={activeDragImage} />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </ProjectPageLayout>
  );
}
