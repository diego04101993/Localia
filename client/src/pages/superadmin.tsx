import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Building2,
  Plus,
  LogOut,
  Shield,
  Loader2,
  CheckCircle2,
  Users,
  Moon,
  Sun,
  Trash2,
  KeyRound,
  ExternalLink,
  Search,
  Copy,
  Download,
  Eye,
  EyeOff,
  RefreshCw,
  ClipboardCheck,
} from "lucide-react";
import { createBranchSchema, type CreateBranchData, type Branch, BRANCH_CATEGORIES } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type BranchMetric = { branchId: string; customerCount: number; activeMemberships: number };

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
    active: { label: "Activa", variant: "default" },
    suspended: { label: "Suspendida", variant: "secondary" },
    blacklisted: { label: "Bloqueada", variant: "destructive" },
  };
  const c = config[status] || config.active;
  return <Badge variant={c.variant} data-testid={`badge-status-${status}`}>{c.label}</Badge>;
}

function DeleteBranchDialog({ branch, onDeleted }: { branch: Branch; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirmSlug, setConfirmSlug] = useState("");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/superadmin/branches/${branch.id}`);
    },
    onSuccess: () => {
      toast({ title: "Sucursal eliminada" });
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string).startsWith("/api/branches") });
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/branches/metrics"] });
      setOpen(false);
      setConfirmSlug("");
      onDeleted();
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setConfirmSlug(""); }}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" data-testid={`button-delete-${branch.id}`}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar sucursal</DialogTitle>
          <DialogDescription>
            Esto ocultará la sucursal y bloqueará el acceso. Los datos no se borrarán permanentemente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm">
            Para confirmar, escribe el slug: <strong>{branch.slug}</strong>
          </p>
          <Input
            value={confirmSlug}
            onChange={(e) => setConfirmSlug(e.target.value)}
            placeholder={branch.slug}
            data-testid="input-confirm-slug"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            variant="destructive"
            disabled={confirmSlug !== branch.slug || mutation.isPending}
            onClick={() => mutation.mutate()}
            data-testid="button-confirm-delete"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Eliminar sucursal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ branch }: { branch: Branch }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ email: string; password: string; name: string } | null>(null);
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", `/api/superadmin/branches/${branch.id}/reset-admin-password`);
      return resp.json();
    },
    onSuccess: (data) => {
      setResult(data);
      toast({ title: "Contraseña reseteada" });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message?.includes("404") ? "No hay administrador para esta sucursal" : "Error al resetear",
        variant: "destructive",
      });
    },
  });

  function copyAll() {
    if (!result) return;
    const text = `Email: ${result.email}\nContraseña: ${result.password}`;
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado al portapapeles" });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setResult(null); }}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" data-testid={`button-reset-pw-${branch.id}`}>
          <KeyRound className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset contraseña admin</DialogTitle>
          <DialogDescription>
            Se generará una nueva contraseña segura para el administrador de {branch.name}.
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="space-y-3 py-2">
            <div className="p-3 bg-muted rounded-md space-y-2 text-sm">
              <p><strong>Email:</strong> {result.email}</p>
              <p><strong>Nueva contraseña:</strong> <code className="text-xs bg-background px-1 py-0.5 rounded">{result.password}</code></p>
            </div>
            <Button onClick={copyAll} className="w-full" data-testid="button-copy-reset">
              <Copy className="h-4 w-4 mr-2" />
              Copiar todo
            </Button>
          </div>
        ) : (
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} data-testid="button-confirm-reset">
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Generar nueva contraseña
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CredentialsModal({
  open,
  onClose,
  data,
}: {
  open: boolean;
  onClose: () => void;
  data: { branchName: string; branchSlug: string; adminEmail: string; adminPassword: string } | null;
}) {
  const { toast } = useToast();
  if (!data) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const d = data;

  function copyAll() {
    const text = [
      `Sucursal: ${d.branchName}`,
      `URL pública: ${origin}/app/${d.branchSlug}`,
      `Login: ${origin}/`,
      `Email: ${d.adminEmail}`,
      `Contraseña: ${d.adminPassword}`,
    ].join("\n");
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado al portapapeles" });
  }

  function downloadTxt() {
    const text = [
      `Credenciales - ${d.branchName}`,
      `==================================`,
      `URL pública: ${origin}/app/${d.branchSlug}`,
      `Login: ${origin}/`,
      `Email: ${d.adminEmail}`,
      `Contraseña: ${d.adminPassword}`,
      `==================================`,
    ].join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `credenciales-${d.branchSlug}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sucursal creada exitosamente</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="p-3 bg-muted rounded-md space-y-2 text-sm">
            <p><strong>Sucursal:</strong> {data.branchName}</p>
            <p>
              <strong>URL pública:</strong>{" "}
              <code className="text-xs bg-background px-1 py-0.5 rounded">{origin}/app/{data.branchSlug}</code>
            </p>
            <p>
              <strong>Login:</strong>{" "}
              <code className="text-xs bg-background px-1 py-0.5 rounded">{origin}/</code>
            </p>
            <p><strong>Email admin:</strong> {data.adminEmail}</p>
            <p>
              <strong>Contraseña:</strong>{" "}
              <code className="text-xs bg-background px-1 py-0.5 rounded">{data.adminPassword}</code>
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={copyAll} className="flex-1" data-testid="button-copy-credentials">
              <Copy className="h-4 w-4 mr-2" />
              Copiar todo
            </Button>
            <Button variant="outline" onClick={downloadTxt} className="flex-1" data-testid="button-download-credentials">
              <Download className="h-4 w-4 mr-2" />
              Descargar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function generatePassword(length = 14): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  let pw = "";
  for (let i = 0; i < length; i++) {
    pw += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pw;
}

function CreateBranchDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [createAdmin, setCreateAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminName, setAdminName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [category, setCategory] = useState("box");
  const [credentials, setCredentials] = useState<{
    branchName: string;
    branchSlug: string;
    adminEmail: string;
    adminPassword: string;
  } | null>(null);
  const { toast } = useToast();

  const form = useForm<CreateBranchData>({
    resolver: zodResolver(createBranchSchema),
    defaultValues: { name: "", slug: "" },
  });

  const mutation = useMutation({
    mutationFn: async (data: CreateBranchData) => {
      const body: any = {
        name: data.name,
        slug: data.slug,
        category,
        createAdmin,
      };
      if (createAdmin) {
        body.adminEmail = adminEmail;
        body.adminPassword = adminPassword;
        body.adminName = adminName || `Admin ${data.name}`;
      }
      const resp = await apiRequest("POST", "/api/branches", body);
      return resp.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string).startsWith("/api/branches") });
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/branches/metrics"] });
      if (result.admin) {
        setCredentials({
          branchName: result.branch.name,
          branchSlug: result.branch.slug,
          adminEmail: result.admin.email,
          adminPassword: result.admin.password,
        });
      } else {
        toast({ title: "Sucursal creada" });
      }
      form.reset();
      setAdminEmail("");
      setAdminPassword("");
      setAdminName("");
      setCreateAdmin(false);
      setOpen(false);
      onCreated();
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message?.includes("409")
          ? "Ese slug o correo ya existe"
          : "No se pudo crear la sucursal",
        variant: "destructive",
      });
    },
  });

  function handleNameChange(name: string) {
    form.setValue("name", name);
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
    form.setValue("slug", slug);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button data-testid="button-create-branch">
            <Plus className="h-4 w-4 mr-2" />
            Nueva sucursal
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crear nueva sucursal</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Box Central"
                        data-testid="input-branch-name"
                        {...field}
                        onChange={(e) => handleNameChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug (URL)</FormLabel>
                    <FormControl>
                      <Input placeholder="box-central" data-testid="input-branch-slug" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div>
                <Label className="text-sm font-medium">Categoría</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="mt-1" data-testid="select-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BRANCH_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="border rounded-md p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm font-medium">Crear administrador de sucursal</Label>
                  <Switch
                    checked={createAdmin}
                    onCheckedChange={setCreateAdmin}
                    data-testid="switch-create-admin"
                  />
                </div>

                {createAdmin && (
                  <div className="space-y-3 pt-1">
                    <div>
                      <Label className="text-sm">Nombre del admin</Label>
                      <Input
                        placeholder="Juan Pérez"
                        value={adminName}
                        onChange={(e) => setAdminName(e.target.value)}
                        className="mt-1"
                        data-testid="input-admin-name"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Email del admin</Label>
                      <Input
                        type="email"
                        placeholder="admin@sucursal.com"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        className="mt-1"
                        data-testid="input-admin-email"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Contraseña</Label>
                      <div className="flex gap-1 mt-1">
                        <div className="relative flex-1">
                          <Input
                            type={showPw ? "text" : "password"}
                            placeholder="Dejar vacío para autogenerar"
                            value={adminPassword}
                            onChange={(e) => setAdminPassword(e.target.value)}
                            data-testid="input-admin-password"
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="absolute right-0 top-0"
                            onClick={() => setShowPw(!showPw)}
                          >
                            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            const pw = generatePassword();
                            setAdminPassword(pw);
                            setShowPw(true);
                          }}
                          data-testid="button-generate-password"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-branch">
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={mutation.isPending || (createAdmin && !adminEmail)}
                  data-testid="button-submit-branch"
                >
                  {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Crear
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <CredentialsModal
        open={!!credentials}
        onClose={() => setCredentials(null)}
        data={credentials}
      />
    </>
  );
}

function BranchCard({
  branch,
  metrics,
  onStatusChange,
}: {
  branch: Branch;
  metrics?: BranchMetric;
  onStatusChange: (id: string, status: string) => void;
}) {
  const isDeleted = !!branch.deletedAt;

  return (
    <Card
      className={isDeleted ? "opacity-50" : ""}
      data-testid={`card-branch-${branch.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10 shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold truncate" data-testid={`text-branch-name-${branch.id}`}>
                {branch.name}
              </h3>
              <p className="text-sm text-muted-foreground" data-testid={`text-branch-slug-${branch.id}`}>
                /{branch.slug}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <StatusBadge status={branch.status} />
            {isDeleted && <Badge variant="destructive">Eliminada</Badge>}
          </div>
        </div>

        {metrics && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="text-center p-2 bg-muted/50 rounded-md">
              <p className="text-lg font-bold" data-testid={`text-customers-${branch.id}`}>
                {metrics.customerCount}
              </p>
              <p className="text-xs text-muted-foreground">Clientes</p>
            </div>
            <div className="text-center p-2 bg-muted/50 rounded-md">
              <p className="text-lg font-bold" data-testid={`text-memberships-${branch.id}`}>
                {metrics.activeMemberships}
              </p>
              <p className="text-xs text-muted-foreground">Membresías activas</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-3 pt-3 border-t gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground">
            {new Date(branch.createdAt).toLocaleDateString("es-MX", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
          {!isDeleted && (
            <Select
              value={branch.status}
              onValueChange={(val) => onStatusChange(branch.id, val)}
            >
              <SelectTrigger className="w-[130px]" data-testid={`select-status-${branch.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Activa</SelectItem>
                <SelectItem value="suspended">Suspendida</SelectItem>
                <SelectItem value="blacklisted">Bloqueada</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {!isDeleted && (
          <div className="flex items-center gap-1 mt-3 pt-3 border-t flex-wrap">
            <Button
              size="sm"
              variant="ghost"
              asChild
              data-testid={`button-open-app-${branch.id}`}
            >
              <a href={`/app/${branch.slug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                App
              </a>
            </Button>
            <ResetPasswordDialog branch={branch} />
            <DeleteBranchDialog branch={branch} onDeleted={() => {}} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SuperAdminPage() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);

  const branchesUrl = showDeleted ? "/api/branches?include_deleted=true" : "/api/branches";
  const { data: branches, isLoading } = useQuery<Branch[]>({
    queryKey: [branchesUrl],
  });

  const { data: metrics } = useQuery<BranchMetric[]>({
    queryKey: ["/api/superadmin/branches/metrics"],
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/branches/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string).startsWith("/api/branches") });
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/branches/metrics"] });
      toast({ title: "Estado actualizado" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar", variant: "destructive" });
    },
  });

  const metricsMap = new Map<string, BranchMetric>();
  metrics?.forEach((m) => metricsMap.set(m.branchId, m));

  const filteredBranches = branches?.filter((b) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      b.name.toLowerCase().includes(q) ||
      b.slug.toLowerCase().includes(q) ||
      (b.city && b.city.toLowerCase().includes(q))
    );
  });

  const activeBranches = branches?.filter((b) => b.status === "active" && !b.deletedAt).length ?? 0;
  const totalBranches = branches?.filter((b) => !b.deletedAt).length ?? 0;
  const totalCustomers = metrics?.reduce((acc, m) => acc + m.customerCount, 0) ?? 0;
  const totalActiveMemberships = metrics?.reduce((acc, m) => acc + m.activeMemberships, 0) ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3 p-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight" data-testid="text-superadmin-title">
                Super Admin
              </h1>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={toggleTheme} data-testid="button-theme">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" onClick={logout} data-testid="button-logout">
              <LogOut className="h-4 w-4 mr-2" />
              Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-branches">{totalBranches}</p>
                <p className="text-xs text-muted-foreground">Sucursales</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-md bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-active-branches">{activeBranches}</p>
                <p className="text-xs text-muted-foreground">Activas</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-md bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-customers">{totalCustomers}</p>
                <p className="text-xs text-muted-foreground">Clientes</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-md bg-purple-500/10">
                <ClipboardCheck className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-memberships">{totalActiveMemberships}</p>
                <p className="text-xs text-muted-foreground">Membresías</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-semibold">Sucursales</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar..."
                className="pl-9 w-48"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-branches"
              />
            </div>
            <div className="flex items-center gap-1">
              <Switch
                checked={showDeleted}
                onCheckedChange={setShowDeleted}
                data-testid="switch-show-deleted"
              />
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Ver eliminadas</Label>
            </div>
            <CreateBranchDialog onCreated={() => {}} />
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-md" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredBranches && filteredBranches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredBranches.map((branch) => (
              <BranchCard
                key={branch.id}
                branch={branch}
                metrics={metricsMap.get(branch.id)}
                onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-1">
                {searchQuery ? "Sin resultados" : "Sin sucursales"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery
                  ? "No se encontraron sucursales con esa búsqueda"
                  : "Crea tu primera sucursal para comenzar"}
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
