import { useRef, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  LogOut,
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
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
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
      scrollRef.current.scrollBy({ left: direction === "left" ? -260 : 260, behavior: "smooth" });
    }
  };

  return (
    <div data-testid="card-public-gallery">
      <div className="flex items-center justify-between px-1 mb-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-1 rounded-full bg-primary" />
          <h3 className="font-bold text-sm tracking-tight" data-testid="text-gallery-title">Instalaciones</h3>
        </div>
        {facilityPhotos.length > 1 && (
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7 rounded-full border-border/60"
              onClick={() => scroll("left")}
              data-testid="button-gallery-left"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7 rounded-full border-border/60"
              onClick={() => scroll("right")}
              data-testid="button-gallery-right"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
      <div className="-mx-3">
        <div
          ref={scrollRef}
          className="flex gap-2.5 overflow-x-auto snap-x snap-mandatory px-3 pb-1"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {facilityPhotos.map((photo, idx) => (
            <img
              key={photo.id}
              src={photo.url}
              alt="Instalación"
              className={`${idx === 0 && facilityPhotos.length > 1 ? "h-56 min-w-[270px]" : "h-56 min-w-[230px]"} rounded-2xl object-cover snap-start shrink-0 shadow-md`}
              data-testid={`img-gallery-${photo.id}`}
            />
          ))}
        </div>
      </div>
    </div>
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
  const [selected, setSelected] = useState<BranchProduct | null>(null);
  const sorted = [...products].filter(p => p.isActive).sort((a, b) => a.displayOrder - b.displayOrder);
  if (sorted.length === 0) return null;

  const services = sorted.filter(p => (p as any).type === "service");
  const prods = sorted.filter(p => (p as any).type !== "service");

  return (
    <>
      <div data-testid="card-public-products" className="space-y-5">
        {services.length > 0 && (
          <div>
            <div className="flex items-center gap-2 px-1 mb-3">
              <div className="h-4 w-1 rounded-full bg-primary" />
              <h3 className="font-bold text-sm tracking-tight" data-testid="text-services-title">Servicios</h3>
            </div>
            <div className="space-y-2">
              {services.map((s) => (
                <button
                  key={s.id}
                  className="flex items-center gap-3 p-3 bg-background border border-border/60 rounded-xl w-full text-left active:bg-muted/60 transition-colors shadow-sm"
                  data-testid={`public-service-${s.id}`}
                  onClick={() => setSelected(s as any)}
                >
                  {s.imageUrl ? (
                    <img src={s.imageUrl} alt={s.name} className="h-16 w-16 rounded-xl object-cover shrink-0 shadow-sm" />
                  ) : (
                    <div className="h-16 w-16 rounded-xl bg-primary/8 border border-primary/15 flex items-center justify-center shrink-0">
                      <Star className="h-6 w-6 text-primary/50" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{s.name}</p>
                    {s.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">{s.description}</p>}
                    <div className="flex items-center gap-3 mt-1.5">
                      {s.price > 0 && (
                        <span className="text-xs font-bold text-primary bg-primary/8 px-2 py-0.5 rounded-full">
                          ${(s.price / 100).toFixed(0)} MXN
                        </span>
                      )}
                      {(s as any).durationMinutes && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />{(s as any).durationMinutes} min
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
        {prods.length > 0 && (
          <div>
            <div className="flex items-center gap-2 px-1 mb-3">
              <div className="h-4 w-1 rounded-full bg-primary" />
              <h3 className="font-bold text-sm tracking-tight" data-testid="text-products-title">Productos</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {prods.map((product) => (
                <button
                  key={product.id}
                  className="bg-background border border-border/60 rounded-xl overflow-hidden text-left active:scale-95 transition-transform cursor-pointer shadow-sm"
                  data-testid={`public-product-${product.id}`}
                  onClick={() => setSelected(product)}
                >
                  <div className="relative aspect-square bg-muted">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        data-testid={`img-public-product-${product.id}`}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted">
                        <ShoppingBag className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                    )}
                    {product.price > 0 && (
                      <div className="absolute bottom-2 right-2">
                        <span className="bg-black/70 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
                          ${(product.price / 100).toFixed(0)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="px-2.5 py-2 pb-3">
                    <p className="text-xs font-semibold leading-tight truncate" data-testid={`text-public-product-name-${product.id}`}>{product.name}</p>
                    {product.description && (
                      <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{product.description}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Product / service detail modal */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl gap-0">
          {selected?.imageUrl ? (
            <div className="aspect-square w-full bg-muted overflow-hidden">
              <img src={selected.imageUrl} alt={selected.name} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="aspect-square w-full bg-muted flex items-center justify-center">
              <ShoppingBag className="h-16 w-16 text-muted-foreground/20" />
            </div>
          )}
          <div className="p-5 space-y-2">
            <h3 className="font-bold text-base leading-tight">{selected?.name}</h3>
            {(selected as any)?.durationMinutes && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {(selected as any).durationMinutes} min
              </p>
            )}
            {selected?.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{selected.description}</p>
            )}
            {selected && selected.price > 0 && (
              <p className="text-xl font-bold text-primary pt-1" data-testid={`text-public-product-price-${selected.id}`}>
                ${(selected.price / 100).toFixed(0)} MXN
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function VideoCard({ video }: { video: BranchVideo }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(0);
  const [isVertical, setIsVertical] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { threshold: 0.45 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const handleMetadata = () => {
    const el = videoRef.current;
    if (el) setIsVertical(el.videoHeight > el.videoWidth);
  };

  const handleLike = () => {
    setLiked((prev) => {
      setLikes((c) => (prev ? c - 1 : c + 1));
      return !prev;
    });
  };

  return (
    <div
      className="rounded-2xl overflow-hidden border border-border/50 shadow-sm bg-zinc-950"
      data-testid={`public-video-${video.id}`}
    >
      <div className={`w-full relative ${isVertical ? "aspect-[9/16]" : "aspect-video"} bg-zinc-950`}>
        <video
          ref={videoRef}
          src={video.url}
          controls
          playsInline
          muted
          loop
          poster={video.thumbnailUrl ?? undefined}
          onLoadedMetadata={handleMetadata}
          className={`w-full h-full ${isVertical ? "object-cover" : "object-contain"}`}
          data-testid={`video-public-player-${video.id}`}
        />
      </div>
      <div className="bg-card px-4 py-3 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          {video.title && (
            <p
              className="text-sm font-semibold leading-tight truncate"
              data-testid={`text-public-video-title-${video.id}`}
            >
              {video.title}
            </p>
          )}
        </div>
        <button
          className="flex items-center gap-1.5 shrink-0"
          onClick={handleLike}
          data-testid={`button-like-video-${video.id}`}
        >
          <Heart
            className={`h-5 w-5 transition-all duration-150 ${
              liked ? "fill-red-500 text-red-500 scale-110" : "text-muted-foreground/40"
            }`}
          />
          {likes > 0 && (
            <span className="text-xs text-muted-foreground" data-testid={`text-like-count-${video.id}`}>
              {likes}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

function PublicVideos({ videos }: { videos: BranchVideo[] }) {
  const sorted = [...videos].sort((a, b) => a.displayOrder - b.displayOrder);
  if (sorted.length === 0) return null;

  return (
    <div data-testid="card-public-videos">
      <div className="flex items-center gap-2 px-1 mb-3">
        <div className="h-4 w-1 rounded-full bg-primary" />
        <h3 className="font-bold text-sm tracking-tight" data-testid="text-videos-title">Videos</h3>
      </div>
      <div className="space-y-4">
        {sorted.map((video) => (
          <VideoCard key={video.id} video={video} />
        ))}
      </div>
    </div>
  );
}

const DAY_NAMES_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function OperatingHoursDisplay({ hours }: { hours: any }) {
  if (!hours || typeof hours !== "object") {
    return (
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Clock className="h-3.5 w-3.5 shrink-0" />
        <span>Horarios por configurar</span>
      </div>
    );
  }

  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

  return (
    <div data-testid="section-operating-hours">
      <div className="flex items-center gap-1.5 mb-3">
        <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-semibold">Horarios</span>
      </div>
      <div className="space-y-1.5">
        {days.map((day, i) => {
          const h = hours[day];
          const isOpen = h?.open;
          return (
            <div
              key={day}
              className="flex items-center justify-between gap-2"
              data-testid={`hours-${day}`}
            >
              <span className={`text-sm w-14 shrink-0 ${isOpen ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                {DAY_NAMES_SHORT[i]}
              </span>
              {isOpen ? (
                <span className="text-sm text-foreground font-mono tabular-nums">
                  {h.from || "09:00"} – {h.to || "18:00"}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground italic">Cerrado</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type LocEntry = { name: string; address: string; googleMapsUrl: string };

function PublicLocationSection({ branch }: { branch: any }) {
  const locs: LocEntry[] =
    branch.locations && branch.locations.length > 0
      ? branch.locations
      : branch.address || branch.city || branch.googleMapsUrl
      ? [{ name: "", address: branch.address || branch.city || "", googleMapsUrl: branch.googleMapsUrl || "" }]
      : [];

  const [active, setActive] = useState(0);

  const noAddress = locs.length === 0;
  const noHours = !branch.operatingHours;

  if (noAddress && noHours) return null;

  const current = locs[active] || locs[0];

  return (
    <div>
      <div className="flex items-center gap-2 px-1 mb-3">
        <div className="h-4 w-1 rounded-full bg-primary" />
        <h3 className="font-bold text-sm tracking-tight">Ubicación</h3>
      </div>
      <Card data-testid="card-public-location" className="border-border/50 shadow-sm rounded-2xl">
        <CardContent className="p-4 space-y-3">
          {locs.length > 1 && (
            <div className="flex gap-1 p-1 bg-muted rounded-xl" data-testid="tabs-locations">
              {locs.map((l, i) => (
                <button
                  key={i}
                  className={`flex-1 text-xs py-1.5 px-2 rounded-lg font-medium transition-all ${
                    active === i
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setActive(i)}
                  data-testid={`button-location-tab-${i}`}
                >
                  {l.name || `Ubicación ${i + 1}`}
                </button>
              ))}
            </div>
          )}

          {current?.address && (
            <div className="flex items-start gap-2.5">
              <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span className="text-sm leading-snug" data-testid="text-branch-address">
                {current.address}
              </span>
            </div>
          )}

          {current?.googleMapsUrl && (
            <Button
              size="sm"
              className="w-full rounded-xl"
              onClick={() => window.open(current.googleMapsUrl, "_blank")}
              data-testid="button-google-maps"
            >
              <Navigation className="h-4 w-4 mr-2" />
              Ver en Google Maps
            </Button>
          )}

          {branch.operatingHours && (
            <>
              <div className="border-t" />
              <OperatingHoursDisplay hours={branch.operatingHours} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-1" data-testid="star-picker">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          className="p-0.5 transition-transform hover:scale-110"
          onMouseEnter={() => setHovered(s)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(s)}
          data-testid={`star-pick-${s}`}
        >
          <Star
            className={`h-6 w-6 transition-colors ${
              s <= (hovered || value) ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function ReviewsSummary({ slug }: { slug: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const { data } = useQuery<{ averageRating: number; totalReviews: number; reviews: any[] }>({
    queryKey: ["/api/public/branch", slug, "reviews"],
    queryFn: async () => {
      const res = await fetch(`/api/public/branch/${slug}/reviews`);
      if (!res.ok) return { averageRating: 0, totalReviews: 0, reviews: [] };
      return res.json();
    },
  });

  const { data: myReviewData } = useQuery<{ review: any | null }>({
    queryKey: ["/api/public/branch", slug, "my-review"],
    queryFn: async () => {
      const res = await fetch(`/api/public/branch/${slug}/my-review`);
      if (!res.ok) return { review: null };
      return res.json();
    },
    enabled: !!user,
  });

  const myReview = myReviewData?.review ?? null;

  const openForm = () => {
    if (myReview) {
      setRating(myReview.rating);
      setComment(myReview.comment || "");
    } else {
      setRating(0);
      setComment("");
    }
    setShowForm(true);
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/public/branch/${slug}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.message || "Error al guardar");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ description: myReview ? "Reseña actualizada" : "Reseña enviada" });
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/public/branch", slug, "reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/branch", slug, "my-review"] });
    },
    onError: (e: any) => {
      toast({ description: e.message, variant: "destructive" });
    },
  });

  const STAR_LABELS = ["", "Malo", "Regular", "Bueno", "Muy bueno", "Excelente"];

  return (
    <div data-testid="section-reviews-summary" className="space-y-4">
      {/* Summary row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {data && data.totalReviews > 0 ? (
            <>
              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
              <span className="text-sm font-semibold" data-testid="text-review-avg">{data.averageRating.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground" data-testid="text-review-count">({data.totalReviews} {data.totalReviews === 1 ? "reseña" : "reseñas"})</span>
            </>
          ) : (
            <>
              <Star className="h-4 w-4 text-muted-foreground/40" />
              <span className="text-sm text-muted-foreground" data-testid="text-no-reviews">Sin calificaciones aún</span>
            </>
          )}
        </div>
        {user && !showForm && (
          <button
            className="text-xs text-primary font-medium underline underline-offset-2"
            onClick={openForm}
            data-testid="button-open-review-form"
          >
            {myReview ? "Editar mi reseña" : "Calificar"}
          </button>
        )}
      </div>

      {/* Submission form */}
      {showForm && (
        <div className="bg-muted/40 rounded-2xl p-4 space-y-3 border border-border/40" data-testid="section-review-form">
          <p className="text-sm font-semibold">{myReview ? "Editar tu reseña" : "Deja tu calificación"}</p>
          <div className="space-y-1">
            <StarPicker value={rating} onChange={setRating} />
            {rating > 0 && (
              <p className="text-xs text-muted-foreground">{STAR_LABELS[rating]}</p>
            )}
          </div>
          <textarea
            className="w-full bg-background text-sm rounded-xl border border-border/60 px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/50"
            rows={3}
            placeholder="Comentario opcional..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
            data-testid="input-review-comment"
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowForm(false)}
              data-testid="button-cancel-review"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => submitMutation.mutate()}
              disabled={rating === 0 || submitMutation.isPending}
              data-testid="button-submit-review"
            >
              {submitMutation.isPending ? "Guardando..." : myReview ? "Actualizar" : "Enviar reseña"}
            </Button>
          </div>
        </div>
      )}

      {/* Review list */}
      {data && data.reviews.length > 0 && (
        <div className="space-y-3">
          {data.reviews.slice(0, 5).map((r: any) => (
            <div key={r.id} className="border-t pt-3" data-testid={`review-${r.id}`}>
              <div className="flex items-center gap-1.5 mb-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className={`h-3 w-3 ${s <= r.rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/20"}`} />
                ))}
                <span className="text-xs font-medium ml-1">{r.userName} {r.userLastName}</span>
              </div>
              {r.comment && <p className="text-xs text-muted-foreground leading-relaxed">{r.comment}</p>}
              {r.adminReply && (
                <div className="mt-2 pl-3 border-l-2 border-primary/30">
                  <p className="text-[10px] text-muted-foreground/60 font-medium mb-0.5">Respuesta del negocio</p>
                  <p className="text-xs text-muted-foreground italic">{r.adminReply}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
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

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function classEndDateTime(bookingDate: string, startTime: string, endTime: string): Date {
  const end = new Date(`${bookingDate}T${endTime}:00`);
  if (endTime < startTime) {
    end.setDate(end.getDate() + 1);
  }
  return end;
}

function getWeekDates(offset: number): { date: Date; dateStr: string; dayOfWeek: number; label: string; isToday: boolean }[] {
  const today = new Date();
  const todayStr = localDateStr(today);
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = localDateStr(d);
    return {
      date: d,
      dateStr,
      dayOfWeek: d.getDay(),
      label: `${DAY_LABELS[d.getDay()]} ${d.getDate()}`,
      isToday: dateStr === todayStr,
    };
  });
}

function CustomerScheduleSection({ slug }: { slug: string }) {
  const { toast } = useToast();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(() => localDateStr(new Date()));
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
                const isPast = selectedDate && classEndDateTime(selectedDay, cls.startTime, cls.endTime) < new Date();
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
  const { user, logout } = useAuth();
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
  const firstFacilityPhoto = content?.photos?.find((p) => p.type === "facility");
  const heroImage = branch.coverImageUrl || firstFacilityPhoto?.url || null;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Hero */}
      <div className="relative h-72 overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)/0.6) 100%)" }}>
        {heroImage && (
          <img
            src={heroImage}
            alt={branch.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {/* Multi-layer overlay for premium depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/5" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent" />

        {/* Top bar */}
        <div className="relative z-10 flex items-center justify-between p-4 max-w-lg mx-auto">
          <button
            onClick={() => navigate("/explore")}
            className="h-9 w-9 flex items-center justify-center rounded-full bg-black/35 backdrop-blur-md text-white hover:bg-black/55 transition-colors border border-white/10"
            data-testid="button-branch-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          {user && (
            <div className="flex items-center gap-1.5">
              <button
                className="h-9 w-9 flex items-center justify-center rounded-full bg-black/35 backdrop-blur-md text-white hover:bg-black/55 transition-colors border border-white/10"
                onClick={() => favMutation.mutate({ branchId: branch.id, isFavorite: !isFavorite })}
                disabled={favMutation.isPending}
                data-testid="button-branch-favorite"
              >
                <Heart className={`h-4 w-4 ${isFavorite ? "fill-red-400 text-red-400" : ""}`} />
              </button>
              <button
                className="h-9 w-9 flex items-center justify-center rounded-full bg-black/35 backdrop-blur-md text-white hover:bg-black/55 transition-colors border border-white/10"
                onClick={async () => { await logout(); navigate("/auth"); }}
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-6 max-w-lg mx-auto">
          <div className="flex items-end gap-4">
            {profilePhoto ? (
              <img
                src={profilePhoto.url}
                alt={branch.name}
                className="w-20 h-20 rounded-2xl object-cover border-2 border-white/50 shadow-xl shrink-0"
                data-testid="img-branch-profile-photo"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border-2 border-white/30 shadow-xl shrink-0">
                <span className="text-3xl font-bold text-white">{branch.name.charAt(0).toUpperCase()}</span>
              </div>
            )}
            <div className="min-w-0 pb-1">
              <h1
                className="text-2xl font-bold text-white leading-tight drop-shadow-md"
                data-testid="text-branch-public-name"
              >
                {branch.name}
              </h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {branch.category && (
                  <span className="inline-flex items-center bg-white/25 backdrop-blur-sm text-white text-[11px] font-semibold px-3 py-1 rounded-full border border-white/20">
                    {getCategoryLabel(branch.category)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-3 pt-4 pb-8 space-y-5 relative z-20">
        {announcements && announcements.length > 0 && (
          <div
            className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 space-y-2"
            data-testid="banner-announcement"
          >
            <div className="flex items-start gap-3">
              <Megaphone className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200 leading-snug" data-testid="text-announcement-banner">
                {announcements[0].message}
              </p>
            </div>
            {announcements[0].imageUrl && (
              <img
                src={announcements[0].imageUrl}
                alt="Anuncio"
                className="w-full rounded-xl max-h-52 object-cover"
                data-testid="img-announcement-banner"
              />
            )}
          </div>
        )}

        {user && !isMember && (
          <div className="rounded-2xl border border-primary/20 bg-background p-4 flex items-center justify-between gap-3 shadow-sm">
            <div>
              <h3 className="font-semibold text-sm">Únete a este negocio</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Accede a clases, reservas y más
              </p>
            </div>
            <Button
              onClick={() => joinMutation.mutate(branch.slug)}
              disabled={joinMutation.isPending}
              className="shrink-0 rounded-xl"
              data-testid="button-join-branch"
            >
              {joinMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : null}
              Unirme
            </Button>
          </div>
        )}

        {isMember && (
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 flex items-center gap-3 shadow-sm">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              Ya eres miembro de este negocio
            </span>
          </div>
        )}

        {user && isMember && slug && (
          <CustomerScheduleSection slug={slug} />
        )}

        {branch.description && (
          <Card className="border-border/50 shadow-sm rounded-2xl">
            <CardContent className="p-4">
              <p className="text-sm leading-relaxed text-foreground/80" data-testid="text-branch-description">
                {branch.description}
              </p>
            </CardContent>
          </Card>
        )}

        <PublicLocationSection branch={branch} />

        {content && <PublicPosts posts={content.posts} />}
        {content && <PublicProducts products={content.products} />}
        {content && <PhotoGallery photos={content.photos} />}
        {content && <PublicVideos videos={content.videos} />}

        <div data-testid="card-public-reviews">
          <div className="flex items-center gap-2 px-1 mb-3">
            <div className="h-4 w-1 rounded-full bg-primary" />
            <h3 className="font-bold text-sm tracking-tight" data-testid="text-reviews-title">Reseñas</h3>
          </div>
          <Card className="border-border/50 shadow-sm rounded-2xl">
            <CardContent className="p-4">
              <ReviewsSummary slug={slug!} />
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            className="flex-1 rounded-xl"
            onClick={() => navigate("/explore")}
            data-testid="button-explore-nearby"
          >
            <Compass className="h-4 w-4 mr-2" />
            Explorar cerca
          </Button>
          {user && (
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
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
