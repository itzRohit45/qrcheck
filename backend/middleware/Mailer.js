import dotenv from "dotenv";
dotenv.config();
import sgMail from "@sendgrid/mail";

export default class Mailer {
  static async sendMail(to, subject, text) {
    const emailUser = process.env.EMAIL || "attendx45@gmail.com";
    const sendgridKey = process.env.SENDGRID_API_KEY;
    const brevoKey = process.env.BREVO_API_KEY;

    // 1. Brevo HTTP API (300 free emails/day forever, HTTPS port 443)
    if (brevoKey) {
      try {
        console.log(`[Mailer] Sending email via Brevo HTTP API to: ${to}`);
        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": brevoKey,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify({
            sender: { email: emailUser, name: "AttendX" },
            to: [{ email: to }],
            subject: subject,
            textContent: text,
          }),
        });

        const data = await response.json();
        if (response.ok) {
          console.log("[Mailer] Email sent successfully via Brevo.");
          return { success: true, info: data };
        } else {
          console.error("[Mailer] Brevo API error:", data);
          return { success: false, error: new Error(data.message || "Brevo delivery failed") };
        }
      } catch (error) {
        console.error("[Mailer] Brevo delivery failed:", error.message);
        return { success: false, error };
      }
    }

    // 2. SendGrid HTTP API (HTTPS port 443)
    if (sendgridKey) {
      try {
        sgMail.setApiKey(sendgridKey);
        const msg = {
          to,
          from: emailUser,
          subject,
          text,
        };

        console.log(`[Mailer] Sending email via SendGrid to: ${to}`);
        const data = await sgMail.send(msg);
        console.log("[Mailer] Email sent successfully via SendGrid.");
        return { success: true, info: data };
      } catch (error) {
        console.error("[Mailer] SendGrid delivery failed:", error.response?.body?.errors || error.message);
        return { success: false, error };
      }
    }

    console.warn("[Mailer] Neither BREVO_API_KEY nor SENDGRID_API_KEY is configured.");
    return { success: false, error: new Error("No active email API key configured.") };
  }
}
