import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Tag, ArrowLeft, Globe, CalendarClock, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

function normalizeWANumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `52${digits}`;
  return digits;
}

function PromoCard({ promo }: { promo: any }) {
  const [, navigate] = useLocation();
  const today = new Date().toISOString().split("T")[0];
  const isExpired = promo.endDate && promo.endDate < today;

  function handleWhatsApp(e: React.MouseEvent) {
    e.stopPropagation();
    const num = normalizeWANumber(promo.branchWhatsapp);
    const msg = encodeURIComponent(`Hola, vi la promoción "${promo.title}" en WebCool y quiero más información.`);
    window.open(`https://wa.me/${num}?text=${msg}`, "_blank");
  }

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
        {promo.branchWhatsapp && (
          <button
            onClick={handleWhatsApp}
            className="mt-3 w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-semibold text-xs py-2 px-3 rounded-xl transition-colors"
            data-testid={`button-promo-whatsapp-${promo.id}`}
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.122 1.534 5.857L0 24l6.334-1.512A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.848 0-3.576-.484-5.073-1.333l-.363-.215-3.762.898.916-3.65-.235-.375A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
            </svg>
            Enviar WhatsApp
          </button>
        )}
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
