"use client";

import { useState } from "react";
import { useProject } from "@/components/providers/ProjectProvider";
import { useMutation, useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Button } from "@/components/ui/button";
import { Plus, Edit3, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ProjectPageLayout } from "@/components/project/ProjectPageLayout";

// Mock data for demonstration - organized by rows
const mockMoodboardRows = [
  {
    id: "1",
    title: "CONCEPT",
    images: [
      {
        id: "1",
        url: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=600&fit=crop",
      },
      {
        id: "2",
        url: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=600&h=400&fit=crop",
      },
      {
        id: "3",
        url: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=400&h=500&fit=crop",
      },
      {
        id: "4",
        url: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=500&h=700&fit=crop",
      },
    ]
  },
  {
    id: "2",
    title: "DETAILS",
    images: [
      {
        id: "5",
        url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=400&fit=crop",
      },
      {
        id: "6",
        url: "https://images.unsplash.com/photo-1613977257363-707ba9348227?w=600&h=500&fit=crop",
      },
      {
        id: "7",
        url: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=300&fit=crop",
      },
      {
        id: "8",
        url: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=500&h=600&fit=crop",
      },
    ]
  }
];

interface MoodboardImage {
  id: string;
  url: string;
}

interface MoodboardRow {
  id: string;
  title: string;
  images: MoodboardImage[];
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
          folderId: undefined, // No folder for moodboard images
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
              className="w-full h-auto object-contain cursor-pointer group-hover:scale-[1.02] transition-transform duration-300 bg-white rounded-xl"
              loading="lazy"
              onClick={() => setSelectedImage(image)}
            />

            {/* Delete button - larger and more visible */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteImage(image.id);
              }}
              className="absolute top-3 right-3 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 shadow-lg"
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
  const [rows, setRows] = useState<MoodboardRow[]>(mockMoodboardRows);

  const handleUpdateTitle = (rowId: string, newTitle: string) => {
    setRows(rows.map(row =>
      row.id === rowId ? { ...row, title: newTitle } : row
    ));
  };



  const handleAddRow = () => {
    const newRow: MoodboardRow = {
      id: Date.now().toString(),
      title: "NEW SECTION",
      images: []
    };
    setRows([...rows, newRow]);
  };

  return (
    <ProjectPageLayout>
      {/* Header - cleaner, more minimal */}
      <div className="text-center py-12 bg-white border-b rounded-3xl mb-8">
        <h1 className="text-5xl font-light tracking-[0.2em] mb-3 text-gray-900">
          {project.name.toUpperCase()}
        </h1>
      </div>

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

        {/* Add New Row */}
        <div className="flex justify-center pt-16">
          <button
            onClick={handleAddRow}
            className="text-gray-600 hover:text-gray-800 text-sm tracking-wider transition-colors"
          >
            + Add New Section
          </button>
        </div>
      </div>
    </ProjectPageLayout>
  );
}