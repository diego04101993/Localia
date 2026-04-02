import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, Link } from "wouter";
import { z } from "zod";
import { Eye, EyeOff, Loader2, Mail, Lock, User, Phone, Calendar, ChevronDown, Info } from "lucide-react";
import { loginSchema, type LoginData } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import webcool_logo from "@assets/webcool_logo.png";

// ─── Register schema (frontend) ─────────────────────────────────────────────
const registerFormSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  lastName: z.string().min(1, "Los apellidos son obligatorios"),
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  confirmPassword: z.string(),
  phone: z.string().optional(),
  birthDate: z.string().optional(),
  gender: z.enum(["M", "F", "NE", ""]).optional(),
  acceptedTerms: z.boolean().refine((v) => v === true, {
    message: "Debes aceptar los términos y aviso de privacidad",
  }),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

type RegisterFormData = z.infer<typeof registerFormSchema>;

// ─── Shared input style helper ───────────────────────────────────────────────
const inputClass = "w-full h-12 pl-11 pr-4 rounded-2xl text-sm outline-none transition-all";
const inputStyle = { background: "#f0f8ff", border: "1.5px solid #bbdefb", color: "#0d47a1" };
function onFocusStyle(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.target.style.border = "1.5px solid #1E88E5";
  e.target.style.boxShadow = "0 0 0 3px rgba(30,136,229,0.1)";
  (e.target.style as any).background = "#ffffff";
}
function onBlurStyle(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.target.style.border = "1.5px solid #bbdefb";
  e.target.style.boxShadow = "none";
  (e.target.style as any).background = "#f0f8ff";
}

// ─── Login view ──────────────────────────────────────────────────────────────
function LoginView({ onRegister, initialEmail = "" }: { onRegister: () => void; initialEmail?: string }) {
  const { login } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: initialEmail, password: "" },
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
    <>
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
                      className={inputClass}
                      style={inputStyle}
                      onFocus={onFocusStyle}
                      onBlur={onBlurStyle}
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
                      style={inputStyle}
                      onFocus={onFocusStyle}
                      onBlur={onBlurStyle}
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

      <div className="mt-3 text-center">
        <Link
          href="/forgot-password"
          className="text-xs hover:opacity-70 transition-opacity"
          style={{ color: "#90a4ae" }}
          data-testid="link-forgot-password"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </div>

      <div className="mt-4 pt-4 border-t text-center" style={{ borderColor: "rgba(30,136,229,0.12)" }}>
        <p className="text-xs mb-2" style={{ color: "#78909c" }}>¿Eres cliente y no tienes cuenta?</p>
        <button
          type="button"
          onClick={onRegister}
          className="text-sm font-semibold transition-opacity hover:opacity-70"
          style={{ color: "#1E88E5" }}
          data-testid="button-go-register"
        >
          Crear mi cuenta →
        </button>
      </div>
    </>
  );
}

