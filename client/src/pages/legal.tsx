import { useLocation, Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import webcool_logo from "@assets/webcool_logo.png";

const TERMS_VERSION = "1.0";
const EFFECTIVE_DATE = "2 de abril de 2025";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-bold" style={{ color: "#0d47a1" }}>{title}</h2>
      <div className="text-sm leading-relaxed space-y-1.5" style={{ color: "#455a64" }}>
        {children}
      </div>
    </div>
  );
}

function TermsContent() {
  return (
    <div className="space-y-5">
      <p className="text-xs" style={{ color: "#90a4ae" }}>
        Versión {TERMS_VERSION} — Vigentes a partir del {EFFECTIVE_DATE}
      </p>

      <Section title="1. Aceptación">
        <p>
          Al crear una cuenta en WebCool, confirmas que has leído, entendido y aceptas estos Términos y
          Condiciones en su totalidad. Si no estás de acuerdo, no podrás utilizar la plataforma.
        </p>
      </Section>

      <Section title="2. Qué es WebCool">
        <p>
          WebCool es una plataforma digital que conecta usuarios con negocios de salud y bienestar
          (gimnasios, estudios de fitness, crossfit, yoga, y similares), permitiendo la gestión de
          membresías, reservas de clases y comunicación entre usuarios y establecimientos.
        </p>
      </Section>

      <Section title="3. Tu cuenta">
        <ul className="list-disc pl-4 space-y-1">
          <li>Eres responsable de mantener la confidencialidad de tu contraseña.</li>
          <li>Debes proporcionar información veraz y actualizada al registrarte.</li>
          <li>Solo personas mayores de 13 años pueden crear una cuenta.</li>
          <li>No puedes ceder ni compartir tu cuenta con terceros.</li>
        </ul>
      </Section>

      <Section title="4. Uso permitido">
        <p>Puedes usar WebCool para:</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>Buscar y descubrir negocios de bienestar registrados en la plataforma.</li>
          <li>Reservar clases y gestionar tu membresía.</li>
          <li>Ver tu historial de asistencia y actividad.</li>
          <li>Comunicarte con los establecimientos de los que seas miembro.</li>
        </ul>
      </Section>

      <Section title="5. Uso no permitido">
        <ul className="list-disc pl-4 space-y-1">
          <li>Utilizar la plataforma para actividades ilícitas o fraudulentas.</li>
          <li>Suplantar la identidad de otra persona.</li>
          <li>Interferir con el funcionamiento técnico del servicio.</li>
          <li>Recopilar datos de otros usuarios sin su consentimiento.</li>
        </ul>
      </Section>

      <Section title="6. Visibilidad de tu información">
        <p>
          Los establecimientos (sucursales) de los que seas miembro activo podrán ver tu nombre, datos de
          contacto, historial de asistencia, membresía y otra información relevante para la gestión de
          tu relación con ellos. Esta visibilidad es necesaria para la operación del servicio y limitada
          a los establecimientos con los que tengas una relación activa.
        </p>
      </Section>

      <Section title="7. Propiedad intelectual">
        <p>
          El nombre WebCool, su diseño, logotipo y contenido de la plataforma son propiedad de sus
          titulares. No puedes reproducirlos sin autorización escrita.
        </p>
      </Section>

      <Section title="8. Limitación de responsabilidad">
        <p>
          WebCool actúa como intermediario tecnológico entre usuarios y establecimientos. No somos
          responsables por los servicios que ofrezcan dichos establecimientos, ni por daños derivados
          del uso de la plataforma, salvo lo expresamente establecido por la ley mexicana aplicable.
        </p>
      </Section>

      <Section title="9. Modificaciones">
        <p>
          WebCool puede actualizar estos Términos. Te notificaremos dentro de la plataforma y podrías
          requerir una nueva aceptación para continuar usando el servicio.
        </p>
      </Section>

      <Section title="10. Ley aplicable">
        <p>
          Estos Términos se rigen por la legislación vigente de los Estados Unidos Mexicanos. Cualquier
          controversia se someterá a los tribunales competentes de la Ciudad de México.
        </p>
      </Section>

      <Section title="11. Contacto">
        <p>
          Para dudas o aclaraciones: <strong>soporte@webcool.mx</strong>
        </p>
      </Section>
    </div>
  );
}

