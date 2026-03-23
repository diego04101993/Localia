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
  UserCog,
  History,
  LayoutDashboard,
  UserCheck,
  Send,
} from "lucide-react";
import { createBranchSchema, type CreateBranchData, type Branch, BRANCH_CATEGORIES, type AuditLog } from "@shared/schema";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

type BranchMetric = { branchId: string; customerCount: number; activeMemberships: number };
type AdminInfo = { id: string; email: string; name: string; createdAt?: string } | null;

function extractErrorMessage(err: any, fallback: string): string {
  try {
    const msg = err?.message || "";
    const statusMatch = msg.match(/^(\d{3}):\s*/);
    const statusCode = statusMatch ? statusMatch[1] : "";
    const body = statusMatch ? msg.substring(statusMatch[0].length) : msg;

    let message = fallback;

    try {
      const parsed = JSON.parse(body);
      message = parsed.message || fallback;
    } catch {
      if (body.trim()) {
        message = body;
      }
    }

    if (statusCode === "403") {
      return `Acceso denegado (${statusCode}). Tu sesión puede haber expirado. Recarga la página.`;
    }
    if (statusCode === "401") {
      return `No autenticado (${statusCode}). Inicia sesión nuevamente.`;
    }
    if (statusCode && statusCode !== "200") {
      return `${message} (${statusCode})`;
    }
    return message;
  } catch {
    return fallback;
  }
}

function invalidateBranches() {
  queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string).startsWith("/api/branches") });
  queryClient.invalidateQueries({ queryKey: ["/api/superadmin/branches/metrics"] });
  queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string).startsWith("/api/superadmin/audit") });
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
    active: { label: "Activa", variant: "default" },
    suspended: { label: "Suspendida", variant: "secondary" },
    blacklisted: { label: "Bloqueada", variant: "destructive" },
  };
  const c = config[status] || config.active;
  return <Badge variant={c.variant} data-testid={`badge-status-${status}`}>{c.label}</Badge>;
}

