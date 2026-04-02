import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { Loader2, CheckCircle, AlertCircle, MailCheck } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import webcool_logo from "@assets/webcool_logo.png";

export default function VerifyEmailPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const token = params.get("token") || "";
  const { user } = useAuth();

  const [status, setStatus] = useState<"loading" | "success" | "error" | "no-token">(token ? "loading" : "no-token");
  const [message, setMessage] = useState("");
  const [resending, setResending] = useState(false);
  const [resendDone, setResendDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiRequest("GET", `/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(() => {
        setStatus("success");
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      })
      .catch(err => {
        let msg = "El enlace es inválido o ya fue utilizado.";
        try { const p = JSON.parse(err.message.replace(/^\d+:\s*/, "")); msg = p.message || msg; } catch {}
        setMessage(msg);
        setStatus("error");
      });
  }, [token]);

  async function handleResend() {
    setResending(true);
    try {
      await apiRequest("POST", "/api/auth/resend-verification");
      setResendDone(true);
    } catch {
      setMessage("Error al reenviar. Intenta de nuevo.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-5 relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, #e3f2fd 0%, #bbdefb 40%, #e8f5e9 100%)" }}
    >
      <div className="w-full max-w-sm relative z-10 flex flex-col items-center gap-5">
        <div className="flex flex-col items-center gap-3">
          <img src={webcool_logo} alt="WebCool" className="object-contain rounded-full" style={{ width: 80, height: 80, filter: "drop-shadow(0 4px 12px rgba(30,136,229,0.3))" }} />
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#0d47a1" }}>WebCool</h1>
        </div>

        <div className="w-full rounded-3xl p-7 text-center space-y-5" style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(30,136,229,0.15)", boxShadow: "0 20px 60px rgba(30,136,229,0.12), 0 4px 16px rgba(0,0,0,0.06)" }}>

          {status === "loading" && (
            <>
              <Loader2 className="h-10 w-10 mx-auto animate-spin text-blue-400" />
              <p className="text-sm" style={{ color: "#546e7a" }}>Verificando tu correo...</p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle className="h-12 w-12 mx-auto text-green-500" data-testid="icon-verify-success" />
              <h2 className="text-base font-semibold" style={{ color: "#0d47a1" }}>¡Correo verificado!</h2>
              <p className="text-sm" style={{ color: "#455a64" }}>Tu cuenta está confirmada. Ya puedes usar WebCool sin restricciones.</p>
              <Link href="/explore" className="block text-sm font-semibold underline-offset-2" style={{ color: "#1E88E5" }} data-testid="link-verify-continue">Continuar →</Link>
            </>
          )}

          {status === "error" && (
            <>
              <AlertCircle className="h-12 w-12 mx-auto text-amber-400" />
              <h2 className="text-base font-semibold" style={{ color: "#0d47a1" }}>Enlace inválido</h2>
              <p className="text-sm" style={{ color: "#455a64" }}>{message}</p>
              {user?.role === "CUSTOMER" && !resendDone && (
                <button
                  onClick={handleResend}
                  disabled={resending}
                  className="w-full h-11 rounded-2xl text-white text-sm font-semibold disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #1E88E5 0%, #1565C0 100%)", boxShadow: "0 4px 14px rgba(30,136,229,0.3)" }}
                  data-testid="button-resend-verification"
                >
                  {resending ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</span> : "Reenviar correo de verificación"}
                </button>
              )}
              {resendDone && <p className="text-sm text-green-600" data-testid="text-resend-done">¡Enviado! Revisa tu correo.</p>}
              <Link href="/" className="block text-xs hover:underline" style={{ color: "#90a4ae" }}>← Volver al inicio</Link>
            </>
          )}

          {status === "no-token" && (
            <>
              <MailCheck className="h-12 w-12 mx-auto text-blue-400" />
              <h2 className="text-base font-semibold" style={{ color: "#0d47a1" }}>Verifica tu correo</h2>
              <p className="text-sm" style={{ color: "#455a64" }}>
                {user?.role === "CUSTOMER" && !resendDone
                  ? "Haz clic en el enlace que enviamos a tu correo para verificar tu cuenta."
                  : "Usa el enlace que recibiste por correo para verificar tu cuenta."}
              </p>
              {user?.role === "CUSTOMER" && !resendDone && (
                <button
                  onClick={handleResend}
                  disabled={resending}
                  className="w-full h-11 rounded-2xl text-sm font-medium disabled:opacity-60"
                  style={{ background: "#e3f2fd", color: "#1565C0", border: "1.5px solid #bbdefb" }}
                  data-testid="button-resend-verification"
                >
                  {resending ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</span> : "Reenviar correo de verificación"}
                </button>
              )}
              {resendDone && <p className="text-sm text-green-600" data-testid="text-resend-done">¡Enviado! Revisa tu correo.</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