function PrivacyContent() {
  return (
    <div className="space-y-5">
      <p className="text-xs" style={{ color: "#90a4ae" }}>
        Versión {TERMS_VERSION} — Vigente a partir del {EFFECTIVE_DATE}
        {" "}— Responsable: WebCool
      </p>

      <Section title="1. Datos que recopilamos">
        <ul className="list-disc pl-4 space-y-1">
          <li>Nombre y apellidos</li>
          <li>Correo electrónico</li>
          <li>Número de celular</li>
          <li>Fecha de nacimiento y sexo (opcionales)</li>
          <li>Actividad dentro de la plataforma: reservas, asistencias, membresías, notas de perfil</li>
        </ul>
      </Section>

      <Section title="2. Para qué usamos tus datos">
        <ul className="list-disc pl-4 space-y-1">
          <li>Crear y gestionar tu cuenta de usuario.</li>
          <li>Conectarte con los establecimientos de los que seas miembro.</li>
          <li>Gestionar tus membresías, reservas de clases y asistencias.</li>
          <li>Enviarte comunicaciones relacionadas directamente con el servicio.</li>
          <li>Mejorar la experiencia y funcionalidades de la plataforma.</li>
          <li>
            A futuro: incorporar funciones de fidelización, promociones, recordatorios y comunicación
            dentro del ecosistema WebCool, siempre relacionadas con el servicio.
          </li>
        </ul>
      </Section>

      <Section title="3. Quién puede ver tus datos">
        <p>
          Los establecimientos (sucursales) de los que seas miembro activo pueden acceder a tu
          información de perfil y actividad, exclusivamente para la gestión de tu relación con ellos.
          Esta visibilidad es necesaria para el funcionamiento del servicio.
        </p>
      </Section>

      <Section title="4. Lo que no hacemos">
        <p>
          <strong>No vendemos, arrendamos ni compartimos</strong> tus datos personales con terceros
          para fines publicitarios o comerciales ajenos al servicio de WebCool.
        </p>
      </Section>

      <Section title="5. Tus derechos ARCO">
        <p>
          Conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares
          (LFPDPPP), tienes derecho a solicitar Acceso, Rectificación, Cancelación u Oposición
          respecto a tus datos personales. Para ejercerlos, escríbenos a:{" "}
          <strong>soporte@webcool.mx</strong>
        </p>
      </Section>

      <Section title="6. Seguridad">
        <p>
          Implementamos medidas técnicas y organizativas razonables para proteger tus datos contra
          acceso no autorizado, pérdida o divulgación indebida.
        </p>
      </Section>

      <Section title="7. Retención de datos">
        <p>
          Conservamos tus datos mientras mantengas una cuenta activa o sea necesario para prestar el
          servicio, salvo que solicites su cancelación antes.
        </p>
      </Section>

      <Section title="8. Cambios a este aviso">
        <p>
          Podemos actualizar este Aviso de Privacidad. Los cambios serán comunicados a través de la
          plataforma y, cuando sea necesario, requeriremos tu nueva aceptación.
        </p>
      </Section>

      <Section title="9. Contacto">
        <p>
          Responsable del tratamiento: WebCool
          <br />
          Correo de contacto: <strong>soporte@webcool.mx</strong>
        </p>
      </Section>
    </div>
  );
}

export default function LegalPage() {
  const [location] = useLocation();
  const isPrivacy = location === "/privacidad";

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(160deg, #e3f2fd 0%, #bbdefb 40%, #e8f5e9 100%)" }}
    >
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/">
            <button
              className="flex items-center gap-1.5 text-sm font-medium rounded-xl px-3 py-2 transition-colors"
              style={{ color: "#1565C0", background: "rgba(255,255,255,0.7)" }}
              data-testid="button-legal-back"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </button>
          </Link>
          <img
            src={webcool_logo}
            alt="WebCool"
            className="object-contain rounded-full ml-auto"
            style={{ width: 36, height: 36 }}
          />
        </div>

        {/* Tab switcher */}
        <div
          className="flex rounded-2xl p-1 mb-6"
          style={{ background: "rgba(255,255,255,0.7)" }}
        >
          <Link href="/terminos">
            <button
              className="flex-1 py-2.5 text-sm font-medium rounded-xl transition-all"
              style={{
                background: !isPrivacy ? "linear-gradient(135deg, #1E88E5, #1565C0)" : "transparent",
                color: !isPrivacy ? "#fff" : "#546e7a",
              }}
              data-testid="tab-terminos"
            >
              Términos de uso
            </button>
          </Link>
          <Link href="/privacidad">
            <button
              className="flex-1 py-2.5 text-sm font-medium rounded-xl transition-all"
              style={{
                background: isPrivacy ? "linear-gradient(135deg, #1E88E5, #1565C0)" : "transparent",
                color: isPrivacy ? "#fff" : "#546e7a",
              }}
              data-testid="tab-privacidad"
            >
              Aviso de privacidad
            </button>
          </Link>
        </div>

        {/* Content */}
        <div
          className="rounded-3xl p-6"
          style={{
            background: "rgba(255,255,255,0.88)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(30,136,229,0.15)",
            boxShadow: "0 20px 60px rgba(30,136,229,0.12)",
          }}
        >
          <h1 className="text-lg font-bold mb-5" style={{ color: "#0d47a1" }}>
            {isPrivacy ? "Aviso de Privacidad" : "Términos y Condiciones de Uso"}
          </h1>
          {isPrivacy ? <PrivacyContent /> : <TermsContent />}
        </div>
      </div>
    </div>
  );
}
