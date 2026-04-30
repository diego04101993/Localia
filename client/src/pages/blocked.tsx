import { useState } from "react";
import { ShieldAlert, ArrowLeft, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";

export default function BlockedPage() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [leaving, setLeaving] = useState(false);
  const isCustomerBlocked = !!(user && user.role === "CUSTOMER" && user.isBlocked);

  const handleGoHome = async () => {
    setLeaving(true);
    try {
      await logout();
    } catch (_) {
    } finally {
      queryClient.clear();
      navigate("/");
    }
  };

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
            {isCustomerBlocked ? "Cuenta bloqueada" : "Servicio no activo"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isCustomerBlocked
              ? (user?.blockedReason || "Tu cuenta ha sido bloqueada. Contacta a soporte.")
              : "Esta sucursal ha sido suspendida o bloqueada. Si crees que esto es un error, contacta al administrador."}
          </p>
          <Button
            variant="outline"
            onClick={handleGoHome}
            disabled={leaving}
            data-testid="button-go-home"
          >
            {leaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ArrowLeft className="h-4 w-4 mr-2" />
            )}
            Volver al inicio
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