// ─── Register view ───────────────────────────────────────────────────────────
function RegisterView({ onBack, onGoLogin }: { onBack: () => void; onGoLogin: (email: string) => void }) {
  const { toast } = useToast();
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasCredentialsEmail, setHasCredentialsEmail] = useState<string | null>(null);

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      name: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      phone: "",
      birthDate: "",
      gender: "",
      acceptedTerms: false,
    },
  });

  async function onSubmit(data: RegisterFormData) {
    setHasCredentialsEmail(null);
    setIsSubmitting(true);
    try {
      const payload = {
        name: data.name,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        confirmPassword: data.confirmPassword,
        phone: data.phone || undefined,
        birthDate: data.birthDate || undefined,
        gender: (data.gender as any) || undefined,
        acceptedTerms: true as const,
      };
      await apiRequest("POST", "/api/auth/register", payload);
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "¡Bienvenido!", description: "Tu cuenta fue creada. Ya puedes explorar." });
    } catch (err: any) {
      let code = "";
      let description = "Error al crear la cuenta. Intenta de nuevo.";
      if (err?.message) {
        try {
          // apiRequest throws errors as "STATUS: {json}" e.g. "409: {"code":"HAS_CREDENTIALS",...}"
          const jsonPart = err.message.replace(/^\d+:\s*/, "");
          const parsed = JSON.parse(jsonPart);
          code = parsed.code || "";
          description = parsed.message || description;
        } catch {
          if (err.message.startsWith("409")) {
            description = "Ya existe una cuenta con ese correo. Inicia sesión.";
          }
        }
      }
      if (code === "HAS_CREDENTIALS") {
        setHasCredentialsEmail(data.email);
        return;
      }
      toast({ title: "Error", description, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-medium transition-opacity hover:opacity-60 flex items-center gap-1"
          style={{ color: "#1E88E5" }}
          data-testid="button-back-to-login"
        >
          ← Iniciar sesión
        </button>
        <h2 className="text-base font-semibold flex-1 text-right" style={{ color: "#0d47a1" }}>
          Crear cuenta
        </h2>
      </div>

      {hasCredentialsEmail && (
        <div
          className="mb-4 p-4 rounded-2xl flex flex-col gap-2"
          style={{ background: "#e3f2fd", border: "1.5px solid #90caf9" }}
          data-testid="callout-has-credentials"
        >
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#1565C0" }} />
            <p className="text-xs leading-relaxed" style={{ color: "#0d47a1" }}>
              Ya tienes un perfil en WebCool con ese correo. Inicia sesión con tu contraseña y acepta los términos para continuar.
            </p>
          </div>
          <button
            type="button"
            className="self-start text-xs font-semibold underline underline-offset-2 hover:opacity-70 transition-opacity"
            style={{ color: "#1565C0" }}
            onClick={() => onGoLogin(hasCredentialsEmail)}
            data-testid="button-go-login-from-credentials"
          >
            Ir a iniciar sesión →
          </button>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2.5">

          {/* Nombre */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "#64b5f6" }} />
                    <input
                      type="text"
                      placeholder="Nombre"
                      data-testid="input-register-name"
                      className={inputClass}
                      style={inputStyle}
                      onFocus={onFocusStyle}
                      onBlur={onBlurStyle}
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Apellidos */}
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "#64b5f6" }} />
                    <input
                      type="text"
                      placeholder="Apellidos"
                      data-testid="input-register-lastname"
                      className={inputClass}
                      style={inputStyle}
                      onFocus={onFocusStyle}
                      onBlur={onBlurStyle}
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Email */}
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
                      data-testid="input-register-email"
                      className={inputClass}
                      style={inputStyle}
                      onFocus={onFocusStyle}
                      onBlur={onBlurStyle}
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Celular (opcional) */}
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "#64b5f6" }} />
                    <input
                      type="tel"
                      placeholder="Celular (opcional)"
                      data-testid="input-register-phone"
                      className={inputClass}
                      style={inputStyle}
                      onFocus={onFocusStyle}
                      onBlur={onBlurStyle}
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Fecha de nacimiento (opcional) */}
          <FormField
            control={form.control}
            name="birthDate"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="relative">
                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "#64b5f6" }} />
                    <input
                      type="date"
                      placeholder="Fecha de nacimiento"
                      data-testid="input-register-birthdate"
                      className={inputClass}
                      style={{ ...inputStyle, paddingLeft: "2.75rem" }}
                      onFocus={onFocusStyle}
                      onBlur={onBlurStyle}
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Sexo (opcional) */}
          <FormField
            control={form.control}
            name="gender"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="relative">
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "#64b5f6" }} />
                    <select
                      data-testid="select-register-gender"
                      className="w-full h-12 pl-4 pr-10 rounded-2xl text-sm outline-none transition-all appearance-none"
                      style={inputStyle}
                      onFocus={onFocusStyle}
                      onBlur={onBlurStyle}
                      {...field}
                    >
                      <option value="">Sexo (opcional)</option>
                      <option value="M">Masculino</option>
                      <option value="F">Femenino</option>
                      <option value="NE">Prefiero no especificar</option>
                    </select>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Contraseña */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "#64b5f6" }} />
                    <input
                      type={showPass ? "text" : "password"}
                      placeholder="Contraseña (mín. 8 caracteres)"
                      data-testid="input-register-password"
                      className="w-full h-12 pl-11 pr-12 rounded-2xl text-sm outline-none transition-all"
                      style={inputStyle}
                      onFocus={onFocusStyle}
                      onBlur={onBlurStyle}
                      {...field}
                    />
                    <button
                      type="button"
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-60"
                      style={{ color: "#64b5f6" }}
                      onClick={() => setShowPass(!showPass)}
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Confirmar contraseña */}
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "#64b5f6" }} />
                    <input
                      type={showConfirm ? "text" : "password"}
                      placeholder="Confirmar contraseña"
                      data-testid="input-register-confirm-password"
                      className="w-full h-12 pl-11 pr-12 rounded-2xl text-sm outline-none transition-all"
                      style={inputStyle}
                      onFocus={onFocusStyle}
                      onBlur={onBlurStyle}
                      {...field}
                    />
                    <button
                      type="button"
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-60"
                      style={{ color: "#64b5f6" }}
                      onClick={() => setShowConfirm(!showConfirm)}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Checkbox términos */}
          <FormField
            control={form.control}
            name="acceptedTerms"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <label
                    className="flex items-start gap-3 cursor-pointer select-none"
                    data-testid="label-terms"
                  >
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={e => field.onChange(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded accent-blue-600 shrink-0"
                      data-testid="checkbox-terms"
                    />
                    <span className="text-xs leading-relaxed" style={{ color: "#546e7a" }}>
                      He leído y acepto los{" "}
                      <Link href="/terminos" className="underline font-medium" style={{ color: "#1E88E5" }}>
                        Términos y Condiciones
                      </Link>{" "}
                      y el{" "}
                      <Link href="/privacidad" className="underline font-medium" style={{ color: "#1E88E5" }}>
                        Aviso de Privacidad
                      </Link>{" "}
                      de WebCool.
                    </span>
                  </label>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <button
            type="submit"
            disabled={isSubmitting}
            data-testid="button-register"
            className="w-full h-12 rounded-2xl text-white text-sm font-semibold transition-all mt-1 disabled:opacity-60"
            style={{
              background: "linear-gradient(135deg, #1E88E5 0%, #1565C0 100%)",
              boxShadow: "0 6px 20px rgba(30,136,229,0.4)",
            }}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Creando cuenta...
              </span>
            ) : (
              "Crear mi cuenta"
            )}
          </button>
        </form>
      </Form>
    </>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function LoginPage() {
  const [view, setView] = useState<"login" | "register">("login");
  const [prefilledEmail, setPrefilledEmail] = useState("");

  function handleGoLogin(email: string) {
    setPrefilledEmail(email);
    setView("login");
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
              {view === "login"
                ? "Descubre, reserva y conecta con negocios cerca de ti"
                : "Crea tu cuenta de cliente"}
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
          {view === "login"
            ? <LoginView onRegister={() => { setPrefilledEmail(""); setView("register"); }} initialEmail={prefilledEmail} />
            : <RegisterView onBack={() => setView("login")} onGoLogin={handleGoLogin} />
          }
        </div>

        <p className="text-center text-xs pb-2" style={{ color: "#90a4ae" }}>
          {view === "login"
            ? "Acceso para administradores, sucursales y clientes registrados"
            : "El registro es exclusivo para usuarios/clientes finales"}
        </p>
      </div>
    </div>
  );
}
