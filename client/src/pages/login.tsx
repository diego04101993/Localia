import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { Eye, EyeOff, Loader2, Mail, Lock } from "lucide-react";
import { loginSchema, type LoginData } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import localia_logo from "@assets/localia_logo.png";

export default function LoginPage() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(data: LoginData) {
    setIsSubmitting(true);
    try {
      await login(data.email, data.password);
      toast({ title: "Bienvenido", description: "Sesión iniciada correctamente" });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message?.includes("401")
          ? "Credenciales incorrectas"
          : "Error al iniciar sesión",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-5 relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, #f5f3ff 0%, #ede9fe 40%, #faf8ff 100%)" }}
    >
      {/* Subtle glow behind logo area */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 360,
          height: 360,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(108,76,241,0.12) 0%, transparent 70%)",
          top: "2%",
          left: "50%",
          transform: "translateX(-50%)",
          filter: "blur(20px)",
        }}
      />
      {/* Subtle corner accents */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 280,
          height: 280,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(167,139,250,0.1) 0%, transparent 70%)",
          bottom: -40,
          right: -40,
          filter: "blur(30px)",
        }}
      />

      {/* Content */}
      <div className="w-full max-w-sm relative z-10 flex flex-col items-center gap-5">

        {/* Logo — main focus */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="relative flex items-center justify-center"
            style={{
              filter: "drop-shadow(0 8px 24px rgba(108,76,241,0.3))",
            }}
          >
            <img
              src={localia_logo}
              alt="Localia"
              className="object-contain"
              style={{ width: 156, height: 156 }}
              data-testid="text-login-title"
            />
          </div>
          {/* Tagline only — no duplicate brand name */}
          <p
            className="text-sm text-center leading-snug max-w-xs"
            style={{ color: "#7c6ba0" }}
          >
            Descubre, reserva y conecta con negocios cerca de ti
          </p>
        </div>

        {/* Login Card */}
        <div
          className="w-full rounded-3xl p-7"
          style={{
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(196,181,253,0.3)",
            boxShadow: "0 20px 60px rgba(108,76,241,0.12), 0 4px 16px rgba(0,0,0,0.06)",
          }}
        >
          <h2
            className="text-base font-semibold text-center mb-5"
            style={{ color: "#1e1b4b" }}
          >
            Iniciar sesión
          </h2>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">

              {/* Email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="relative">
                        <Mail
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                          style={{ color: "#a78bfa" }}
                        />
                        <input
                          type="email"
                          placeholder="Correo electrónico"
                          data-testid="input-email"
                          className="w-full h-12 pl-11 pr-4 rounded-2xl text-sm outline-none transition-all"
                          style={{
                            background: "#f8f6ff",
                            border: "1.5px solid #e5e0f8",
                            color: "#1e1b4b",
                          }}
                          onFocus={e => {
                            e.target.style.border = "1.5px solid #6C4CF1";
                            e.target.style.boxShadow = "0 0 0 3px rgba(108,76,241,0.1)";
                            e.target.style.background = "#ffffff";
                          }}
                          onBlur={e => {
                            e.target.style.border = "1.5px solid #e5e0f8";
                            e.target.style.boxShadow = "none";
                            e.target.style.background = "#f8f6ff";
                          }}
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Password */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="relative">
                        <Lock
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                          style={{ color: "#a78bfa" }}
                        />
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="Contraseña"
                          data-testid="input-password"
                          className="w-full h-12 pl-11 pr-12 rounded-2xl text-sm outline-none transition-all"
                          style={{
                            background: "#f8f6ff",
                            border: "1.5px solid #e5e0f8",
                            color: "#1e1b4b",
                          }}
                          onFocus={e => {
                            e.target.style.border = "1.5px solid #6C4CF1";
                            e.target.style.boxShadow = "0 0 0 3px rgba(108,76,241,0.1)";
                            e.target.style.background = "#ffffff";
                          }}
                          onBlur={e => {
                            e.target.style.border = "1.5px solid #e5e0f8";
                            e.target.style.boxShadow = "none";
                            e.target.style.background = "#f8f6ff";
                          }}
                          {...field}
                        />
                        <button
                          type="button"
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-60"
                          style={{ color: "#a78bfa" }}
                          onClick={() => setShowPassword(!showPassword)}
                          data-testid="button-toggle-password"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                data-testid="button-login"
                className="w-full h-12 rounded-2xl text-white text-sm font-semibold transition-all mt-1 disabled:opacity-60"
                style={{
                  background: "linear-gradient(135deg, #6C4CF1 0%, #4B2ED6 100%)",
                  boxShadow: "0 6px 20px rgba(108,76,241,0.4)",
                }}
                onMouseEnter={e => {
                  if (!isSubmitting) {
                    const btn = e.currentTarget as HTMLButtonElement;
                    btn.style.transform = "translateY(-1px)";
                    btn.style.boxShadow = "0 10px 28px rgba(108,76,241,0.5)";
                  }
                }}
                onMouseLeave={e => {
                  const btn = e.currentTarget as HTMLButtonElement;
                  btn.style.transform = "translateY(0)";
                  btn.style.boxShadow = "0 6px 20px rgba(108,76,241,0.4)";
                }}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Ingresando...
                  </span>
                ) : (
                  "Ingresar"
                )}
              </button>
            </form>
          </Form>
        </div>

        <p className="text-center text-xs pb-2" style={{ color: "#c4b5fd" }}>
          Acceso exclusivo para administradores y usuarios registrados
        </p>
      </div>
    </div>
  );
}
