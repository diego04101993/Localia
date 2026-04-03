import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Users,
  UserPlus,
  Plus,
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
  Package,
  Hash,
  XCircle,
  Download,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Heart,
  Shield,
  Camera,
  ImageOff,
  MessageCircle,
  DollarSign,
  KeyRound,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface BranchClient {
  userId: string;
  name: string;
  lastName: string | null;
  email: string;
  phone: string | null;
  birthDate: string | null;
  gender: string | null;
  membershipId: string;
  membershipStatus: string;
  joinedAt: string;
  lastSeenAt: string | null;
  source: string;
  isFavorite: boolean;
  lastAttendance: string | null;
  planId: string | null;
  planNameSnapshot: string | null;
  planName: string | null;
  planStatus: "active" | "expired" | "deleted" | null;
  classesRemaining: number | null;
  classesTotal: number | null;
  expiresAt: string | null;
  paidAt: string | null;
  avatarUrl: string | null;
  clientStatus: string;
  hasDebt: boolean;
  debtAmount: number;
}

interface MembershipPlan {
  id: string;
  name: string;
  price: number;
  durationDays: number | null;
  classLimit: number | null;
  isActive: boolean;
}

interface ClientProfile {
  user: {
    id: string;
    name: string;
    lastName: string | null;
    email: string;
    phone: string | null;
    birthDate: string | null;
    gender: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    medicalNotes: string | null;
    injuriesNotes: string | null;
    medicalWarnings: string | null;
    parqAccepted: boolean;
    parqAcceptedDate: string | null;
    avatarUrl: string | null;
    createdAt: string;
  };
  membership: {
    id: string;
    status: string;
    clientStatus: string;
    hasDebt: boolean;
    debtAmount: number;
    joinedAt: string;
    lastSeenAt: string | null;
    source: string;
    planId: string | null;
    classesRemaining: number | null;
    classesTotal: number | null;
    expiresAt: string | null;
    paidAt: string | null;
  };
  planStatus: "active" | "expired" | "deleted" | null;
  planNameSnapshot: string | null;
  plan: { id: string; name: string; price: number; durationDays: number | null; classLimit: number | null } | null;
  notes: { id: string; content: string; createdAt: string; createdByName?: string }[];
  recentAttendances: { id: string; checkedInAt: string }[];
  totalAttendances: number;
  nextBooking: { bookingDate: string; className: string; startTime: string } | null;
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

function isBirthdayToday(birthDate: string | null): boolean {
  if (!birthDate) return false;
  const today = new Date();
  const [, monthStr, dayStr] = birthDate.split("-");
  return parseInt(monthStr) === today.getMonth() + 1 && parseInt(dayStr) === today.getDate();
}

function calcAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function genderLabel(g: string | null): string {
  if (g === "M") return "Masculino";
  if (g === "F") return "Femenino";
  if (g === "NE") return "No especifica";
  return "";
}

function displayName(name: string, lastName: string | null): string {
  return lastName ? `${name} ${lastName}` : name;
}

function cycleLabel(cycleMonths: number | null | undefined): string {
  if (cycleMonths === 0) return "Por clase";
  if (!cycleMonths || cycleMonths === 1) return "Mensual";
  if (cycleMonths === 3) return "Trimestral";
  if (cycleMonths === 6) return "Semestral";
  if (cycleMonths === 12) return "Anual";
  return `${cycleMonths} meses`;
}

function clientStatusLabel(s: string): string {
  if (s === "active") return "Activo";
  if (s === "inactive") return "Inactivo";
  if (s === "frozen") return "Congelado";
  return s;
}

function clientStatusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "active") return "default";
  if (s === "inactive") return "secondary";
  if (s === "frozen") return "outline";
  return "secondary";
}

function normalizePhoneMX(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("52")) return digits;
  if (digits.startsWith("1") && digits.length === 11) return "52" + digits.slice(1);
  if (digits.length === 10) return "52" + digits;
  return digits;
}

type WaModalTarget = {
  name: string;
  lastName: string | null;
  phone: string | null;
  expiresAt: string | null;
  classesRemaining: number | null;
  classesTotal: number | null;
  planName: string | null;
};

const TEMPLATE_LABELS: Record<string, string> = {
  expired_membership: "Membresía vencida",
  expiring_membership: "Membresía por vencer",
  no_classes: "Sin clases disponibles",
  birthday_greeting: "Feliz cumpleaños",
  plan_renewal: "Renovaste tu plan",
};

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

