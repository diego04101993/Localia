import { useRef } from "react";
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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  const sorted = [...products].sort((a, b) => a.displayOrder - b.displayOrder);
  if (sorted.length === 0) return null;

  return (
    <Card data-testid="card-public-products">
      <CardContent className="p-4">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2" data-testid="text-products-title">
          <ShoppingBag className="h-4 w-4" />
          Productos
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {sorted.map((product) => (
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
                <p className="text-xs font-semibold text-primary" data-testid={`text-public-product-price-${product.id}`}>
                  ${(product.price / 100).toFixed(2)} MXN
                </p>
              </div>
            </div>
          ))}
        </div>
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
            className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
            data-testid="banner-announcement"
          >
            <Megaphone className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200" data-testid="text-announcement-banner">
              {announcements[0].message}
            </p>
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

        <Card>
          <CardContent className="p-4 space-y-3">
            {branch.description && (
              <p className="text-sm">{branch.description}</p>
            )}
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">Sin calificaciones aún</span>
            </div>
            {branch.address && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                <span>{branch.address}</span>
              </div>
            )}
            {branch.city && !branch.address && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                <span>{branch.city}</span>
              </div>
            )}
            {!branch.address && !branch.city && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>Ubicación por configurar</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Horarios por configurar</span>
            </div>
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
