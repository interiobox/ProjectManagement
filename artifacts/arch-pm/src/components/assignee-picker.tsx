import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, UserPlus, X } from "lucide-react";
import { useListUsers } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface AssigneePickerProps {
  value: number[];
  onChange: (value: number[]) => void;
  disabled?: boolean;
  label?: string;
}

export function AssigneePicker({
  value,
  onChange,
  disabled = false,
  label = "Assign to",
}: AssigneePickerProps) {
  const { user: currentUser } = useAuth();
  const [open, setOpen] = useState(false);
  const { data: users = [], isLoading } = useListUsers();
  const selectedIds = useMemo(() => new Set(value), [value]);
  const selectedUsers = users.filter(user => selectedIds.has(user.id));

  const toggleUser = (id: number) => {
    onChange(selectedIds.has(id) ? value.filter(userId => userId !== id) : [...value, id]);
  };

  const assignToMe = () => {
    if (currentUser && !selectedIds.has(currentUser.id)) {
      onChange([...value, currentUser.id]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </label>
        {currentUser && !selectedIds.has(currentUser.id) && (
          <button
            type="button"
            onClick={assignToMe}
            disabled={disabled}
            className="text-xs font-bold text-primary hover:underline disabled:opacity-50"
          >
            Assign to me
          </button>
        )}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="w-full justify-between min-h-11 h-auto py-2 font-medium"
          >
            <span className="flex flex-wrap gap-1.5 text-left">
              {selectedUsers.length > 0 ? (
                selectedUsers.map(user => (
                  <span
                    key={user.id}
                    className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-1 text-xs"
                  >
                    {user.name}
                    <X
                      className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground"
                      onClick={event => {
                        event.stopPropagation();
                        toggleUser(user.id);
                      }}
                    />
                  </span>
                ))
              ) : (
                <span className="text-muted-foreground">Select one or more users…</span>
              )}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-1">
          <div className="max-h-64 overflow-y-auto">
            {isLoading ? (
              <p className="p-3 text-sm text-muted-foreground">Loading users…</p>
            ) : users.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">No users available.</p>
            ) : (
              users.map(user => {
                const checked = selectedIds.has(user.id);
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => toggleUser(user.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded px-2 py-2 text-left text-sm hover:bg-secondary",
                      checked && "bg-secondary/60",
                    )}
                  >
                    <Checkbox checked={checked} className="pointer-events-none" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{user.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                    </span>
                    {checked && <Check className="h-4 w-4 text-primary" />}
                  </button>
                );
              })
            )}
          </div>
          <div className="border-t border-border p-2">
            <button
              type="button"
              onClick={assignToMe}
              disabled={disabled || !currentUser}
              className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm font-bold text-primary hover:bg-secondary disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" /> Assign to me
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}