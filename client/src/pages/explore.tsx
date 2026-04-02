import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Search,
  MapPin,
  Star,
  Heart,
  Loader2,
  Navigation,
  ArrowLeft,
  LogOut,
  Dumbbell,
  Stethoscope,
  Scale,
  Scissors,
  User,
  Compass,
  X,
  Zap,
  UserCircle,
  Tag,
} from "lucide-react";
import { BRANCH_CATEGORIES, type Branch } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type BranchWithDistance = Branch & { distance_km?: number; profileImageUrl?: string | null };
type MembershipInfo = { branchId: string; isFavorite: boolean; status: string };

const categoryIcons: Record<string, any> = {
  box: Dumbbell,
  gym: Zap,
  yoga: Compass,
  estetica: Scissors,
  doctor: Stethoscope,
  abogado: Scale,
  freelancer: User,
  otro: Compass,
};

const categoryGradients: Record<string, string> = {
  box: "from-orange-500/20 to-red-500/10",
  gym: "from-blue-500/20 to-indigo-500/10",
  yoga: "from-emerald-500/20 to-teal-500/10",
  estetica: "from-pink-500/20 to-rose-500/10",
  doctor: "from-cyan-500/20 to-blue-500/10",
  abogado: "from-slate-500/20 to-gray-500/10",
  freelancer: "from-violet-500/20 to-purple-500/10",
  otro: "from-primary/20 to-primary/5",
};

function getCategoryLabel(value: string) {
  return BRANCH_CATEGORIES.find((c) => c.value === value)?.label || value;
}

function BranchInitialAvatar({ name, category }: { name: string; category?: string | null }) {
  const initial = name?.charAt(0)?.toUpperCase() || "?";
  const gradient = categoryGradients[category || "otro"] || categoryGradients.otro;
  const Icon = categoryIcons[category || "otro"] || Compass;
  return (
    <div className={`flex flex-col items-center justify-center h-full bg-gradient-to-br ${gradient}`}>
      <div className="w-14 h-14 rounded-full bg-background/60 backdrop-blur flex items-center justify-center mb-1 shadow-sm">
        <span className="text-2xl font-bold text-foreground/80">{initial}</span>
      </div>
      <Icon className="h-4 w-4 text-foreground/30" />
    </div>
  );
}

function BranchExploreCard({
  branch,
  isFavorite,
  isLoggedIn,
  onFavorite,
  onOpen,
  favoriteLoading,
}: {
  branch: BranchWithDistance;
  isFavorite: boolean;
  isLoggedIn: boolean;
  onFavorite: (branchId: string, fav: boolean) => void;
  onOpen: (slug: string) => void;
  favoriteLoading: boolean;
}) {
  const displayImage = branch.profileImageUrl || branch.coverImageUrl;

  return (
    <Card
      className="overflow-hidden border border-border/60 shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer"
      data-testid={`card-explore-${branch.slug}`}
      onClick={() => onOpen(branch.slug)}
    >
      <div className="relative h-36 overflow-hidden bg-muted">
        {displayImage ? (
          <img
            src={displayImage}
            alt={branch.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <BranchInitialAvatar name={branch.name} category={branch.category} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
        {isLoggedIn && (
          <button
            className="absolute top-2.5 right-2.5 h-8 w-8 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onFavorite(branch.id, !isFavorite);
            }}
            disabled={favoriteLoading}
            data-testid={`button-favorite-${branch.slug}`}
          >
            <Heart
              className={`h-4 w-4 transition-all ${isFavorite ? "fill-red-400 text-red-400" : "text-white"}`}
            />
          </button>
        )}
        {branch.distance_km !== undefined && branch.distance_km !== null && (
          <div className="absolute bottom-2 left-2">
            <span className="inline-flex items-center gap-1 bg-black/50 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
              <Navigation className="h-2.5 w-2.5" />
              {branch.distance_km < 1
                ? `${Math.round(branch.distance_km * 1000)} m`
                : `${branch.distance_km.toFixed(1)} km`}
            </span>
          </div>
        )}
      </div>

      <CardContent className="p-3.5 space-y-2">
        <div>
          <h3
            className="font-semibold text-sm leading-snug truncate"
            data-testid={`text-explore-name-${branch.slug}`}
          >
            {branch.name}
          </h3>
          <span className="text-[11px] text-muted-foreground font-medium">
            {getCategoryLabel(branch.category || "otro")}
          </span>
        </div>

        {(branch.city || branch.address) && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 leading-tight">
            <MapPin className="h-3 w-3 shrink-0 text-primary/60" />
            <span className="truncate">{branch.city || branch.address?.split(",")[0]}</span>
          </p>
        )}

        {branch.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {branch.description}
          </p>
        )}

        <button
          className="w-full mt-1 py-2 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(branch.slug);
          }}
          data-testid={`button-open-${branch.slug}`}
        >
          Ver negocio
        </button>
      </CardContent>
    </Card>
  );
}

function CategoryFilter({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (v: string) => void;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
      <button
        onClick={() => onSelect("")}
        className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border ${
          selected === ""
            ? "bg-primary text-primary-foreground border-primary shadow-sm"
            : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
        }`}
        data-testid="button-category-all"
      >
        Todos
      </button>
      {BRANCH_CATEGORIES.map((cat) => {
        const Icon = categoryIcons[cat.value] || Compass;
        const isActive = selected === cat.value;
        return (
          <button
            key={cat.value}
            onClick={() => onSelect(cat.value)}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              isActive
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
            }`}
            data-testid={`button-category-${cat.value}`}
          >
            <Icon className="h-3 w-3" />
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}

