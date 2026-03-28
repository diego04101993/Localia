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
import webcool_logo from "@assets/webcool_logo.png";

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
      style={{ background: "linear-gradient(160deg, #e3f2fd 0%, #bbdefb 40%, #e8f5e9 100%)" }}
    >
      {/* Subtle glow behind logo */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 360,
          height: 360,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(30,136,229,0.15) 0%, transparent 70%)",
          top: "2%",
          left: "50%",
          transform: "translateX(-50%)",
          filter: "blur(20px)",
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          width: 250,
          height: 250,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(21,101,192,0.1) 0%, transparent 70%)",
          bottom: -40,
          right: -40,
          filter: "blur(30px)",
        }}
      />

      <div className="w-full max-w-sm relative z-10 flex flex-col items-center gap-5">

        {/* Logo + tagline */}
        <div className="flex flex-col items-center gap-3">
          <div style={{ filter: "drop-shadow(0 8px 24px rgba(30,136,229,0.3))" }}>
            <img
              src={webcool_logo}
              alt="WebCool"
              className="object-contain rounded-full"
              style={{ width: 130, height: 130 }}
              data-testid="text-login-title"
            />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#0d47a1" }}>
              WebCool
            </h1>
            <p className="text-sm mt-1" style={{ color: "#546e7a" }}>
              Descubre, reserva y conecta con negocios cerca de ti
            </p>
          </div>
        </div>

        {/* Card */}
        <div
          className="w-full rounded-3xl p-7"
          style={{
            background: "rgba(255,255,255,0.88)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(30,136,229,0.15)",
            boxShadow: "0 20px 60px rgba(30,136,229,0.12), 0 4px 16px rgba(0,0,0,0.06)",
          }}
        >
          <h2 className="text-base font-semibold text-center mb-5" style={{ color: "#0d47a1" }}>
            Iniciar sesión
          </h2>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "#64b5f6" }} />
                        <input
                          type="email"
                          placeholder="Correo electrónico"
                          data-testid="input-email"
                          className="w-full h-12 pl-11 pr-4 rounded-2xl text-sm outline-none transition-all"
                          style={{ background: "#f0f8ff", border: "1.5px solid #bbdefb", color: "#0d47a1" }}
                          onFocus={e => {
                            e.target.style.border = "1.5px solid #1E88E5";
                            e.target.style.boxShadow = "0 0 0 3px rgba(30,136,229,0.1)";
                            e.target.style.background = "#ffffff";
                          }}
                          onBlur={e => {
                            e.target.style.border = "1.5px solid #bbdefb";
                            e.target.style.boxShadow = "none";
                            e.target.style.background = "#f0f8ff";
                          }}
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "#64b5f6" }} />
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="Contraseña"
                          data-testid="input-password"
                          className="w-full h-12 pl-11 pr-12 rounded-2xl text-sm outline-none transition-all"
                          style={{ background: "#f0f8ff", border: "1.5px solid #bbdefb", color: "#0d47a1" }}
                          onFocus={e => {
                            e.target.style.border = "1.5px solid #1E88E5";
                            e.target.style.boxShadow = "0 0 0 3px rgba(30,136,229,0.1)";
                            e.target.style.background = "#ffffff";
                          }}
                          onBlur={e => {
                            e.target.style.border = "1.5px solid #bbdefb";
                            e.target.style.boxShadow = "none";
                            e.target.style.background = "#f0f8ff";
                          }}
                          {...field}
                        />
                        <button
                          type="button"
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-60"
                          style={{ color: "#64b5f6" }}
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

              <button
                type="submit"
                disabled={isSubmitting}
                data-testid="button-login"
                className="w-full h-12 rounded-2xl text-white text-sm font-semibold transition-all mt-1 disabled:opacity-60"
                style={{
                  background: "linear-gradient(135deg, #1E88E5 0%, #1565C0 100%)",
                  boxShadow: "0 6px 20px rgba(30,136,229,0.4)",
                }}
                onMouseEnter={e => {
                  if (!isSubmitting) {
                    const btn = e.currentTarget as HTMLButtonElement;
                    btn.style.transform = "translateY(-1px)";
                    btn.style.boxShadow = "0 10px 28px rgba(30,136,229,0.5)";
                  }
                }}
                onMouseLeave={e => {
                  const btn = e.currentTarget as HTMLButtonElement;
                  btn.style.transform = "translateY(0)";
                  btn.style.boxShadow = "0 6px 20px rgba(30,136,229,0.4)";
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

        <p className="text-center text-xs pb-2" style={{ color: "#90a4ae" }}>
          Acceso exclusivo para administradores y usuarios registrados
        </p>
      </div>
    </div>
  );
}
