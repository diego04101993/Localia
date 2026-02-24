import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Users,
  UserPlus,
  Link2,
  Search,
  ClipboardCheck,
  StickyNote,
  Mail,
  Phone,
  Calendar,
  Copy,
  Check,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface BranchClient {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  membershipId: string;
  membershipStatus: string;
  joinedAt: string;
  lastSeenAt: string | null;
  source: string;
  isFavorite: boolean;
  lastAttendance: string | null;
}

interface ClientProfile {
  user: { id: string; name: string; email: string; phone: string | null; createdAt: string };
  membership: { id: string; status: string; joinedAt: string; lastSeenAt: string | null; source: string };
  notes: { id: string; content: string; createdAt: string; createdByName?: string }[];
  recentAttendances: { id: string; checkedInAt: string }[];
  totalAttendances: number;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "Nunca";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;
  if (days < 30) return `Hace ${Math.floor(days / 7)} sem`;
  return `Hace ${Math.floor(days / 30)} meses`;
}

function CreateClientDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; phone?: string }) => {
      const resp = await apiRequest("POST", "/api/branch/clients", data);
      return resp.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/branch/stats"] });
      if (data.password) {
        setCreatedPassword(data.password);
        toast({ title: "Cliente creado" });
      } else {
        toast({ title: data.message || "Cliente agregado" });
        resetAndClose();
      }
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Error al crear cliente", variant: "destructive" });
    },
  });

  function resetAndClose() {
    setName("");
    setEmail("");
    setPhone("");
    setCreatedPassword(null);
    onOpenChange(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({ name, email, phone: phone || undefined });
  }

  if (createdPassword) {
    return (
      <Dialog open={open} onOpenChange={() => resetAndClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cliente creado</DialogTitle>
            <DialogDescription>Comparte estas credenciales con el cliente</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-muted rounded-md p-3 space-y-2 text-sm">
              <p><span className="font-medium">Email:</span> {email}</p>
              <p><span className="font-medium">Contraseña:</span> {createdPassword}</p>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                navigator.clipboard.writeText(`Email: ${email}\nContraseña: ${createdPassword}`);
                toast({ title: "Copiado al portapapeles" });
              }}
              data-testid="button-copy-credentials"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copiar credenciales
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={resetAndClose} data-testid="button-close-credentials">Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear cliente</DialogTitle>
          <DialogDescription>Agrega un nuevo cliente a tu sucursal</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client-name">Nombre *</Label>
            <Input
              id="client-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre del cliente"
              required
              data-testid="input-client-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-email">Email *</Label>
            <Input
              id="client-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              required
              data-testid="input-client-email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-phone">Teléfono (opcional)</Label>
            <Input
              id="client-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="55 1234 5678"
              data-testid="input-client-phone"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-create-client">Cancelar</Button>
            <Button type="submit" disabled={createMutation.isPending || !name || !email} data-testid="button-submit-client">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Crear
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InviteLinkDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: linkData } = useQuery<{ inviteUrl: string; slug: string }>({
    queryKey: ["/api/branch/invite-link"],
    enabled: open,
  });

  function copyLink() {
    if (linkData?.inviteUrl) {
      navigator.clipboard.writeText(linkData.inviteUrl);
      setCopied(true);
      toast({ title: "Link copiado" });
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar cliente</DialogTitle>
          <DialogDescription>Comparte este link para que los clientes se registren y se unan a tu sucursal</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {linkData ? (
            <div className="flex gap-2">
              <Input value={linkData.inviteUrl} readOnly className="font-mono text-sm" data-testid="input-invite-url" />
              <Button variant="outline" onClick={copyLink} data-testid="button-copy-invite">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          ) : (
            <Skeleton className="h-10 w-full" />
          )}
          <p className="text-xs text-muted-foreground">
            Cuando un cliente visite este link y se registre, quedará asociado a tu sucursal automáticamente.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} data-testid="button-close-invite">Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClientProfileDialog({ clientId, open, onOpenChange }: {
  clientId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const [noteContent, setNoteContent] = useState("");

  const { data: profile, isLoading } = useQuery<ClientProfile>({
    queryKey: ["/api/branch/clients", clientId],
    enabled: open && !!clientId,
  });

  const noteMutation = useMutation({
    mutationFn: async (content: string) => {
      const resp = await apiRequest("POST", `/api/branch/clients/${clientId}/notes`, { content });
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/clients", clientId] });
      setNoteContent("");
      toast({ title: "Nota agregada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Error al crear nota", variant: "destructive" });
    },
  });

  const attendanceMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", `/api/branch/clients/${clientId}/attendance`);
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/clients", clientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/branch/clients"] });
      toast({ title: "Asistencia registrada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Error al registrar asistencia", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Perfil del cliente</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-40" />
          </div>
        ) : profile ? (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg" data-testid="text-profile-name">{profile.user.name}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <Mail className="h-3.5 w-3.5" />
                <span data-testid="text-profile-email">{profile.user.email}</span>
              </div>
              {profile.user.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <Phone className="h-3.5 w-3.5" />
                  <span data-testid="text-profile-phone">{profile.user.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <Calendar className="h-3.5 w-3.5" />
                <span>Desde {formatDate(profile.user.createdAt)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant={profile.membership.status === "active" ? "default" : "secondary"} data-testid="badge-client-status">
                {profile.membership.status === "active" ? "Activo" : profile.membership.status === "banned" ? "Bloqueado" : "Inactivo"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Membresía desde {formatDate(profile.membership.joinedAt)} · {profile.membership.source === "admin_created" ? "Creado por admin" : profile.membership.source === "invite" ? "Por invitación" : "Auto-registro"}
              </span>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => attendanceMutation.mutate()}
                disabled={attendanceMutation.isPending || profile.membership.status !== "active"}
                data-testid="button-register-attendance"
              >
                {attendanceMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <ClipboardCheck className="h-4 w-4 mr-1" />
                )}
                Registrar asistencia
              </Button>
              <div className="text-xs text-muted-foreground self-center">
                {profile.totalAttendances} asistencia{profile.totalAttendances !== 1 ? "s" : ""} total
              </div>
            </div>

            {profile.recentAttendances.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Últimas asistencias</h4>
                <div className="space-y-1">
                  {profile.recentAttendances.slice(0, 5).map((att) => (
                    <div key={att.id} className="text-xs text-muted-foreground flex items-center gap-2">
                      <Check className="h-3 w-3 text-green-500" />
                      {formatDateTime(att.checkedInAt)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <StickyNote className="h-3.5 w-3.5" />
                Notas internas ({profile.notes.length})
              </h4>
              <div className="space-y-2 mb-3">
                {profile.notes.length === 0 && (
                  <p className="text-xs text-muted-foreground">Sin notas</p>
                )}
                {profile.notes.map((note) => (
                  <div key={note.id} className="bg-muted rounded-md p-2 text-sm" data-testid={`note-${note.id}`}>
                    <p>{note.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {note.createdByName} · {formatDateTime(note.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Agregar nota interna..."
                  className="text-sm min-h-[60px]"
                  data-testid="input-note-content"
                />
              </div>
              <Button
                size="sm"
                className="mt-2"
                onClick={() => noteContent.trim() && noteMutation.mutate(noteContent.trim())}
                disabled={noteMutation.isPending || !noteContent.trim()}
                data-testid="button-add-note"
              >
                {noteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <StickyNote className="h-3.5 w-3.5 mr-1" />}
                Agregar nota
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No se encontró el perfil del cliente.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function ClientesTab() {
  const [search, setSearch] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showProfileDialog, setShowProfileDialog] = useState(false);

  const { data: clients, isLoading } = useQuery<BranchClient[]>({
    queryKey: ["/api/branch/clients"],
  });

  const filteredClients = (clients || []).filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q))
    );
  });

  function openProfile(userId: string) {
    setSelectedClientId(userId);
    setShowProfileDialog(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email, teléfono..."
            className="pl-9"
            data-testid="input-search-clients"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowInviteDialog(true)} data-testid="button-invite-client">
            <Link2 className="h-4 w-4 mr-1" />
            Invitar
          </Button>
          <Button size="sm" onClick={() => setShowCreateDialog(true)} data-testid="button-create-client">
            <UserPlus className="h-4 w-4 mr-1" />
            Crear cliente
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredClients.length === 0 ? (
        <Card>
          <CardContent className="p-4">
            <div className="text-center py-12" data-testid="empty-clients">
              <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-1">
                {search ? "Sin resultados" : "Sin clientes"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {search
                  ? `No se encontraron clientes con "${search}"`
                  : "Agrega tu primer cliente o comparte el link de invitación."}
              </p>
              {!search && (
                <div className="flex gap-2 justify-center mt-4">
                  <Button variant="outline" size="sm" onClick={() => setShowInviteDialog(true)} data-testid="button-empty-invite">
                    <Link2 className="h-4 w-4 mr-1" />
                    Invitar
                  </Button>
                  <Button size="sm" onClick={() => setShowCreateDialog(true)} data-testid="button-empty-create">
                    <UserPlus className="h-4 w-4 mr-1" />
                    Crear cliente
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1">
          {filteredClients.map((client) => (
            <Card
              key={client.userId}
              className="cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => openProfile(client.userId)}
              data-testid={`card-client-${client.userId}`}
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 shrink-0">
                    <span className="text-sm font-semibold text-primary">
                      {client.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate" data-testid={`text-client-name-${client.userId}`}>
                        {client.name}
                      </p>
                      <Badge
                        variant={client.membershipStatus === "active" ? "default" : "secondary"}
                        className="text-[10px] px-1.5 py-0"
                        data-testid={`badge-client-status-${client.userId}`}
                      >
                        {client.membershipStatus === "active" ? "Activo" : client.membershipStatus === "banned" ? "Bloqueado" : "Inactivo"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="truncate">{client.email}</span>
                      {client.phone && <span>{client.phone}</span>}
                    </div>
                  </div>
                  <div className="hidden sm:flex flex-col items-end gap-0.5 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      Última visita: {timeAgo(client.lastAttendance)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Desde {formatDate(client.joinedAt)}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
          <p className="text-xs text-muted-foreground text-center pt-2" data-testid="text-clients-total">
            {filteredClients.length} cliente{filteredClients.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      <CreateClientDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
      <InviteLinkDialog open={showInviteDialog} onOpenChange={setShowInviteDialog} />
      <ClientProfileDialog
        clientId={selectedClientId}
        open={showProfileDialog}
        onOpenChange={setShowProfileDialog}
      />
    </div>
  );
}
