import { useState, useRef, useEffect } from "react";
import { MessageSquare, Pencil, Trash2, Send, Loader2, X, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { Note } from "@/hooks/use-notes";
import { useUpdateNote, useDeleteNote } from "@/hooks/use-notes";
import { useToast } from "@/hooks/use-toast";

interface NoteItemProps {
  note: Note;
  invalidateKey: readonly unknown[];
  currentUserId?: number;
  isAdmin?: boolean;
}

function NoteItem({ note, invalidateKey, currentUserId, isAdmin }: NoteItemProps) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(note.content);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const updateNote = useUpdateNote(invalidateKey);
  const deleteNote = useDeleteNote(invalidateKey);

  const canModify = note.userId === currentUserId || isAdmin;

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      editRef.current.setSelectionRange(editRef.current.value.length, editRef.current.value.length);
    }
  }, [editing]);

  const handleSave = () => {
    if (!editValue.trim() || editValue.trim() === note.content) {
      setEditing(false);
      return;
    }
    updateNote.mutate(
      { noteId: note.id, content: editValue.trim() },
      {
        onSuccess: () => setEditing(false),
        onError: () => toast({ title: "Failed to update note", variant: "destructive" }),
      }
    );
  };

  const handleDelete = () => {
    deleteNote.mutate(note.id, {
      onError: () => toast({ title: "Failed to delete note", variant: "destructive" }),
    });
  };

  const initials = note.userName
    ? note.userName.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <div className="group flex gap-3">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
        {initials}
      </div>

      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-baseline gap-2 mb-1">
          <span className="font-bold text-sm text-foreground">{note.userName ?? "Unknown"}</span>
          <span className="text-[11px] font-mono text-muted-foreground">
            {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
          </span>
          {note.updatedAt !== note.createdAt && (
            <span className="text-[10px] text-muted-foreground italic">(edited)</span>
          )}
        </div>

        {/* Body */}
        {editing ? (
          <div className="space-y-2">
            <textarea
              ref={editRef}
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave();
                if (e.key === "Escape") { setEditing(false); setEditValue(note.content); }
              }}
              className="w-full min-h-[80px] p-2.5 text-sm bg-background border-2 border-primary rounded outline-none resize-none leading-relaxed"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={updateNote.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-60"
                data-testid="button-save-note"
              >
                {updateNote.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Save
              </button>
              <button
                onClick={() => { setEditing(false); setEditValue(note.content); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-secondary text-secondary-foreground rounded hover:bg-secondary/80"
              >
                <X className="w-3 h-3" /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words pr-14">
              {note.content}
            </p>
            {canModify && (
              <div className="absolute top-0 right-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => { setEditValue(note.content); setEditing(true); }}
                  className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  title="Edit"
                  data-testid="button-edit-note"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteNote.isPending}
                  className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Delete"
                  data-testid="button-delete-note"
                >
                  {deleteNote.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Compose box ───────────────────────────────────────────────────────────────

interface ComposeProps {
  onSubmit: (content: string) => void;
  isPending: boolean;
  placeholder?: string;
}

function Compose({ onSubmit, isPending, placeholder = "Add a comment..." }: ComposeProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  return (
    <div className="flex gap-3 pt-3 border-t border-border">
      <div className="flex-1">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={e => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
          }}
          placeholder={placeholder}
          rows={2}
          className="w-full resize-none bg-background border-2 border-border rounded p-3 text-sm outline-none focus:border-primary transition-colors leading-relaxed overflow-hidden"
          data-testid="input-note-content"
        />
        <p className="text-[10px] text-muted-foreground mt-1 font-mono">
          Cmd/Ctrl + Enter to post
        </p>
      </div>
      <div className="pt-1">
        <button
          onClick={handleSubmit}
          disabled={isPending || !value.trim()}
          className={cn(
            "p-2.5 rounded transition-colors",
            value.trim()
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-secondary text-muted-foreground cursor-not-allowed"
          )}
          data-testid="button-post-note"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

interface NotesSectionProps {
  notes: Note[] | undefined;
  isLoading: boolean;
  onPost: (content: string) => void;
  isPosting: boolean;
  invalidateKey: readonly unknown[];
  title?: string;
  placeholder?: string;
}

export function NotesSection({
  notes,
  isLoading,
  onPost,
  isPosting,
  invalidateKey,
  title = "Notes & Comments",
  placeholder,
}: NotesSectionProps) {
  const { user } = useAuth();

  return (
    <div className="bg-card border-2 border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-secondary/50 border-b border-border px-5 py-3 flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-muted-foreground" />
        <h3 className="font-bold text-sm uppercase tracking-wider">{title}</h3>
        {notes && notes.length > 0 && (
          <span className="bg-background border border-border px-1.5 rounded text-[10px] font-mono">
            {notes.length}
          </span>
        )}
      </div>

      <div className="p-5 space-y-5">
        {/* Note list */}
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : notes && notes.length > 0 ? (
          <div className="space-y-5">
            {notes.map(note => (
              <NoteItem
                key={note.id}
                note={note}
                invalidateKey={invalidateKey}
                currentUserId={user?.id}
                isAdmin={user?.role === "admin"}
              />
            ))}
          </div>
        ) : (
          <div className="py-6 text-center">
            <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground font-medium">No comments yet</p>
            <p className="text-xs text-muted-foreground mt-1">Be the first to leave a note.</p>
          </div>
        )}

        {/* Compose */}
        <Compose onSubmit={onPost} isPending={isPosting} placeholder={placeholder} />
      </div>
    </div>
  );
}
