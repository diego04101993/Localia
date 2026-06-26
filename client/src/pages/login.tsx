import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, Link } from "wouter";
import { z } from "zod";
import {
  BadgePercent,
  Building2,
  Calendar,
  CalendarDays,
  Check,
  ChevronDown,
  CreditCard,
  Eye,
  EyeOff,
  Gift,
  Info,
  LayoutDashboard,
  Loader2,
  Lock,
  Mail,
  Phone,
  Smartphone,
  Store,
  User,
  Users,
  Wallet,
} from "lucide-react";
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
import dashboardBranchImage from "../assets/login-showcase/dashboard-branch.png";
import appExploreMobileImage from "../assets/login-showcase/app-explore-mobile.png";
import appBranchMobileImage from "../assets/login-showcase/app-branch-mobile.png";

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

const businessBadges = [
  "Android",
  "iPhone",
  "Dashboard Web",
  "SaaS para negocios locales",
];

const businessBenefits: Array<{
  title: string;
  description: string;
  icon: typeof CalendarDays;
}> = [
  {
    title: "Reservas y agenda en línea",
    description: "Organiza citas, clases y cupos disponibles desde un solo lugar.",
    icon: CalendarDays,
  },
  {
    title: "Clientes y CRM",
    description: "Da seguimiento a tus clientes, notas internas y actividad reciente.",
    icon: Users,
  },
  {
    title: "Membresías y promociones",
    description: "Administra beneficios, planes y ofertas para activar ventas recurrentes.",
    icon: Gift,
  },
  {
    title: "Finanzas básicas",
    description: "Consulta ingresos, gastos y movimientos clave sin depender de Excel.",
    icon: CreditCard,
  },
  {
    title: "App móvil para tus clientes",
    description: "Tus clientes pueden descubrir tu negocio, reservar y revisar sus beneficios.",
    icon: Smartphone,
  },
  {
    title: "Disponible en Android y App Store",
    description: "Tu operación vive en el dashboard web y la experiencia del cliente en la app.",
    icon: Store,
  },
];

function BusinessBadge({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
      style={{
        background: "rgba(255,255,255,0.72)",
        color: "#1565C0",
        border: "1px solid rgba(30,136,229,0.12)",
        boxShadow: "0 8px 24px rgba(30,136,229,0.08)",
      }}
    >
      {label}
    </span>
  );
}

function BusinessBenefitCard({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: typeof CalendarDays;
}) {
  return (
    <div
      className="rounded-3xl p-4"
      style={{
        background: "rgba(255,255,255,0.7)",
        border: "1px solid rgba(30,136,229,0.14)",
        boxShadow: "0 18px 40px rgba(30,136,229,0.08)",
      }}
    >
      <div
        className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl"
        style={{
          background: "linear-gradient(135deg, rgba(30,136,229,0.14) 0%, rgba(255,255,255,0.92) 100%)",
          color: "#1565C0",
        }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold leading-tight" style={{ color: "#0d47a1" }}>
        {title}
      </h3>
      <p className="mt-2 text-xs leading-5" style={{ color: "#546e7a" }}>
        {description}
      </p>
    </div>
  );
}

// ─── Login view ──────────────────────────────────────────────────────────────
const platformBadges = [
  "Dashboard Web",
  "Android",
  "iPhone",
  "Multi Sucursal",
];

const productHighlights: Array<{
  label: string;
  icon: typeof CalendarDays;
}> = [
  { label: "Reservas", icon: CalendarDays },
  { label: "Clientes", icon: Users },
  { label: "Membres\u00EDas", icon: CreditCard },
  { label: "Promociones", icon: BadgePercent },
  { label: "Finanzas", icon: Wallet },
  { label: "App m\u00F3vil", icon: Smartphone },
];

function PlatformBadge({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] sm:text-xs"
      style={{
        background: "rgba(255,255,255,0.84)",
        color: "#0d47a1",
        border: "1px solid rgba(30,136,229,0.12)",
        boxShadow: "0 12px 30px rgba(30,136,229,0.08)",
      }}
    >
      <Check className="h-3.5 w-3.5" style={{ color: "#1E88E5" }} />
      {label}
    </span>
  );
}

