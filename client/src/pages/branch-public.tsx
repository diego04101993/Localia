import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Dumbbell, MapPin, Star, Clock, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Branch } from "@shared/schema";

export default function BranchPublicPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [, navigate] = useLocation();

  const { data: branch, isLoading, error } = useQuery<Branch>({
    queryKey: [`/api/public/branch/${slug}`],
    enabled: !!slug,
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

  return (
    <div className="min-h-screen bg-background">
      <div className="relative h-48 bg-gradient-to-br from-primary/80 to-primary overflow-hidden">
        <div className="absolute inset-0 bg-black/30" />
        <div className="relative z-10 h-full flex flex-col justify-end p-6 max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-2">
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
              <p className="text-white/70 text-sm">/{branch.slug}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4 -mt-4 relative z-20">
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">Sin calificaciones aún</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>Ubicación por configurar</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Horarios por configurar</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-8 text-center">
            <CalendarIcon className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-semibold mb-1">Agenda</h3>
            <p className="text-sm text-muted-foreground">
              Las reservas se habilitarán próximamente.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}
