"use client";

import { useQuery, useMutation } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Id } from "@/convex/_generated/dataModel";
import { useProject } from "@/components/providers/ProjectProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Plus, MoreHorizontal, Edit, Trash2, StickyNote, Eye } from "lucide-react";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";
import { useI18n } from "@/lib/i18n";

type Note = {
  _id: Id<"notes">;
  title: string;
  content: string;
  projectId: Id<"projects">;
  teamId: Id<"teams">;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  isArchived?: boolean;
  createdByUser: {
    name: string;
    imageUrl?: string;
  };
};

interface NoteFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { title: string; content: string }) => void;
  note?: Note;
  isSubmitting: boolean;
}

function NoteForm({ isOpen, onClose, onSubmit, note, isSubmitting }: NoteFormProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
    } else {
      setTitle("");
      setContent("");
    }
  }, [note]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error(t("notes", "pleaseFillAllFields"));
      return;
    }
    onSubmit({ title: title.trim(), content: content.trim() });
  };

  const handleClose = () => {
    setTitle("");
    setContent("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{note ? t("notes", "editNote") : t("notes", "addNewNote")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">{t("notes", "title")}</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("notes", "enterNoteTitle")}
              disabled={isSubmitting}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="content">{t("notes", "content")}</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t("notes", "enterNoteContent")}
              rows={6}
              disabled={isSubmitting}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              {t("notes", "cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("notes", "saving") : note ? t("notes", "update") : t("notes", "create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NoteCard({ note, onEdit, onDelete, onView }: { 
  note: Note; 
  onEdit: (note: Note) => void; 
  onDelete: (noteId: Id<"notes">) => void; 
  onView: (note: Note) => void;
}) {
  const { t, locale } = useI18n();
  const updatedDateLabel = new Intl.DateTimeFormat(locale === "pl" ? "pl-PL" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(note.updatedAt));
  return (
    <Card className="h-fit cursor-pointer hover:shadow-md transition-shadow" onClick={() => onView(note)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg line-clamp-2">{note.title}</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView(note)}>
                <Eye className="mr-2 h-4 w-4" />
                {t("notes", "view")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(note)}>
                <Edit className="mr-2 h-4 w-4" />
                {t("notes", "edit")}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDelete(note._id)}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("notes", "delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">
          {note.content}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              <AvatarImage src={note.createdByUser.imageUrl} />
              <AvatarFallback className="text-xs">
                {note.createdByUser.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span>{note.createdByUser.name}</span>
          </div>
          <div>
            {note.updatedAt !== note.createdAt && `${t("notes", "updated")} `}
            {updatedDateLabel}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function NotesView() {
  const { project } = useProject();
  const { t, locale } = useI18n();
  const formatNoteDateTime = (value: number) =>
    new Intl.DateTimeFormat(locale === "pl" ? "pl-PL" : "en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [viewingNote, setViewingNote] = useState<Note | null>(null);

  const notes = useQuery(apiAny.notes.getProjectNotes, { 
    projectId: project._id 
  });

  const createNote = useMutation(apiAny.notes.createNote);
  const updateNote = useMutation(apiAny.notes.updateNote);
  const deleteNote = useMutation(apiAny.notes.deleteNote);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateNote = async (data: { title: string; content: string }) => {
    setIsSubmitting(true);
    try {
      await createNote({
        title: data.title,
        content: data.content,
        projectId: project._id,
      });
      toast.success(t("notes", "noteCreated"));
      setIsFormOpen(false);
    } catch (error) {
      toast.error(t("notes", "failedToCreateNote"), {
        description: toUserFacingErrorMessage(error),
      });
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateNote = async (data: { title: string; content: string }) => {
    if (!editingNote) return;
    
    setIsSubmitting(true);
    try {
      await updateNote({
        noteId: editingNote._id,
        title: data.title,
        content: data.content,
      });
      toast.success(t("notes", "noteUpdated"));
      setEditingNote(null);
    } catch (error) {
      toast.error(t("notes", "failedToUpdateNote"), {
        description: toUserFacingErrorMessage(error),
      });
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNote = async (noteId: Id<"notes">) => {
    try {
      await deleteNote({ noteId });
      toast.success(t("notes", "noteDeleted"));
    } catch (error) {
      toast.error(t("notes", "failedToDeleteNote"), {
        description: toUserFacingErrorMessage(error),
      });
      console.error(error);
    }
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
  };

  const handleViewNote = (note: Note) => {
    setViewingNote(note);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingNote(null);
  };

  const closeView = () => {
    setViewingNote(null);
  };

  if (notes === undefined) {
    return <NotesViewLoading />;
  }

  return (
    <div className="flex flex-col gap-6">
      <ProjectPageHeader
        title={t("notes", "notes")}
        icon={<StickyNote className="h-8 w-8 text-primary" />}
        actions={
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("notes", "addNote")}
          </Button>
        }
      />

      {notes.length === 0 ? (
        <Card className="p-12 text-center">
          <StickyNote className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">{t("notes", "noNotesYet")}</h3>
          <p className="text-muted-foreground mb-4">
            {t("notes", "createFirstNote")}
          </p>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("notes", "addNote")}
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <NoteCard
              key={note._id}
              note={note}
              onEdit={handleEditNote}
              onDelete={handleDeleteNote}
              onView={handleViewNote}
            />
          ))}
        </div>
      )}

      <NoteForm
        isOpen={isFormOpen || !!editingNote}
        onClose={closeForm}
        onSubmit={editingNote ? handleUpdateNote : handleCreateNote}
        note={editingNote || undefined}
        isSubmitting={isSubmitting}
      />

      {/* Note Viewer Modal */}
      <Dialog open={!!viewingNote} onOpenChange={closeView}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">{viewingNote?.title}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {viewingNote?.content}
            </div>
            <div className="flex items-center justify-between pt-4 border-t text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={viewingNote?.createdByUser.imageUrl} />
                  <AvatarFallback className="text-xs">
                    {viewingNote?.createdByUser.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span>{viewingNote?.createdByUser.name}</span>
              </div>
              <div className="flex gap-4">
                <span>{viewingNote && t("notes", "created", { date: formatNoteDateTime(viewingNote.createdAt) })}</span>
                {viewingNote && viewingNote.updatedAt !== viewingNote.createdAt && (
                  <span>{t("notes", "updatedWithDate", { date: formatNoteDateTime(viewingNote.updatedAt) })}</span>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeView}>
                {t("notes", "close")}
              </Button>
              <Button 
                onClick={() => {
                  setViewingNote(null);
                  setEditingNote(viewingNote);
                }}
              >
                <Edit className="mr-2 h-4 w-4" />
                {t("notes", "edit")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function NotesViewLoading() {
  return <Spinner />;
} 
