"use client";
/**
 * useFileUpload Hook
 * 
 * Manages file selection and upload state for the AI Assistant.
 * Supports multiple file uploads.
 */

import { useState, useRef, useCallback, type ChangeEvent } from "react";
import { toast } from "sonner";
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from "../../config/constants";
const MAX_FILES = 10; // Maximum number of files allowed

export const useFileUpload = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedFileIds, setUploadedFileIds] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: File[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > MAX_FILE_SIZE_BYTES) {
        errors.push(`${file.name} is too large (max ${MAX_FILE_SIZE_MB}MB)`);
        continue;
      }
      newFiles.push(file);
    }

    if (errors.length > 0) {
      toast.error(errors.join(", "));
    }

    if (newFiles.length > 0) {
      setSelectedFiles((prev) => {
        const combined = [...prev, ...newFiles];
        if (combined.length > MAX_FILES) {
          toast.warning(`Maximum ${MAX_FILES} files allowed`);
          return combined.slice(0, MAX_FILES);
        }
        return combined;
      });
    }

    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setUploadedFileIds((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleAttachmentClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return {
    selectedFiles,
    setSelectedFiles,
    uploadedFileIds,
    isUploading,
    handleFileSelect,
    handleRemoveFile,
    handleAttachmentClick,
    fileInputRef,
    // Expose setters for parent component to control
    setUploadedFileIds: (ids: string[]) => setUploadedFileIds(ids),
    setIsUploading: (uploading: boolean) => setIsUploading(uploading),
  };
};

export default useFileUpload;
















