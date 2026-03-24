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
      style={{ background: "linear-gradient(145deg, #1a0e3a 0%, #2d1b69 40%, #4a2db8 75%, #6C4CF1 100%)" }}
    >
      {/* Decorative glow orbs */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(108,76,241,0.35) 0%, transparent 70%)",
          top: -80,
          right: -80,
          filter: "blur(40px)",
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(147,51,234,0.25) 0%, transparent 70%)",
          bottom: -60,
          left: -60,
          filter: "blur(50px)",
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          width: 200,
          height: 200,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(196,181,253,0.15) 0%, transparent 70%)",
          top: "45%",
          left: "15%",
          filter: "blur(30px)",
        }}
      />

      {/* Content */}
      <div className="w-full max-w-sm relative z-10 flex flex-col items-center gap-6">

        {/* Branding */}
        <div className="flex flex-col items-center gap-2 text-center">
          <img
            src={localia_logo}
            alt="Localia"
            className="object-contain drop-shadow-2xl"
            style={{ width: 140, height: 140 }}
            data-testid="text-login-title"
          />
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: "#ffffff", textShadow: "0 2px 16px rgba(108,76,241,0.5)" }}
          >
            Localia
          </h1>
          <p className="text-sm leading-snug max-w-xs" style={{ color: "rgba(220,210,255,0.8)" }}>
            Descubre, reserva y conecta con negocios cerca de ti
          </p>
        </div>

        {/* Card */}
        <div
          className="w-full rounded-3xl p-7"
          style={{
            background: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.15)",
            boxShadow: "0 24px 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
          }}
        >
          <h2
            className="text-base font-semibold text-center mb-5"
            style={{ color: "rgba(255,255,255,0.9)" }}
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
                          style={{ color: "rgba(196,181,253,0.7)" }}
                        />
                        <input
                          type="email"
                          placeholder="Correo electrónico"
                          data-testid="input-email"
                          className="w-full h-12 pl-11 pr-4 rounded-2xl text-sm outline-none transition-all"
                          style={{
                            background: "rgba(255,255,255,0.1)",
                            border: "1px solid rgba(255,255,255,0.15)",
                            color: "#ffffff",
                          }}
                          onFocus={e => {
                            e.target.style.background = "rgba(255,255,255,0.15)";
                            e.target.style.border = "1px solid rgba(108,76,241,0.8)";
                            e.target.style.boxShadow = "0 0 0 3px rgba(108,76,241,0.2)";
                          }}
                          onBlur={e => {
                            e.target.style.background = "rgba(255,255,255,0.1)";
                            e.target.style.border = "1px solid rgba(255,255,255,0.15)";
                            e.target.style.boxShadow = "none";
                          }}
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-red-300" />
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
                          style={{ color: "rgba(196,181,253,0.7)" }}
                        />
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="Contraseña"
                          data-testid="input-password"
                          className="w-full h-12 pl-11 pr-12 rounded-2xl text-sm outline-none transition-all"
                          style={{
                            background: "rgba(255,255,255,0.1)",
                            border: "1px solid rgba(255,255,255,0.15)",
                            color: "#ffffff",
                          }}
                          onFocus={e => {
                            e.target.style.background = "rgba(255,255,255,0.15)";
                            e.target.style.border = "1px solid rgba(108,76,241,0.8)";
                            e.target.style.boxShadow = "0 0 0 3px rgba(108,76,241,0.2)";
                          }}
                          onBlur={e => {
                            e.target.style.background = "rgba(255,255,255,0.1)";
                            e.target.style.border = "1px solid rgba(255,255,255,0.15)";
                            e.target.style.boxShadow = "none";
                          }}
                          {...field}
                        />
                        <button
                          type="button"
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
                          style={{ color: "rgba(196,181,253,0.7)" }}
                          onClick={() => setShowPassword(!showPassword)}
                          data-testid="button-toggle-password"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage className="text-red-300" />
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
                  boxShadow: "0 6px 24px rgba(108,76,241,0.5)",
                }}
                onMouseEnter={e => {
                  if (!isSubmitting) {
                    (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 10px 32px rgba(108,76,241,0.6)";
                  }
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 24px rgba(108,76,241,0.5)";
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

        <p className="text-center text-xs pb-2" style={{ color: "rgba(196,181,253,0.5)" }}>
          Acceso exclusivo para administradores y usuarios registrados
        </p>
      </div>
    </div>
  );
}
