import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import webcool_logo from "@assets/webcool_logo.png";

const LEGAL_VERSION = "1.1";
const EFFECTIVE_DATE = "5 de mayo de 2026";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-bold" style={{ color: "#0d47a1" }}>
        {title}
      </h2>
      <div className="space-y-2 text-sm leading-relaxed" style={{ color: "#455a64" }}>
        {children}
      </div>
    </div>
  );
}

function TermsContent() {
  return (
    <div className="space-y-5">
      <p className="text-xs" style={{ color: "#90a4ae" }}>
        Versión {LEGAL_VERSION} · Vigentes a partir del {EFFECTIVE_DATE}
      </p>

      <Section title="1. Aceptación">
        <p>
          Al crear una cuenta o usar Webcool aceptas estos Términos y Condiciones. Si no estás de
          acuerdo con ellos, no debes usar la plataforma.
        </p>
      </Section>

      <Section title="2. Qué es Webcool">
        <p>
          Webcool es una plataforma digital para descubrir negocios cercanos, revisar perfiles
          públicos, promociones y servicios, reservar citas o clases, administrar membresías,
          guardar favoritos y recibir notificaciones relacionadas con la experiencia dentro de la
          app.
        </p>
      </Section>

      <Section title="3. Cuenta de usuario">
        <ul className="list-disc pl-4 space-y-1">
          <li>Debes proporcionar datos veraces, completos y actualizados.</li>
          <li>Eres responsable de proteger tu contraseña y el acceso a tu cuenta.</li>
          <li>No debes compartir tu cuenta ni suplantar la identidad de otra persona.</li>
          <li>Webcool puede suspender cuentas que incumplan estos términos o la ley aplicable.</li>
        </ul>
      </Section>

      <Section title="4. Uso permitido">
        <ul className="list-disc pl-4 space-y-1">
          <li>Buscar negocios y sucursales cercanas.</li>
          <li>Ver información pública, promociones, servicios y disponibilidad.</li>
          <li>Reservar citas o clases y administrar tus membresías.</li>
          <li>Guardar favoritos, publicar reseñas y recibir notificaciones del servicio.</li>
        </ul>
      </Section>

      <Section title="5. Uso no permitido">
        <ul className="list-disc pl-4 space-y-1">
          <li>Usar Webcool para actividades ilegales, fraudulentas o engañosas.</li>
          <li>Interferir con la seguridad, disponibilidad o funcionamiento de la plataforma.</li>
          <li>Publicar contenido ofensivo, falso, difamatorio o que viole derechos de terceros.</li>
          <li>Extraer o recopilar información de otros usuarios sin autorización.</li>
        </ul>
      </Section>

      <Section title="6. Reservas, membresías y reseñas">
        <p>
          Cada sucursal administra sus propias promociones, reservas, membresías, servicios y
          condiciones comerciales. Webcool facilita la operación tecnológica, pero no sustituye las
          políticas internas ni la responsabilidad directa de cada negocio sobre su atención.
        </p>
      </Section>

      <Section title="7. WhatsApp y enlaces externos">
        <p>
          Algunas sucursales pueden ofrecer comunicación vía WhatsApp u otros enlaces externos.
          Cuando sales de Webcool para usar esos canales, la interacción se rige también por las
          políticas del servicio externo correspondiente.
        </p>
      </Section>

      <Section title="8. Propiedad intelectual">
        <p>
          El nombre Webcool, su imagen, diseño, logotipos, software y contenido están protegidos por
          derechos aplicables. No pueden reproducirse o explotarse sin autorización previa por
          escrito.
        </p>
      </Section>

      <Section title="9. Limitación de responsabilidad">
        <p>
          Webcool actúa como intermediario tecnológico. No garantiza la calidad, disponibilidad o
          resultados de los servicios prestados por las sucursales publicadas en la plataforma,
          salvo lo que expresamente exija la ley aplicable.
        </p>
      </Section>

      <Section title="10. Cambios y contacto">
        <p>
          Webcool puede actualizar estos términos para reflejar cambios operativos, legales o del
          servicio. Si tienes dudas, escríbenos a <strong>soporte@webcool.mx</strong>.
        </p>
      </Section>
    </div>
  );
}

