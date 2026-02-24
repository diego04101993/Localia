import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Monitor,
  Maximize,
  Minimize,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  XCircle,
  Users,
  Pencil,
  Loader2,
  Upload,
  X,
  Dumbbell,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type TvBooking = {
  id: string;
  userId: string;
  status: string;
  userName: string;
  userEmail: string;
};

type TvClassSlot = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  capacity: number;
  instructorName: string | null;
  routineDescription: string | null;
  routineImageUrl: string | null;
  bookings: TvBooking[];
  summary: { total: number; attended: number; confirmed: number; cancelled: number };
};

async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const resp = await fetch("/api/branch/upload", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data.message || "Error al subir archivo");
  }
  const data = await resp.json();
  return data.url;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getDateLabel(dateStr: string): string {
  const today = formatDate(new Date());
  const tomorrow = formatDate(new Date(Date.now() + 86400000));
  const yesterday = formatDate(new Date(Date.now() - 86400000));
  if (dateStr === today) return "Hoy";
  if (dateStr === tomorrow) return "Mañana";
  if (dateStr === yesterday) return "Ayer";
  const d = new Date(dateStr + "T12:00:00");
  const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "attended") return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (status === "cancelled") return <XCircle className="h-4 w-4 text-red-400" />;
  return <Clock className="h-4 w-4 text-amber-500" />;
}

