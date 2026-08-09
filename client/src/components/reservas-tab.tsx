import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Calendar,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Clock,
  Users,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  User,
  Copy,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { apiRequest, fetchJson, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ClassSchedule {
  id: string;
  branchId: string;
  name: string;
  description: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  capacity: number;
  instructorName: string | null;
  isActive: boolean;
  createdAt: string;
}

interface BookingEntry {
  id: string;
  classScheduleId: string;
  userId: string;
  bookingDate: string;
  status: string;
  userName: string;
  userEmail: string | null;
  className: string;
  startTime: string;
  endTime: string;
}

interface ClassBookingDetail {
  id: string;
  userId: string;
  status: string;
  userName: string;
  userEmail: string | null;
  userPhone?: string | null;
  clientOrigin?: string | null;
  clientOriginLabel?: string | null;
  hasActivePlan?: boolean;
  planName?: string | null;
  planStatusLabel?: string | null;
  clientStatus?: string | null;
  classesRemaining?: number | null;
  classesTotal?: number | null;
  expiresAt?: string | null;
}

interface ClassBookingResponse {
  schedule: ClassSchedule;
  bookings: ClassBookingDetail[];
  capacity: number;
  booked: number;
}

interface ClientInfo {
  userId: string;
  name: string;
  email: string | null;
  clientStatus?: string;
  classesRemaining?: number | null;
  classesTotal?: number | null;
  expiresAt?: string | null;
  planName?: string | null;
}

interface BookingAuditEntry {
  id: string;
  bookingId: string;
  action: string;
  actorRole: string;
  reason: string | null;
  source: string;
  createdAt: string;
  customerName?: string | null;
  customerLastName?: string | null;
  className?: string | null;
  bookingDate?: string | null;
}

type ReservationFocusRequest = {
  bookingId?: string | null;
  clientUserId?: string | null;
  classScheduleId: string;
  bookingDate: string;
  nonce: number;
};

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DAY_NAMES_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const MEXICO_TIME_ZONE = "America/Mexico_City";

function getMxTodayIsoDate() {
  return new Date().toLocaleDateString("en-CA", { timeZone: MEXICO_TIME_ZONE });
}

function parseIsoDateAtNoon(isoDate: string) {
  return new Date(`${isoDate}T12:00:00`);
}

function getWeekDates(referenceDate: Date): Date[] {
  const day = referenceDate.getDay();
  const monday = new Date(referenceDate);
  monday.setDate(referenceDate.getDate() - ((day + 6) % 7));
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function formatDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isToday(d: Date): boolean {
  return formatDateStr(d) === getMxTodayIsoDate();
}

function reservationAuditActionLabel(action: string): string {
  if (action === "created") return "Creada";
  if (action === "cancelled") return "Cancelada";
  if (action === "attended") return "Asistencia";
  if (action === "no_show") return "No show";
  return action;
}

function ClassFormDialog({
  open,
  onOpenChange,
  editClass,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editClass?: ClassSchedule | null;
}) {
  const { toast } = useToast();
  const isEdit = !!editClass;

  const [name, setName] = useState(editClass?.name || "");
  const [description, setDescription] = useState(editClass?.description || "");
  const [dayOfWeek, setDayOfWeek] = useState(editClass?.dayOfWeek?.toString() || "1");
  const [startTime, setStartTime] = useState(editClass?.startTime || "09:00");
  const [endTime, setEndTime] = useState(editClass?.endTime || "10:00");
  const [capacityStr, setCapacityStr] = useState(editClass?.capacity?.toString() || "10");
  const [instructorName, setInstructorName] = useState(editClass?.instructorName || "");

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEdit) {
        const resp = await apiRequest("PATCH", `/api/branch/classes/${editClass!.id}`, data);
        return resp.json();
      } else {
        const resp = await apiRequest("POST", "/api/branch/classes", data);
        return resp.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/classes"] });
      toast({ title: isEdit ? "Horario actualizado" : "Reservación creada" });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Error al guardar el horario", variant: "destructive" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const capacity = parseInt(capacityStr) || 10;
    mutation.mutate({
      name,
      description: description || undefined,
      dayOfWeek: parseInt(dayOfWeek),
      startTime,
      endTime,
      capacity,
      instructorName: instructorName || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar horario" : "Nueva reservación"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Modifica los detalles del horario" : "Define un nuevo horario recurrente para tus citas o clases"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="class-name">Nombre *</Label>
            <Input
              id="class-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Spinning, Yoga, CrossFit"
              required
              data-testid="input-class-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="class-description">Descripción</Label>
            <Textarea
              id="class-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción del servicio o clase (opcional)"
              className="min-h-[60px]"
              data-testid="input-class-description"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Día de la semana *</Label>
              <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                <SelectTrigger data-testid="select-class-day">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_NAMES.map((name, i) => (
                    <SelectItem key={i} value={i.toString()}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="class-capacity">Cupo *</Label>
              <Input
                id="class-capacity"
                type="number"
                min="1"
                value={capacityStr}
                onChange={(e) => setCapacityStr(e.target.value)}
                placeholder="10"
                required
                data-testid="input-class-capacity"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="class-start">Hora inicio *</Label>
              <Input
                id="class-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                data-testid="input-class-start"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="class-end">Hora fin *</Label>
              <Input
                id="class-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                data-testid="input-class-end"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="class-instructor">Responsable</Label>
            <Input
              id="class-instructor"
              value={instructorName}
              onChange={(e) => setInstructorName(e.target.value)}
              placeholder="Nombre del responsable (opcional)"
              data-testid="input-class-instructor"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-class">
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending || !name} data-testid="button-submit-class">
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isEdit ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BookClientDialog({
  open,
  onOpenChange,
  classSchedule,
  bookingDate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  classSchedule: ClassSchedule;
  bookingDate: string;
}) {
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState("");

  const { data: clients } = useQuery<ClientInfo[]>({
    queryKey: ["/api/branch/clients"],
  });

  const { data: classBookings } = useQuery<ClassBookingResponse>({
    queryKey: [`/api/branch/bookings/class/${classSchedule.id}?date=${bookingDate}`],
  });

  const bookedUserIds = new Set(
    (classBookings?.bookings || []).filter(b => b.status !== "cancelled").map(b => b.userId)
  );

  const availableClients = (clients || []).filter(c => !bookedUserIds.has(c.userId));
  const spotsLeft = classSchedule.capacity - (classBookings?.booked || 0);
  const selectedClient = availableClients.find(c => c.userId === selectedUserId);

  const clientBlocked = selectedClient && (selectedClient.clientStatus === "frozen" || selectedClient.clientStatus === "inactive");
  const clientNoClasses = selectedClient && selectedClient.classesRemaining !== null && selectedClient.classesRemaining !== undefined && selectedClient.classesRemaining <= 0;
  const clientExpired = selectedClient?.expiresAt && new Date(selectedClient.expiresAt) < new Date();
  const canBook = selectedUserId && !clientBlocked && !clientNoClasses && !clientExpired;

  const mutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", "/api/branch/bookings", {
        classScheduleId: classSchedule.id,
        userId: selectedUserId,
        bookingDate,
      });
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/branch/bookings/class/${classSchedule.id}?date=${bookingDate}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/branch/reservations/stats"] });
      toast({ title: "Reserva creada" });
      setSelectedUserId("");
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Error al crear reserva", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva reservación</DialogTitle>
          <DialogDescription>
            {classSchedule.name} · {DAY_NAMES[classSchedule.dayOfWeek]} {classSchedule.startTime}-{classSchedule.endTime} · {bookingDate}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant={spotsLeft > 0 ? "default" : "destructive"} data-testid="badge-spots-left">
              {spotsLeft > 0 ? `${spotsLeft} cupos disponibles` : "Cupo lleno"}
            </Badge>
          </div>
          {spotsLeft > 0 ? (
            <>
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger data-testid="select-booking-client">
                    <SelectValue placeholder="Seleccionar cliente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableClients.map((c) => (
                      <SelectItem key={c.userId} value={c.userId}>
                        {c.name} ({c.email || "Sin correo"})
                        {c.clientStatus === "frozen" ? " · Congelado" : c.clientStatus === "inactive" ? " · Inactivo" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedClient && (
                <div className="rounded-md border p-3 space-y-1" data-testid="booking-client-info">
                  <p className="text-sm font-medium">{selectedClient.name}</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {selectedClient.planName && (
                      <Badge variant="outline">{selectedClient.planName}</Badge>
                    )}
                    {selectedClient.classesRemaining !== null && selectedClient.classesRemaining !== undefined ? (
                      <Badge variant={selectedClient.classesRemaining > 0 ? "secondary" : "destructive"}>
                        {selectedClient.classesRemaining} usos restantes
                      </Badge>
                    ) : selectedClient.planName ? (
                      <Badge variant="secondary">Ilimitadas</Badge>
                    ) : null}
                    {selectedClient.expiresAt && (
                      <Badge variant={new Date(selectedClient.expiresAt) < new Date() ? "destructive" : "outline"}>
                        Vence: {new Date(selectedClient.expiresAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                      </Badge>
                    )}
                  </div>
                  {clientBlocked && (
                    <p className="text-xs text-red-500 mt-1">
                      {selectedClient.clientStatus === "frozen" ? "Cliente congelado · no puede reservar" : "Cliente inactivo · no puede reservar"}
                    </p>
                  )}
                  {clientNoClasses && (
                    <p className="text-xs text-red-500 mt-1">Sin usos disponibles · asigna un servicio o plan primero</p>
                  )}
                  {clientExpired && (
                    <p className="text-xs text-red-500 mt-1">Servicio o plan vencido · renueva para reservar</p>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-booking">
                  Cancelar
                </Button>
                <Button
                  onClick={() => mutation.mutate()}
                  disabled={mutation.isPending || !canBook}
                  data-testid="button-submit-booking"
                >
                  {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Reservar
                </Button>
              </DialogFooter>
            </>
          ) : (
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close-full-class">
                Cerrar
              </Button>
            </DialogFooter>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ClassDayDetail({
  classSchedule,
  bookingDate,
  focusedBookingId,
  focusedClientUserId,
  focusNonce,
  onMissingFocusedBooking,
}: {
  classSchedule: ClassSchedule;
  bookingDate: string;
  focusedBookingId?: string | null;
  focusedClientUserId?: string | null;
  focusNonce?: number;
  onMissingFocusedBooking?: () => void;
}) {
  const { toast } = useToast();
  const [showBookDialog, setShowBookDialog] = useState(false);
  const lastMissingFocusNonceRef = useRef<number | null>(null);
  const lastScrolledFocusNonceRef = useRef<number | null>(null);
  const bookingsQueryKey = [`/api/branch/bookings/class/${classSchedule.id}?date=${bookingDate}`] as const;

  const {
    data: classBookings,
    isLoading,
  } = useQuery<ClassBookingResponse>({
    queryKey: bookingsQueryKey,
    queryFn: ({ signal }) =>
      fetchJson<ClassBookingResponse>(bookingsQueryKey[0], { signal }) as Promise<ClassBookingResponse>,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ bookingId, status }: { bookingId: string; status: string }) => {
      const endpoint =
        status === "attended"
          ? `/api/branch/bookings/${bookingId}/mark-attended`
          : status === "no_show"
          ? `/api/branch/bookings/${bookingId}/mark-no-show`
          : status === "cancelled"
          ? `/api/branch/bookings/${bookingId}/cancel`
          : `/api/branch/bookings/${bookingId}/status`;
      const method = endpoint.endsWith("/status") ? "PATCH" : "POST";
      const resp = await apiRequest(method, endpoint, { status });
      return resp.json();
    },
    onSuccess: (_data: any, variables: { bookingId: string; status: string }) => {
      queryClient.invalidateQueries({ queryKey: [`/api/branch/bookings/class/${classSchedule.id}?date=${bookingDate}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/branch/reservations/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/branch/bookings/history"] });
      if (variables.status === "attended" || variables.status === "no_show" || variables.status === "cancelled") {
        queryClient.invalidateQueries({ queryKey: ["/api/branch/clients"] });
        queryClient.invalidateQueries({ queryKey: ["/api/branch/alerts"] });
      }
      toast({ title: "Estado actualizado" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Error al actualizar", variant: "destructive" });
    },
  });

  const allBookings = classBookings?.bookings || [];
  const confirmedBookings = allBookings.filter((b) => b.status === "confirmed");
  const attendedBookings = allBookings.filter((b) => b.status === "attended");
  const noShowBookings = allBookings.filter((b) => b.status === "no_show");
  const cancelledBookings = allBookings.filter((b) => b.status === "cancelled");
  const visibleCapacityCount = confirmedBookings.length + attendedBookings.length;
  const spotsLeft = classSchedule.capacity - visibleCapacityCount;

  function isFocusedBooking(booking: ClassBookingDetail) {
    if (focusedBookingId) {
      return booking.id === focusedBookingId;
    }

    if (focusedClientUserId) {
      return booking.userId === focusedClientUserId;
    }

    return false;
  }


  useEffect(() => {
    if ((!focusedBookingId && !focusedClientUserId) || !focusNonce || isLoading) {
      return;
    }

    const targetBooking = allBookings.find((booking) => isFocusedBooking(booking));

    if (!targetBooking) {
      if (lastMissingFocusNonceRef.current !== focusNonce) {
        lastMissingFocusNonceRef.current = focusNonce;
        onMissingFocusedBooking?.();
      }
      return;
    }

    const row = document.querySelector(`[data-booking-row-id="${targetBooking.id}"]`) as HTMLElement | null;
    if (row && lastScrolledFocusNonceRef.current !== focusNonce) {
      lastScrolledFocusNonceRef.current = focusNonce;
      row.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [classBookings, focusNonce, focusedBookingId, focusedClientUserId, isLoading, onMissingFocusedBooking]);

  return (
    <Card data-testid={`card-class-detail-${classSchedule.id}`}>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-base" data-testid={`text-class-detail-name-${classSchedule.id}`}>
              {classSchedule.name}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {classSchedule.startTime} - {classSchedule.endTime}
              {classSchedule.instructorName && ` · ${classSchedule.instructorName}`}
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">
            <Badge variant={spotsLeft > 0 ? "secondary" : "destructive"} data-testid={`badge-capacity-${classSchedule.id}`}>
              <Users className="h-3 w-3 mr-1" />
              {visibleCapacityCount}/{classSchedule.capacity}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-center md:w-auto"
              onClick={() => setShowBookDialog(true)}
              disabled={spotsLeft <= 0}
              data-testid={`button-book-client-${classSchedule.id}`}
            >
              <UserPlus className="h-3.5 w-3.5 mr-1" />
              Reservar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-[10px] text-muted-foreground mb-2" data-testid={`text-cutoff-info-${classSchedule.id}`}>
          Cancelaciones con menos de 3 hrs de anticipación descuentan 1 clase.
        </p>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map(i => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : allBookings.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3 text-center" data-testid={`empty-bookings-${classSchedule.id}`}>
            Sin reservas para esta clase
          </p>
        ) : (
          <div className="space-y-3">
            {confirmedBookings.length > 0 && (
              <p className="text-xs text-muted-foreground">Reservados ({confirmedBookings.length})</p>
            )}
            {confirmedBookings.map((b) => (
              <div
                key={b.id}
                className={`rounded-xl border px-3 py-2 transition-colors ${
                  isFocusedBooking(b)
                    ? "border-primary/60 bg-primary/5 ring-1 ring-primary/30"
                    : "border-transparent hover:bg-muted/50"
                }`}
                data-testid={`booking-row-${b.id}`}
                data-booking-row-id={b.id}
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="flex min-w-0 items-start gap-2">
                    <User className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                    <div className="min-w-0">
                      <span className="text-sm font-medium" data-testid={`text-booking-name-${b.id}`}>{b.userName}</span>
                      <p className="break-all text-xs text-muted-foreground">{b.userEmail || "Sin correo registrado"}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {[b.planStatusLabel || "Sin servicio o plan", b.clientOriginLabel || "Origen no disponible"].join(" \u00b7 ")}
                      </p>
                    </div>
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-1 md:w-auto md:justify-end">
                  {b.status === "confirmed" && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 flex-1 px-2 text-green-600 md:flex-none"
                        onClick={() => statusMutation.mutate({ bookingId: b.id, status: "attended" })}
                        disabled={statusMutation.isPending}
                        data-testid={`button-attend-${b.id}`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        Marcar asistió
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 flex-1 px-2 text-orange-500 md:flex-none"
                        onClick={() => statusMutation.mutate({ bookingId: b.id, status: "no_show" })}
                        disabled={statusMutation.isPending}
                        data-testid={`button-noshow-${b.id}`}
                      >
                        Marcar no asistió
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 flex-1 px-2 text-red-500 md:flex-none"
                        onClick={() => statusMutation.mutate({ bookingId: b.id, status: "cancelled" })}
                        disabled={statusMutation.isPending}
                        data-testid={`button-cancel-booking-${b.id}`}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  {b.status === "attended" && (
                    <Badge variant="default" className="bg-green-600 text-xs" data-testid={`badge-attended-${b.id}`}>
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Asistió
                    </Badge>
                  )}
                  {b.status === "no_show" && (
                    <Badge variant="destructive" className="text-xs" data-testid={`badge-noshow-${b.id}`}>
                      No asistió
                    </Badge>
                  )}
                  </div>
                </div>
                {isFocusedBooking(b) && (
                  <div className="mt-3 grid gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground md:grid-cols-2">
                    <div className="rounded-lg bg-background/70 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Cliente</p>
                      <p className="mt-1 font-medium text-foreground">{b.userName}</p>
                      <p>{b.clientOriginLabel || "Origen no disponible"}</p>
                    </div>
                    <div className="rounded-lg bg-background/70 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Estado del servicio o plan</p>
                      <p className="mt-1 font-medium text-foreground">{b.planStatusLabel || "Sin servicio o plan"}</p>
                      {b.expiresAt && (
                        <p>Vence: {new Date(b.expiresAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}</p>
                      )}
                    </div>
	                  </div>
	                )}
	              </div>
	            ))}
	            {attendedBookings.length > 0 && (
              <div className="pt-2 border-t mt-2 space-y-2">
                <p className="text-xs text-muted-foreground">Asistieron ({attendedBookings.length})</p>
                {attendedBookings.map((b) => (
                  <div
                    key={b.id}
                    className={`rounded-xl border px-3 py-2 transition-colors ${
                      isFocusedBooking(b)
                        ? "border-green-300 bg-green-50/70 ring-1 ring-green-200 dark:border-green-900/60 dark:bg-green-950/20 dark:ring-green-900/50"
                        : "border-transparent bg-muted/20 hover:bg-muted/50"
                    }`}
                    data-testid={`booking-row-${b.id}`}
                    data-booking-row-id={b.id}
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div className="flex min-w-0 items-start gap-2">
                        <User className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                        <div className="min-w-0">
                          <span className="text-sm font-medium">{b.userName}</span>
                          <p className="break-all text-xs text-muted-foreground">{b.userEmail || "Sin correo registrado"}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {[b.planStatusLabel || "Sin servicio o plan", b.clientOriginLabel || "Origen no disponible"].join(" \u00b7 ")}
                          </p>
                        </div>
                      </div>
                      <div className="flex w-full flex-wrap items-center gap-1 md:w-auto md:justify-end">
                        <Badge variant="default" className="bg-green-600 text-xs" data-testid={`badge-attended-${b.id}`}>
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Asistió
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-orange-500"
                          onClick={() => statusMutation.mutate({ bookingId: b.id, status: "no_show" })}
                          disabled={statusMutation.isPending}
                          data-testid={`button-correct-noshow-${b.id}`}
                        >
                          Marcar no asistió
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {noShowBookings.length > 0 && (
              <div className="pt-2 border-t mt-2 space-y-2">
                <p className="text-xs text-muted-foreground">No asistieron ({noShowBookings.length})</p>
                {noShowBookings.map((b) => (
                  <div
                    key={b.id}
                    className={`flex flex-col gap-2 rounded-md px-2 py-2 opacity-80 ${
                      isFocusedBooking(b) ? "bg-orange-50 ring-1 ring-orange-200 dark:bg-orange-950/20 dark:ring-orange-900/50" : ""
                    }`}
                    data-booking-row-id={b.id}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <User className="h-3 w-3 shrink-0 text-orange-400" />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium">{b.userName}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {[b.planStatusLabel || "Sin servicio o plan", b.clientOriginLabel || "Origen no disponible"].join(" \u00b7 ")}
                          </p>
                        </div>
                      </div>
                      <Badge variant="destructive" className="text-[10px]" data-testid={`badge-noshow-${b.id}`}>No asistió</Badge>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-green-600"
                        onClick={() => statusMutation.mutate({ bookingId: b.id, status: "attended" })}
                        disabled={statusMutation.isPending}
                        data-testid={`button-correct-attended-${b.id}`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        Marcar asistió
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
	            {cancelledBookings.length > 0 && (
              <div className="pt-2 border-t mt-2">
                <p className="text-xs text-muted-foreground mb-1">Canceladas ({cancelledBookings.length})</p>
                {cancelledBookings.map((b) => (
                  <div
                    key={b.id}
                    className={`flex items-center gap-2 py-1 px-2 opacity-50 rounded-md ${
                      isFocusedBooking(b) ? "bg-rose-50 ring-1 ring-rose-200 dark:bg-rose-950/20 dark:ring-rose-900/50" : ""
                    }`}
                    data-booking-row-id={b.id}
                  >
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs line-through">{b.userName}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>

      {showBookDialog && (
        <BookClientDialog
          open={showBookDialog}
          onOpenChange={setShowBookDialog}
          classSchedule={classSchedule}
          bookingDate={bookingDate}
        />
      )}
    </Card>
  );
}

function CopyWeekDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const [fromDay, setFromDay] = useState("1");
  const [toDay, setToDay] = useState("2");

  const mutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", "/api/branch/classes/copy-week", {
        fromDay: parseInt(fromDay),
        toDay: parseInt(toDay),
      });
      return resp.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/classes"] });
      toast({
        title: data.copied > 0 ? "Horario copiado" : "Sin cambios",
        description: data.message,
      });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Error al copiar horario", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Copiar horario</DialogTitle>
          <DialogDescription>
            Copia todos los horarios activos de un día a otro. No se duplicarán horarios con el mismo nombre y horario.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Desde (día origen)</Label>
              <Select value={fromDay} onValueChange={setFromDay}>
                <SelectTrigger data-testid="select-copy-from-day">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_NAMES.map((name, i) => (
                    <SelectItem key={i} value={i.toString()}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Hacia (día destino)</Label>
              <Select value={toDay} onValueChange={setToDay}>
                <SelectTrigger data-testid="select-copy-to-day">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_NAMES.map((name, i) => (
                    <SelectItem key={i} value={i.toString()}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-copy">
              Cancelar
            </Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || fromDay === toDay}
              data-testid="button-submit-copy"
            >
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              Copiar
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ReservasTab({
  focusRequest,
}: {
  focusRequest?: ReservationFocusRequest | null;
} = {}) {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassSchedule | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => parseIsoDateAtNoon(getMxTodayIsoDate()));
  const [viewMode, setViewMode] = useState<"calendar" | "classes">("calendar");
  const [activeFocusRequest, setActiveFocusRequest] = useState<ReservationFocusRequest | null>(null);
  const lastProcessedFocusNonceRef = useRef<number | null>(null);

  const weekDates = getWeekDates(selectedDate);

  const { data: classes, isLoading } = useQuery<ClassSchedule[]>({
    queryKey: ["/api/branch/classes"],
  });
  const { data: bookingHistory } = useQuery<BookingAuditEntry[]>({
    queryKey: ["/api/branch/bookings/history"],
    queryFn: ({ signal }) => fetchJson<BookingAuditEntry[]>("/api/branch/bookings/history?limit=20", { signal }) as Promise<BookingAuditEntry[]>,
  });

  const deactivateMutation = useMutation({
    mutationFn: async (classId: string) => {
      const resp = await apiRequest("DELETE", `/api/branch/classes/${classId}`);
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/classes"] });
      toast({ title: "Horario desactivado" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Error al desactivar", variant: "destructive" });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async (classId: string) => {
      const resp = await apiRequest("PATCH", `/api/branch/classes/${classId}`, { isActive: true });
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/classes"] });
      toast({ title: "Horario reactivado" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Error al reactivar", variant: "destructive" });
    },
  });

  const activeClasses = (classes || []).filter(c => c.isActive);
  const inactiveClasses = (classes || []).filter(c => !c.isActive);

  const selectedDayOfWeek = selectedDate.getDay();
  const classesForSelectedDay = activeClasses.filter(c => c.dayOfWeek === selectedDayOfWeek);
  const dateStr = formatDateStr(selectedDate);
  const focusedBookingForDay = activeFocusRequest && activeFocusRequest.bookingDate === dateStr
    ? activeFocusRequest
    : null;

  useEffect(() => {
    if (!focusRequest) {
      return;
    }

    if (lastProcessedFocusNonceRef.current === focusRequest.nonce) {
      return;
    }

    lastProcessedFocusNonceRef.current = focusRequest.nonce;

    const nextSelectedDate = parseIsoDateAtNoon(focusRequest.bookingDate);

    setActiveFocusRequest(focusRequest);
    setViewMode("calendar");
    setSelectedDate(nextSelectedDate);
  }, [focusRequest, selectedDate, viewMode]);

  useEffect(() => {
    if (!activeFocusRequest?.nonce) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setActiveFocusRequest((current) => {
        if (current?.nonce === activeFocusRequest.nonce) {
          return null;
        }

        return current;
      });
    }, 6000);

    return () => window.clearTimeout(timeoutId);
  }, [activeFocusRequest]);

  useEffect(() => {
    if (!focusedBookingForDay || !classes) {
      return;
    }

    const targetClass = classes.find(
      (classSchedule) => classSchedule.id === focusedBookingForDay.classScheduleId,
    );
    const classExists = classes.some(
      (classSchedule) => classSchedule.id === focusedBookingForDay.classScheduleId && classSchedule.isActive,
    );

    if (!classExists) {
      toast({
        title: "Reserva no disponible",
        description: "Esta reserva ya no está disponible.",
        variant: "destructive",
      });
      setActiveFocusRequest(null);
    }
  }, [classes, focusedBookingForDay, toast]);

  function handleMissingFocusedBooking() {
    if (!activeFocusRequest) {
      return;
    }

    toast({
      title: "Reserva no disponible",
      description: "Esta reserva ya no está disponible.",
      variant: "destructive",
    });
    setActiveFocusRequest(null);
  }

  function prevWeek() {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 7);
    setSelectedDate(d);
  }
  function nextWeek() {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 7);
    setSelectedDate(d);
  }
  function goToToday() {
    setSelectedDate(parseIsoDateAtNoon(getMxTodayIsoDate()));
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="font-semibold text-lg" data-testid="text-reservas-title">Agenda y reservaciones</h3>
          <p className="text-sm text-muted-foreground">Gestiona horarios, cupos y reservaciones de tus clientes</p>
        </div>
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
          <Button
            size="sm"
            className="w-full justify-center md:w-auto"
            variant={viewMode === "calendar" ? "default" : "outline"}
            onClick={() => setViewMode("calendar")}
            data-testid="button-view-calendar"
          >
            <Calendar className="h-4 w-4 mr-1" />
            Calendario
          </Button>
          <Button
            size="sm"
            className="w-full justify-center md:w-auto"
            variant={viewMode === "classes" ? "default" : "outline"}
            onClick={() => setViewMode("classes")}
            data-testid="button-view-classes"
          >
            <Clock className="h-4 w-4 mr-1" />
            Horarios
          </Button>
          <Button className="w-full justify-center md:w-auto" size="sm" variant="outline" onClick={() => setShowCopyDialog(true)} data-testid="button-copy-week">
            <Copy className="h-4 w-4 mr-1" />
            Copiar horario
          </Button>
          <Button className="w-full justify-center md:w-auto" size="sm" onClick={() => setShowCreateDialog(true)} data-testid="button-create-class">
            <Plus className="h-4 w-4 mr-1" />
            Nueva reservación
          </Button>
        </div>
      </div>

      {viewMode === "calendar" ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Button className="hidden md:inline-flex" size="sm" variant="ghost" onClick={prevWeek} data-testid="button-prev-week">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-start">
              <span className="min-w-0 text-center text-sm font-medium" data-testid="text-week-range">
                {weekDates[0].toLocaleDateString("es-MX", { day: "numeric", month: "short" })} · {weekDates[6].toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
              </span>
              <Button className="w-full justify-center md:w-auto md:shrink-0" size="sm" variant="outline" onClick={goToToday} data-testid="button-today">
                Hoy
              </Button>
            </div>
            <Button className="hidden md:inline-flex" size="sm" variant="ghost" onClick={nextWeek} data-testid="button-next-week">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center justify-between gap-2 md:hidden">
            <Button size="sm" variant="ghost" onClick={prevWeek} data-testid="button-prev-week-mobile">
              <ChevronLeft className="mr-1 h-4 w-4" />
              Semana anterior
            </Button>
            <Button size="sm" variant="ghost" onClick={nextWeek} data-testid="button-next-week-mobile">
              Semana siguiente
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>

          <div className="-mx-1 overflow-x-auto pb-1 md:hidden">
            <div className="flex w-max gap-2 px-1">
              {weekDates.map((date, i) => {
                const dow = date.getDay();
                const dayClasses = activeClasses.filter(c => c.dayOfWeek === dow);
                const isSelected = formatDateStr(date) === formatDateStr(selectedDate);
                const todayMark = isToday(date);

                return (
                  <button
                    key={`mobile-${i}`}
                    onClick={() => setSelectedDate(new Date(date))}
                    className={`min-w-[84px] rounded-2xl border px-3 py-2 text-left transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/50"
                    }`}
                    data-testid={`calendar-day-mobile-${formatDateStr(date)}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[11px] font-medium ${todayMark ? "text-primary" : "text-muted-foreground"}`}>
                        {DAY_NAMES_SHORT[dow]}
                      </span>
                      <span className={`text-sm font-bold ${todayMark ? "text-primary" : ""}`}>
                        {date.getDate()}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {dayClasses.length > 0 ? `${dayClasses.length} horario${dayClasses.length === 1 ? "" : "s"}` : "Sin horarios"}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="hidden grid-cols-7 gap-1 md:grid">
            {weekDates.map((date, i) => {
              const dow = date.getDay();
              const dayClasses = activeClasses.filter(c => c.dayOfWeek === dow);
              const isSelected = formatDateStr(date) === formatDateStr(selectedDate);
              const todayMark = isToday(date);

              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(new Date(date))}
                  className={`p-2 rounded-lg border text-left transition-colors min-h-[100px] ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                  data-testid={`calendar-day-${formatDateStr(date)}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium ${todayMark ? "text-primary" : "text-muted-foreground"}`}>
                      {DAY_NAMES_SHORT[dow]}
                    </span>
                    <span className={`text-sm font-bold ${todayMark ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center" : ""}`}>
                      {date.getDate()}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {dayClasses.slice(0, 3).map((c) => (
                      <div
                        key={c.id}
                        className="text-[10px] px-1 py-0.5 rounded bg-primary/10 text-primary truncate"
                        data-testid={`calendar-class-${c.id}-${formatDateStr(date)}`}
                      >
                        {c.startTime} {c.name}
                      </div>
                    ))}
                    {dayClasses.length > 3 && (
                      <p className="text-[10px] text-muted-foreground">+{dayClasses.length - 3} más</p>
                    )}
                    {dayClasses.length === 0 && (
                      <p className="text-[10px] text-muted-foreground italic">Sin horarios</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-sm" data-testid="text-selected-day">
              {DAY_NAMES[selectedDayOfWeek]} {selectedDate.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
            </h4>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <Card key={i}>
                    <CardContent className="p-4 space-y-2">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-8 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : classesForSelectedDay.length === 0 ? (
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground text-center py-6" data-testid="empty-day-classes">
                    No hay horarios programados para este día
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {classesForSelectedDay.map((cls) => (
                  <ClassDayDetail
                    key={cls.id}
                    classSchedule={cls}
                    bookingDate={dateStr}
                    focusedBookingId={
                      focusedBookingForDay?.classScheduleId === cls.id
                        ? focusedBookingForDay.bookingId
                        : null
                    }
                    focusedClientUserId={
                      focusedBookingForDay?.classScheduleId === cls.id
                        ? focusedBookingForDay.clientUserId
                        : null
                    }
                    focusNonce={
                      focusedBookingForDay?.classScheduleId === cls.id
                        ? focusedBookingForDay.nonce
                        : undefined
                    }
                    onMissingFocusedBooking={handleMissingFocusedBooking}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(i => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : activeClasses.length === 0 && inactiveClasses.length === 0 ? (
            <Card>
              <CardContent className="p-4">
                <div className="text-center py-12" data-testid="empty-classes">
                  <Calendar className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="font-semibold text-lg mb-1">Sin horarios</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Crea tu primer horario para comenzar a recibir reservaciones.
                  </p>
                  <Button size="sm" className="mt-4" onClick={() => setShowCreateDialog(true)} data-testid="button-empty-create-class">
                    <Plus className="h-4 w-4 mr-1" />
                    Nueva reservación
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeClasses.map((cls) => (
                  <Card key={cls.id} data-testid={`card-class-${cls.id}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold" data-testid={`text-class-name-${cls.id}`}>{cls.name}</h4>
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />
                            {DAY_NAMES[cls.dayOfWeek]} {cls.startTime}-{cls.endTime}
                          </p>
                        </div>
                        <Badge variant="default" data-testid={`badge-class-status-${cls.id}`}>Activa</Badge>
                      </div>
                      {cls.description && (
                        <p className="text-sm text-muted-foreground">{cls.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {cls.capacity} cupos
                        </span>
                        {cls.instructorName && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {cls.instructorName}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-center sm:w-auto"
                          onClick={() => setEditingClass(cls)}
                          data-testid={`button-edit-class-${cls.id}`}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-center sm:w-auto"
                          onClick={() => deactivateMutation.mutate(cls.id)}
                          disabled={deactivateMutation.isPending}
                          data-testid={`button-deactivate-class-${cls.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Desactivar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {inactiveClasses.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Horarios desactivados</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {inactiveClasses.map((cls) => (
                      <Card key={cls.id} className="opacity-60" data-testid={`card-class-${cls.id}`}>
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-semibold">{cls.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                {DAY_NAMES[cls.dayOfWeek]} {cls.startTime}-{cls.endTime}
                              </p>
                            </div>
                            <Badge variant="secondary">Inactiva</Badge>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => reactivateMutation.mutate(cls.id)}
                            disabled={reactivateMutation.isPending}
                            data-testid={`button-reactivate-class-${cls.id}`}
                          >
                            Reactivar
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <Card data-testid="card-booking-history">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Historial reciente
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {bookingHistory && bookingHistory.length > 0 ? (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {bookingHistory.map((item) => (
                <div key={item.id} className="flex flex-col gap-2 rounded-md border p-3 text-sm md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {item.className || "Horario"} · {reservationAuditActionLabel(item.action)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[item.customerName, item.customerLastName].filter(Boolean).join(" ") || "Cliente"} · {item.actorRole} · {item.source}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.bookingDate || "Sin fecha"}{item.reason ? ` · ${item.reason}` : ""}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(item.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Todavía no hay movimientos auditados.</p>
          )}
        </CardContent>
      </Card>

      {showCreateDialog && (
        <ClassFormDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
      )}
      {editingClass && (
        <ClassFormDialog open={!!editingClass} onOpenChange={() => setEditingClass(null)} editClass={editingClass} />
      )}
      {showCopyDialog && (
        <CopyWeekDialog open={showCopyDialog} onOpenChange={setShowCopyDialog} />
      )}
    </div>
  );
}
