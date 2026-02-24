import { useState } from "react";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  userEmail: string;
  className: string;
  startTime: string;
  endTime: string;
}

interface ClassBookingDetail {
  id: string;
  userId: string;
  status: string;
  userName: string;
  userEmail: string;
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
  email: string;
}

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DAY_NAMES_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

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
  return d.toISOString().split("T")[0];
}

function isToday(d: Date): boolean {
  const today = new Date();
  return d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
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
      toast({ title: isEdit ? "Clase actualizada" : "Clase creada" });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Error al guardar clase", variant: "destructive" });
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
          <DialogTitle>{isEdit ? "Editar clase" : "Crear clase"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Modifica los detalles de la clase" : "Define una nueva clase recurrente en tu horario semanal"}
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
              placeholder="Descripción de la clase (opcional)"
              className="min-h-[60px]"
              data-testid="input-class-description"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
              <Label htmlFor="class-capacity">Capacidad *</Label>
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
          <div className="grid grid-cols-2 gap-3">
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
            <Label htmlFor="class-instructor">Instructor</Label>
            <Input
              id="class-instructor"
              value={instructorName}
              onChange={(e) => setInstructorName(e.target.value)}
              placeholder="Nombre del instructor (opcional)"
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
          <DialogTitle>Reservar cliente</DialogTitle>
          <DialogDescription>
            {classSchedule.name} — {DAY_NAMES[classSchedule.dayOfWeek]} {classSchedule.startTime}-{classSchedule.endTime} — {bookingDate}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant={spotsLeft > 0 ? "default" : "destructive"} data-testid="badge-spots-left">
              {spotsLeft > 0 ? `${spotsLeft} lugares disponibles` : "Clase llena"}
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
                      <SelectItem key={c.userId} value={c.userId}>{c.name} ({c.email})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-booking">
                  Cancelar
                </Button>
                <Button
                  onClick={() => mutation.mutate()}
                  disabled={mutation.isPending || !selectedUserId}
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
}: {
  classSchedule: ClassSchedule;
  bookingDate: string;
}) {
  const { toast } = useToast();
  const [showBookDialog, setShowBookDialog] = useState(false);

  const { data: classBookings, isLoading } = useQuery<ClassBookingResponse>({
    queryKey: [`/api/branch/bookings/class/${classSchedule.id}?date=${bookingDate}`],
  });

  const statusMutation = useMutation({
    mutationFn: async ({ bookingId, status }: { bookingId: string; status: string }) => {
      const resp = await apiRequest("PATCH", `/api/branch/bookings/${bookingId}/status`, { status });
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/branch/bookings/class/${classSchedule.id}?date=${bookingDate}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/branch/reservations/stats"] });
      toast({ title: "Estado actualizado" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Error al actualizar", variant: "destructive" });
    },
  });

  const activeBookings = (classBookings?.bookings || []).filter(b => b.status !== "cancelled");
  const cancelledBookings = (classBookings?.bookings || []).filter(b => b.status === "cancelled");
  const spotsLeft = classSchedule.capacity - activeBookings.length;

  return (
    <Card data-testid={`card-class-detail-${classSchedule.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base" data-testid={`text-class-detail-name-${classSchedule.id}`}>
              {classSchedule.name}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {classSchedule.startTime} - {classSchedule.endTime}
              {classSchedule.instructorName && ` · ${classSchedule.instructorName}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={spotsLeft > 0 ? "secondary" : "destructive"} data-testid={`badge-capacity-${classSchedule.id}`}>
              <Users className="h-3 w-3 mr-1" />
              {activeBookings.length}/{classSchedule.capacity}
            </Badge>
            <Button
              size="sm"
              variant="outline"
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
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map(i => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : activeBookings.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3 text-center" data-testid={`empty-bookings-${classSchedule.id}`}>
            Sin reservas para esta clase
          </p>
        ) : (
          <div className="space-y-1">
            {activeBookings.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50"
                data-testid={`booking-row-${b.id}`}
              >
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium" data-testid={`text-booking-name-${b.id}`}>{b.userName}</span>
                  <span className="text-xs text-muted-foreground">{b.userEmail}</span>
                </div>
                <div className="flex items-center gap-1">
                  {b.status === "confirmed" && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-green-600"
                        onClick={() => statusMutation.mutate({ bookingId: b.id, status: "attended" })}
                        disabled={statusMutation.isPending}
                        data-testid={`button-attend-${b.id}`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        Asistió
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-red-500"
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
                </div>
              </div>
            ))}
            {cancelledBookings.length > 0 && (
              <div className="pt-2 border-t mt-2">
                <p className="text-xs text-muted-foreground mb-1">Canceladas ({cancelledBookings.length})</p>
                {cancelledBookings.map((b) => (
                  <div key={b.id} className="flex items-center gap-2 py-1 px-2 opacity-50">
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
            Copia todas las clases activas de un día a otro. No se duplicarán clases con el mismo nombre y horario.
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

export default function ReservasTab() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassSchedule | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"calendar" | "classes">("calendar");

  const weekDates = getWeekDates(selectedDate);

  const { data: classes, isLoading } = useQuery<ClassSchedule[]>({
    queryKey: ["/api/branch/classes"],
  });

  const deactivateMutation = useMutation({
    mutationFn: async (classId: string) => {
      const resp = await apiRequest("DELETE", `/api/branch/classes/${classId}`);
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/classes"] });
      toast({ title: "Clase desactivada" });
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
      toast({ title: "Clase reactivada" });
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
    setSelectedDate(new Date());
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold text-lg" data-testid="text-reservas-title">Reservas y Calendario</h3>
          <p className="text-sm text-muted-foreground">Gestiona clases y reservas de tus clientes</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={viewMode === "calendar" ? "default" : "outline"}
            onClick={() => setViewMode("calendar")}
            data-testid="button-view-calendar"
          >
            <Calendar className="h-4 w-4 mr-1" />
            Calendario
          </Button>
          <Button
            size="sm"
            variant={viewMode === "classes" ? "default" : "outline"}
            onClick={() => setViewMode("classes")}
            data-testid="button-view-classes"
          >
            <Clock className="h-4 w-4 mr-1" />
            Clases
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowCopyDialog(true)} data-testid="button-copy-week">
            <Copy className="h-4 w-4 mr-1" />
            Copiar horario
          </Button>
          <Button size="sm" onClick={() => setShowCreateDialog(true)} data-testid="button-create-class">
            <Plus className="h-4 w-4 mr-1" />
            Nueva clase
          </Button>
        </div>
      </div>

      {viewMode === "calendar" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button size="sm" variant="ghost" onClick={prevWeek} data-testid="button-prev-week">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium" data-testid="text-week-range">
                {weekDates[0].toLocaleDateString("es-MX", { day: "numeric", month: "short" })} — {weekDates[6].toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
              </span>
              <Button size="sm" variant="outline" onClick={goToToday} data-testid="button-today">
                Hoy
              </Button>
            </div>
            <Button size="sm" variant="ghost" onClick={nextWeek} data-testid="button-next-week">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1">
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
                      <p className="text-[10px] text-muted-foreground italic">Sin clases</p>
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
                    No hay clases programadas para este día
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {classesForSelectedDay.map((cls) => (
                  <ClassDayDetail key={cls.id} classSchedule={cls} bookingDate={dateStr} />
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
                  <h3 className="font-semibold text-lg mb-1">Sin clases</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Crea tu primera clase para comenzar a recibir reservas.
                  </p>
                  <Button size="sm" className="mt-4" onClick={() => setShowCreateDialog(true)} data-testid="button-empty-create-class">
                    <Plus className="h-4 w-4 mr-1" />
                    Nueva clase
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
                          {cls.capacity} lugares
                        </span>
                        {cls.instructorName && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {cls.instructorName}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingClass(cls)}
                          data-testid={`button-edit-class-${cls.id}`}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
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
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Clases desactivadas</h4>
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