function ClassSlotCard({
  slot,
  isFullscreen,
  onEditRoutine,
}: {
  slot: TvClassSlot;
  isFullscreen: boolean;
  onEditRoutine: (slot: TvClassSlot) => void;
}) {
  const activeBookings = slot.bookings.filter(b => b.status !== "cancelled");
  const cancelledBookings = slot.bookings.filter(b => b.status === "cancelled");

  return (
    <Card className={`${isFullscreen ? "bg-gray-900 border-gray-700" : ""}`} data-testid={`tv-class-${slot.id}`}>
      <CardHeader className={`pb-2 ${isFullscreen ? "px-6 pt-4" : ""}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant={isFullscreen ? "outline" : "secondary"} className={`text-xs ${isFullscreen ? "border-gray-600 text-gray-300" : ""}`} data-testid={`badge-tv-time-${slot.id}`}>
              {slot.startTime} - {slot.endTime}
            </Badge>
            <CardTitle className={`text-base ${isFullscreen ? "text-white" : ""}`} data-testid={`text-tv-class-name-${slot.id}`}>
              {slot.name}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={slot.summary.attended > 0 ? "default" : "outline"} className={`text-xs ${isFullscreen ? "border-gray-600" : ""}`} data-testid={`badge-tv-attendance-${slot.id}`}>
              {slot.summary.attended}/{slot.summary.total} asistieron
            </Badge>
            {!isFullscreen && (
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEditRoutine(slot)} data-testid={`button-edit-routine-${slot.id}`}>
                <Pencil className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        {slot.instructorName && (
          <p className={`text-xs ${isFullscreen ? "text-gray-400" : "text-muted-foreground"}`} data-testid={`text-tv-instructor-${slot.id}`}>
            Instructor: {slot.instructorName}
          </p>
        )}
      </CardHeader>
      <CardContent className={isFullscreen ? "px-6 pb-4" : ""}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className={`text-xs font-semibold mb-2 flex items-center gap-1 ${isFullscreen ? "text-gray-300" : "text-muted-foreground"}`}>
              <Users className="h-3 w-3" /> Alumnos ({activeBookings.length}/{slot.capacity})
            </h4>
            {activeBookings.length === 0 ? (
              <p className={`text-xs ${isFullscreen ? "text-gray-500" : "text-muted-foreground"}`} data-testid={`text-tv-no-bookings-${slot.id}`}>
                Sin reservaciones
              </p>
            ) : (
              <div className="space-y-1">
                {activeBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className={`flex items-center gap-2 text-sm py-1 px-2 rounded ${
                      isFullscreen
                        ? booking.status === "attended" ? "bg-green-900/30" : "bg-gray-800"
                        : booking.status === "attended" ? "bg-green-50 dark:bg-green-950/30" : "bg-muted/50"
                    }`}
                    data-testid={`tv-booking-${booking.id}`}
                  >
                    <StatusIcon status={booking.status} />
                    <span className={`flex-1 truncate ${isFullscreen ? "text-gray-200" : ""}`} data-testid={`text-tv-student-${booking.id}`}>
                      {booking.userName}
                    </span>
                    <span className={`text-xs ${isFullscreen ? "text-gray-500" : "text-muted-foreground"}`}>
                      {booking.status === "attended" ? "Asistió" : "Pendiente"}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {cancelledBookings.length > 0 && (
              <div className="mt-2">
                <p className={`text-xs ${isFullscreen ? "text-gray-600" : "text-muted-foreground"}`}>
                  {cancelledBookings.length} cancelación{cancelledBookings.length > 1 ? "es" : ""}
                </p>
              </div>
            )}
          </div>

          {(slot.routineDescription || slot.routineImageUrl) && (
            <div>
              <h4 className={`text-xs font-semibold mb-2 flex items-center gap-1 ${isFullscreen ? "text-gray-300" : "text-muted-foreground"}`}>
                <Dumbbell className="h-3 w-3" /> Rutina
              </h4>
              {slot.routineDescription && (
                <p className={`text-sm whitespace-pre-wrap ${isFullscreen ? "text-gray-300" : ""}`} data-testid={`text-tv-routine-${slot.id}`}>
                  {slot.routineDescription}
                </p>
              )}
              {slot.routineImageUrl && (
                <img
                  src={slot.routineImageUrl}
                  alt="Rutina"
                  className="mt-2 rounded-lg max-h-40 w-full object-cover"
                  data-testid={`img-tv-routine-${slot.id}`}
                />
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function TvModeTab() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [routineDialog, setRoutineDialog] = useState<TvClassSlot | null>(null);
  const [routineDesc, setRoutineDesc] = useState("");
  const [routineImage, setRoutineImage] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  const { data: tvData, isLoading } = useQuery<TvClassSlot[]>({
    queryKey: [`/api/branch/tv-data?date=${selectedDate}`],
    refetchInterval: 30000,
  });

  const routineMutation = useMutation({
    mutationFn: async ({ classId, routineDescription, routineImageUrl }: { classId: string; routineDescription: string | null; routineImageUrl: string | null }) => {
      await apiRequest("PATCH", `/api/branch/classes/${classId}/routine`, { routineDescription, routineImageUrl });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/branch/tv-data?date=${selectedDate}`] });
      toast({ title: "Rutina actualizada" });
      setRoutineDialog(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      toast({ title: "No se pudo activar pantalla completa", variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const prevDay = () => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() - 1);
    setSelectedDate(formatDate(d));
  };

  const nextDay = () => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + 1);
    setSelectedDate(formatDate(d));
  };

  const goToday = () => setSelectedDate(formatDate(new Date()));

  const openRoutineDialog = (slot: TvClassSlot) => {
    setRoutineDialog(slot);
    setRoutineDesc(slot.routineDescription || "");
    setRoutineImage(slot.routineImageUrl || "");
  };

  const handleRoutineImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const url = await uploadFile(file);
      setRoutineImage(url);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUploadingImage(false);
    }
  };

  const saveRoutine = () => {
    if (!routineDialog) return;
    routineMutation.mutate({
      classId: routineDialog.id,
      routineDescription: routineDesc.trim() || null,
      routineImageUrl: routineImage || null,
    });
  };

  const totalStudents = (tvData || []).reduce((acc, s) => acc + s.bookings.filter(b => b.status !== "cancelled").length, 0);
  const totalAttended = (tvData || []).reduce((acc, s) => acc + s.summary.attended, 0);

  const content = (
    <div
      ref={containerRef}
      className={`${isFullscreen ? "bg-gray-950 min-h-screen p-6 overflow-auto" : ""}`}
      data-testid="tv-mode-container"
    >
      <div className={`flex items-center justify-between mb-4 ${isFullscreen ? "px-2" : ""}`}>
        <div className="flex items-center gap-2">
          <Button size="icon" variant={isFullscreen ? "outline" : "ghost"} className={`h-8 w-8 ${isFullscreen ? "border-gray-700 text-gray-300" : ""}`} onClick={prevDay} data-testid="button-tv-prev-day">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant={isFullscreen ? "outline" : "ghost"} className={`text-sm font-medium ${isFullscreen ? "border-gray-700 text-gray-200" : ""}`} onClick={goToday} data-testid="button-tv-today">
            {getDateLabel(selectedDate)}
          </Button>
          <Button size="icon" variant={isFullscreen ? "outline" : "ghost"} className={`h-8 w-8 ${isFullscreen ? "border-gray-700 text-gray-300" : ""}`} onClick={nextDay} data-testid="button-tv-next-day">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-3">
          {(tvData?.length ?? 0) > 0 && (
            <div className={`text-sm ${isFullscreen ? "text-gray-400" : "text-muted-foreground"}`} data-testid="text-tv-summary">
              {totalAttended}/{totalStudents} alumnos · {tvData?.length} clases
            </div>
          )}
          <Button
            variant={isFullscreen ? "outline" : "secondary"}
            size="sm"
            onClick={toggleFullscreen}
            className={isFullscreen ? "border-gray-700 text-gray-300" : ""}
            data-testid="button-tv-fullscreen"
          >
            {isFullscreen ? <Minimize className="h-4 w-4 mr-1" /> : <Maximize className="h-4 w-4 mr-1" />}
            {isFullscreen ? "Salir" : "Pantalla completa"}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className={`h-40 w-full ${isFullscreen ? "bg-gray-800" : ""}`} data-testid="skeleton-tv" />
          <Skeleton className={`h-40 w-full ${isFullscreen ? "bg-gray-800" : ""}`} />
        </div>
      ) : (tvData?.length ?? 0) === 0 ? (
        <div className={`text-center py-16 ${isFullscreen ? "text-gray-500" : ""}`}>
          <Monitor className={`h-12 w-12 mx-auto mb-3 ${isFullscreen ? "text-gray-700" : "text-muted-foreground/30"}`} />
          <h3 className={`font-semibold text-lg mb-1 ${isFullscreen ? "text-gray-400" : ""}`} data-testid="text-tv-no-classes">
            Sin clases programadas
          </h3>
          <p className={`text-sm ${isFullscreen ? "text-gray-600" : "text-muted-foreground"}`}>
            No hay clases para {getDateLabel(selectedDate).toLowerCase()}. Crea clases en la pestaña Reservas.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {tvData!.map((slot) => (
            <ClassSlotCard
              key={slot.id}
              slot={slot}
              isFullscreen={isFullscreen}
              onEditRoutine={openRoutineDialog}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      {content}

      <Dialog open={!!routineDialog} onOpenChange={(open) => !open && setRoutineDialog(null)}>
        <DialogContent data-testid="dialog-routine">
          <DialogHeader>
            <DialogTitle>Rutina — {routineDialog?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Descripción de la rutina</Label>
              <Textarea
                value={routineDesc}
                onChange={(e) => setRoutineDesc(e.target.value)}
                placeholder="Ej: 3 rondas de 10 burpees, 15 sentadillas, 20 saltos de cuerda..."
                rows={4}
                data-testid="input-routine-description"
              />
            </div>
            <div>
              <Label>Imagen (opcional)</Label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  id="routine-image-input"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleRoutineImageUpload(f);
                    e.target.value = "";
                  }}
                  data-testid="input-routine-image-file"
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={uploadingImage}
                  onClick={() => document.getElementById("routine-image-input")?.click()}
                  data-testid="button-upload-routine-image"
                >
                  {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                  Subir imagen
                </Button>
                {routineImage && (
                  <Button variant="ghost" size="sm" onClick={() => setRoutineImage("")} data-testid="button-remove-routine-image">
                    <X className="h-4 w-4 mr-1" /> Quitar
                  </Button>
                )}
              </div>
              {routineImage && (
                <img src={routineImage} alt="Preview rutina" className="mt-2 w-full max-h-32 object-cover rounded" data-testid="preview-routine-image" />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoutineDialog(null)} data-testid="button-cancel-routine">Cancelar</Button>
            <Button onClick={saveRoutine} disabled={routineMutation.isPending} data-testid="button-save-routine">
              {routineMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
