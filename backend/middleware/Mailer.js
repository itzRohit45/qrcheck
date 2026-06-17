import dotenv from "dotenv";
dotenv.config();
import sgMail from "@sendgrid/mail";

// Make sure to add SENDGRID_API_KEY to your Render environment variables!
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export default class Mailer {
  static async sendMail(to, subject, text) {
    try {
      console.log(`[Mailer] Preparing to send email via SendGrid to: ${to}`);
      console.log(`[Mailer] From address configured as: ${process.env.EMAIL || "attendx45@gmail.com"}`);
      console.log(`[Mailer] Has API Key?: ${!!process.env.SENDGRID_API_KEY}`);
      
      const msg = {
        to: to,
        // The 'from' email MUST be the exact email address you verified in SendGrid as a Single Sender
        from: process.env.EMAIL || "attendx45@gmail.com", 
        subject: subject,
        text: text,
      };

      console.log(`[Mailer] Awaiting sgMail.send()...`);
      const data = await sgMail.send(msg);
      console.log("[Mailer] ✅ Email sent successfully via SendGrid!");
      return { success: true, info: data };
    } catch (error) {
      console.error("[Mailer] ❌ Failed to send email via SendGrid:", error.response?.body || error);
      return { success: false, error };
    }
  }
}