function PrivacyContent() {
  return (
    <div className="space-y-5">
      <p className="text-xs" style={{ color: "#90a4ae" }}>
        Versión {LEGAL_VERSION} · Vigente a partir del {EFFECTIVE_DATE} · Responsable: Webcool
      </p>

      <Section title="1. Datos que podemos recopilar">
        <ul className="list-disc pl-4 space-y-1">
          <li>Datos de cuenta como nombre, correo electrónico y teléfono.</li>
          <li>Ubicación aproximada o coordenadas para mostrar negocios cercanos.</li>
          <li>Información sobre reservas, citas, clases y membresías.</li>
          <li>Favoritos, reseñas, calificaciones y actividad dentro de la plataforma.</li>
          <li>Tokens de notificaciones push, incluyendo token de Firebase cuando aplique.</li>
          <li>Información técnica básica del dispositivo y uso del servicio.</li>
        </ul>
      </Section>

      <Section title="2. Para qué usamos tus datos">
        <ul className="list-disc pl-4 space-y-1">
          <li>Crear y administrar tu cuenta de Webcool.</li>
          <li>Mostrarte negocios, promociones y sucursales relevantes cerca de ti.</li>
          <li>Gestionar reservas, citas, membresías, favoritos y reseñas.</li>
          <li>Enviarte avisos operativos y notificaciones relacionadas con tu actividad.</li>
          <li>Mejorar la seguridad, calidad y funcionamiento general del servicio.</li>
        </ul>
      </Section>

      <Section title="3. Compartición limitada dentro del servicio">
        <p>
          Las sucursales con las que interactúas pueden ver la información necesaria para operar tu
          relación con ellas, como tu nombre, contacto, reservas, membresías o reseñas asociadas a
          esa sucursal.
        </p>
      </Section>

      <Section title="4. WhatsApp y enlaces externos">
        <p>
          Algunas comunicaciones pueden realizarse mediante un enlace externo a WhatsApp u otros
          servicios. Cuando uses esos enlaces, tu interacción también estará sujeta a los términos y
          políticas del proveedor externo correspondiente.
        </p>
      </Section>

      <Section title="5. Compromiso de privacidad">
        <p>
          <strong>Webcool no vende datos personales.</strong> Tampoco compartimos tu información con
          terceros para fines comerciales ajenos a la operación normal del servicio.
        </p>
      </Section>

      <Section title="6. Conservación y derechos">
        <p>
          Conservamos los datos mientras exista una cuenta activa o sea necesario para prestar el
          servicio, cumplir obligaciones legales o atender solicitudes válidas. Puedes solicitar
          acceso, corrección o eliminación escribiendo a <strong>soporte@webcool.mx</strong>.
        </p>
      </Section>

      <Section title="7. Seguridad y contacto">
        <p>
          Aplicamos medidas técnicas y organizativas razonables para proteger la información
          personal. Para dudas sobre privacidad o tratamiento de datos, contáctanos en{" "}
          <strong>soporte@webcool.mx</strong>.
        </p>
      </Section>
    </div>
  );
}

function DeleteAccountContent() {
  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed" style={{ color: "#455a64" }}>
        Para solicitar la eliminación de tu cuenta, escribe a{" "}
        <strong>soporte@webcool.mx</strong> desde el correo registrado en Webcool.
      </p>

      <Section title="Datos que se eliminan">
        <ul className="list-disc pl-4 space-y-1">
          <li>Perfil</li>
          <li>Datos personales</li>
          <li>Favoritos</li>
          <li>Membresías</li>
          <li>Reservas</li>
          <li>Reseñas</li>
          <li>Tokens de notificaciones</li>
          <li>Datos asociados a la cuenta</li>
        </ul>
      </Section>

      <Section title="Tiempo de procesamiento">
        <p>La solicitud será procesada en un máximo de 90 días.</p>
      </Section>

      <Section title="Conservación temporal si aplica">
        <p>
          Algunos datos administrativos o legales podrían conservarse temporalmente si aplica, por
          ejemplo para cumplir obligaciones normativas, de seguridad o de soporte.
        </p>
      </Section>

      <Section title="Contacto">
        <p>
          Correo de atención: <strong>soporte@webcool.mx</strong>
        </p>
      </Section>
    </div>
  );
}

const legalTabs = [
  { href: "/terminos", label: "Términos", testId: "tab-terminos" },
  { href: "/privacidad", label: "Privacidad", testId: "tab-privacidad" },
  { href: "/delete-account", label: "Eliminar cuenta", testId: "tab-delete-account" },
];

export default function LegalPage() {
  const [location] = useLocation();
  const activePage =
    location === "/privacidad"
      ? "privacy"
      : location === "/delete-account"
        ? "delete"
        : "terms";

  const title =
    activePage === "privacy"
      ? "Aviso de Privacidad"
      : activePage === "delete"
        ? "Eliminación de cuenta - Webcool"
        : "Términos y Condiciones";

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(160deg, #e3f2fd 0%, #bbdefb 40%, #e8f5e9 100%)" }}
    >
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Link href="/">
            <button
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors"
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
            className="ml-auto rounded-full object-contain"
            style={{ width: 36, height: 36 }}
          />
        </div>

        <div
          className="mb-6 grid grid-cols-1 gap-2 rounded-2xl p-2 sm:grid-cols-3"
          style={{ background: "rgba(255,255,255,0.7)" }}
        >
          {legalTabs.map((tab) => {
            const isActive = location === tab.href;
            return (
              <Link key={tab.href} href={tab.href}>
                <button
                  className="w-full rounded-xl px-3 py-2.5 text-sm font-medium transition-all"
                  style={{
                    background: isActive
                      ? "linear-gradient(135deg, #1E88E5, #1565C0)"
                      : "transparent",
                    color: isActive ? "#fff" : "#546e7a",
                  }}
                  data-testid={tab.testId}
                >
                  {tab.label}
                </button>
              </Link>
            );
          })}
        </div>

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
          <h1 className="mb-5 text-lg font-bold" style={{ color: "#0d47a1" }}>
            {title}
          </h1>
          {activePage === "privacy" ? (
            <PrivacyContent />
          ) : activePage === "delete" ? (
            <DeleteAccountContent />
          ) : (
            <TermsContent />
          )}
        </div>
      </div>
    </div>
  );
}
