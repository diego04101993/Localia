import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Tag, ArrowLeft, Globe, CalendarClock, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

function PromoCard({ promo }: { promo: any }) {
  const [, navigate] = useLocation();
  const today = new Date().toISOString().split("T")[0];
  const isExpired = promo.endDate && promo.endDate < today;

  return (
    <Card
      className="overflow-hidden cursor-pointer group hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
      onClick={() => navigate(`/app/${promo.branchSlug}`)}
      data-testid={`card-global-promo-${promo.id}`}
    >
      {promo.imageUrl ? (
        <div className="aspect-video overflow-hidden">
          <img
            src={promo.imageUrl}
            alt={promo.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      ) : (
        <div className="aspect-video flex items-center justify-center" style={{ background: "linear-gradient(135deg, #e3f2fd, #bbdefb)" }}>
          <Tag className="h-12 w-12 opacity-30" style={{ color: "#1E88E5" }} />
        </div>
      )}
      <CardContent className="p-4">
        <p className="font-bold text-base leading-snug group-hover:text-primary transition-colors" data-testid={`text-global-promo-title-${promo.id}`}>
          {promo.title}
        </p>
        {promo.description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{promo.description}</p>
        )}
        <div className="flex items-center justify-between mt-3 gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-0">
            <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate font-medium">{promo.branchName}</span>
          </div>
          {promo.endDate && !isExpired && (
            <Badge variant="outline" className="text-xs flex items-center gap-1 flex-shrink-0">
              <CalendarClock className="h-3 w-3" />
              Hasta {promo.endDate}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PromotionsPage() {
  const [, navigate] = useLocation();

  const { data: promos = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/promotions/global"],
  });

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #e3f2fd 0%, #f8fbff 120px)" }}>
      <div className="max-w-2xl mx-auto px-4 pb-12">
        <div className="pt-6 pb-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/explore")} data-testid="button-back-promotions">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "#0d47a1" }}>
              <Globe className="h-6 w-6" />
              Promociones
            </h1>
            <p className="text-sm text-muted-foreground">Ofertas activas de todos los negocios</p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="aspect-video w-full" />
                <CardContent className="p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : promos.length === 0 ? (
          <div className="text-center py-20">
            <Tag className="h-14 w-14 mx-auto mb-4 opacity-20" style={{ color: "#1E88E5" }} />
            <p className="text-lg font-semibold text-muted-foreground">Sin promociones activas</p>
            <p className="text-sm text-muted-foreground mt-1">Vuelve pronto, los negocios estarán publicando ofertas</p>
            <Button variant="outline" className="mt-6" onClick={() => navigate("/explore")} data-testid="button-go-explore">
              Ver negocios
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2" data-testid="list-global-promotions">
            {promos.map((promo: any) => <PromoCard key={promo.id} promo={promo} />)}
          </div>
        )}
      </div>
    </div>
  );
}
