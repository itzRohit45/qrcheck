import dotenv from "dotenv";
dotenv.config();
import nodemailer from "nodemailer";

export default class Mailer {
  static async sendMail(to, subject, text) {
    const emailUser = process.env.EMAIL || "attendx45@gmail.com";
    const emailPass = process.env.PASSWORD;

    if (!emailPass) {
      console.warn("[Mailer] ⚠️ PASSWORD is not set in backend/.env. To send real emails, add a Google App Password.");
      return { success: false, error: new Error("PASSWORD missing in .env") };
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: emailUser,
        pass: emailPass, // Google App Password (16 characters)
      },
    });

    const mailOptions = {
      from: `"AttendX Support" <${emailUser}>`,
      to,
      subject,
      text,
    };

    try {
      console.log(`[Mailer] Sending email via Nodemailer (Gmail) to: ${to}`);
      const info = await transporter.sendMail(mailOptions);
      console.log("[Mailer] ✅ Email sent successfully via Nodemailer! MessageId:", info.messageId);
      return { success: true, info };
    } catch (error) {
      console.error("[Mailer] ❌ Failed to send email via Nodemailer:", error.message || error);
      return { success: false, error };
    }
  }
}
