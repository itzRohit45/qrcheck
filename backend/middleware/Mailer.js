import dotenv from "dotenv";
dotenv.config();

export default class Mailer {
  static async sendMail(to, subject, text) {
    const emailUser = process.env.EMAIL || "attendx45@gmail.com";
    const brevoKey = process.env.BREVO_API_KEY;

    if (!brevoKey) {
      console.warn("[Mailer] BREVO_API_KEY is not set in environment.");
      return { success: false, error: new Error("BREVO_API_KEY missing in environment variables") };
    }

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
}
