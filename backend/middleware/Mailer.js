import dotenv from "dotenv";
dotenv.config();
import sgMail from "@sendgrid/mail";

export default class Mailer {
  static async sendMail(to, subject, text) {
    const emailUser = process.env.EMAIL || "attendx45@gmail.com";
    const sendgridKey = process.env.SENDGRID_API_KEY;

    if (!sendgridKey) {
      console.warn("[Mailer] SENDGRID_API_KEY is not set in environment.");
      return { success: false, error: new Error("SENDGRID_API_KEY missing") };
    }

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
}
