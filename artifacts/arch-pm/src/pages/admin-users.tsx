import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout";
import { useListUsers, useCreateUser, useUpdateUser, useDeleteUser, getListUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Shield, User as UserIcon, Loader2, Edit2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const userSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Min 6 characters").or(z.string().length(0).optional()),
  role: z.enum(["admin", "member"]).default("member")
});

export default function AdminUsers() {
  const [location, setLocation] = useLocation();
  const { data: users, isLoading } = useListUsers();
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<number | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();

  const form = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: { role: "member", password: "" }
  });

  useEffect(() => {
    if (location.includes("?add=user")) {
      setIsAddOpen(true);
      setLocation("/settings", { replace: true });
    }
  }, [location, setLocation]);

  const onSubmit = (data: z.infer<typeof userSchema>) => {
    if (editUserId) {
      const updateData = { name: data.name, role: data.role as any, password: data.password || undefined };
      updateMutation.mutate(
        { id: editUserId, data: updateData },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
            setEditUserId(null);
            setIsAddOpen(false);
            form.reset();
            toast({ title: "User updated" });
          },
          onError: (err: any) => toast({ title: "Error", description: err.data?.error || "An error occurred", variant: "destructive" })
        }
      );
    } else {
      if (!data.password) {
        form.setError("password", { message: "Password is required for new users" });
        return;
      }
      createMutation.mutate(
        { data: data as any },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
            setIsAddOpen(false);
            form.reset();
            toast({ title: "User created" });
          },
          onError: (err: any) => toast({ title: "Error", description: err.data?.error || "An error occurred", variant: "destructive" })
        }
      );
    }
  };

  const openEdit = (user: any) => {
    setEditUserId(user.id);
    form.reset({
      name: user.name,
      email: user.email,
      role: user.role,
      password: ""
    });
    setIsAddOpen(true);
  };

  const handleDelete = (id: number) => {
    if(confirm("Are you sure you want to remove this user?")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          toast({ title: "User removed" });
        }
      });
    }
  };

  const filteredUsers = users?.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="p-6 md:p-10 max-w-5xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2 text-foreground flex items-center gap-3">
               <Shield className="w-8 h-8 text-primary" /> Settings
            </h1>
            <p className="text-muted-foreground font-mono">Manage access to the workspace.</p>
          </div>
          
          <Dialog open={isAddOpen} onOpenChange={(open) => {
            setIsAddOpen(open);
            if (!open) {
              setEditUserId(null);
              form.reset({ role: "member", password: "", name: "", email: "" });
            }
          }}>
            <DialogTrigger asChild>
               <button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-4 py-3 rounded-md flex items-center gap-2 transition-colors">
                 <Plus className="w-5 h-5" /> Add User
              </button>
            </DialogTrigger>
            <DialogContent className="border-2 border-border p-6 rounded-lg sm:max-w-[425px]">
              <DialogHeader>
                 <DialogTitle>{editUserId ? "Edit User" : "Add New User"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Name</label>
                  <input {...form.register("name")} className="w-full bg-background border-2 border-border p-3 rounded focus:border-primary outline-none" />
                  {form.formState.errors.name && <p className="text-xs text-destructive font-bold">{form.formState.errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Email</label>
                  <input {...form.register("email")} type="email" disabled={!!editUserId} className="w-full bg-background border-2 border-border p-3 rounded focus:border-primary outline-none disabled:opacity-50" />
                  {form.formState.errors.email && <p className="text-xs text-destructive font-bold">{form.formState.errors.email.message}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Role</label>
                  <select {...form.register("role")} className="w-full bg-background border-2 border-border p-3 rounded focus:border-primary outline-none appearance-none">
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Password {editUserId && <span className="text-xs lowercase normal-case opacity-70">(leave blank to keep current)</span>}
                  </label>
                  <input {...form.register("password")} type="password" className="w-full bg-background border-2 border-border p-3 rounded focus:border-primary outline-none" />
                  {form.formState.errors.password && <p className="text-xs text-destructive font-bold">{form.formState.errors.password.message}</p>}
                </div>
                
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="w-full bg-primary text-primary-foreground font-bold p-3 rounded mt-4">
                  {createMutation.isPending || updateMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (editUserId ? "Save Changes" : "Create User")}
                </button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-card border-2 border-border rounded-lg overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border bg-secondary/30 relative">
            <Search className="w-4 h-4 absolute left-7 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-sm bg-background border border-border py-2 pl-9 pr-4 rounded text-sm focus:border-primary outline-none"
            />
          </div>

          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : filteredUsers?.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground font-mono text-sm">No users found.</div>
            ) : (
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-secondary text-secondary-foreground font-bold uppercase tracking-wider text-xs border-b-2 border-border">
                  <tr>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Joined</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredUsers?.map(user => (
                    <tr key={user.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold">
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-foreground">{user.name}</div>
                            <div className="text-muted-foreground font-mono text-xs">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border ${user.role === 'admin' ? 'bg-accent/10 text-accent border-accent/20' : 'bg-secondary text-secondary-foreground border-border'}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                        {format(new Date(user.createdAt), "MMM d, yyyy")}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => openEdit(user)}
                            className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors"
                            title="Edit User"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(user.id)}
                            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                            title="Remove User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
