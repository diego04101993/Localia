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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { BRANCH_CATEGORIES, type Branch } from "@shared/schema";

type MembershipInfo = { branchId: string; isFavorite: boolean; status: string };

function getCategoryLabel(value: string) {
  return BRANCH_CATEGORIES.find((c) => c.value === value)?.label || value;
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
            <div className="flex items-center justify-center w-12 h-12 rounded-md bg-white/20 backdrop-blur">
              <Dumbbell className="h-6 w-6 text-white" />
            </div>
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
