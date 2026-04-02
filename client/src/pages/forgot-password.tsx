import { useState } from "react";
import { Link } from "wouter";
import { Loader2, Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import webcool_logo from "@assets/webcool_logo.png";

const inputClass = "w-full h-12 pl-11 pr-4 rounded-2xl text-sm outline-none transition-all";
const inputStyle = { background: "#f0f8ff", border: "1.5px solid #bbdefb", color: "#0d47a1" };
function onFocusStyle(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.border = "1.5px solid #1E88E5";
  e.target.style.boxShadow = "0 0 0 3px rgba(30,136,229,0.1)";
  (e.target.style as any).background = "#ffffff";
}
function onBlurStyle(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.border = "1.5px solid #bbdefb";
  e.target.style.boxShadow = "none";
  (e.target.style as any).background = "#f0f8ff";
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Ingresa tu correo electrónico"); return; }
    setError("");
    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/auth/forgot-password", { email: email.trim() });
      setDone(true);
    } catch {
      setError("Error al procesar la solicitud. Intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
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
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#0d47a1" }}>WebCool</h1>
            <p className="text-sm mt-1" style={{ color: "#546e7a" }}>Recuperar contraseña</p>
          </div>
        </div>

        <div className="w-full rounded-3xl p-7" style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(30,136,229,0.15)", boxShadow: "0 20px 60px rgba(30,136,229,0.12), 0 4px 16px rgba(0,0,0,0.06)" }}>

          {done ? (
            <div className="text-center space-y-4">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
              <h2 className="text-base font-semibold" style={{ color: "#0d47a1" }}>¡Listo!</h2>
              <p className="text-sm" style={{ color: "#455a64" }}>
                Si el correo está registrado, recibirás instrucciones en los próximos minutos. Revisa también tu carpeta de spam.
              </p>
              <Link href="/" className="block mt-4 text-sm font-medium text-center underline underline-offset-2 hover:opacity-70" style={{ color: "#1E88E5" }} data-testid="link-back-to-login">
                ← Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-5">
                <Link href="/" className="text-xs font-medium transition-opacity hover:opacity-60 flex items-center gap-1" style={{ color: "#1E88E5" }} data-testid="link-forgot-back">
                  <ArrowLeft className="h-3 w-3" /> Iniciar sesión
                </Link>
                <h2 className="text-base font-semibold flex-1 text-right" style={{ color: "#0d47a1" }}>¿Olvidaste tu contraseña?</h2>
              </div>

              <p className="text-xs mb-5" style={{ color: "#546e7a" }}>
                Ingresa tu correo y te enviamos un enlace para restablecer tu contraseña.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "#64b5f6" }} />
                  <input
                    type="email"
                    placeholder="Correo electrónico"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                    onFocus={onFocusStyle}
                    onBlur={onBlurStyle}
                    data-testid="input-forgot-email"
                    autoFocus
                  />
                </div>

                {error && <p className="text-xs text-red-500" data-testid="error-forgot">{error}</p>}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  data-testid="button-forgot-submit"
                  className="w-full h-12 rounded-2xl text-white text-sm font-semibold transition-all disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #1E88E5 0%, #1565C0 100%)", boxShadow: "0 6px 20px rgba(30,136,229,0.4)" }}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</span>
                  ) : "Enviar instrucciones"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