function ProductHighlightChip({
  label,
  icon: Icon,
}: {
  label: string;
  icon: typeof CalendarDays;
}) {
  return (
    <div
      className="inline-flex items-center gap-3 rounded-2xl px-4 py-3"
      style={{
        background: "rgba(255,255,255,0.74)",
        border: "1px solid rgba(30,136,229,0.14)",
        boxShadow: "0 18px 36px rgba(30,136,229,0.08)",
      }}
    >
      <span
        className="inline-flex h-9 w-9 items-center justify-center rounded-2xl"
        style={{
          background: "linear-gradient(135deg, rgba(30,136,229,0.14) 0%, rgba(255,255,255,0.96) 100%)",
          color: "#1565C0",
        }}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-sm font-semibold" style={{ color: "#0d47a1" }}>
        {label}
      </span>
    </div>
  );
}

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
                      {...field}
                      onFocus={onFocusStyle}
                      onBlur={(e) => {
                        field.onBlur();
                        onBlurStyle(e);
                      }}
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
                      {...field}
                      onFocus={onFocusStyle}
                      onBlur={(e) => {
                        field.onBlur();
                        onBlurStyle(e);
                      }}
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

      <div
        className="mt-4 rounded-2xl px-4 py-3 text-center"
        style={{ background: "rgba(227,242,253,0.55)", border: "1px solid rgba(30,136,229,0.12)" }}
      >
        <p className="mb-2 text-[11px] font-medium" style={{ color: "#78909c" }}>
          Información legal
        </p>
        <div className="flex flex-col gap-1.5 text-sm">
          <Link
            href="/terminos"
            className="font-medium transition-opacity hover:opacity-70"
            style={{ color: "#1E88E5" }}
            data-testid="link-login-terms"
          >
            Términos y Condiciones
          </Link>
          <Link
            href="/privacidad"
            className="font-medium transition-opacity hover:opacity-70"
            style={{ color: "#1E88E5" }}
            data-testid="link-login-privacy"
          >
            Aviso de Privacidad
          </Link>
          <Link
            href="/delete-account"
            className="font-medium transition-opacity hover:opacity-70"
            style={{ color: "#1E88E5" }}
            data-testid="link-login-delete-account"
          >
            Eliminar cuenta
          </Link>
        </div>
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
                      {...field}
                      onFocus={onFocusStyle}
                      onBlur={(e) => {
                        field.onBlur();
                        onBlurStyle(e);
                      }}
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
                      {...field}
                      onFocus={onFocusStyle}
                      onBlur={(e) => {
                        field.onBlur();
                        onBlurStyle(e);
                      }}
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
                      {...field}
                      onFocus={onFocusStyle}
                      onBlur={(e) => {
                        field.onBlur();
                        onBlurStyle(e);
                      }}
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
                      {...field}
                      onFocus={onFocusStyle}
                      onBlur={(e) => {
                        field.onBlur();
                        onBlurStyle(e);
                      }}
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
                      {...field}
                      onFocus={onFocusStyle}
                      onBlur={(e) => {
                        field.onBlur();
                        onBlurStyle(e);
                      }}
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
                      {...field}
                      onFocus={onFocusStyle}
                      onBlur={(e) => {
                        field.onBlur();
                        onBlurStyle(e);
                      }}
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
                      {...field}
                      onFocus={onFocusStyle}
                      onBlur={(e) => {
                        field.onBlur();
                        onBlurStyle(e);
                      }}
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
                      {...field}
                      onFocus={onFocusStyle}
                      onBlur={(e) => {
                        field.onBlur();
                        onBlurStyle(e);
                      }}
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
  const [sceneDrift, setSceneDrift] = useState({
    rotateX: 0,
    rotateY: 0,
    shiftX: 0,
    shiftY: 0,
  });

  function handleGoLogin(email: string) {
    setPrefilledEmail(email);
    setView("login");
  }

  function handleScenePointerMove(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;

    setSceneDrift({
      rotateX: py * -12,
      rotateY: px * 14,
      shiftX: px * 18,
      shiftY: py * 14,
    });
  }

  function resetScenePointer() {
    setSceneDrift({
      rotateX: 0,
      rotateY: 0,
      shiftX: 0,
      shiftY: 0,
    });
  }

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[#f7fbff]"
      style={{
        background:
          "radial-gradient(circle at top left, rgba(33,150,243,0.18) 0%, transparent 32%), radial-gradient(circle at 85% 12%, rgba(144,202,249,0.28) 0%, transparent 24%), linear-gradient(180deg, #f8fbff 0%, #eef6ff 58%, #f8fbff 100%)",
      }}
    >
      <style>{`
        @keyframes webcoolLaptopFloat {
          0%, 100% { transform: translate3d(0, 0, 0); }
          50% { transform: translate3d(0, -14px, 0); }
        }

        @keyframes webcoolPhoneLeftFloat {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(-3deg); }
          50% { transform: translate3d(0, -18px, 0) rotate(1deg); }
        }

        @keyframes webcoolPhoneRightFloat {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(3deg); }
          50% { transform: translate3d(0, -16px, 0) rotate(-1deg); }
        }

        @keyframes webcoolGlowPulse {
          0%, 100% { opacity: 0.58; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.06); }
        }

        .webcool-hero-scene {
          perspective: 2400px;
          transform-style: preserve-3d;
        }

        .webcool-hero-layer {
          transform-style: preserve-3d;
          transition: transform 220ms ease-out;
          will-change: transform;
        }

        .webcool-hero-laptop-float {
          animation: webcoolLaptopFloat 7s ease-in-out infinite;
        }

        .webcool-hero-phone-left-float {
          animation: webcoolPhoneLeftFloat 6.8s ease-in-out infinite;
        }

        .webcool-hero-phone-right-float {
          animation: webcoolPhoneRightFloat 7.2s ease-in-out infinite;
        }

        .webcool-hero-glow {
          animation: webcoolGlowPulse 6.5s ease-in-out infinite;
        }
      `}</style>
      <div
        className="absolute pointer-events-none rounded-full opacity-70 blur-3xl"
        style={{
          width: 288,
          height: 288,
          background: "rgba(30,136,229,0.14)",
          top: "8%",
          left: "-8%",
        }}
      />
      <div
        className="absolute pointer-events-none rounded-full opacity-70 blur-3xl"
        style={{
          width: 320,
          height: 320,
          background: "rgba(66,165,245,0.12)",
          bottom: "10%",
          right: "-6%",
        }}
      />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-10 px-4 py-6 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1.55fr)_minmax(360px,420px)] lg:items-center lg:gap-14 lg:px-10 xl:px-14">
        <section className="order-1 flex flex-col gap-8 lg:pr-6 xl:pr-10">
          <div className="max-w-[820px]">
            <div
              className="w-fit"
              style={{ filter: "drop-shadow(0 16px 40px rgba(30,136,229,0.22))" }}
            >
              <img
                src={webcool_logo}
                alt="WebCool"
                className="rounded-full object-contain"
                style={{ width: 64, height: 64 }}
                data-testid="text-login-title"
              />
            </div>
            <div className="mt-6 text-left">
              <div
                className="mb-3 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] sm:text-xs"
                style={{
                  background: "rgba(255,255,255,0.86)",
                  color: "#1565C0",
                  border: "1px solid rgba(30,136,229,0.14)",
                  boxShadow: "0 10px 30px rgba(30,136,229,0.08)",
                }}
              >
                Todo tu negocio en WebCool
              </div>
              <h1
                className="max-w-[760px] text-4xl font-semibold tracking-[-0.04em] sm:text-5xl lg:text-6xl xl:text-[72px]"
                style={{ color: "#0b1f44", lineHeight: 0.95 }}
              >
                Administra tu negocio desde un solo lugar.
              </h1>
              <p
                className="mt-5 max-w-[720px] text-base leading-7 sm:text-lg"
                style={{ color: "#4f6b85" }}
              >
                {"Controla reservas, clientes, membres\u00EDas, promociones y finanzas desde un dashboard web. Tus clientes reservan desde la app disponible para Android y iPhone."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {platformBadges.map((badge) => (
              <PlatformBadge key={badge} label={badge} />
            ))}
          </div>

          <div
            className="webcool-hero-scene relative h-[360px] sm:h-[460px] lg:h-[580px] xl:h-[640px]"
            onMouseMove={handleScenePointerMove}
            onMouseLeave={resetScenePointer}
          >
            <div
              className="webcool-hero-glow absolute left-[10%] top-[8%] h-40 w-40 rounded-full blur-3xl sm:h-56 sm:w-56"
              style={{ background: "rgba(59,130,246,0.18)" }}
            />
            <div
              className="webcool-hero-glow absolute bottom-[14%] right-[10%] h-48 w-48 rounded-full blur-3xl sm:h-64 sm:w-64"
              style={{ background: "rgba(96,165,250,0.18)" }}
            />
            <div
              className="pointer-events-none absolute inset-x-[9%] bottom-[8%] h-16 rounded-full blur-3xl sm:bottom-[10%] sm:h-24"
              style={{ background: "rgba(8,20,39,0.12)" }}
            />

            <div
              className="webcool-hero-layer absolute left-[13%] right-[13%] top-[18%] hidden sm:block"
              style={{
                transform: `translate3d(${sceneDrift.shiftX * 0.35}px, ${sceneDrift.shiftY * 0.25}px, 0) rotateX(${9 + sceneDrift.rotateX * 0.18}deg) rotateY(${sceneDrift.rotateY * 0.42}deg)`,
              }}
            >
              <div className="webcool-hero-laptop-float relative mx-auto max-w-[780px]">
                <div
                  className="rounded-[30px] border border-white/10 bg-[#09121f] p-3 shadow-[0_42px_100px_rgba(8,20,39,0.26)]"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(16,30,54,0.98) 0%, rgba(7,17,29,0.98) 100%)",
                  }}
                >
                  <div className="mb-3 flex items-center gap-2 px-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-white/30" />
                    <span className="h-2.5 w-2.5 rounded-full bg-white/16" />
                    <span className="h-2.5 w-2.5 rounded-full bg-white/8" />
                    <div className="ml-auto h-2 w-24 rounded-full bg-white/10" />
                  </div>
                  <div className="overflow-hidden rounded-[22px] border border-white/10 bg-[#07111d] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                    <img
                      src={dashboardBranchImage}
                      alt="Dashboard de sucursal WebCool"
                      className="aspect-[16/10] w-full object-cover"
                    />
                  </div>
                </div>
                <div className="mx-auto h-4 w-[74%] rounded-b-[22px] bg-gradient-to-b from-[#dfe9f5] via-[#b9c8d9] to-[#8ba3bb] shadow-[0_12px_30px_rgba(15,23,42,0.18)]" />
                <div className="mx-auto h-3 w-[22%] rounded-b-full bg-[#7f95aa]/70 blur-[1px]" />
              </div>
            </div>

            <div
              className="webcool-hero-layer absolute left-[1%] top-[21%] z-20 hidden w-[24%] min-w-[170px] sm:block lg:left-[1%] xl:left-[2%]"
              style={{
                transform: `translate3d(${sceneDrift.shiftX * 1.1}px, ${sceneDrift.shiftY * 0.8}px, 120px) rotateY(${16 + sceneDrift.rotateY * 0.72}deg) rotateX(${-8 + sceneDrift.rotateX * 0.28}deg)`,
              }}
            >
              <div className="webcool-hero-phone-left-float relative">
                <div
                  className="absolute inset-[9%] rounded-[42px] blur-2xl"
                  style={{ background: "rgba(37,99,235,0.28)" }}
                />
                <div className="relative rounded-[42px] border border-white/55 bg-white/54 p-3 shadow-[0_34px_72px_rgba(15,23,42,0.2)] backdrop-blur-2xl">
                  <div className="absolute left-1/2 top-5 h-1.5 w-16 -translate-x-1/2 rounded-full bg-slate-900/70" />
                  <div className="absolute left-5 top-5 h-2.5 w-2.5 rounded-full bg-slate-900/70" />
                  <div className="overflow-hidden rounded-[32px] border border-white/60 bg-white">
                    <img
                      src={appExploreMobileImage}
                      alt="App móvil WebCool explorando negocios"
                      className="aspect-[9/19] w-full object-cover object-center"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div
              className="webcool-hero-layer absolute right-[1%] top-[12%] z-20 hidden w-[25%] min-w-[180px] sm:block xl:right-[2%]"
              style={{
                transform: `translate3d(${sceneDrift.shiftX * -1.12}px, ${sceneDrift.shiftY * 0.95}px, 150px) rotateY(${-18 + sceneDrift.rotateY * 0.68}deg) rotateX(${8 + sceneDrift.rotateX * 0.24}deg)`,
              }}
            >
              <div className="webcool-hero-phone-right-float relative">
                <div
                  className="absolute inset-[10%] rounded-[44px] blur-2xl"
                  style={{ background: "rgba(59,130,246,0.26)" }}
                />
                <div className="relative rounded-[42px] border border-white/45 bg-white/52 p-3 shadow-[0_34px_72px_rgba(15,23,42,0.22)] backdrop-blur-2xl">
                  <div className="absolute left-1/2 top-5 h-1.5 w-14 -translate-x-1/2 rounded-full bg-slate-900/70" />
                  <div className="overflow-hidden rounded-[32px] border border-white/60 bg-white">
                    <img
                      src={appBranchMobileImage}
                      alt="App móvil WebCool mostrando promociones y membresías"
                      className="aspect-[9/19] w-full object-cover object-center"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="relative mx-auto flex h-full max-w-[620px] items-center sm:hidden">
              <div className="w-full">
                <div className="rounded-[30px] border border-white/65 bg-white/72 p-3 shadow-[0_28px_70px_rgba(15,23,42,0.14)] backdrop-blur-xl">
                  <div className="mb-3 flex items-center gap-2 px-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#bfdbfe]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#93c5fd]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#60a5fa]" />
                  </div>
                  <div className="overflow-hidden rounded-[18px] border border-white/60 bg-[#07111d]">
                    <img
                      src={dashboardBranchImage}
                      alt="Dashboard de sucursal WebCool"
                      className="aspect-[16/10] w-full object-cover"
                    />
                  </div>
                </div>

                <div className="-mt-10 grid grid-cols-2 gap-3 px-3">
                  <div className="rounded-[30px] border border-white/70 bg-white/70 p-2 shadow-[0_20px_50px_rgba(15,23,42,0.12)] backdrop-blur-xl">
                    <img
                      src={appExploreMobileImage}
                      alt="App móvil WebCool explorando"
                      className="aspect-[9/19] w-full rounded-[24px] object-cover object-center"
                    />
                  </div>
                  <div className="rounded-[30px] border border-white/70 bg-white/70 p-2 shadow-[0_20px_50px_rgba(15,23,42,0.12)] backdrop-blur-xl">
                    <img
                      src={appBranchMobileImage}
                      alt="App móvil WebCool mostrando promociones"
                      className="aspect-[9/19] w-full rounded-[24px] object-cover object-center"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="hidden">
            <div
              className="webcool-hero-scene relative h-[360px] sm:h-[440px] lg:h-[560px] xl:h-[620px]"
              onMouseMove={handleScenePointerMove}
              onMouseLeave={resetScenePointer}
            >
            <div className="mb-3 flex items-center gap-2 px-2 sm:px-3">
              <span className="h-2.5 w-2.5 rounded-full bg-[#bfdbfe]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#93c5fd]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#60a5fa]" />
              <div
                className="ml-auto inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] sm:text-[11px]"
                style={{
                  background: "rgba(255,255,255,0.92)",
                  color: "#0d47a1",
                  border: "1px solid rgba(30,136,229,0.12)",
                }}
              >
                Producto real WebCool
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[28px] bg-[#081427] p-2 sm:p-3">
              <div
                className="absolute inset-x-0 top-0 h-20 opacity-80"
                style={{ background: "linear-gradient(180deg, rgba(59,130,246,0.14) 0%, transparent 100%)" }}
              />
              <img
                src={dashboardBranchImage}
                alt="Dashboard de sucursal WebCool"
                className="relative z-10 w-full rounded-[22px] border border-white/10 object-cover"
              />
            </div>

            <div className="pointer-events-none absolute -left-2 top-10 hidden w-[22%] min-w-[150px] max-w-[210px] sm:block lg:-left-8">
              <img
                src={appExploreMobileImage}
                alt="App móvil WebCool explorando negocios"
                className="w-full drop-shadow-[0_36px_60px_rgba(15,23,42,0.26)]"
              />
            </div>

            <div className="pointer-events-none absolute -bottom-8 right-0 hidden w-[23%] min-w-[160px] max-w-[220px] sm:block lg:-right-8">
              <img
                src={appBranchMobileImage}
                alt="App móvil WebCool mostrando perfil de negocio"
                className="w-full drop-shadow-[0_36px_60px_rgba(15,23,42,0.28)]"
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:hidden">
              <div
                className="rounded-[28px] border p-2 shadow-[0_20px_45px_rgba(15,23,42,0.12)]"
                style={{ background: "rgba(255,255,255,0.76)", borderColor: "rgba(30,136,229,0.12)" }}
              >
                <img
                  src={appExploreMobileImage}
                  alt="App móvil WebCool explorando"
                  className="w-full"
                />
              </div>
              <div
                className="rounded-[28px] border p-2 shadow-[0_20px_45px_rgba(15,23,42,0.12)]"
                style={{ background: "rgba(255,255,255,0.76)", borderColor: "rgba(30,136,229,0.12)" }}
              >
                <img
                  src={appBranchMobileImage}
                  alt="App móvil WebCool promociones y membresías"
                  className="w-full"
                />
              </div>
            </div>
          </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {productHighlights.map((item) => (
              <ProductHighlightChip
                key={item.label}
                label={item.label}
                icon={item.icon}
              />
            ))}
          </div>
        </section>

        <section className="order-2 lg:justify-self-end lg:w-full">
          <div className="mx-auto w-full max-w-md">
            <div
              className="mb-4 rounded-[28px] border px-5 py-4"
              style={{
                background: "rgba(255,255,255,0.8)",
                borderColor: "rgba(30,136,229,0.12)",
                boxShadow: "0 20px 44px rgba(15,23,42,0.08)",
              }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: "#64b5f6" }}>
                {view === "login" ? "Accede a tu plataforma" : "Crea tu cuenta"}
              </p>
              <p className="mt-2 text-sm leading-6" style={{ color: "#546e7a" }}>
                {view === "login"
                  ? "Administra tu sucursal o inicia sesi\u00F3n como cliente."
                  : "Reg\u00EDstrate para usar WebCool y reservar desde la app o la web."}
              </p>
            </div>

            <div
              className="w-full rounded-[34px] p-7 sm:p-8"
              style={{
                background: "rgba(255,255,255,0.92)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: "1px solid rgba(30,136,229,0.14)",
                boxShadow: "0 32px 80px rgba(30,136,229,0.14), 0 10px 30px rgba(15,23,42,0.06)",
              }}
            >
              {view === "login"
                ? <LoginView onRegister={() => { setPrefilledEmail(""); setView("register"); }} initialEmail={prefilledEmail} />
                : <RegisterView onBack={() => setView("login")} onGoLogin={handleGoLogin} />
              }
            </div>

            <p className="px-2 pt-4 text-center text-xs" style={{ color: "#90a4ae" }}>
              {view === "login"
                ? "Acceso para administradores, sucursales y clientes registrados"
                : "El registro es exclusivo para usuarios y clientes finales"}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