function WhatsAppModal({ target, branchName, onClose }: {
  target: WaModalTarget | null;
  branchName: string;
  onClose: () => void;
}) {
  const [selectedTemplate, setSelectedTemplate] = useState("expired_membership");
  const [message, setMessage] = useState("");

  const { data: templates } = useQuery<Record<string, string>>({
    queryKey: ["/api/branch/whatsapp-templates"],
    enabled: !!target,
  });

  const vars = useMemo<Record<string, string>>(() => {
    if (!target) return {};
    return {
      firstName: target.name,
      fullName: displayName(target.name, target.lastName),
      branchName,
      expiresAt: target.expiresAt ? formatDate(target.expiresAt) ?? "" : "",
      classesRemaining: target.classesRemaining?.toString() ?? "",
      classesTotal: target.classesTotal?.toString() ?? "",
      planName: target.planName ?? "",
    };
  }, [target, branchName]);

  useEffect(() => {
    if (templates && templates[selectedTemplate]) {
      setMessage(fillTemplate(templates[selectedTemplate], vars));
    }
  }, [selectedTemplate, templates, vars]);

  const phone = target?.phone ? normalizePhoneMX(target.phone) : null;
  const waLink = phone && message.trim()
    ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    : null;

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="dialog-whatsapp">
        <DialogHeader>
          <DialogTitle>Enviar WhatsApp</DialogTitle>
          <DialogDescription>
            {target ? `Para: ${displayName(target.name, target.lastName)}` : ""}
          </DialogDescription>
        </DialogHeader>
        {!target?.phone ? (
          <p className="text-sm text-muted-foreground py-2" data-testid="text-wa-no-phone">
            Este cliente no tiene número de teléfono registrado. Edita su perfil para agregarlo.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              <span data-testid="text-wa-phone">{target.phone}</span>
            </div>
            <div>
              <Label>Plantilla</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger className="mt-1" data-testid="select-wa-template">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TEMPLATE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key} data-testid={`option-wa-${key}`}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mensaje (puedes editarlo antes de enviar)</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                className="mt-1 text-sm"
                data-testid="textarea-wa-message"
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-wa-cancel">Cancelar</Button>
          {waLink && (
            <Button
              onClick={() => window.open(waLink, "_blank")}
              className="bg-green-600 hover:bg-green-700 text-white"
              data-testid="button-wa-open"
            >
              <MessageCircle className="h-4 w-4 mr-1" />
              Abrir WhatsApp
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getInitials(name: string, lastName: string | null): string {
  const first = name.charAt(0).toUpperCase();
  const last = lastName ? lastName.charAt(0).toUpperCase() : "";
  return last ? `${first}${last}` : first;
}

function ClientAvatar({ avatarUrl, name, lastName, size = "md" }: { avatarUrl: string | null; name: string; lastName: string | null; size?: "sm" | "md" | "lg" }) {
  const sizeClasses = size === "sm" ? "w-8 h-8 text-xs" : size === "md" ? "w-10 h-10 text-sm" : "w-16 h-16 text-xl";

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={displayName(name, lastName)}
        className={`${sizeClasses} rounded-full object-cover shrink-0`}
        data-testid="client-avatar-image"
      />
    );
  }

  return (
    <div className={`${sizeClasses} rounded-full bg-primary/10 flex items-center justify-center shrink-0`} data-testid="client-avatar-initials">
      <span className="font-semibold text-primary">{getInitials(name, lastName)}</span>
    </div>
  );
}

function AvatarUploadSection({ clientId, avatarUrl, name, lastName }: { clientId: string; avatarUrl: string | null; name: string; lastName: string | null }) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast({ title: "Formato no válido", description: "Solo jpg, png o webp", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Archivo muy grande", description: "Máximo 5MB", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const resp = await fetch(`/api/branch/clients/${clientId}/avatar`, {
        method: "POST",
        body: formData,
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.message || "Error al subir");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/branch/clients", clientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/branch/clients"] });
      toast({ title: "Foto actualizada" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  const removeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/branch/clients/${clientId}/avatar`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/clients", clientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/branch/clients"] });
      toast({ title: "Foto eliminada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="flex items-center gap-3">
      <ClientAvatar avatarUrl={avatarUrl} name={name} lastName={lastName} size="lg" />
      <div className="flex flex-col gap-1">
        <label className="cursor-pointer" data-testid="client-avatar-upload">
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleUpload} disabled={uploading} />
          <span className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
            {avatarUrl ? "Cambiar foto" : "Subir foto"}
          </span>
        </label>
        {avatarUrl && (
          <button
            onClick={() => removeMutation.mutate()}
            disabled={removeMutation.isPending}
            className="inline-flex items-center gap-1 text-xs text-red-500 hover:underline"
            data-testid="client-avatar-remove"
          >
            <ImageOff className="h-3 w-3" />
            Eliminar foto
          </button>
        )}
      </div>
    </div>
  );
}

function CreateClientDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const branchSlug = (user?.branch as any)?.slug ?? "";
  const appLink = branchSlug ? `${window.location.origin}/app/${branchSlug}` : "";
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [medicalNotes, setMedicalNotes] = useState("");
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
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
    setName(""); setLastName(""); setEmail(""); setPhone("");
    setShowMore(false); setBirthDate(""); setGender("");
    setEmergencyContactName(""); setEmergencyContactPhone("");
    setMedicalNotes(""); setCreatedPassword(null);
    onOpenChange(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data: any = { name, email, phone: phone || undefined };
    if (lastName) data.lastName = lastName;
    if (birthDate) data.birthDate = birthDate;
    if (gender) data.gender = gender;
    if (emergencyContactName) data.emergencyContactName = emergencyContactName;
    if (emergencyContactPhone) data.emergencyContactPhone = emergencyContactPhone;
    if (medicalNotes) data.medicalNotes = medicalNotes;
    createMutation.mutate(data);
  }

  if (createdPassword) {
    const clientName = [name, lastName].filter(Boolean).join(" ");
    const accessText = `Hola ${name}, aquí están tus datos de acceso para ${(user?.branch as any)?.name ?? "el estudio"}:\n\nUsuario (email): ${email}\nContraseña: ${createdPassword}${appLink ? `\nApp: ${appLink}` : ""}`;
    const waPhone = phone ? normalizePhoneMX(phone) : null;
    return (
      <Dialog open={open} onOpenChange={() => resetAndClose()}>
        <DialogContent data-testid="dialog-credentials">
          <DialogHeader>
            <DialogTitle>Cliente creado</DialogTitle>
            <DialogDescription>Comparte las credenciales de acceso con {clientName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-muted rounded-md p-3 space-y-2 text-sm font-mono" data-testid="box-credentials">
              <p><span className="font-sans font-medium">Email:</span> {email}</p>
              <p><span className="font-sans font-medium">Contraseña:</span> {createdPassword}</p>
              {appLink && <p><span className="font-sans font-medium">App:</span> {appLink}</p>}
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                navigator.clipboard.writeText(accessText);
                toast({ title: "Copiado al portapapeles" });
              }}
              data-testid="button-copy-credentials"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copiar acceso completo
            </Button>
            {waPhone && (
              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                onClick={() => window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(accessText)}`, "_blank")}
                data-testid="button-wa-credentials"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Enviar acceso por WhatsApp
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetAndClose} data-testid="button-close-credentials">Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear cliente</DialogTitle>
          <DialogDescription>Agrega un nuevo cliente a tu sucursal</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="client-name">Nombre *</Label>
              <Input id="client-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" required data-testid="input-client-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-lastname">Apellidos</Label>
              <Input id="client-lastname" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Apellidos" data-testid="input-client-lastname" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-email">Email *</Label>
            <Input id="client-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" required data-testid="input-client-email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-phone">Teléfono (opcional)</Label>
            <Input id="client-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="55 1234 5678" data-testid="input-client-phone" />
          </div>

          <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => setShowMore(!showMore)} data-testid="button-toggle-more-fields">
            {showMore ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
            {showMore ? "Menos datos" : "Más datos"}
          </Button>

          {showMore && (
            <div className="space-y-3 border-t pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="client-birthdate">Fecha de nacimiento</Label>
                  <Input id="client-birthdate" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} data-testid="input-client-birthdate" />
                </div>
                <div className="space-y-2">
                  <Label>Género</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger data-testid="select-client-gender">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Masculino</SelectItem>
                      <SelectItem value="F">Femenino</SelectItem>
                      <SelectItem value="NE">No especifica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="client-emergency-name">Contacto de emergencia</Label>
                  <Input id="client-emergency-name" value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} placeholder="Nombre" data-testid="input-client-emergency-name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-emergency-phone">Tel. emergencia</Label>
                  <Input id="client-emergency-phone" value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)} placeholder="55 1234 5678" data-testid="input-client-emergency-phone" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-medical">Notas médicas (privado)</Label>
                <Textarea id="client-medical" value={medicalNotes} onChange={(e) => setMedicalNotes(e.target.value)} placeholder="Alergias, condiciones, etc." className="min-h-[60px] text-sm" data-testid="input-client-medical" />
              </div>
            </div>
          )}

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

