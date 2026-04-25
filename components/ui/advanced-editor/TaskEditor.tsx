"use client";

import { useCallback } from 'react';
import { useMutation } from 'convex/react';
import { apiAny } from '@/lib/convexApiAny';
import { Id } from '@/convex/_generated/dataModel';
import AdvancedEditor from './index';

interface TaskEditorProps {
  taskId: string;
  initialContent?: string;
  placeholder?: string;
}

export default function TaskEditor({ 
  taskId, 
  initialContent = '', 
  placeholder = "Describe task details..." 
}: TaskEditorProps) {
  const updateTask = useMutation(apiAny.tasks.updateTask);

  const handleSave = useCallback(async (content: string) => {
    try {
      await updateTask({
        taskId: taskId as Id<"tasks">,
        content: content, // Use the 'content' field for rich text
      });
    } catch (error) {
      console.error('Error saving task:', error);
      throw error; // Re-throw so AdvancedEditor can handle the error
    }
  }, [taskId, updateTask]);

  return (
    <div className="task-editor">
      <AdvancedEditor
        content={initialContent}
        onSave={handleSave}
        placeholder={placeholder}
        autoSave={true}
        autoSaveDelay={3000} // 3 seconds for tasks
        className="min-h-[400px]"
      />
    </div>
  );
} 