export default function ExplorePage() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("");
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [favLoadingId, setFavLoadingId] = useState<string | null>(null);

  const buildSearchUrl = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (category) params.set("category", category);
    if (userLat && userLng) {
      params.set("lat", userLat.toString());
      params.set("lng", userLng.toString());
      params.set("radius_km", "50");
    }
    return `/api/branches/nearby?${params.toString()}`;
  };

  const {
    data: branchesData,
    isLoading,
    refetch,
  } = useQuery<BranchWithDistance[]>({
    queryKey: [buildSearchUrl()],
  });

  const { data: myMemberships } = useQuery<MembershipInfo[]>({
    queryKey: ["/api/memberships"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user,
  });

  const favMutation = useMutation({
    mutationFn: async ({ branchId, isFavorite }: { branchId: string; isFavorite: boolean }) => {
      setFavLoadingId(branchId);
      await apiRequest("POST", "/api/memberships/favorite", { branchId, isFavorite });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/memberships"] });
      toast({ title: "Actualizado" });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message?.includes("403")
          ? "No puedes unirte a esta sucursal"
          : "Error al actualizar favorito",
        variant: "destructive",
      });
    },
    onSettled: () => setFavLoadingId(null),
  });

  function requestLocation() {
    if (!navigator.geolocation) {
      toast({ title: "Tu navegador no soporta geolocalización", variant: "destructive" });
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        setGeoLoading(false);
      },
      () => {
        toast({ title: "No se pudo obtener ubicación", variant: "destructive" });
        setGeoLoading(false);
      },
      { timeout: 10000 }
    );
  }

  useEffect(() => {
    refetch();
  }, [searchQuery, category, userLat, userLng]);

  const favMap = new Map<string, boolean>();
  myMemberships?.forEach((m: any) => {
    favMap.set(m.branchId, m.isFavorite);
  });

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-50 bg-background border-b border-border/60 shadow-sm">
        <div className="max-w-3xl mx-auto px-3 pt-3 pb-2 space-y-2.5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/")}
              className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
              data-testid="button-explore-back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-base leading-none" data-testid="text-explore-title">
                Explorar
              </h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Descubre negocios cerca de ti
              </p>
            </div>
            <div className="flex items-center gap-1">
              {user && (
                <>
                  <button
                    className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors relative"
                    onClick={() => navigate("/favorites")}
                    data-testid="button-nav-favorites"
                    title="Favoritos y mis sucursales"
                  >
                    <Heart className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button
                    className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
                    onClick={() => navigate("/profile")}
                    data-testid="button-nav-profile"
                    title="Mi perfil"
                  >
                    <UserCircle className="h-4 w-4 text-muted-foreground" />
                  </button>
                </>
              )}
              {user && (
                <button
                  className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground"
                  onClick={async () => {
                    await logout();
                    navigate("/auth");
                  }}
                  data-testid="button-logout"
                  title="Cerrar sesión"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                placeholder="Buscar negocios..."
                className="pl-9 pr-9 h-9 bg-muted/60 border-transparent focus:bg-background focus:border-border"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-explore-search"
              />
              {searchQuery && (
                <button
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setSearchQuery("")}
                  data-testid="button-clear-search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={requestLocation}
              disabled={geoLoading}
              className={`h-9 w-9 flex items-center justify-center rounded-lg border transition-colors shrink-0 ${
                userLat
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
              }`}
              data-testid="button-use-location"
            >
              {geoLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Navigation className="h-4 w-4" />
              )}
            </button>
          </div>

          <CategoryFilter selected={category} onSelect={setCategory} />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-3 py-3">
        <button
          onClick={() => navigate("/promotions")}
          className="w-full mb-3 flex items-center gap-3 p-3 rounded-2xl text-left transition-all hover:shadow-md active:scale-[0.99]"
          style={{ background: "linear-gradient(135deg, #1E88E5, #1565C0)", color: "white" }}
          data-testid="button-go-promotions"
        >
          <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.2)" }}>
            <Tag className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">Promociones activas</p>
            <p className="text-xs opacity-80">Descuentos y ofertas de todos los negocios</p>
          </div>
          <span className="text-white opacity-60 text-xl leading-none">›</span>
        </button>

        {userLat && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full">
              <Navigation className="h-3 w-3" />
              Ordenando por cercanía
            </div>
            <button
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              onClick={() => {
                setUserLat(null);
                setUserLng(null);
              }}
              data-testid="button-clear-location"
            >
              <X className="h-3 w-3" />
              Quitar
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="overflow-hidden border border-border/60">
                <Skeleton className="h-36 rounded-none" />
                <div className="p-3.5 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-8 w-full rounded-lg mt-1" />
                </div>
              </Card>
            ))}
          </div>
        ) : branchesData && branchesData.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {branchesData.map((branch) => (
              <BranchExploreCard
                key={branch.id}
                branch={branch}
                isFavorite={favMap.get(branch.id) || false}
                isLoggedIn={!!user}
                onFavorite={(id, fav) => favMutation.mutate({ branchId: id, isFavorite: fav })}
                onOpen={(slug) => navigate(`/app/${slug}`)}
                favoriteLoading={favLoadingId === branch.id}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Search className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <h3 className="font-semibold text-base mb-1">Sin resultados</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              No se encontraron negocios con esos filtros. Intenta con otros criterios.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