function EditClientDialog({ clientId, open, onOpenChange }: { clientId: string | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [medicalNotes, setMedicalNotes] = useState("");
  const [injuriesNotes, setInjuriesNotes] = useState("");
  const [medicalWarnings, setMedicalWarnings] = useState("");
  const [parqAccepted, setParqAccepted] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const { data: profile } = useQuery<ClientProfile>({
    queryKey: ["/api/branch/clients", clientId],
    enabled: open && !!clientId,
  });

  useEffect(() => {
    if (profile && !loaded) {
      setName(profile.user.name || "");
      setEmail(profile.user.email || "");
      setLastName(profile.user.lastName || "");
      setPhone(profile.user.phone || "");
      setBirthDate(profile.user.birthDate || "");
      setGender(profile.user.gender || "");
      setEmergencyContactName(profile.user.emergencyContactName || "");
      setEmergencyContactPhone(profile.user.emergencyContactPhone || "");
      setMedicalNotes(profile.user.medicalNotes || "");
      setInjuriesNotes(profile.user.injuriesNotes || "");
      setMedicalWarnings(profile.user.medicalWarnings || "");
      setParqAccepted(profile.user.parqAccepted || false);
      setLoaded(true);
    }
  }, [profile, loaded]);

  const editMutation = useMutation({
    mutationFn: async (data: any) => {
      const resp = await apiRequest("PATCH", `/api/branch/clients/${clientId}`, data);
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/branch/clients", clientId] });
      toast({ title: "Cliente actualizado" });
      handleClose();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Error al actualizar", variant: "destructive" });
    },
  });

  function handleClose() {
    setLoaded(false);
    onOpenChange(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    editMutation.mutate({
      name: name || undefined,
      email: email || undefined,
      lastName: lastName || null,
      phone: phone || null,
      birthDate: birthDate || null,
      gender: gender || null,
      emergencyContactName: emergencyContactName || null,
      emergencyContactPhone: emergencyContactPhone || null,
      medicalNotes: medicalNotes || null,
      injuriesNotes: injuriesNotes || null,
      medicalWarnings: medicalWarnings || null,
      parqAccepted,
      parqAcceptedDate: parqAccepted ? (profile?.user.parqAcceptedDate || new Date().toISOString().split("T")[0]) : null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar cliente</DialogTitle>
          <DialogDescription>Modifica los datos del cliente</DialogDescription>
        </DialogHeader>
        {!profile ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required data-testid="input-edit-name" />
              </div>
              <div className="space-y-2">
                <Label>Apellidos</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} data-testid="input-edit-lastname" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="input-edit-email" />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="input-edit-phone" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Fecha de nacimiento</Label>
                <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} data-testid="input-edit-birthdate" />
              </div>
              <div className="space-y-2">
                <Label>Género</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger data-testid="select-edit-gender">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Femenino</SelectItem>
                    <SelectItem value="NE">No especifica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Contacto de emergencia</Label>
                <Input value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} placeholder="Nombre" data-testid="input-edit-emergency-name" />
              </div>
              <div className="space-y-2">
                <Label>Tel. emergencia</Label>
                <Input value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)} placeholder="55 1234 5678" data-testid="input-edit-emergency-phone" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notas médicas (privado)</Label>
              <Textarea value={medicalNotes} onChange={(e) => setMedicalNotes(e.target.value)} placeholder="Alergias, condiciones, etc." className="min-h-[60px] text-sm" data-testid="input-edit-medical" />
            </div>
            <div className="space-y-2">
              <Label>Lesiones / limitaciones</Label>
              <Textarea value={injuriesNotes} onChange={(e) => setInjuriesNotes(e.target.value)} placeholder="Rodilla derecha operada, espalda baja sensible, etc." className="min-h-[60px] text-sm" data-testid="input-edit-injuries" />
            </div>
            <div className="space-y-2">
              <Label>Advertencias médicas</Label>
              <Textarea value={medicalWarnings} onChange={(e) => setMedicalWarnings(e.target.value)} placeholder="Hipertensión, asma, toma medicamento X, etc." className="min-h-[60px] text-sm" data-testid="input-edit-warnings" />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="parq-accepted"
                checked={parqAccepted}
                onChange={(e) => setParqAccepted(e.target.checked)}
                className="rounded"
                data-testid="input-edit-parq"
              />
              <Label htmlFor="parq-accepted" className="cursor-pointer text-sm">
                PAR-Q firmado / aceptado
              </Label>
              {parqAccepted && profile?.user.parqAcceptedDate && (
                <span className="text-xs text-muted-foreground">({profile.user.parqAcceptedDate})</span>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} data-testid="button-cancel-edit">Cancelar</Button>
              <Button type="submit" disabled={editMutation.isPending || !name} data-testid="button-save-edit">
                {editMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Pencil className="h-4 w-4 mr-2" />}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        )}
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

function ClientDebtSection({ clientId, hasDebt, debtAmount }: { clientId: string; hasDebt: boolean; debtAmount: number }) {
  const { toast } = useToast();
  const [localHasDebt, setLocalHasDebt] = useState(hasDebt);
  const [localAmount, setLocalAmount] = useState(String(debtAmount / 100));

  useEffect(() => {
    setLocalHasDebt(hasDebt);
    setLocalAmount(String(debtAmount / 100));
  }, [hasDebt, debtAmount]);

  const debtMutation = useMutation({
    mutationFn: async (data: { hasDebt: boolean; debtAmount: number }) => {
      const resp = await apiRequest("PATCH", `/api/branch/clients/${clientId}/debt`, data);
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/clients", clientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/branch/clients"] });
      toast({ title: "Adeudo actualizado" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function saveDebt() {
    const cents = Math.round(parseFloat(localAmount || "0") * 100);
    debtMutation.mutate({ hasDebt: localHasDebt, debtAmount: cents });
  }

  return (
    <div className="bg-muted/50 rounded-md p-3 space-y-2">
      <h4 className="text-sm font-medium flex items-center gap-1.5">
        <DollarSign className="h-3.5 w-3.5" />
        Adeudo
      </h4>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input
            type="checkbox"
            checked={localHasDebt}
            onChange={(e) => setLocalHasDebt(e.target.checked)}
            className="rounded"
            data-testid="client-debt-toggle"
          />
          Tiene adeudo
        </label>
        {localHasDebt && (
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">$</span>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={localAmount}
              onChange={(e) => setLocalAmount(e.target.value)}
              className="w-24 h-7 text-sm"
              placeholder="0.00"
              data-testid="client-debt-amount"
            />
            <span className="text-xs text-muted-foreground">MXN</span>
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={saveDebt}
          disabled={debtMutation.isPending}
          data-testid="client-debt-save"
        >
          {debtMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Guardar"}
        </Button>
      </div>
    </div>
  );
}

function ClientStatusSelector({ clientId, currentStatus }: { clientId: string; currentStatus: string }) {
  const { toast } = useToast();

  const statusMutation = useMutation({
    mutationFn: async (clientStatus: string) => {
      const resp = await apiRequest("PATCH", `/api/branch/clients/${clientId}/status`, { clientStatus });
      return resp.json();
    },
    onSuccess: (_data, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/clients", clientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/branch/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/branch/stats"] });
      toast({ title: `Status actualizado a ${clientStatusLabel(newStatus)}` });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="flex items-center gap-2">
      <Badge variant={clientStatusVariant(currentStatus)} data-testid="badge-client-status">
        {clientStatusLabel(currentStatus)}
      </Badge>
      <Select
        value={currentStatus}
        onValueChange={(val) => statusMutation.mutate(val)}
        disabled={statusMutation.isPending}
      >
        <SelectTrigger className="w-[140px] h-7 text-xs" data-testid="client-status-select">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="active">Activo</SelectItem>
          <SelectItem value="inactive">Inactivo</SelectItem>
          <SelectItem value="frozen">Congelado</SelectItem>
        </SelectContent>
      </Select>
      {statusMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
      {currentStatus === "inactive" && (
        <span className="text-xs text-orange-500">No puede reservar</span>
      )}
      {currentStatus === "frozen" && (
        <span className="text-xs text-blue-500">Sin asistencia ni reservas</span>
      )}
    </div>
  );
}

function ClientProfileDialog({ clientId, open, onOpenChange, onEdit, onDelete, onWhatsApp }: {
  clientId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  onWhatsApp?: (target: WaModalTarget) => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const branchSlug = (user?.branch as any)?.slug ?? "";
  const appLink = branchSlug ? `${window.location.origin}/app/${branchSlug}` : "";
  const [noteContent, setNoteContent] = useState("");
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [showPlanSelect, setShowPlanSelect] = useState(false);
  const { data: profile, isLoading } = useQuery<ClientProfile>({
    queryKey: ["/api/branch/clients", clientId],
    enabled: open && !!clientId,
  });

  const { data: plans } = useQuery<MembershipPlan[]>({
    queryKey: ["/api/branch/plans"],
    enabled: open && showPlanSelect,
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

  const assignPlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      const resp = await apiRequest("POST", `/api/branch/memberships/${profile!.membership.id}/assign-plan`, { planId });
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/clients", clientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/branch/clients"] });
      setShowPlanSelect(false);
      toast({ title: "Plan asignado" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Error al asignar plan", variant: "destructive" });
    },
  });

  const removePlanMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("DELETE", `/api/branch/memberships/${profile!.membership.id}/plan`);
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/clients", clientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/branch/clients"] });
      toast({ title: "Plan removido" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Error al remover plan", variant: "destructive" });
    },
  });

  const renewMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", `/api/branch/memberships/${profile!.membership.id}/renew`);
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/clients", clientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/branch/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/branch/alerts"] });
      toast({ title: "Membresía renovada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Error al renovar", variant: "destructive" });
    },
  });

  const activePlans = (plans || []).filter(p => p.isActive);
  const age = profile ? calcAge(profile.user.birthDate) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Perfil del cliente</DialogTitle>
          <DialogDescription>Información detallada y acciones</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-40" />
          </div>
        ) : profile ? (
          <div className="space-y-4">
            <AvatarUploadSection
              clientId={profile.user.id}
              avatarUrl={profile.user.avatarUrl}
              name={profile.user.name}
              lastName={profile.user.lastName}
            />

            <div>
              <h3 className="font-semibold text-lg" data-testid="text-profile-name">
                {displayName(profile.user.name, profile.user.lastName)}
              </h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <Mail className="h-3.5 w-3.5" />
                <span data-testid="text-profile-email">{profile.user.email}</span>
              </div>
              {profile.user.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <Phone className="h-3.5 w-3.5" />
                  <span data-testid="text-profile-phone">{profile.user.phone}</span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700 hover:underline ml-1"
                    data-testid="client-whatsapp"
                    onClick={(e) => {
                      e.stopPropagation();
                      onWhatsApp?.({
                        name: profile.user.name,
                        lastName: profile.user.lastName,
                        phone: profile.user.phone,
                        expiresAt: profile.membership?.expiresAt ?? null,
                        classesRemaining: profile.membership?.classesRemaining ?? null,
                        classesTotal: profile.membership?.classesTotal ?? null,
                        planName: profile.membership?.planName ?? null,
                      });
                    }}
                  >
                    <MessageCircle className="h-3 w-3" />
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                    data-testid="client-copy-phone"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(profile.user.phone!);
                      toast({ title: "Teléfono copiado" });
                    }}
                  >
                    <Copy className="h-3 w-3" />
                    Copiar
                  </button>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Desde {formatDate(profile.user.createdAt)}
                </span>
                {profile.user.birthDate && (
                  <span data-testid="text-profile-age">
                    {age !== null ? `${age} años` : ""} ({profile.user.birthDate})
                  </span>
                )}
                {profile.user.gender && (
                  <span data-testid="text-profile-gender">{genderLabel(profile.user.gender)}</span>
                )}
              </div>
            </div>

            <ClientStatusSelector
              clientId={profile.user.id}
              currentStatus={profile.membership.clientStatus || "active"}
            />

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Membresía desde {formatDate(profile.membership.joinedAt)} · {profile.membership.source === "admin_created" ? "Creado por admin" : profile.membership.source === "invite" ? "Por invitación" : "Auto-registro"}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => { onOpenChange(false); onEdit(profile.user.id); }} data-testid="button-profile-edit">
                <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
              </Button>
              <Button
                size="sm"
                onClick={() => attendanceMutation.mutate()}
                disabled={attendanceMutation.isPending || profile.membership.status !== "active" || profile.membership.clientStatus === "frozen"}
                data-testid="button-register-attendance"
              >
                {attendanceMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ClipboardCheck className="h-4 w-4 mr-1" />}
                Registrar asistencia
              </Button>
              <Button size="sm" variant="destructive" onClick={() => { onOpenChange(false); onDelete(profile.user.id, displayName(profile.user.name, profile.user.lastName)); }} data-testid="button-profile-delete">
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar
              </Button>
            </div>

            <div className="bg-muted/50 rounded-md p-3 space-y-3" data-testid="client-summary-pro">
              <h4 className="text-sm font-medium flex items-center gap-1.5">
                <ClipboardCheck className="h-3.5 w-3.5" />
                Resumen
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-background rounded-md p-2 text-center">
                  <div className="text-lg font-bold" data-testid="text-total-attendances">{profile.totalAttendances}</div>
                  <div className="text-[10px] text-muted-foreground">Asistencias</div>
                </div>
                <div className="bg-background rounded-md p-2 text-center">
                  <div className="text-lg font-bold" data-testid="text-classes-remaining-summary">
                    {profile.membership.classesRemaining !== null ? profile.membership.classesRemaining : "∞"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Clases restantes</div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Última asistencia</span>
                  <span className="font-medium" data-testid="text-last-attendance">
                    {profile.recentAttendances.length > 0 ? formatDateTime(profile.recentAttendances[0].checkedInAt) : "Nunca"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Próxima reserva</span>
                  <span className="font-medium" data-testid="text-next-booking">
                    {profile.nextBooking
                      ? `${profile.nextBooking.className} · ${formatDate(profile.nextBooking.bookingDate)} ${profile.nextBooking.startTime}`
                      : "Sin reservas"}
                  </span>
                </div>
              </div>
              {profile.recentAttendances.length > 0 && (
                <div className="space-y-1 pt-1 border-t">
                  <p className="text-[10px] font-medium text-muted-foreground">Últimas 5 asistencias:</p>
                  {profile.recentAttendances.slice(0, 5).map((att) => (
                    <div key={att.id} className="text-xs text-muted-foreground flex items-center gap-2">
                      <Check className="h-3 w-3 text-green-500" />
                      {formatDateTime(att.checkedInAt)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <ClientDebtSection
              clientId={profile.user.id}
              hasDebt={profile.membership.hasDebt}
              debtAmount={profile.membership.debtAmount}
            />

            <div className="bg-muted/50 rounded-md p-3 space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" />
                Plan de membresía
              </h4>
              {profile.plan ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium" data-testid="text-profile-plan">{profile.plan.name}</span>
                      <Badge
                        variant={profile.planStatus === "expired" ? "destructive" : "default"}
                        className="text-[10px]"
                        data-testid="badge-plan-status"
                      >
                        {profile.planStatus === "expired" ? "Vencido" : "Activo"}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => removePlanMutation.mutate()} disabled={removePlanMutation.isPending} data-testid="button-remove-plan">
                      <XCircle className="h-3 w-3 mr-1" /> Quitar
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-background rounded-md p-2">
                      <div className="text-muted-foreground mb-0.5">Ciclo</div>
                      <div className="font-medium" data-testid="text-billing-cycle">{cycleLabel(profile.plan?.cycleMonths)}</div>
                    </div>
                    <div className="bg-background rounded-md p-2">
                      <div className="text-muted-foreground mb-0.5">Precio</div>
                      <div className="font-medium" data-testid="text-plan-price">${(profile.plan.price / 100).toFixed(2)} MXN</div>
                    </div>
                    <div className="bg-background rounded-md p-2">
                      <div className="text-muted-foreground mb-0.5">Pagado el</div>
                      <div className="font-medium" data-testid="text-paid-at">
                        {profile.membership.paidAt ? formatDate(profile.membership.paidAt) : "—"}
                      </div>
                    </div>
                    <div className="bg-background rounded-md p-2">
                      <div className="text-muted-foreground mb-0.5">Vence el</div>
                      <div className={`font-medium ${profile.planStatus === "expired" ? "text-red-500" : ""}`} data-testid="text-plan-expires">
                        {profile.membership.expiresAt ? formatDate(profile.membership.expiresAt) : "—"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {profile.membership.classesRemaining !== null && profile.membership.classesTotal !== null ? (
                      <span className="flex items-center gap-1" data-testid="text-classes-remaining">
                        <Hash className="h-3 w-3" />
                        {profile.membership.classesRemaining}/{profile.membership.classesTotal} clases restantes
                      </span>
                    ) : profile.membership.classesRemaining !== null ? (
                      <span className="flex items-center gap-1" data-testid="text-classes-remaining">
                        <Hash className="h-3 w-3" />
                        {profile.membership.classesRemaining} clases restantes
                      </span>
                    ) : (
                      <span>Clases ilimitadas</span>
                    )}
                  </div>

                  {profile.planStatus === "expired" && (
                    <div className="pt-1">
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => renewMutation.mutate()}
                        disabled={renewMutation.isPending}
                        data-testid="button-renew-plan"
                      >
                        {renewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Calendar className="h-4 w-4 mr-1" />}
                        Renovar ciclo
                      </Button>
                    </div>
                  )}
                </div>
              ) : profile.planStatus === "deleted" ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-orange-400 text-orange-600 text-[10px]" data-testid="badge-plan-deleted">
                      Plan eliminado
                    </Badge>
                    {profile.planNameSnapshot && (
                      <span className="text-xs text-muted-foreground line-through" data-testid="text-deleted-plan-name">{profile.planNameSnapshot}</span>
                    )}
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-md p-2">
                    <p className="text-xs text-orange-700 dark:text-orange-400 flex items-center gap-1.5" data-testid="text-deleted-plan-warning">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      El plan asignado fue eliminado. Asigna un nuevo plan para continuar.
                    </p>
                  </div>
                  {profile.membership.paidAt && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-background rounded-md p-2">
                        <div className="text-muted-foreground mb-0.5">Pagado el</div>
                        <div className="font-medium">{formatDate(profile.membership.paidAt)}</div>
                      </div>
                      <div className="bg-background rounded-md p-2">
                        <div className="text-muted-foreground mb-0.5">Vencía el</div>
                        <div className="font-medium">{profile.membership.expiresAt ? formatDate(profile.membership.expiresAt) : "—"}</div>
                      </div>
                    </div>
                  )}
                  {!showPlanSelect ? (
                    <Button variant="default" size="sm" className="w-full bg-orange-600 hover:bg-orange-700" onClick={() => setShowPlanSelect(true)} data-testid="button-assign-new-plan">
                      <Package className="h-3.5 w-3.5 mr-1" /> Asignar nuevo plan
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      {activePlans.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No hay planes activos. Crea uno en la pestaña Membresías.</p>
                      ) : (
                        activePlans.map((plan) => (
                          <button
                            key={plan.id}
                            onClick={() => assignPlanMutation.mutate(plan.id)}
                            disabled={assignPlanMutation.isPending}
                            className="w-full text-left p-2 rounded-md border bg-background hover:bg-muted/50 transition-colors text-sm"
                            data-testid={`button-select-plan-${plan.id}`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-medium">{plan.name}</span>
                              <span className="text-xs text-muted-foreground">${(plan.price / 100).toFixed(2)}/mes</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Mensual · {plan.classLimit ? `${plan.classLimit} clases/ciclo` : "Clases ilimitadas"}
                            </div>
                          </button>
                        ))
                      )}
                      <Button variant="ghost" size="sm" onClick={() => setShowPlanSelect(false)} data-testid="button-cancel-assign-plan">Cancelar</Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground" data-testid="text-no-plan">Sin plan asignado</p>
                  {!showPlanSelect ? (
                    <Button variant="outline" size="sm" onClick={() => setShowPlanSelect(true)} data-testid="button-assign-plan">
                      <Package className="h-3.5 w-3.5 mr-1" /> Asignar plan
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      {activePlans.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No hay planes activos. Crea uno en la pestaña Membresías.</p>
                      ) : (
                        activePlans.map((plan) => (
                          <button
                            key={plan.id}
                            onClick={() => assignPlanMutation.mutate(plan.id)}
                            disabled={assignPlanMutation.isPending}
                            className="w-full text-left p-2 rounded-md border bg-background hover:bg-muted/50 transition-colors text-sm"
                            data-testid={`button-select-plan-${plan.id}`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-medium">{plan.name}</span>
                              <span className="text-xs text-muted-foreground">${(plan.price / 100).toFixed(2)}/mes</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Mensual · {plan.classLimit ? `${plan.classLimit} clases/ciclo` : "Clases ilimitadas"}
                            </div>
                          </button>
                        ))
                      )}
                      <Button variant="ghost" size="sm" onClick={() => setShowPlanSelect(false)} data-testid="button-cancel-assign-plan">Cancelar</Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-muted/50 rounded-md p-3 space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                Salud y emergencia
              </h4>
              <div className="flex items-center gap-2">
                <Badge
                  variant={profile.user.parqAccepted ? "default" : "outline"}
                  className={`text-[10px] ${profile.user.parqAccepted ? "bg-green-600" : ""}`}
                  data-testid="badge-parq"
                >
                  PAR-Q {profile.user.parqAccepted ? "✓" : "pendiente"}
                </Badge>
                {profile.user.parqAccepted && profile.user.parqAcceptedDate && (
                  <span className="text-[10px] text-muted-foreground">Firmado: {profile.user.parqAcceptedDate}</span>
                )}
              </div>
              {(profile.user.emergencyContactName || profile.user.emergencyContactPhone) && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Contacto emergencia:</span> {profile.user.emergencyContactName || ""} {profile.user.emergencyContactPhone ? `(${profile.user.emergencyContactPhone})` : ""}
                </div>
              )}
              {profile.user.medicalNotes && (
                <div className="text-xs text-muted-foreground" data-testid="text-medical-notes">
                  <span className="font-medium">Notas médicas:</span> {profile.user.medicalNotes}
                </div>
              )}
              {profile.user.injuriesNotes && (
                <div className="text-xs text-muted-foreground" data-testid="text-injuries-notes">
                  <span className="font-medium">Lesiones:</span> {profile.user.injuriesNotes}
                </div>
              )}
              {profile.user.medicalWarnings && (
                <div className="text-xs text-muted-foreground" data-testid="text-medical-warnings">
                  <span className="font-medium">Advertencias:</span> {profile.user.medicalWarnings}
                </div>
              )}
              {!profile.user.emergencyContactName && !profile.user.emergencyContactPhone && !profile.user.medicalNotes && !profile.user.injuriesNotes && !profile.user.medicalWarnings && !profile.user.parqAccepted && (
                <p className="text-xs text-muted-foreground italic">Sin datos de salud registrados</p>
              )}
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" />
                Acceso del cliente
              </h4>
              <div className="bg-muted rounded-md p-3 space-y-1 text-sm">
                <p><span className="font-medium">Email:</span> {profile.user.email}</p>
                {appLink && <p className="text-muted-foreground text-xs">El cliente gestiona su contraseña desde el inicio de sesión.</p>}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <StickyNote className="h-3.5 w-3.5" />
                Notas internas ({profile.notes.length})
              </h4>
              <div className="flex gap-2 mb-3">
                <Textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Agregar nota interna..."
                  className="text-sm min-h-[50px]"
                  data-testid="client-note-add"
                />
                <Button
                  size="sm"
                  className="self-end shrink-0"
                  onClick={() => noteContent.trim() && noteMutation.mutate(noteContent.trim())}
                  disabled={noteMutation.isPending || !noteContent.trim()}
                  data-testid="button-add-note"
                >
                  {noteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <div className="space-y-0" data-testid="client-notes-list">
                {profile.notes.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Sin notas registradas</p>
                )}
                {(showAllNotes ? profile.notes : profile.notes.slice(0, 10)).map((note, idx) => (
                  <div key={note.id} className="relative pl-4 pb-3" data-testid={`note-${note.id}`}>
                    <div className="absolute left-[5px] top-[6px] w-1.5 h-1.5 rounded-full bg-primary" />
                    {idx < (showAllNotes ? profile.notes.length : Math.min(profile.notes.length, 10)) - 1 && (
                      <div className="absolute left-[7px] top-[14px] bottom-0 w-px bg-border" />
                    )}
                    <div className="text-[10px] text-muted-foreground mb-0.5">
                      {formatDateTime(note.createdAt)} — {note.createdByName || "Admin"}
                    </div>
                    <p className="text-sm leading-snug">{note.content}</p>
                  </div>
                ))}
                {profile.notes.length > 10 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs w-full"
                    onClick={() => setShowAllNotes(!showAllNotes)}
                    data-testid="button-show-all-notes"
                  >
                    {showAllNotes ? "Mostrar menos" : `Ver todas (${profile.notes.length})`}
                  </Button>
                )}
              </div>
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
  const { toast } = useToast();
  const { user } = useAuth();
  const branchName = (user?.branch as any)?.name ?? "";
  const [search, setSearch] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [editClientId, setEditClientId] = useState<string | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [waTarget, setWaTarget] = useState<WaModalTarget | null>(null);

  const { data: clients, isLoading } = useQuery<BranchClient[]>({
    queryKey: ["/api/branch/clients"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (clientId: string) => {
      await apiRequest("DELETE", `/api/branch/clients/${clientId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/branch/stats"] });
      toast({ title: "Cliente eliminado" });
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Error al eliminar", variant: "destructive" });
    },
  });

  const filteredClients = (clients || []).filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const full = displayName(c.name, c.lastName).toLowerCase();
    return (
      full.includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q))
    );
  });

  function openProfile(userId: string) {
    setSelectedClientId(userId);
    setShowProfileDialog(true);
  }

  function openEdit(userId: string) {
    setEditClientId(userId);
    setShowEditDialog(true);
  }

  function openDelete(userId: string, name: string) {
    setDeleteTarget({ id: userId, name });
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
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const link = document.createElement("a");
              link.href = "/api/branch/clients/export";
              link.download = "clientes.csv";
              link.click();
            }}
            data-testid="button-export-csv"
          >
            <Download className="h-4 w-4 mr-1" />
            Exportar CSV
          </Button>
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
                  <ClientAvatar avatarUrl={client.avatarUrl} name={client.name} lastName={client.lastName} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate" data-testid={`text-client-name-${client.userId}`}>
                        {displayName(client.name, client.lastName)}
                      </p>
                      <Badge
                        variant={clientStatusVariant(client.clientStatus)}
                        className="text-[10px] px-1.5 py-0"
                        data-testid={`badge-client-status-${client.userId}`}
                      >
                        {clientStatusLabel(client.clientStatus)}
                      </Badge>
                      {isBirthdayToday(client.birthDate) && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-pink-600 font-medium bg-pink-50 dark:bg-pink-950/40 px-1.5 py-0 rounded-full border border-pink-200 dark:border-pink-800" data-testid={`badge-birthday-${client.userId}`}>
                          🎂 Hoy cumple
                        </span>
                      )}
                      {client.hasDebt && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-red-500 font-medium" data-testid={`badge-debt-${client.userId}`}>
                          <DollarSign className="h-3 w-3" />
                          Adeudo
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <span className="truncate max-w-[140px]">{client.email}</span>
                      {client.phone && <span className="hidden sm:inline">{client.phone}</span>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {client.planName ? (
                        <>
                          <Badge
                            variant={client.planStatus === "expired" ? "destructive" : client.planStatus === "deleted" ? "outline" : "outline"}
                            className={`text-[10px] px-1.5 py-0 ${client.planStatus === "deleted" ? "border-orange-400 text-orange-600" : ""}`}
                            data-testid={`badge-plan-${client.userId}`}
                          >
                            {client.planStatus === "deleted" ? "Plan eliminado" : client.planName}
                          </Badge>
                          {client.planStatus !== "deleted" && (
                            <>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0" data-testid={`badge-cycle-${client.userId}`}>
                                {cycleLabel(client.cycleMonths)}
                              </Badge>
                              {client.classesRemaining !== null && client.classesTotal !== null ? (
                                <span className="text-[10px] text-muted-foreground" data-testid={`text-classes-${client.userId}`}>
                                  {client.classesRemaining}/{client.classesTotal} clases
                                </span>
                              ) : client.classesRemaining === null && client.classesTotal === null ? (
                                <span className="text-[10px] text-muted-foreground">Ilimitado</span>
                              ) : null}
                              {client.expiresAt && (
                                <span className={`text-[10px] ${client.planStatus === "expired" ? "text-red-500 font-medium" : "text-muted-foreground"}`} data-testid={`text-expires-${client.userId}`}>
                                  {client.planStatus === "expired" ? "Vencido" : `Vence ${formatDate(client.expiresAt)}`}
                                </span>
                              )}
                            </>
                          )}
                        </>
                      ) : (
                        <span className="text-[10px] text-muted-foreground" data-testid={`text-no-plan-${client.userId}`}>Sin plan</span>
                      )}
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-green-600 hover:text-green-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        setWaTarget({ name: client.name, lastName: client.lastName, phone: client.phone, expiresAt: client.expiresAt, classesRemaining: client.classesRemaining, classesTotal: client.classesTotal, planName: client.planName });
                      }}
                      data-testid={`button-wa-client-${client.userId}`}
                      title="Enviar WhatsApp"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={(e) => { e.stopPropagation(); openEdit(client.userId); }}
                      data-testid={`button-edit-client-${client.userId}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                      onClick={(e) => { e.stopPropagation(); openDelete(client.userId, displayName(client.name, client.lastName)); }}
                      data-testid={`button-delete-client-${client.userId}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="hidden md:flex flex-col items-end gap-0.5 shrink-0">
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
      <EditClientDialog key={editClientId} clientId={editClientId} open={showEditDialog} onOpenChange={setShowEditDialog} />
      <ClientProfileDialog
        clientId={selectedClientId}
        open={showProfileDialog}
        onOpenChange={setShowProfileDialog}
        onEdit={openEdit}
        onDelete={openDelete}
        onWhatsApp={setWaTarget}
      />
      <WhatsAppModal target={waTarget} branchName={branchName} onClose={() => setWaTarget(null)} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Se desactivará la membresía de <strong>{deleteTarget?.name}</strong>. El cliente dejará de aparecer en la lista. Esta acción se puede revertir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
