import { useState } from "react";
import { Loader2, ShieldCheck, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import webcool_logo from "@assets/webcool_logo.png";

export default function AcceptTermsPage() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [accepting, setAccepting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await apiRequest("POST", "/api/auth/accept-terms");
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch {
      toast({
        title: "Error",
        description: "No se pudo guardar tu aceptación. Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setAccepting(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-5 relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, #e3f2fd 0%, #bbdefb 40%, #e8f5e9 100%)" }}
    >
      <div className="w-full max-w-md relative z-10 flex flex-col items-center gap-5">
        <div className="flex flex-col items-center gap-3">
          <img
            src={webcool_logo}
            alt="WebCool"
            className="object-contain rounded-full"
            style={{ width: 72, height: 72, filter: "drop-shadow(0 4px 12px rgba(30,136,229,0.3))" }}
          />
          <h1 className="text-xl font-bold tracking-tight text-center" style={{ color: "#0d47a1" }}>
            Términos y privacidad
          </h1>
          <p className="text-sm text-center" style={{ color: "#546e7a" }}>
            Hola{user?.name ? `, ${user.name}` : ""}. Para continuar debes aceptar nuestros términos.
          </p>
        </div>

        <div
          className="w-full rounded-3xl p-6"
          style={{
            background: "rgba(255,255,255,0.88)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(30,136,229,0.15)",
            boxShadow: "0 20px 60px rgba(30,136,229,0.12), 0 4px 16px rgba(0,0,0,0.06)",
          }}
        >
          <div className="flex items-start gap-3 mb-4 p-3 rounded-2xl bg-blue-50 border border-blue-100">
            <ShieldCheck className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed text-blue-800">
              Al continuar, confirmas que has leído y aceptas nuestros{" "}
              <Link href="/terminos" className="underline font-medium">Términos y Condiciones</Link>{" "}
              y nuestro{" "}
              <Link href="/privacidad" className="underline font-medium">Aviso de Privacidad</Link>.
              Sin aceptación, no es posible acceder a la app.
            </p>
          </div>

          <div
            className="text-xs leading-relaxed space-y-3 max-h-64 overflow-y-auto pr-1 mb-5"
            style={{ color: "#455a64" }}
          >
            <div>
              <p className="font-semibold text-sm mb-1" style={{ color: "#0d47a1" }}>Resumen de términos</p>
              <ul className="space-y-1.5 list-none">
                {[
                  "WebCool es una plataforma para conectar usuarios con negocios de salud y bienestar.",
                  "Tus datos (nombre, correo, celular, historial de actividad) se usan para operar el servicio.",
                  "Los establecimientos de los que seas miembro pueden ver tu perfil e historial dentro de la plataforma.",
                  "No vendemos ni compartimos tus datos con terceros para fines comerciales externos.",
                  "Puedes solicitar acceso, rectificación, cancelación u oposición de tus datos escribiendo a soporte@webcool.mx.",
                  "El servicio puede incluir a futuro funciones de reservas, fidelización y comunicación dentro del ecosistema WebCool.",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <FileText className="h-3 w-3 shrink-0 mt-0.5 text-blue-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Button
            className="w-full h-12 rounded-2xl text-sm font-semibold"
            style={{
              background: "linear-gradient(135deg, #1E88E5 0%, #1565C0 100%)",
              boxShadow: "0 6px 20px rgba(30,136,229,0.4)",
              color: "#fff",
              border: "none",
            }}
            onClick={handleAccept}
            disabled={accepting}
            data-testid="button-accept-terms"
          >
            {accepting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Guardando...
              </span>
            ) : (
              "Acepto los términos y condiciones"
            )}
          </Button>

          <button
            className="w-full mt-3 text-xs text-center hover:underline"
            style={{ color: "#90a4ae" }}
            onClick={handleLogout}
            disabled={loggingOut}
            data-testid="button-decline-terms"
          >
            {loggingOut ? "Cerrando sesión..." : "No acepto — cerrar sesión"}
          </button>
        </div>
      </div>
    </div>
  );
}
