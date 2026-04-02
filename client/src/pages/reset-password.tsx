import { useState } from "react";
import { Link, useSearch } from "wouter";
import { Loader2, Lock, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import webcool_logo from "@assets/webcool_logo.png";

const inputClass = "w-full h-12 pl-11 pr-12 rounded-2xl text-sm outline-none transition-all";
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

export default function ResetPasswordPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const token = params.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) { setError("Enlace inválido. Solicita uno nuevo."); return; }
    if (newPassword.length < 8) { setError("La contraseña debe tener al menos 8 caracteres"); return; }
    if (newPassword !== confirmPassword) { setError("Las contraseñas no coinciden"); return; }
    setError("");
    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/auth/reset-password", { token, newPassword, confirmPassword });
      setDone(true);
    } catch (err: any) {
      let msg = "Error al restablecer la contraseña.";
      try { const p = JSON.parse(err.message.replace(/^\d+:\s*/, "")); msg = p.message || msg; } catch {}
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-5" style={{ background: "linear-gradient(160deg, #e3f2fd 0%, #bbdefb 40%, #e8f5e9 100%)" }}>
        <div className="text-center space-y-4 max-w-sm">
          <AlertCircle className="h-12 w-12 mx-auto text-red-400" />
          <p className="text-sm" style={{ color: "#455a64" }}>Enlace inválido. Solicita uno nuevo desde la pantalla de inicio de sesión.</p>
          <Link href="/" className="block text-sm font-medium underline underline-offset-2 hover:opacity-70" style={{ color: "#1E88E5" }}>← Volver al inicio de sesión</Link>
        </div>
      </div>
    );
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
            <p className="text-sm mt-1" style={{ color: "#546e7a" }}>Nueva contraseña</p>
          </div>
        </div>

        <div className="w-full rounded-3xl p-7" style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(30,136,229,0.15)", boxShadow: "0 20px 60px rgba(30,136,229,0.12), 0 4px 16px rgba(0,0,0,0.06)" }}>

          {done ? (
            <div className="text-center space-y-4">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
              <h2 className="text-base font-semibold" style={{ color: "#0d47a1" }}>¡Contraseña actualizada!</h2>
              <p className="text-sm" style={{ color: "#455a64" }}>Tu contraseña fue cambiada correctamente. Ya puedes iniciar sesión.</p>
              <Link href="/" className="block mt-4 text-sm font-semibold text-center underline-offset-2" style={{ color: "#1E88E5" }} data-testid="link-reset-to-login">
                Ir a iniciar sesión →
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-base font-semibold mb-5 text-center" style={{ color: "#0d47a1" }}>Elige una nueva contraseña</h2>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "#64b5f6" }} />
                  <input
                    type={showNew ? "text" : "password"}
                    placeholder="Nueva contraseña"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                    onFocus={onFocusStyle}
                    onBlur={onBlurStyle}
                    data-testid="input-reset-new-password"
                  />
                  <button type="button" className="absolute right-3.5 top-1/2 -translate-y-1/2 hover:opacity-60" style={{ color: "#64b5f6" }} onClick={() => setShowNew(v => !v)}>
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "#64b5f6" }} />
                  <input
                    type={showConfirm ? "text" : "password"}
                    placeholder="Confirmar contraseña"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                    onFocus={onFocusStyle}
                    onBlur={onBlurStyle}
                    data-testid="input-reset-confirm-password"
                  />
                  <button type="button" className="absolute right-3.5 top-1/2 -translate-y-1/2 hover:opacity-60" style={{ color: "#64b5f6" }} onClick={() => setShowConfirm(v => !v)}>
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <p className="text-xs" style={{ color: "#90a4ae" }}>Mínimo 8 caracteres</p>

                {error && <p className="text-xs text-red-500" data-testid="error-reset">{error}</p>}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  data-testid="button-reset-submit"
                  className="w-full h-12 rounded-2xl text-white text-sm font-semibold transition-all mt-1 disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #1E88E5 0%, #1565C0 100%)", boxShadow: "0 6px 20px rgba(30,136,229,0.4)" }}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</span>
                  ) : "Guardar nueva contraseña"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
