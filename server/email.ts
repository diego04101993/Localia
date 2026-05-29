import nodemailer from "nodemailer";
import { Resend } from "resend";

type TransactionalEmailProvider = "smtp" | "resend" | "none";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const SMTP_HOST = process.env.SMTP_HOST?.trim() || "";
const SMTP_PORT = Number.parseInt(process.env.SMTP_PORT || "", 10);
const SMTP_USER = process.env.SMTP_USER?.trim() || "";
const SMTP_PASS = process.env.SMTP_PASS?.trim() || "";
const SMTP_FROM = process.env.SMTP_FROM?.trim() || "";
const EMAIL_FROM = process.env.EMAIL_FROM?.trim() || "";
const DEFAULT_FROM = "WebCool <noreply@webcool.mx>";
const APP_URL = process.env.APP_URL?.trim() || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "");
const SMTP_SECURE = process.env.SMTP_SECURE === "true" || SMTP_PORT === 465;

let smtpTransporter: nodemailer.Transporter | null = null;

export class EmailConfigurationError extends Error {
  missingEnv: string[];

  constructor(message: string, missingEnv: string[]) {
    super(message);
    this.name = "EmailConfigurationError";
    this.missingEnv = missingEnv;
  }
}

export class EmailDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

export interface TransactionalEmailStatus {
  provider: TransactionalEmailProvider;
  configured: boolean;
  missingEnv: string[];
  from: string;
  appUrl: string;
}

function getConfiguredProvider(): TransactionalEmailProvider {
  if (SMTP_HOST && Number.isFinite(SMTP_PORT) && SMTP_PORT > 0 && SMTP_USER && SMTP_PASS) {
    return "smtp";
  }
  if (resend) {
    return "resend";
  }
  return "none";
}

function getFromAddress(): string {
  return SMTP_FROM || EMAIL_FROM || DEFAULT_FROM;
}

function getProviderMissingEnv(provider: TransactionalEmailProvider): string[] {
  if (provider === "smtp") {
    return APP_URL ? [] : ["APP_URL"];
  }

  if (provider === "resend") {
    const missing: string[] = [];
    if (!process.env.RESEND_API_KEY?.trim()) missing.push("RESEND_API_KEY");
    if (!APP_URL) missing.push("APP_URL");
    return missing;
  }

  const missing: string[] = [];
  if (!SMTP_HOST) missing.push("SMTP_HOST");
  if (!Number.isFinite(SMTP_PORT) || SMTP_PORT <= 0) missing.push("SMTP_PORT");
  if (!SMTP_USER) missing.push("SMTP_USER");
  if (!SMTP_PASS) missing.push("SMTP_PASS");
  if (!APP_URL) missing.push("APP_URL");
  if (!process.env.RESEND_API_KEY?.trim()) missing.push("RESEND_API_KEY");
  return Array.from(new Set(missing));
}

export function getTransactionalEmailStatus(): TransactionalEmailStatus {
  const provider = getConfiguredProvider();
  const missingEnv = getProviderMissingEnv(provider);

  return {
    provider,
    configured: missingEnv.length === 0 && provider !== "none",
    missingEnv,
    from: getFromAddress(),
    appUrl: APP_URL,
  };
}

function ensureTransactionalEmailConfigured(): TransactionalEmailStatus {
  const status = getTransactionalEmailStatus();
  if (!status.configured) {
    throw new EmailConfigurationError(
      `El correo transaccional no está configurado. Faltan: ${status.missingEnv.join(", ")}`,
      status.missingEnv,
    );
  }
  return status;
}

function getSmtpTransporter(): nodemailer.Transporter {
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }

  return smtpTransporter;
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const status = ensureTransactionalEmailConfigured();

  try {
    if (status.provider === "smtp") {
      await getSmtpTransporter().sendMail({
        from: status.from,
        to,
        subject,
        html,
      });
      return;
    }

    const { error } = await resend!.emails.send({
      from: status.from,
      to,
      subject,
      html,
    });

    if (error) {
      throw new EmailDeliveryError(typeof error.message === "string" ? error.message : "No se pudo enviar el correo");
    }
  } catch (err) {
    if (err instanceof EmailConfigurationError || err instanceof EmailDeliveryError) {
      throw err;
    }

    const message = err instanceof Error ? err.message : "No se pudo enviar el correo";
    throw new EmailDeliveryError(message);
  }
}

function getRequiredAppUrl(): string {
  const status = ensureTransactionalEmailConfigured();
  if (!status.appUrl) {
    throw new EmailConfigurationError("APP_URL es obligatorio para enviar correos transaccionales", ["APP_URL"]);
  }
  return status.appUrl;
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const link = `${getRequiredAppUrl()}/reset-password?token=${token}`;
  await sendEmail(
    to,
    "Recupera tu contraseña - WebCool",
    `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f0f8ff;border-radius:16px;">
      <h2 style="color:#0d47a1;margin-bottom:8px;">Recuperar contraseña</h2>
      <p style="color:#455a64;margin-bottom:24px;">Recibimos una solicitud para restablecer la contraseña de tu cuenta en WebCool.</p>
      <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#1E88E5,#1565C0);color:#fff;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:600;font-size:15px;">Restablecer contraseña</a>
      <p style="color:#78909c;font-size:12px;margin-top:24px;">Este enlace expira en 30 minutos. Si no solicitaste esto, ignora este correo.</p>
      <hr style="border:none;border-top:1px solid #e3f2fd;margin:24px 0;" />
      <p style="color:#90a4ae;font-size:11px;">O copia este enlace: ${link}</p>
    </div>
    `,
  );
}

export async function sendEmailVerificationEmail(to: string, token: string): Promise<void> {
  const link = `${getRequiredAppUrl()}/verify-email?token=${token}`;
  await sendEmail(
    to,
    "Verifica tu correo - WebCool",
    `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f0f8ff;border-radius:16px;">
      <h2 style="color:#0d47a1;margin-bottom:8px;">Verifica tu correo</h2>
      <p style="color:#455a64;margin-bottom:24px;">Bienvenido a WebCool. Confirma tu dirección de correo para mayor seguridad.</p>
      <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#1E88E5,#1565C0);color:#fff;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:600;font-size:15px;">Verificar correo</a>
      <p style="color:#78909c;font-size:12px;margin-top:24px;">Este enlace expira en 24 horas.</p>
      <hr style="border:none;border-top:1px solid #e3f2fd;margin:24px 0;" />
      <p style="color:#90a4ae;font-size:11px;">O copia este enlace: ${link}</p>
    </div>
    `,
  );
}
