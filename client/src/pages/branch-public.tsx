import { useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import {
  Dumbbell,
  MapPin,
  Star,
  Clock,
  Loader2,
  Heart,
  Compass,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Play,
  ShoppingBag,
  Megaphone,
  CalendarDays,
  Users,
  AlertTriangle,
  XCircle,
  Navigation,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { BRANCH_CATEGORIES, type Branch, type BranchPhoto, type BranchPost, type BranchProduct, type BranchVideo } from "@shared/schema";

type MembershipInfo = { branchId: string; isFavorite: boolean; status: string };
type BranchContent = {
  photos: BranchPhoto[];
  posts: BranchPost[];
  products: BranchProduct[];
  videos: BranchVideo[];
};

function getCategoryLabel(value: string) {
  return BRANCH_CATEGORIES.find((c) => c.value === value)?.label || value;
}

function PhotoGallery({ photos }: { photos: BranchPhoto[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const facilityPhotos = photos
    .filter((p) => p.type === "facility")
    .sort((a, b) => a.displayOrder - b.displayOrder);

  if (facilityPhotos.length === 0) return null;

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: direction === "left" ? -200 : 200, behavior: "smooth" });
    }
  };

  return (
    <Card data-testid="card-public-gallery">
      <CardContent className="p-4">
        <h3 className="font-semibold text-sm mb-3" data-testid="text-gallery-title">Instalaciones</h3>
        <div className="relative">
          {facilityPhotos.length > 2 && (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 bg-background/80 backdrop-blur"
                onClick={() => scroll("left")}
                data-testid="button-gallery-left"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 bg-background/80 backdrop-blur"
                onClick={() => scroll("right")}
                data-testid="button-gallery-right"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
          <div
            ref={scrollRef}
            className="flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-1"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {facilityPhotos.map((photo) => (
              <img
                key={photo.id}
                src={photo.url}
                alt="Instalación"
                className="h-36 min-w-[200px] rounded-lg object-cover snap-start shrink-0"
                data-testid={`img-gallery-${photo.id}`}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PublicPosts({ posts }: { posts: BranchPost[] }) {
  const sorted = [...posts].sort((a, b) => a.displayOrder - b.displayOrder);
  if (sorted.length === 0) return null;

  return (
    <div className="space-y-3" data-testid="section-public-posts">
      {sorted.map((post) => (
        <Card key={post.id} data-testid={`public-post-${post.id}`}>
          <CardContent className="p-4 space-y-2">
            <h3 className="font-semibold text-sm" data-testid={`text-public-post-title-${post.id}`}>{post.title}</h3>
            <p className="text-sm text-muted-foreground" data-testid={`text-public-post-content-${post.id}`}>{post.content}</p>
            {post.mediaUrl && (
              <div className="rounded-lg overflow-hidden">
                {post.mediaType === "video" ? (
                  <video src={post.mediaUrl} controls className="w-full max-h-48 rounded-lg" data-testid={`video-public-post-${post.id}`} />
                ) : (
                  <img src={post.mediaUrl} alt={post.title} className="w-full max-h-48 object-cover rounded-lg" data-testid={`img-public-post-${post.id}`} />
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PublicProducts({ products }: { products: BranchProduct[] }) {
  const sorted = [...products].filter(p => p.isActive).sort((a, b) => a.displayOrder - b.displayOrder);
  if (sorted.length === 0) return null;

  const services = sorted.filter(p => (p as any).type === "service");
  const prods = sorted.filter(p => (p as any).type !== "service");

  return (
    <Card data-testid="card-public-products">
      <CardContent className="p-4 space-y-4">
        {services.length > 0 && (
          <div>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2" data-testid="text-services-title">
              <Star className="h-4 w-4" />
              Servicios
            </h3>
            <div className="space-y-2">
              {services.map((s) => (
                <div key={s.id} className="flex items-center gap-3 p-2 border rounded-lg" data-testid={`public-service-${s.id}`}>
                  {s.imageUrl ? (
                    <img src={s.imageUrl} alt={s.name} className="h-14 w-14 rounded object-cover shrink-0" />
                  ) : (
                    <div className="h-14 w-14 rounded bg-muted flex items-center justify-center shrink-0">
                      <Star className="h-5 w-5 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{s.name}</p>
                    {s.description && <p className="text-xs text-muted-foreground line-clamp-2">{s.description}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      {s.price > 0 && <span className="text-xs font-semibold text-primary">${(s.price / 100).toFixed(0)} MXN</span>}
                      {(s as any).durationMinutes && <span className="text-xs text-muted-foreground">{(s as any).durationMinutes} min</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {prods.length > 0 && (
          <div>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2" data-testid="text-products-title">
              <ShoppingBag className="h-4 w-4" />
              Productos
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {prods.map((product) => (
                <div key={product.id} className="border rounded-lg overflow-hidden" data-testid={`public-product-${product.id}`}>
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="h-24 w-full object-cover" data-testid={`img-public-product-${product.id}`} />
                  ) : (
                    <div className="h-24 w-full bg-muted flex items-center justify-center">
                      <ShoppingBag className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="p-2">
                    <p className="text-xs font-medium truncate" data-testid={`text-public-product-name-${product.id}`}>{product.name}</p>
                    {product.description && <p className="text-[10px] text-muted-foreground truncate">{product.description}</p>}
                    <p className="text-xs font-semibold text-primary" data-testid={`text-public-product-price-${product.id}`}>
                      ${(product.price / 100).toFixed(0)} MXN
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PublicVideos({ videos }: { videos: BranchVideo[] }) {
  const sorted = [...videos].sort((a, b) => a.displayOrder - b.displayOrder);
  if (sorted.length === 0) return null;

  return (
    <Card data-testid="card-public-videos">
      <CardContent className="p-4">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2" data-testid="text-videos-title">
          <Play className="h-4 w-4" />
          Videos
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {sorted.map((video) => (
            <div key={video.id} className="rounded-lg overflow-hidden border" data-testid={`public-video-${video.id}`}>
              <video src={video.url} controls className="w-full h-32 object-cover bg-black" data-testid={`video-public-player-${video.id}`} />
              {video.title && (
                <p className="text-xs font-medium p-2 truncate" data-testid={`text-public-video-title-${video.id}`}>{video.title}</p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const DAY_NAMES_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function OperatingHoursDisplay({ hours }: { hours: any }) {
  if (!hours || typeof hours !== "object") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>Horarios por configurar</span>
      </div>
    );
  }

  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

  return (
    <div data-testid="section-operating-hours">
      <div className="flex items-center gap-2 mb-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Horarios</span>
      </div>
      <div className="space-y-1">
        {days.map((day, i) => {
          const h = hours[day];
          return (
            <div key={day} className="flex justify-between text-xs text-muted-foreground" data-testid={`hours-${day}`}>
              <span className="font-medium w-10">{DAY_NAMES_SHORT[i]}</span>
              {h?.open ? (
                <span>{h.from || "09:00"} - {h.to || "18:00"}</span>
              ) : (
                <span className="italic">Cerrado</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReviewsSummary({ slug }: { slug: string }) {
  const { data } = useQuery<{ averageRating: number; totalReviews: number; reviews: any[] }>({
    queryKey: ["/api/public/branch", slug, "reviews"],
    queryFn: async () => {
      const res = await fetch(`/api/public/branch/${slug}/reviews`);
      if (!res.ok) return { averageRating: 0, totalReviews: 0, reviews: [] };
      return res.json();
    },
  });

  if (!data || data.totalReviews === 0) {
    return (
      <div className="flex items-center gap-2">
        <Star className="h-4 w-4 text-yellow-500" />
        <span className="text-sm font-medium" data-testid="text-no-reviews">Sin calificaciones aún</span>
      </div>
    );
  }

  return (
    <div data-testid="section-reviews-summary">
      <div className="flex items-center gap-2 mb-2">
        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
        <span className="text-sm font-medium" data-testid="text-review-avg">{data.averageRating.toFixed(1)}</span>
        <span className="text-xs text-muted-foreground" data-testid="text-review-count">({data.totalReviews} reseñas)</span>
      </div>
      {data.reviews.slice(0, 3).map((r: any) => (
        <div key={r.id} className="border-t py-2" data-testid={`review-${r.id}`}>
          <div className="flex items-center gap-1 mb-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} className={`h-3 w-3 ${s <= r.rating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`} />
            ))}
            <span className="text-[10px] text-muted-foreground ml-1">{r.userName}</span>
          </div>
          {r.comment && <p className="text-xs text-muted-foreground">{r.comment}</p>}
          {r.adminReply && (
            <p className="text-xs text-muted-foreground mt-1 pl-3 border-l-2 italic">{r.adminReply}</p>
          )}
        </div>
      ))}
    </div>
  );
}

type ScheduleClass = {
  id: string;
  name: string;
  description: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  capacity: number;
  instructorName: string | null;
};

type MyBookingsData = {
  bookings: Array<{
    id: string;
    classScheduleId: string;
    bookingDate: string;
    status: string;
    userId: string;
  }>;
  membership: {
    id: string;
    planId: string | null;
    classesRemaining: number | null;
    classesTotal: number | null;
    expiresAt: string | null;
    clientStatus: string;
  } | null;
};

type UpcomingBooking = {
  id: string;
  classScheduleId: string;
  bookingDate: string;
  status: string;
  className: string;
  startTime: string;
  endTime: string;
  instructorName: string | null;
};

type ScheduleData = {
  schedules: ScheduleClass[];
  cancelCutoffMinutes: number;
  spotsTaken: Record<string, number>;
};

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAY_LABELS_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function formatBookingDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("es-MX", { weekday: "short", day: "2-digit", month: "short" });
}

function getWeekDates(offset: number): { date: Date; dateStr: string; dayOfWeek: number; label: string; isToday: boolean }[] {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    return {
      date: d,
      dateStr,
      dayOfWeek: d.getDay(),
      label: `${DAY_LABELS[d.getDay()]} ${d.getDate()}`,
      isToday: dateStr === today.toISOString().split("T")[0],
    };
  });
}

function CustomerScheduleSection({ slug }: { slug: string }) {
  const { toast } = useToast();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [cancelConfirm, setCancelConfirm] = useState<{ bookingId: string; isLate: boolean } | null>(null);

  const weekDates = getWeekDates(weekOffset);

  const { data: scheduleData, isLoading: scheduleLoading } = useQuery<ScheduleData>({
    queryKey: [`/api/public/branch/${slug}/schedule`, selectedDay],
    queryFn: async () => {
      const resp = await fetch(`/api/public/branch/${slug}/schedule?date=${selectedDay}`);
      if (!resp.ok) throw new Error("Error");
      return resp.json();
    },
  });

  const { data: myBookingsData, isLoading: bookingsLoading } = useQuery<MyBookingsData>({
    queryKey: [`/api/public/branch/${slug}/my-bookings`, selectedDay],
    queryFn: async () => {
      const resp = await fetch(`/api/public/branch/${slug}/my-bookings?date=${selectedDay}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Error");
      return resp.json();
    },
  });

  const { data: upcomingBookings } = useQuery<UpcomingBooking[]>({
    queryKey: [`/api/public/branch/${slug}/my-upcoming-bookings`],
    queryFn: async () => {
      const resp = await fetch(`/api/public/branch/${slug}/my-upcoming-bookings`, { credentials: "include" });
      if (!resp.ok) throw new Error("Error");
      return resp.json();
    },
  });

  const bookMutation = useMutation({
    mutationFn: async ({ classScheduleId, bookingDate }: { classScheduleId: string; bookingDate: string }) => {
      const resp = await apiRequest("POST", `/api/public/branch/${slug}/book`, { classScheduleId, bookingDate });
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/public/branch/${slug}/my-bookings`] });
      queryClient.invalidateQueries({ queryKey: [`/api/public/branch/${slug}/my-upcoming-bookings`] });
      queryClient.invalidateQueries({ queryKey: [`/api/public/branch/${slug}/schedule`] });
      toast({ title: "Reserva confirmada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "No se pudo reservar", variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const resp = await apiRequest("POST", `/api/public/branch/${slug}/cancel-booking`, { bookingId });
      return resp.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/public/branch/${slug}/my-bookings`] });
      queryClient.invalidateQueries({ queryKey: [`/api/public/branch/${slug}/my-upcoming-bookings`] });
      queryClient.invalidateQueries({ queryKey: [`/api/public/branch/${slug}/schedule`] });
      if (data.lateCancellation) {
        toast({ title: "Cancelación tardía", description: "Cancelación tardía: se descontará 1 clase." });
      } else {
        toast({ title: "Reserva cancelada", description: "Reserva cancelada (sin descuento)." });
      }
      setCancelConfirm(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "No se pudo cancelar", variant: "destructive" });
      setCancelConfirm(null);
    },
  });

  const cutoffMinutes = scheduleData?.cancelCutoffMinutes ?? 180;

  function handleCancelClick(bookingId: string, classStartTime: string) {
    const classStart = new Date(`${selectedDay}T${classStartTime}:00`);
    const diffMin = (classStart.getTime() - Date.now()) / 60000;
    const isLate = diffMin < cutoffMinutes;
    setCancelConfirm({ bookingId, isLate });
  }

  const membership = myBookingsData?.membership;
  const myBookings = myBookingsData?.bookings || [];
  const schedules = scheduleData?.schedules || [];
  const spotsTaken = scheduleData?.spotsTaken || {};

  const selectedDate = weekDates.find(d => d.dateStr === selectedDay);
  const daySchedules = selectedDate
    ? schedules
        .filter(s => s.dayOfWeek === selectedDate.dayOfWeek)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
    : [];

  const planExpired = membership?.expiresAt && new Date(membership.expiresAt) < new Date();
  const noClasses = membership?.classesRemaining !== null && membership?.classesRemaining !== undefined && membership.classesRemaining <= 0;
  const isUnlimited = membership?.classesRemaining === null;
  const canBook = membership && !planExpired && (isUnlimited || !noClasses) && membership.clientStatus === "active";

  return (
    <div className="space-y-4">
      {upcomingBookings && upcomingBookings.length > 0 && (
        <Card data-testid="card-upcoming-bookings">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2" data-testid="text-upcoming-title">
              <CalendarDays className="h-4 w-4" />
              Mis reservas
            </h3>
            <div className="space-y-2">
              {upcomingBookings.map((b) => (
                <div key={b.id} className="flex items-center justify-between border rounded-md p-2" data-testid={`upcoming-booking-${b.id}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium" data-testid={`text-upcoming-class-${b.id}`}>{b.className}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBookingDate(b.bookingDate)} · {b.startTime} – {b.endTime}
                      {b.instructorName && ` · ${b.instructorName}`}
                    </p>
                  </div>
                  <Badge variant="default" className="text-[10px] shrink-0" data-testid={`badge-upcoming-status-${b.id}`}>
                    Confirmada
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-customer-schedule">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2" data-testid="text-schedule-title">
              <CalendarDays className="h-4 w-4" />
              Agenda
            </h3>
            {membership && (
              <div className="flex items-center gap-2">
                {membership.classesRemaining !== null ? (
                  <Badge variant="outline" className="text-[10px]" data-testid="badge-classes-info">
                    {membership.classesRemaining}/{membership.classesTotal ?? "?"} clases
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]" data-testid="badge-classes-info">
                    Ilimitadas
                  </Badge>
                )}
                {membership.expiresAt && (
                  <Badge
                    variant={planExpired ? "destructive" : "outline"}
                    className="text-[10px]"
                    data-testid="badge-plan-expiry"
                  >
                    {planExpired ? "Vencido" : `Vence ${new Date(membership.expiresAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}`}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {planExpired && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md p-3" data-testid="alert-plan-expired">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-700 dark:text-red-400">Tu plan venció</p>
                  <p className="text-xs text-red-600 dark:text-red-400/80">Renueva en recepción para seguir reservando.</p>
                </div>
              </div>
            </div>
          )}

          {!planExpired && noClasses && !isUnlimited && (
            <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-md p-3" data-testid="alert-no-classes">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-orange-700 dark:text-orange-400">No tienes clases disponibles</p>
                  <p className="text-xs text-orange-600 dark:text-orange-400/80">Compra un nuevo plan en recepción.</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setWeekOffset(weekOffset - 1)}
              disabled={weekOffset <= 0}
              data-testid="button-week-prev"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground" data-testid="text-week-range">
              {weekDates[0].date.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })} — {weekDates[6].date.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setWeekOffset(weekOffset + 1)}
              disabled={weekOffset >= 3}
              data-testid="button-week-next"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex gap-1">
            {weekDates.map((d) => (
              <button
                key={d.dateStr}
                onClick={() => setSelectedDay(d.dateStr)}
                className={`flex-1 text-center py-1.5 rounded-md text-xs transition-colors ${
                  d.dateStr === selectedDay
                    ? "bg-primary text-primary-foreground font-semibold"
                    : d.isToday
                    ? "bg-primary/10 font-medium"
                    : "hover:bg-muted"
                }`}
                data-testid={`button-day-${d.dateStr}`}
              >
                <div>{DAY_LABELS[d.dayOfWeek]}</div>
                <div className="text-[10px]">{d.date.getDate()}</div>
              </button>
            ))}
          </div>

          {scheduleLoading || bookingsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : daySchedules.length === 0 ? (
            <div className="text-center py-6">
              <CalendarDays className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground" data-testid="text-no-classes">
                No hay clases programadas para {selectedDate ? DAY_LABELS_FULL[selectedDate.dayOfWeek].toLowerCase() : "este día"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {daySchedules.map((cls) => {
                const myBooking = myBookings.find(
                  (b) => b.classScheduleId === cls.id && b.bookingDate === selectedDay && b.status === "confirmed"
                );
                const isPast = selectedDate && new Date(`${selectedDay}T${cls.endTime}:00`) < new Date();
                const taken = spotsTaken[cls.id] || 0;
                const spotsLeft = cls.capacity - taken;
                const isFull = spotsLeft <= 0;

                return (
                  <div
                    key={cls.id}
                    className={`border rounded-lg p-3 space-y-1 ${myBooking ? "border-primary bg-primary/5" : ""} ${isPast ? "opacity-60" : ""}`}
                    data-testid={`class-card-${cls.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium" data-testid={`text-class-name-${cls.id}`}>{cls.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {cls.startTime} – {cls.endTime}
                          </span>
                          {cls.instructorName && (
                            <span data-testid={`text-class-instructor-${cls.id}`}>{cls.instructorName}</span>
                          )}
                          <span
                            className={`flex items-center gap-1 ${isFull && !myBooking ? "text-red-500 font-medium" : ""}`}
                            data-testid={`text-class-spots-${cls.id}`}
                          >
                            <Users className="h-3 w-3" />
                            {spotsLeft}/{cls.capacity} {spotsLeft === 1 ? "lugar" : "lugares"}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {isPast ? (
                          myBooking ? (
                            <Badge variant="outline" className="text-[10px]">Reservada</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">Pasada</Badge>
                          )
                        ) : myBooking ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => handleCancelClick(myBooking.id, cls.startTime)}
                            disabled={cancelMutation.isPending}
                            data-testid={`button-cancel-class-${cls.id}`}
                          >
                            {cancelMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3 mr-1" />}
                            Cancelar
                          </Button>
                        ) : canBook && !isFull ? (
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => bookMutation.mutate({ classScheduleId: cls.id, bookingDate: selectedDay })}
                            disabled={bookMutation.isPending}
                            data-testid={`button-book-class-${cls.id}`}
                          >
                            {bookMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CalendarDays className="h-3 w-3 mr-1" />}
                            Reservar
                          </Button>
                        ) : isFull ? (
                          <Badge variant="outline" className="text-[10px] text-red-500">Llena</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">No disponible</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!cancelConfirm} onOpenChange={(o) => { if (!o) setCancelConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="text-cancel-dialog-title">
              {cancelConfirm?.isLate ? "Cancelación tardía" : "Cancelar reserva"}
            </AlertDialogTitle>
            <AlertDialogDescription data-testid="text-cancel-dialog-body">
              {cancelConfirm?.isLate
                ? `Faltan menos de ${Math.floor(cutoffMinutes / 60)} horas. Si cancelas, se descontará 1 clase. ¿Deseas continuar?`
                : "Si cancelas ahora, NO se descontará ninguna clase. ¿Deseas continuar?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-dialog-dismiss">Volver</AlertDialogCancel>
            <AlertDialogAction
              className={cancelConfirm?.isLate ? "bg-red-600 hover:bg-red-700" : ""}
              onClick={() => cancelConfirm && cancelMutation.mutate(cancelConfirm.bookingId)}
              disabled={cancelMutation.isPending}
              data-testid="button-cancel-dialog-confirm"
            >
              {cancelMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {cancelConfirm?.isLate ? "Sí, cancelar y descontar" : "Sí, cancelar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function BranchPublicPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: branch, isLoading, error } = useQuery<Branch>({
    queryKey: [`/api/public/branch/${slug}`],
    enabled: !!slug,
  });

  const { data: content } = useQuery<BranchContent>({
    queryKey: [`/api/public/branch/${slug}/content`],
    enabled: !!slug,
  });

  const { data: announcements } = useQuery<any[]>({
    queryKey: [`/api/public/branch/${slug}/announcements`],
    enabled: !!slug,
  });

  const { data: myMemberships } = useQuery<MembershipInfo[]>({
    queryKey: ["/api/memberships"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user,
  });

  const favMutation = useMutation({
    mutationFn: async ({ branchId, isFavorite }: { branchId: string; isFavorite: boolean }) => {
      await apiRequest("POST", "/api/memberships/favorite", { branchId, isFavorite });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/memberships"] });
      toast({ title: "Favorito actualizado" });
    },
    onError: () => {
      toast({ title: "Error al actualizar favorito", variant: "destructive" });
    },
  });

  const joinMutation = useMutation({
    mutationFn: async (branchSlug: string) => {
      await apiRequest("POST", "/api/memberships/join", { branchSlug });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/memberships"] });
      toast({ title: "Te has unido a esta sucursal" });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message?.includes("403") ? "No puedes unirte" : "Error al unirse",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !branch) {
    const isBlocked = error?.message?.includes("403");
    if (isBlocked) {
      navigate("/blocked");
      return null;
    }
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="p-8 text-center">
            <Dumbbell className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2" data-testid="text-branch-not-found">
              Sucursal no encontrada
            </h2>
            <p className="text-sm text-muted-foreground">
              La sucursal que buscas no existe o no está disponible.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const membership = myMemberships?.find((m: any) => m.branchId === branch.id);
  const isFavorite = membership?.isFavorite || false;
  const isMember = membership && membership.status === "active";

  const profilePhoto = content?.photos?.find((p) => p.type === "profile");
  const hasContent = content && (
    content.photos.length > 0 || content.posts.length > 0 ||
    content.products.length > 0 || content.videos.length > 0
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="relative h-52 bg-gradient-to-br from-primary/80 to-primary overflow-hidden">
        {branch.coverImageUrl && (
          <img
            src={branch.coverImageUrl}
            alt={branch.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 h-full flex flex-col justify-between p-4 max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <Button
              size="icon"
              variant="ghost"
              className="bg-white/20 backdrop-blur text-white"
              onClick={() => navigate("/explore")}
              data-testid="button-branch-back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1">
              {user && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="bg-white/20 backdrop-blur text-white"
                  onClick={() =>
                    favMutation.mutate({ branchId: branch.id, isFavorite: !isFavorite })
                  }
                  disabled={favMutation.isPending}
                  data-testid="button-branch-favorite"
                >
                  <Heart
                    className={`h-4 w-4 ${isFavorite ? "fill-red-500 text-red-500" : ""}`}
                  />
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 mb-1">
            {profilePhoto ? (
              <img
                src={profilePhoto.url}
                alt={branch.name}
                className="w-12 h-12 rounded-md object-cover border-2 border-white/30"
                data-testid="img-branch-profile-photo"
              />
            ) : (
              <div className="flex items-center justify-center w-12 h-12 rounded-md bg-white/20 backdrop-blur">
                <Dumbbell className="h-6 w-6 text-white" />
              </div>
            )}
            <div>
              <h1
                className="text-2xl font-bold text-white"
                data-testid="text-branch-public-name"
              >
                {branch.name}
              </h1>
              <div className="flex items-center gap-2">
                <p className="text-white/70 text-sm">/{branch.slug}</p>
                {branch.category && (
                  <Badge variant="secondary" className="text-xs bg-white/20 text-white border-0">
                    {getCategoryLabel(branch.category)}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4 -mt-4 relative z-20">
        {announcements && announcements.length > 0 && (
          <div
            className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 space-y-2"
            data-testid="banner-announcement"
          >
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200" data-testid="text-announcement-banner">
                {announcements[0].message}
              </p>
            </div>
            {announcements[0].imageUrl && (
              <img
                src={announcements[0].imageUrl}
                alt="Anuncio"
                className="w-full rounded-md max-h-48 object-cover"
                data-testid="img-announcement-banner"
              />
            )}
          </div>
        )}

        {user && !isMember && (
          <Card>
            <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="font-semibold text-sm">Únete a este negocio</h3>
                <p className="text-xs text-muted-foreground">
                  Accede a beneficios exclusivos
                </p>
              </div>
              <Button
                onClick={() => joinMutation.mutate(branch.slug)}
                disabled={joinMutation.isPending}
                data-testid="button-join-branch"
              >
                {joinMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Unirme
              </Button>
            </CardContent>
          </Card>
        )}

        {isMember && (
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Badge variant="default">Miembro</Badge>
              <span className="text-sm text-muted-foreground">
                Ya eres parte de este negocio
              </span>
            </CardContent>
          </Card>
        )}

        {user && isMember && slug && (
          <CustomerScheduleSection slug={slug} />
        )}

        <Card>
          <CardContent className="p-4 space-y-3">
            {branch.description && (
              <p className="text-sm" data-testid="text-branch-description">{branch.description}</p>
            )}
            <ReviewsSummary slug={slug!} />
            {branch.address && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                <span data-testid="text-branch-address">{branch.address}</span>
              </div>
            )}
            {branch.city && !branch.address && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                <span>{branch.city}</span>
              </div>
            )}
            {(branch as any).googleMapsUrl && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => window.open((branch as any).googleMapsUrl, "_blank")}
                data-testid="button-google-maps"
              >
                <Navigation className="h-4 w-4 mr-2" />
                Ver en Google Maps
              </Button>
            )}
            <OperatingHoursDisplay hours={(branch as any).operatingHours} />
          </CardContent>
        </Card>

        {content && <PhotoGallery photos={content.photos} />}
        {content && <PublicPosts posts={content.posts} />}
        {content && <PublicProducts products={content.products} />}
        {content && <PublicVideos videos={content.videos} />}

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => navigate("/explore")}
            data-testid="button-explore-nearby"
          >
            <Compass className="h-4 w-4 mr-2" />
            Explorar cerca
          </Button>
          {user && (
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate("/favorites")}
              data-testid="button-my-favorites"
            >
              <Heart className="h-4 w-4 mr-2" />
              Mis favoritos
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
