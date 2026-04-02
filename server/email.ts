import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM || "WebCool <noreply@webcool.mx>";
const APP_URL = process.env.APP_URL || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://localhost:5000");

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!resend) {
    console.log(`\n[EMAIL - no RESEND_API_KEY configured]\nTo: ${to}\nSubject: ${subject}\n${html.replace(/<[^>]+>/g, "")}\n`);
    return;
  }
  try {
    const { error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) console.error("[EMAIL] Resend error:", error);
  } catch (err) {
    console.error("[EMAIL] Send failed:", err);
  }
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const link = `${APP_URL}/reset-password?token=${token}`;
  await sendEmail(
    to,
    "Recupera tu contraseña — WebCool",
    `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f0f8ff;border-radius:16px;">
      <h2 style="color:#0d47a1;margin-bottom:8px;">Recuperar contraseña</h2>
      <p style="color:#455a64;margin-bottom:24px;">Recibimos una solicitud para restablecer la contraseña de tu cuenta en WebCool.</p>
      <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#1E88E5,#1565C0);color:#fff;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:600;font-size:15px;">Restablecer contraseña</a>
      <p style="color:#78909c;font-size:12px;margin-top:24px;">Este enlace expira en 30 minutos. Si no solicitaste esto, ignora este correo.</p>
      <hr style="border:none;border-top:1px solid #e3f2fd;margin:24px 0;" />
      <p style="color:#90a4ae;font-size:11px;">O copia este enlace: ${link}</p>
    </div>
    `
  );
}

export async function sendEmailVerificationEmail(to: string, token: string): Promise<void> {
  const link = `${APP_URL}/verify-email?token=${token}`;
  await sendEmail(
    to,
    "Verifica tu correo — WebCool",
    `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f0f8ff;border-radius:16px;">
      <h2 style="color:#0d47a1;margin-bottom:8px;">Verifica tu correo</h2>
      <p style="color:#455a64;margin-bottom:24px;">¡Bienvenido a WebCool! Confirma tu dirección de correo para mayor seguridad.</p>
      <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#1E88E5,#1565C0);color:#fff;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:600;font-size:15px;">Verificar correo</a>
      <p style="color:#78909c;font-size:12px;margin-top:24px;">Este enlace expira en 24 horas.</p>
      <hr style="border:none;border-top:1px solid #e3f2fd;margin:24px 0;" />
      <p style="color:#90a4ae;font-size:11px;">O copia este enlace: ${link}</p>
    </div>
    `
  );
}