function DeleteBranchDialog({ branch }: { branch: Branch }) {
  const [open, setOpen] = useState(false);
  const [confirmSlug, setConfirmSlug] = useState("");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/superadmin/branches/${branch.id}`);
    },
    onSuccess: () => {
      toast({ title: "Sucursal eliminada" });
      invalidateBranches();
      setOpen(false);
      setConfirmSlug("");
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setConfirmSlug(""); }}>
      <DialogTrigger asChild>
        <span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" data-testid={`button-delete-${branch.id}`}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Eliminar sucursal</TooltipContent>
          </Tooltip>
        </span>
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
          <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-delete">Cancelar</Button>
          <Button
            variant="destructive"
            disabled={confirmSlug !== branch.slug || mutation.isPending}
            onClick={() => mutation.mutate()}
            data-testid="button-confirm-delete"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ branch, hasAdmin }: { branch: Branch; hasAdmin?: boolean }) {
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
      invalidateBranches();
      toast({ title: "Contraseña reseteada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: extractErrorMessage(err, "No hay admin para esta sucursal"), variant: "destructive" });
    },
  });

  const r = result;
  function copyAll() {
    if (!r) return;
    navigator.clipboard.writeText(`Email: ${r.email}\nContraseña: ${r.password}`);
    toast({ title: "Copiado al portapapeles" });
  }

  function downloadTxt() {
    if (!r) return;
    const origin = window.location.origin;
    const text = [
      `Reset de contraseña - ${branch.name}`,
      `==================================`,
      `Login: ${origin}/`,
      `Email: ${r.email}`,
      `Nueva contraseña: ${r.password}`,
      `==================================`,
    ].join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reset-${branch.slug}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setResult(null); }}>
      <DialogTrigger asChild>
        <span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" disabled={hasAdmin === false} data-testid={`button-reset-pw-${branch.id}`}>
                <KeyRound className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{hasAdmin === false ? "Primero crea o asigna un admin" : "Reset contraseña admin"}</TooltipContent>
          </Tooltip>
        </span>
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
            <div className="flex gap-2">
              <Button onClick={copyAll} className="flex-1" data-testid="button-copy-reset">
                <Copy className="h-4 w-4 mr-2" />
                Copiar
              </Button>
              <Button variant="outline" onClick={downloadTxt} className="flex-1" data-testid="button-download-reset">
                <Download className="h-4 w-4 mr-2" />
                Descargar
              </Button>
            </div>
          </div>
        ) : (
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-reset">Cancelar</Button>
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

function AdminDialog({ branch, onAdminChanged }: { branch: Branch; onAdminChanged?: () => void }) {
  const [open, setOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string | null; reassigned?: boolean } | null>(null);
  const [showReassign, setShowReassign] = useState(false);
  const { toast } = useToast();

  const { data: admin, isLoading: loadingAdmin } = useQuery<AdminInfo>({
    queryKey: ["/api/superadmin/branches", branch.id, "admin"],
    queryFn: async () => {
      const resp = await fetch(`/api/superadmin/branches/${branch.id}/admin`, { credentials: "include" });
      if (!resp.ok) return null;
      return resp.json();
    },
    enabled: open,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { name?: string; email?: string }) => {
      const resp = await apiRequest("PATCH", `/api/superadmin/branches/${branch.id}/admin`, data);
      return resp.json();
    },
    onSuccess: () => {
      toast({ title: "Admin actualizado" });
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/branches", branch.id, "admin"] });
      invalidateBranches();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: extractErrorMessage(err, "Error al actualizar"), variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { email: string; name: string; password?: string; reassign?: boolean }) => {
      const resp = await apiRequest("POST", `/api/superadmin/branches/${branch.id}/admin`, data);
      return resp.json();
    },
    onSuccess: (result) => {
      setCreatedCreds({ email: result.admin.email, password: result.password, reassigned: result.reassigned });
      setShowReassign(false);
      toast({ title: result.reassigned ? "Admin reasignado" : "Admin creado" });
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/branches", branch.id, "admin"] });
      invalidateBranches();
      onAdminChanged?.();
    },
    onError: (err: any) => {
      const errorMsg = extractErrorMessage(err, "Error al crear admin");
      if (errorMsg.includes("reasignar")) {
        setShowReassign(true);
        toast({ title: "Usuario existente", description: errorMsg, variant: "default" });
      } else {
        toast({ title: "Error", description: errorMsg, variant: "destructive" });
      }
    },
  });

  function handleOpen(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) {
      setEditName("");
      setEditEmail("");
      setNewAdminEmail("");
      setNewAdminName("");
      setNewAdminPassword("");
      setCreatedCreds(null);
      setShowReassign(false);
    }
  }

  function handleOpenChange(isOpen: boolean) {
    handleOpen(isOpen);
    if (isOpen && admin) {
      setEditName(admin.name);
      setEditEmail(admin.email);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" data-testid={`button-admin-${branch.id}`}>
                <UserCog className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Gestionar admin</TooltipContent>
          </Tooltip>
        </span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Admin de {branch.name}</DialogTitle>
          <DialogDescription>Gestiona el administrador de esta sucursal.</DialogDescription>
        </DialogHeader>

        {loadingAdmin ? (
          <div className="space-y-2 py-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : createdCreds ? (
          <div className="space-y-3 py-2">
            {createdCreds.reassigned ? (
              <div className="p-3 bg-muted rounded-md space-y-2 text-sm">
                <p className="font-semibold text-green-600">Usuario reasignado como admin</p>
                <p><strong>Email:</strong> {createdCreds.email}</p>
                <p className="text-xs text-muted-foreground">El usuario conserva su contraseña actual.</p>
              </div>
            ) : (
              <>
                <div className="p-3 bg-muted rounded-md space-y-2 text-sm">
                  <p><strong>Email:</strong> {createdCreds.email}</p>
                  <p><strong>Contraseña:</strong> <code className="text-xs bg-background px-1 py-0.5 rounded">{createdCreds.password}</code></p>
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    navigator.clipboard.writeText(`Email: ${createdCreds.email}\nContraseña: ${createdCreds.password}`);
                    toast({ title: "Copiado" });
                  }}
                  data-testid="button-copy-new-admin"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar credenciales
                </Button>
              </>
            )}
          </div>
        ) : admin ? (
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm">Nombre</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="mt-1"
                data-testid="input-edit-admin-name"
              />
            </div>
            <div>
              <Label className="text-sm">Email</Label>
              <Input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="mt-1"
                data-testid="input-edit-admin-email"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-admin-edit">Cancelar</Button>
              <Button
                disabled={updateMutation.isPending || (editName === admin.name && editEmail === admin.email)}
                onClick={() => updateMutation.mutate({ name: editName, email: editEmail })}
                data-testid="button-save-admin"
              >
                {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Guardar
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">No hay admin asignado. Crea uno nuevo o asigna un usuario existente:</p>
            <div>
              <Label className="text-sm">Nombre</Label>
              <Input
                value={newAdminName}
                onChange={(e) => setNewAdminName(e.target.value)}
                placeholder="Juan Pérez"
                className="mt-1"
                data-testid="input-new-admin-name"
              />
            </div>
            <div>
              <Label className="text-sm">Email</Label>
              <Input
                type="email"
                value={newAdminEmail}
                onChange={(e) => { setNewAdminEmail(e.target.value); setShowReassign(false); }}
                placeholder="admin@sucursal.com"
                className="mt-1"
                data-testid="input-new-admin-email"
              />
            </div>
            {!showReassign && (
              <div>
                <Label className="text-sm">Contraseña</Label>
                <div className="flex gap-1 mt-1">
                  <div className="relative flex-1">
                    <Input
                      type={showNewPw ? "text" : "password"}
                      placeholder="Dejar vacío para autogenerar"
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      data-testid="input-new-admin-password"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="absolute right-0 top-0"
                      onClick={() => setShowNewPw(!showNewPw)}
                    >
                      {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
                      let pw = "";
                      for (let i = 0; i < 14; i++) pw += chars.charAt(Math.floor(Math.random() * chars.length));
                      setNewAdminPassword(pw);
                      setShowNewPw(true);
                    }}
                    data-testid="button-generate-new-admin-pw"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-create-admin">Cancelar</Button>
              {showReassign ? (
                <Button
                  disabled={createMutation.isPending || !newAdminEmail}
                  onClick={() => createMutation.mutate({ email: newAdminEmail, name: newAdminName || `Admin ${branch.name}`, reassign: true })}
                  data-testid="button-reassign-admin"
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Reasignar como admin
                </Button>
              ) : (
                <Button
                  disabled={createMutation.isPending || !newAdminEmail}
                  onClick={() => createMutation.mutate({ email: newAdminEmail, name: newAdminName || `Admin ${branch.name}`, password: newAdminPassword || undefined })}
                  data-testid="button-create-admin"
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Crear admin
                </Button>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ImpersonateButton({ branch, hasAdmin }: { branch: Branch; hasAdmin?: boolean }) {
  const { toast } = useToast();
  const { refetch } = useAuth();
  const [, setLocation] = useLocation();

  const mutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", "/api/superadmin/impersonate", { branchId: branch.id });
      return resp.json();
    },
    onSuccess: () => {
      queryClient.clear();
      toast({ title: `Modo soporte: ${branch.name}` });
      setTimeout(() => {
        refetch();
        setLocation("/dashboard");
      }, 300);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: extractErrorMessage(err, "No se puede iniciar modo soporte"), variant: "destructive" });
    },
  });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || hasAdmin === false}
          data-testid={`button-impersonate-${branch.id}`}
        >
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{hasAdmin === false ? "Primero crea o asigna un admin" : "Entrar como admin"}</TooltipContent>
    </Tooltip>
  );
}

function ResendWelcomeButton({ branch, hasAdmin }: { branch: Branch; hasAdmin?: boolean }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const { data: pkg, isLoading, isError, error } = useQuery<{
    branchName: string;
    branchSlug: string;
    adminEmail: string | null;
    adminName: string | null;
    hasAdmin: boolean;
  }>({
    queryKey: ["/api/superadmin/branches", branch.id, "welcome-package"],
    queryFn: async () => {
      const resp = await fetch(`/api/superadmin/branches/${branch.id}/welcome-package`, { credentials: "include" });
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`${resp.status}: ${text || resp.statusText}`);
      }
      return resp.json();
    },
    enabled: open,
    retry: false,
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  function getLinks(slug: string) {
    return {
      publicUrl: `${origin}/app/${slug}`,
      marketplace: `${origin}/explore`,
      favorites: `${origin}/favorites`,
      login: `${origin}/`,
      dashboard: `${origin}/dashboard`,
    };
  }

  function copyWelcome() {
    if (!pkg) return;
    const links = getLinks(pkg.branchSlug);
    const lines = [
      `Paquete de bienvenida - ${pkg.branchName}`,
      ``,
      `URLs importantes:`,
      `  Página pública (para clientes): ${links.publicUrl}`,
      `  Marketplace: ${links.marketplace}`,
      `  Favoritos: ${links.favorites}`,
      `  Login (admin): ${links.login}`,
      `  Dashboard (requiere login): ${links.dashboard}`,
    ];
    if (pkg.adminEmail) {
      lines.push(``, `Admin:`, `  Email: ${pkg.adminEmail}`);
      if (pkg.adminName) lines.push(`  Nombre: ${pkg.adminName}`);
      lines.push(`  (Contraseña no incluida — usa "Reset contraseña" si necesitas regenerarla)`);
    } else {
      lines.push(``, `AVISO: No hay admin asignado aún.`);
    }
    navigator.clipboard.writeText(lines.join("\n"));
    toast({ title: "Paquete de bienvenida copiado" });
  }

  function downloadTxt() {
    if (!pkg) return;
    const links = getLinks(pkg.branchSlug);
    const lines = [
      `Paquete de bienvenida - ${pkg.branchName}`,
      `==================================`,
      ``,
      `URLs importantes:`,
      `  Página pública: ${links.publicUrl}`,
      `  Marketplace: ${links.marketplace}`,
      `  Favoritos: ${links.favorites}`,
      `  Login: ${links.login}`,
      `  Dashboard: ${links.dashboard}`,
    ];
    if (pkg.adminEmail) {
      lines.push(``, `Admin:`, `  Email: ${pkg.adminEmail}`);
      if (pkg.adminName) lines.push(`  Nombre: ${pkg.adminName}`);
      lines.push(`  (Contraseña no incluida)`);
    } else {
      lines.push(``, `Sin admin asignado.`);
    }
    lines.push(``, `==================================`);
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bienvenida-${pkg.branchSlug}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" data-testid={`button-resend-welcome-${branch.id}`}>
                <Send className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reenviar paquete de bienvenida</TooltipContent>
          </Tooltip>
        </span>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Paquete de bienvenida</DialogTitle>
          <DialogDescription>URLs y datos de la sucursal. Puedes copiar o descargar.</DialogDescription>
        </DialogHeader>
        {isError ? (
          <div className="py-4 text-center space-y-2">
            <p className="text-sm text-destructive font-medium">No se pudo cargar el paquete de bienvenida</p>
            <p className="text-xs text-muted-foreground">
              {extractErrorMessage(error, "Error desconocido")}
            </p>
          </div>
        ) : isLoading || !pkg ? (
          <div className="space-y-2 py-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-40" />
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="p-3 bg-muted rounded-md space-y-2 text-sm">
              <p className="font-semibold">{pkg.branchName}</p>
              <div className="space-y-1 pt-1">
                <p><strong>URL pública:</strong> <code className="text-xs bg-background px-1 py-0.5 rounded">{getLinks(pkg.branchSlug).publicUrl}</code></p>
                <p><strong>Marketplace:</strong> <code className="text-xs bg-background px-1 py-0.5 rounded">{getLinks(pkg.branchSlug).marketplace}</code></p>
                <p><strong>Favoritos:</strong> <code className="text-xs bg-background px-1 py-0.5 rounded">{getLinks(pkg.branchSlug).favorites}</code></p>
                <p><strong>Login:</strong> <code className="text-xs bg-background px-1 py-0.5 rounded">{getLinks(pkg.branchSlug).login}</code></p>
                <p><strong>Dashboard:</strong> <code className="text-xs bg-background px-1 py-0.5 rounded">{getLinks(pkg.branchSlug).dashboard}</code></p>
              </div>
              {pkg.adminEmail ? (
                <div className="border-t pt-2 mt-2 space-y-1">
                  <p><strong>Email admin:</strong> {pkg.adminEmail}</p>
                  {pkg.adminName && <p><strong>Nombre:</strong> {pkg.adminName}</p>}
                  <p className="text-xs text-muted-foreground">La contraseña no se muestra. Usa "Reset contraseña" si necesitas regenerarla.</p>
                </div>
              ) : (
                <div className="border-t pt-2 mt-2">
                  <p className="text-amber-500 text-sm">No hay admin asignado a esta sucursal.</p>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={copyWelcome} className="flex-1" data-testid="button-copy-resend-welcome">
                <Copy className="h-4 w-4 mr-2" />
                Copiar
              </Button>
              <Button variant="outline" onClick={downloadTxt} className="flex-1" data-testid="button-download-resend-welcome">
                <Download className="h-4 w-4 mr-2" />
                Descargar
              </Button>
            </div>
          </div>
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

  const links = {
    publicUrl: `${origin}/app/${d.branchSlug}`,
    marketplace: `${origin}/explore`,
    favorites: `${origin}/favorites`,
    login: `${origin}/`,
    dashboard: `${origin}/dashboard`,
  };

  function copyWelcome() {
    const text = [
      `Paquete de bienvenida - ${d.branchName}`,
      ``,
      `URLs importantes:`,
      `  Página pública (para clientes): ${links.publicUrl}`,
      `  Marketplace: ${links.marketplace}`,
      `  Favoritos: ${links.favorites}`,
      `  Login (admin): ${links.login}`,
      `  Dashboard (requiere login): ${links.dashboard}`,
      ``,
      `Credenciales del administrador:`,
      `  Email: ${d.adminEmail}`,
      `  Contraseña: ${d.adminPassword}`,
    ].join("\n");
    navigator.clipboard.writeText(text);
    toast({ title: "Paquete de bienvenida copiado" });
  }

  function downloadTxt() {
    const text = [
      `Paquete de bienvenida - ${d.branchName}`,
      `==================================`,
      ``,
      `URLs importantes:`,
      `  Página pública: ${links.publicUrl}`,
      `  Marketplace: ${links.marketplace}`,
      `  Favoritos: ${links.favorites}`,
      `  Login: ${links.login}`,
      `  Dashboard: ${links.dashboard}`,
      ``,
      `Credenciales del administrador:`,
      `  Email: ${d.adminEmail}`,
      `  Contraseña: ${d.adminPassword}`,
      ``,
      `==================================`,
    ].join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bienvenida-${d.branchSlug}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sucursal creada exitosamente</DialogTitle>
          <DialogDescription>Guarda esta información antes de cerrar.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="p-3 bg-muted rounded-md space-y-2 text-sm">
            <p className="font-semibold">{d.branchName}</p>
            <div className="space-y-1 pt-1">
              <p><strong>URL pública:</strong> <code className="text-xs bg-background px-1 py-0.5 rounded">{links.publicUrl}</code></p>
              <p><strong>Marketplace:</strong> <code className="text-xs bg-background px-1 py-0.5 rounded">{links.marketplace}</code></p>
              <p><strong>Favoritos:</strong> <code className="text-xs bg-background px-1 py-0.5 rounded">{links.favorites}</code></p>
              <p><strong>Login (admin):</strong> <code className="text-xs bg-background px-1 py-0.5 rounded">{links.login}</code></p>
              <p><strong>Dashboard:</strong> <code className="text-xs bg-background px-1 py-0.5 rounded">{links.dashboard}</code></p>
            </div>
            <div className="border-t pt-2 mt-2 space-y-1">
              <p><strong>Email admin:</strong> {d.adminEmail}</p>
              <p><strong>Contraseña:</strong> <code className="text-xs bg-background px-1 py-0.5 rounded">{d.adminPassword}</code></p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={copyWelcome} className="flex-1" data-testid="button-copy-welcome">
              <Copy className="h-4 w-4 mr-2" />
              Copiar paquete de bienvenida
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

function CreateBranchDialog() {
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
      invalidateBranches();
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
            <DialogDescription>Completa los datos de la nueva sucursal.</DialogDescription>
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
                  <Label className="text-sm font-medium">Crear administrador</Label>
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
                            const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
                            let pw = "";
                            for (let i = 0; i < 14; i++) pw += chars.charAt(Math.floor(Math.random() * chars.length));
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

const ACTION_LABELS: Record<string, string> = {
  CREATE_BRANCH: "Crear sucursal",
  UPDATE_STATUS: "Cambiar estado",
  DELETE_BRANCH: "Eliminar sucursal",
  RESET_ADMIN_PASSWORD: "Reset contraseña",
  UPDATE_ADMIN: "Editar admin",
  REASSIGN_ADMIN: "Reasignar admin",
  CREATE_ADMIN: "Crear admin",
  IMPERSONATE_START: "Iniciar soporte",
  IMPERSONATE_END: "Fin soporte",
};

function AuditLogPanel() {
  const { data: logs, isLoading } = useQuery<(AuditLog & { actorEmail?: string | null })[]>({
    queryKey: ["/api/superadmin/audit"],
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 items-start">
            <Skeleton className="w-8 h-8 rounded-md" />
            <div className="space-y-1 flex-1"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-32" /></div>
          </div>
        ))}
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="text-center py-12">
        <History className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No hay actividad registrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[500px] overflow-y-auto">
      {logs.map((log) => {
        const meta = (log.metadata || {}) as Record<string, any>;
        let detail = "";
        if (meta.branchName) detail = meta.branchName;
        if (meta.oldStatus && meta.newStatus) detail = `${meta.oldStatus} → ${meta.newStatus}`;
        if (meta.adminEmail) detail = meta.adminEmail;
        if (meta.newEmail) detail = `${meta.oldEmail} → ${meta.newEmail}`;

        return (
          <div key={log.id} className="flex gap-3 items-start p-2 rounded-md hover-elevate" data-testid={`audit-log-${log.id}`}>
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted shrink-0">
              <History className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">{ACTION_LABELS[log.action] || log.action}</Badge>
                {detail && <span className="text-xs text-muted-foreground truncate">{detail}</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {log.actorEmail} &middot;{" "}
                {new Date(log.createdAt).toLocaleString("es-MX", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
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

  const { data: adminData, refetch: refetchAdmin } = useQuery<AdminInfo>({
    queryKey: ["/api/superadmin/branches", branch.id, "admin"],
    queryFn: async () => {
      const resp = await fetch(`/api/superadmin/branches/${branch.id}/admin`, { credentials: "include" });
      if (!resp.ok) return null;
      return resp.json();
    },
  });
  const hasAdmin = adminData !== undefined ? !!adminData : undefined;

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
              <p className="text-xs text-muted-foreground" data-testid={`text-admin-email-${branch.id}`}>
                {adminData ? (
                  <span className="text-green-600 dark:text-green-400">Admin: {adminData.email}</span>
                ) : adminData === null ? (
                  <span className="text-amber-500">Sin admin asignado</span>
                ) : null}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <StatusBadge status={branch.status} />
            {isDeleted && <Badge variant="destructive">Eliminada</Badge>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="text-center p-2 bg-muted/50 rounded-md">
            <p className="text-lg font-bold" data-testid={`text-customers-${branch.id}`}>
              {metrics?.customerCount ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">Clientes (activos)</p>
          </div>
          <div className="text-center p-2 bg-muted/50 rounded-md">
            <p className="text-lg font-bold" data-testid={`text-memberships-${branch.id}`}>
              {metrics?.activeMemberships ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">Membresías activas</p>
          </div>
        </div>

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
              <SelectTrigger className="w-[160px]" data-testid={`select-status-${branch.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Activa — Todo funciona</SelectItem>
                <SelectItem value="suspended">Suspendida — Admin ve banner "Pago pendiente"</SelectItem>
                <SelectItem value="blacklisted">Bloqueada — No permite acceso</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {!isDeleted && (
          <div className="flex items-center gap-1 mt-3 pt-3 border-t flex-wrap">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  asChild
                  data-testid={`button-open-app-${branch.id}`}
                >
                  <a href={`/app/${branch.slug}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Abrir app pública</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  asChild
                  data-testid={`button-open-dashboard-${branch.id}`}
                >
                  <a href="/dashboard" target="_blank" rel="noopener noreferrer">
                    <LayoutDashboard className="h-4 w-4" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Dashboard (requiere login)</TooltipContent>
            </Tooltip>
            <ImpersonateButton branch={branch} hasAdmin={hasAdmin} />
            <AdminDialog branch={branch} onAdminChanged={() => refetchAdmin()} />
            <ResetPasswordDialog branch={branch} hasAdmin={hasAdmin} />
            <ResendWelcomeButton branch={branch} hasAdmin={hasAdmin} />
            <DeleteBranchDialog branch={branch} />
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
      const resp = await apiRequest("PATCH", `/api/branches/${id}/status`, { status });
      return resp.json();
    },
    onSuccess: () => {
      invalidateBranches();
      toast({ title: "Estado actualizado" });
    },
    onError: async (err: any, variables) => {
      const errorMsg = extractErrorMessage(err, "No se pudo actualizar el estado");
      const is5xx = err?.message?.startsWith("5");
      if (is5xx) {
        toast({ title: "Reintentando...", description: "Error de servidor, reintentando..." });
        try {
          await apiRequest("PATCH", `/api/branches/${variables.id}/status`, { status: variables.status });
          invalidateBranches();
          toast({ title: "Estado actualizado (reintento exitoso)" });
          return;
        } catch {
          // retry failed, fall through to error toast
        }
      }
      invalidateBranches();
      toast({ title: "Error", description: errorMsg, variant: "destructive" });
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
                <p className="text-xs text-muted-foreground">Clientes (activos)</p>
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
                <p className="text-xs text-muted-foreground">Membresías activas</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="branches" className="w-full">
          <TabsList data-testid="tabs-superadmin">
            <TabsTrigger value="branches" data-testid="tab-branches">Sucursales</TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-activity">Actividad</TabsTrigger>
          </TabsList>

          <TabsContent value="branches" className="space-y-4 mt-4">
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
                <CreateBranchDialog />
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
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <Card>
              <CardContent className="p-4">
                <h2 className="font-semibold text-lg mb-4" data-testid="text-activity-title">Actividad reciente</h2>
                <AuditLogPanel />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
