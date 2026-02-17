import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function BlockedPage() {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-md bg-destructive/10 mx-auto">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <h1
            className="text-xl font-bold"
            data-testid="text-blocked-title"
          >
            Servicio no activo
          </h1>
          <p className="text-sm text-muted-foreground">
            Esta sucursal ha sido suspendida o bloqueada. Si crees que esto es
            un error, contacta al administrador.
          </p>
          <Button
            variant="outline"
            onClick={() => navigate("/")}
            data-testid="button-go-home"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al inicio
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
