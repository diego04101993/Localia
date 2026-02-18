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
  Filter,
  ArrowLeft,
  Dumbbell,
  Stethoscope,
  Scale,
  Scissors,
  User,
  Compass,
  X,
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

type BranchWithDistance = Branch & { distance_km?: number };
type MembershipInfo = { branchId: string; isFavorite: boolean; status: string };

const categoryIcons: Record<string, any> = {
  box: Dumbbell,
  gym: Dumbbell,
  yoga: Compass,
  estetica: Scissors,
  doctor: Stethoscope,
  abogado: Scale,
  freelancer: User,
  otro: Compass,
};

function getCategoryLabel(value: string) {
  return BRANCH_CATEGORIES.find((c) => c.value === value)?.label || value;
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
  const Icon = categoryIcons[branch.category || "otro"] || Compass;
  const hasImage = !!branch.coverImageUrl;

  return (
    <Card className="overflow-visible" data-testid={`card-explore-${branch.slug}`}>
      <CardContent className="p-0">
        <div className="relative h-32 bg-gradient-to-br from-primary/20 to-primary/5 rounded-t-md overflow-hidden">
          {hasImage ? (
            <img
              src={branch.coverImageUrl!}
              alt={branch.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Icon className="h-10 w-10 text-primary/30" />
            </div>
          )}
          {isLoggedIn && (
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-2 right-2 bg-background/60 backdrop-blur"
              onClick={(e) => {
                e.stopPropagation();
                onFavorite(branch.id, !isFavorite);
              }}
              disabled={favoriteLoading}
              data-testid={`button-favorite-${branch.slug}`}
            >
              <Heart
                className={`h-4 w-4 ${isFavorite ? "fill-red-500 text-red-500" : ""}`}
              />
            </Button>
          )}
        </div>
        <div className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3
                className="font-semibold truncate"
                data-testid={`text-explore-name-${branch.slug}`}
              >
                {branch.name}
              </h3>
              <Badge variant="secondary" className="mt-1">
                {getCategoryLabel(branch.category || "otro")}
              </Badge>
            </div>
          </div>
          {branch.city && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{branch.city}</span>
            </p>
          )}
          {branch.distance_km !== undefined && branch.distance_km !== null && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Navigation className="h-3 w-3 shrink-0" />
              {branch.distance_km < 1
                ? `${Math.round(branch.distance_km * 1000)} m`
                : `${branch.distance_km.toFixed(1)} km`}
            </p>
          )}
          {branch.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {branch.description}
            </p>
          )}
          <Button
            className="w-full mt-1"
            variant="outline"
            onClick={() => onOpen(branch.slug)}
            data-testid={`button-open-${branch.slug}`}
          >
            Ver negocio
          </Button>
        </div>
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
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      <Button
        variant={selected === "" ? "default" : "outline"}
        size="sm"
        onClick={() => onSelect("")}
        className="shrink-0"
        data-testid="button-category-all"
      >
        Todos
      </Button>
      {BRANCH_CATEGORIES.map((cat) => {
        const Icon = categoryIcons[cat.value] || Compass;
        return (
          <Button
            key={cat.value}
            variant={selected === cat.value ? "default" : "outline"}
            size="sm"
            onClick={() => onSelect(cat.value)}
            className="shrink-0"
            data-testid={`button-category-${cat.value}`}
          >
            <Icon className="h-3.5 w-3.5 mr-1" />
            {cat.label}
          </Button>
        );
      })}
    </div>
  );
}

export default function ExplorePage() {
  const { user } = useAuth();
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
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-3xl mx-auto p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => navigate("/")}
              data-testid="button-explore-back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="font-bold text-lg" data-testid="text-explore-title">
              Explorar
            </h1>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar negocios..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-explore-search"
              />
              {searchQuery && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute right-0 top-0"
                  onClick={() => setSearchQuery("")}
                  data-testid="button-clear-search"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Button
              variant={userLat ? "default" : "outline"}
              size="icon"
              onClick={requestLocation}
              disabled={geoLoading}
              data-testid="button-use-location"
            >
              {geoLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Navigation className="h-4 w-4" />
              )}
            </Button>
          </div>
          <CategoryFilter selected={category} onSelect={setCategory} />
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-3">
        {userLat && (
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="secondary">
              <Navigation className="h-3 w-3 mr-1" />
              Ordenando por cercanía
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setUserLat(null);
                setUserLng(null);
              }}
              data-testid="button-clear-location"
            >
              <X className="h-3 w-3 mr-1" />
              Quitar
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-0">
                  <Skeleton className="h-32 rounded-t-md" />
                  <div className="p-3 space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : branchesData && branchesData.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <Card>
            <CardContent className="p-12 text-center">
              <Search className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-1">Sin resultados</h3>
              <p className="text-sm text-muted-foreground">
                No se encontraron negocios con esos filtros. Intenta con otros criterios.
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
