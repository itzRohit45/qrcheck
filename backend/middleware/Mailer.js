import dotenv from "dotenv";
dotenv.config();
import nodemailer from "nodemailer";
import sgMail from "@sendgrid/mail";

export default class Mailer {
  static async sendMail(to, subject, text) {
    const emailUser = process.env.EMAIL || "attendx45@gmail.com";
    const emailPass = process.env.PASSWORD;
    const sendgridKey = process.env.SENDGRID_API_KEY;

    // 1. Try SendGrid HTTP API if key is present (HTTP port 443 is never blocked by cloud firewalls)
    if (sendgridKey && sendgridKey.startsWith("SG.")) {
      try {
        sgMail.setApiKey(sendgridKey);
        const msg = {
          to,
          from: emailUser,
          subject,
          text,
        };
        console.log(`[Mailer] Attempting SendGrid HTTP API to ${to}...`);
        const data = await sgMail.send(msg);
        console.log("[Mailer] ✅ Sent via SendGrid!");
        return { success: true, info: data };
      } catch (sgErr) {
        console.warn("[Mailer] SendGrid failed or quota exceeded:", sgErr.response?.body?.errors || sgErr.message);
      }
    }

    // 2. Try Nodemailer Gmail SMTP with strict 3.5s timeout (prevents Render from hanging)
    if (emailPass) {
      try {
        console.log(`[Mailer] Attempting Nodemailer Gmail SMTP to ${to}...`);
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: emailUser,
            pass: emailPass,
          },
          connectionTimeout: 3500,
          greetingTimeout: 3500,
          socketTimeout: 3500,
        });

        const mailOptions = {
          from: `"AttendX Support" <${emailUser}>`,
          to,
          subject,
          text,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("[Mailer] ✅ Sent via Nodemailer Gmail!");
        return { success: true, info };
      } catch (nmErr) {
        console.warn("[Mailer] Nodemailer Gmail failed (likely Render firewall blocking SMTP):", nmErr.message);
      }
    }

    return { success: false, error: new Error("No active email transport succeeded") };
  }
}
