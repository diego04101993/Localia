import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Heart,
  ArrowLeft,
  MapPin,
  Loader2,
  Dumbbell,
  Compass,
  Scissors,
  Stethoscope,
  Scale,
  User,
  ExternalLink,
  Users,
} from "lucide-react";
import { BRANCH_CATEGORIES } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type MembershipWithBranch = {
  id: string;
  branchId: string;
  isFavorite: boolean;
  status: string;
  joinedAt: string;
  branch: {
    id: string;
    name: string;
    slug: string;
    category: string | null;
    city: string | null;
    coverImageUrl: string | null;
    description: string | null;
  };
};

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

function BranchCard({
  m,
  showUnfav,
  onUnfav,
}: {
  m: MembershipWithBranch;
  showUnfav?: boolean;
  onUnfav?: () => void;
}) {
  const [, navigate] = useLocation();
  const Icon = categoryIcons[m.branch.category || "otro"] || Compass;
  return (
    <Card className="hover-elevate" data-testid={`card-branch-${m.branch.slug}`}>
      <CardContent className="p-3 flex items-center gap-3">
        <div className="w-14 h-14 rounded-md bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
          {m.branch.coverImageUrl ? (
            <img
              src={m.branch.coverImageUrl}
              alt={m.branch.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <Icon className="h-6 w-6 text-primary/40" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">{m.branch.name}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs">
              {getCategoryLabel(m.branch.category || "otro")}
            </Badge>
            {m.branch.city && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {m.branch.city}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {showUnfav && onUnfav && (
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onUnfav();
              }}
              data-testid={`button-unfav-${m.branch.slug}`}
              title="Quitar de favoritos"
            >
              <Heart className="h-4 w-4 fill-red-500 text-red-500" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => navigate(`/app/${m.branch.slug}`)}
            data-testid={`button-goto-${m.branch.slug}`}
            title="Ver sucursal"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FavoritesPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: memberships, isLoading } = useQuery<MembershipWithBranch[]>({
    queryKey: ["/api/memberships"],
    enabled: !!user,
  });

  const unfavMutation = useMutation({
    mutationFn: async (branchId: string) => {
      await apiRequest("POST", "/api/memberships/favorite", { branchId, isFavorite: false });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/memberships"] });
      toast({ title: "Eliminado de favoritos" });
    },
  });

  const favorites = memberships?.filter((m) => m.isFavorite) || [];
  const joined = memberships?.filter((m) => !m.isFavorite && m.status === "active") || [];

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="p-8 text-center">
            <Heart className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Inicia sesión</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Necesitas iniciar sesión para ver tus sucursales.
            </p>
            <Button onClick={() => navigate("/")} data-testid="button-go-login">
              Ir a login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-3xl mx-auto p-3 flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => navigate("/explore")}
            data-testid="button-fav-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="font-bold text-lg" data-testid="text-favorites-title">
            Mis Sucursales
          </h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-3 space-y-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-3 flex items-center gap-3">
                  <Skeleton className="w-14 h-14 rounded-md shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            {/* Sección: Favoritas */}
            <section data-testid="section-favorites">
              <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                Sucursales favoritas
                {favorites.length > 0 && (
                  <span className="text-xs">({favorites.length})</span>
                )}
              </h2>
              {favorites.length > 0 ? (
                <div className="space-y-3">
                  {favorites.map((m) => (
                    <BranchCard
                      key={m.id}
                      m={m}
                      showUnfav
                      onUnfav={() => unfavMutation.mutate(m.branchId)}
                    />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-6 text-center">
                    <Heart className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground" data-testid="text-no-favorites">
                      No tienes sucursales favoritas todavía
                    </p>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => navigate("/explore")}
                      className="mt-1"
                    >
                      Explorar sucursales
                    </Button>
                  </CardContent>
                </Card>
              )}
            </section>

            {/* Sección: Unido */}
            <section data-testid="section-joined">
              <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Sucursales donde soy miembro
                {joined.length > 0 && (
                  <span className="text-xs">({joined.length})</span>
                )}
              </h2>
              {joined.length > 0 ? (
                <div className="space-y-3">
                  {joined.map((m) => (
                    <BranchCard key={m.id} m={m} />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-6 text-center">
                    <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground" data-testid="text-no-joined">
                      No estás unido a ninguna sucursal todavía
                    </p>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => navigate("/explore")}
                      className="mt-1"
                    >
                      Explorar sucursales
                    </Button>
                  </CardContent>
                </Card>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
