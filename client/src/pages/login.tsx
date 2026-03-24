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
import localia_logo from "@assets/Logo_Localia_1774386009489.png";

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
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(135deg, #ffffff 0%, #f5f3ff 50%, #ede9fe 100%)",
      }}
    >
      <div className="w-full max-w-sm">
        {/* Logo + marca */}
        <div className="flex flex-col items-center mb-8 gap-1">
          <img
            src={localia_logo}
            alt="Localia"
            className="h-20 w-20 object-contain mb-1"
          />
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: "#4B2ED6" }}
            data-testid="text-login-title"
          >
            Localia
          </h1>
          <p className="text-sm text-center" style={{ color: "#7c6ba0" }}>
            Descubre, reserva y conecta con negocios cerca de ti
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-3xl p-8 shadow-xl"
          style={{ background: "rgba(255,255,255,0.95)" }}
        >
          <h2 className="text-lg font-semibold text-center mb-6 text-gray-800">
            Iniciar sesión
          </h2>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="relative">
                        <Mail
                          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                          style={{ color: "#9b8ec4" }}
                        />
                        <input
                          type="email"
                          placeholder="Correo electrónico"
                          data-testid="input-email"
                          className="w-full h-11 pl-10 pr-4 rounded-xl border text-sm outline-none transition-all"
                          style={{
                            borderColor: "#e2d9f3",
                            backgroundColor: "#faf9ff",
                            color: "#1a1a2e",
                          }}
                          onFocus={e => {
                            e.target.style.borderColor = "#6C4CF1";
                            e.target.style.boxShadow = "0 0 0 3px rgba(108,76,241,0.12)";
                          }}
                          onBlur={e => {
                            e.target.style.borderColor = "#e2d9f3";
                            e.target.style.boxShadow = "none";
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
                          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                          style={{ color: "#9b8ec4" }}
                        />
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="Contraseña"
                          data-testid="input-password"
                          className="w-full h-11 pl-10 pr-11 rounded-xl border text-sm outline-none transition-all"
                          style={{
                            borderColor: "#e2d9f3",
                            backgroundColor: "#faf9ff",
                            color: "#1a1a2e",
                          }}
                          onFocus={e => {
                            e.target.style.borderColor = "#6C4CF1";
                            e.target.style.boxShadow = "0 0 0 3px rgba(108,76,241,0.12)";
                          }}
                          onBlur={e => {
                            e.target.style.borderColor = "#e2d9f3";
                            e.target.style.boxShadow = "none";
                          }}
                          {...field}
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
                          style={{ color: "#9b8ec4" }}
                          onClick={() => setShowPassword(!showPassword)}
                          data-testid="button-toggle-password"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Botón */}
              <button
                type="submit"
                disabled={isSubmitting}
                data-testid="button-login"
                className="w-full h-11 rounded-xl text-white text-sm font-semibold transition-all mt-2 disabled:opacity-70"
                style={{
                  background: "linear-gradient(135deg, #6C4CF1 0%, #4B2ED6 100%)",
                  boxShadow: "0 4px 14px rgba(108,76,241,0.35)",
                }}
                onMouseEnter={e => {
                  if (!isSubmitting) (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 20px rgba(108,76,241,0.45)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 14px rgba(108,76,241,0.35)";
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

        <p className="text-center text-xs mt-6" style={{ color: "#9b8ec4" }}>
          Acceso exclusivo para administradores y usuarios registrados
        </p>
      </div>
    </div>
  );
}
