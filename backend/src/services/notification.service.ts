import nodemailer, { Transporter } from 'nodemailer';
import { ENV } from '../config/env';

export interface OrderNotificationPayload {
  id: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  otp?: string;
  appointmentSlot?: string;
  boutiqueName?: string;
  designName?: string;
  price?: number;
  deliveryAddress?: string;
}

class NotificationService {
  private transporter: Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter(): void {
    if (ENV.SMTP_HOST && ENV.SMTP_USER && ENV.SMTP_PASS) {
      try {
        const cleanPass = ENV.SMTP_PASS.replace(/\s+/g, '');
        if (ENV.SMTP_HOST.includes('gmail') || (ENV.SMTP_USER && ENV.SMTP_USER.includes('@gmail.com'))) {
          this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: ENV.SMTP_USER.trim(),
              pass: cleanPass,
            },
            connectionTimeout: 6000,
            greetingTimeout: 6000,
            socketTimeout: 6000,
          });
          console.log('[NotificationService] Connected to Gmail SMTP service for:', ENV.SMTP_USER);
        } else {
          this.transporter = nodemailer.createTransport({
            host: ENV.SMTP_HOST,
            port: ENV.SMTP_PORT,
            secure: ENV.SMTP_PORT === 465,
            auth: {
              user: ENV.SMTP_USER.trim(),
              pass: cleanPass,
            },
            connectionTimeout: 6000,
            greetingTimeout: 6000,
            socketTimeout: 6000,
          });
          console.log('[NotificationService] Connected to SMTP server:', ENV.SMTP_HOST);
        }
      } catch (err) {
        console.warn('[NotificationService] Failed to initialize SMTP transporter:', err);
        this.transporter = null;
      }
    }
  }

  /**
   * 1. Send Booking Confirmation & Doorstep Security OTP
   */
  async sendOrderConfirmationAndOtp(order: OrderNotificationPayload): Promise<boolean> {
    const subject = `Bespoke Appointment Confirmed • Order #${order.id} [OTP: ${order.otp}]`;
    const html = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #FAF8F5; padding: 32px; border: 1px solid #E8E4DA; color: #121212;">
        <div style="border-bottom: 2px solid #C5A880; padding-bottom: 16px; margin-bottom: 24px;">
          <span style="font-size: 10px; text-transform: uppercase; letter-spacing: 3px; color: #C5A880; font-weight: bold;">Suit & Stitch Atelier</span>
          <h1 style="font-family: Georgia, serif; font-size: 26px; margin: 8px 0 0 0; font-weight: normal;">Appointment Confirmed</h1>
        </div>

        <p style="font-size: 14px; line-height: 1.6; color: #4A4A4A;">Dear <strong>${order.customerName}</strong>,</p>
        <p style="font-size: 14px; line-height: 1.6; color: #4A4A4A;">
          Your bespoke appointment for <strong>${order.designName}</strong> crafted by <strong>${order.boutiqueName}</strong> is confirmed.
        </p>

        <!-- Doorstep Security OTP Card -->
        <div style="background: #FFFFFF; border: 1px solid #E8E4DA; border-left: 4px solid #C5A880; padding: 20px; margin: 24px 0; text-align: center;">
          <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #737373; display: block; margin-bottom: 8px;">Doorstep Verification Code (OTP)</span>
          <span style="font-family: monospace; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #121212; display: block;">${order.otp}</span>
          <span style="font-size: 11px; color: #A3A3A3; display: block; margin-top: 8px;">Provide this 4-digit code to the visiting Field Associate upon arrival.</span>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px;">
          <tr>
            <td style="padding: 8px 0; color: #737373; border-bottom: 1px solid #E8E4DA;">Appointment Slot:</td>
            <td style="padding: 8px 0; font-weight: bold; text-align: right; border-bottom: 1px solid #E8E4DA;">${order.appointmentSlot}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #737373; border-bottom: 1px solid #E8E4DA;">Studio Atelier:</td>
            <td style="padding: 8px 0; font-weight: bold; text-align: right; border-bottom: 1px solid #E8E4DA;">${order.boutiqueName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #737373; border-bottom: 1px solid #E8E4DA;">Estimated Investment:</td>
            <td style="padding: 8px 0; font-weight: bold; text-align: right; border-bottom: 1px solid #E8E4DA;">₹${(order.price || 0).toLocaleString('en-IN')}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #737373;">Fitting Address:</td>
            <td style="padding: 8px 0; font-weight: bold; text-align: right;">${order.deliveryAddress}</td>
          </tr>
        </table>

        <p style="font-size: 12px; color: #737373; line-height: 1.5; border-top: 1px solid #E8E4DA; padding-top: 16px;">
          Need to reschedule? Contact your atelier concierge directly through the Suit & Stitch live dashboard.
        </p>
      </div>
    `;

    console.log(`
╔═══════════════════════════════════════════════════════════════════════════╗
║                   [SUIT & STITCH NOTIFICATION DISPATCH]                  ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  Type:    BOOKING_CONFIRMATION & DOORSTEP OTP                             ║
║  To:      ${order.customerEmail} (${order.customerPhone || 'N/A'})
║  Order:   ${order.id}                                                      ║
║  OTP:     >>> ${order.otp} <<< (4-DIGIT VERIFICATION CODE)                 ║
║  Design:  ${order.designName}                                             ║
║  Atelier: ${order.boutiqueName}                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
    `);

    return this.deliverEmail(order.customerEmail, subject, html);
  }

  /**
   * 2. Send Measurement Telemetry Received Notification
   */
  async sendMeasurementCompletion(order: OrderNotificationPayload): Promise<boolean> {
    const subject = `Fitting Completed • Sizing Telemetry Sent to Studio #${order.id}`;
    const html = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #FAF8F5; padding: 32px; border: 1px solid #E8E4DA;">
        <h2 style="font-family: Georgia, serif; color: #121212;">Measurements Successfully Recorded</h2>
        <p>Dear ${order.customerName}, your doorstep fitting visit has concluded. Your 6-point biometric measurements have been securely verified and transferred to <strong>${order.boutiqueName}</strong> for precision pattern drafting.</p>
        <p>Order Reference: <strong>${order.id}</strong></p>
      </div>
    `;

    console.log(`[Notification] Telemetry recorded notification sent to ${order.customerEmail} for order ${order.id}`);
    return this.deliverEmail(order.customerEmail, subject, html);
  }

  /**
   * 3. Send Production & Dispatch Notification
   */
  async sendProductionStatusUpdate(order: OrderNotificationPayload, statusMessage: string): Promise<boolean> {
    const subject = `Atelier Update: Order #${order.id} • ${statusMessage}`;
    const html = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #FAF8F5; padding: 32px; border: 1px solid #E8E4DA;">
        <h2 style="font-family: Georgia, serif; color: #121212;">${statusMessage}</h2>
        <p>Dear ${order.customerName}, your handcrafted garment <strong>${order.designName}</strong> status is now: <strong>${statusMessage}</strong>.</p>
        <p>Track live delivery progress on your client dashboard.</p>
      </div>
    `;

    console.log(`[Notification] Status update '${statusMessage}' sent to ${order.customerEmail}`);
    return this.deliverEmail(order.customerEmail, subject, html);
  }

  /**
   * 4. Send Login / Authentication 6-Digit OTP Email
   */
  async sendLoginOtp(email: string, otp: string): Promise<boolean> {
    const subject = `Your Suit & Stitch Atelier Verification Code: ${otp}`;
    const html = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 550px; margin: 0 auto; background: #FAF8F5; padding: 32px; border: 1px solid #E8E4DA; color: #121212;">
        <div style="border-bottom: 2px solid #C5A880; padding-bottom: 16px; margin-bottom: 24px; text-align: center;">
          <span style="font-size: 10px; text-transform: uppercase; letter-spacing: 3px; color: #C5A880; font-weight: bold;">Suit & Stitch Collective</span>
          <h1 style="font-family: Georgia, serif; font-size: 24px; margin: 8px 0 0 0; font-weight: normal;">Account Verification Code</h1>
        </div>

        <p style="font-size: 14px; line-height: 1.6; color: #4A4A4A; text-align: center;">
          Here is your 6-digit one-time verification code to sign into your bespoke tailoring client portal:
        </p>

        <div style="background: #FFFFFF; border: 1px solid #E8E4DA; border-left: 4px solid #C5A880; padding: 24px; margin: 24px 0; text-align: center;">
          <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #737373; display: block; margin-bottom: 8px;">6-Digit One-Time Password</span>
          <span style="font-family: monospace; font-size: 40px; font-weight: bold; letter-spacing: 10px; color: #121212; display: block;">${otp}</span>
          <span style="font-size: 11px; color: #A3A3A3; display: block; margin-top: 10px;">Valid for 5 minutes. Do not share this code with anyone.</span>
        </div>

        <p style="font-size: 12px; color: #737373; line-height: 1.5; text-align: center; border-top: 1px solid #E8E4DA; padding-top: 16px;">
          If you did not request this verification code, you can safely ignore this email.
        </p>
      </div>
    `;

    console.log(`[Notification] Login OTP ${otp} dispatched to ${email}`);
    return this.deliverEmail(email, subject, html);
  }

  /**
   * 5. Send SMS Verification Code via Fast2SMS (India) or Twilio (Global)
   */
  async sendLoginSms(phone: string, otp: string): Promise<boolean> {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const message = `Your Suit & Stitch Atelier verification code is ${otp}. Valid for 5 minutes.`;

    // A. Fast2SMS (Direct Indian mobile gateway)
    if (ENV.FAST2SMS_API_KEY) {
      try {
        const indianNumber = cleanPhone.length > 10 ? cleanPhone.slice(-10) : cleanPhone;
        const url = `https://www.fast2sms.com/dev/bulkV2?authorization=${ENV.FAST2SMS_API_KEY}&variables_values=${otp}&route=otp&numbers=${indianNumber}`;
        const res = await fetch(url, { method: 'GET' });
        const data = await res.json() as any;
        console.log('[NotificationService] Fast2SMS response:', data);
        if (data && data.return) return true;
      } catch (err) {
        console.warn('[NotificationService] Fast2SMS error:', err);
      }
    }

    // B. Twilio SMS Gateway
    if (ENV.TWILIO_ACCOUNT_SID && ENV.TWILIO_AUTH_TOKEN && ENV.TWILIO_PHONE_NUMBER) {
      try {
        const formattedTo = phone.startsWith('+') ? phone : `+91${cleanPhone.slice(-10)}`;
        const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${ENV.TWILIO_ACCOUNT_SID}/Messages.json`;
        const auth = Buffer.from(`${ENV.TWILIO_ACCOUNT_SID}:${ENV.TWILIO_AUTH_TOKEN}`).toString('base64');
        const params = new URLSearchParams({
          To: formattedTo,
          From: ENV.TWILIO_PHONE_NUMBER,
          Body: message,
        });

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        });
        const data = await res.json();
        console.log('[NotificationService] Twilio response:', data);
        if (res.ok) return true;
      } catch (err) {
        console.warn('[NotificationService] Twilio error:', err);
      }
    }

    console.log(`[NotificationService] SMS dispatch simulated for ${phone}: ${message}`);
    return true;
  }

  /**
   * Internal email delivery method
   */
  private async deliverEmail(to: string, subject: string, html: string): Promise<boolean> {
    // 1. Try Resend HTTP API (Port 443 HTTPS - Bypasses Render SMTP port blocking)
    if (ENV.RESEND_API_KEY) {
      try {
        const from = ENV.FROM_EMAIL || 'onboarding@resend.dev';
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ENV.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `Suit & Stitch Atelier <${from}>`,
            to: [to],
            subject,
            html,
          }),
        });
        const data = await res.json() as any;
        console.log('[NotificationService] Resend API response:', data);
        if (res.ok && data?.id) return true;
      } catch (err) {
        console.warn('[NotificationService] Resend API error:', err);
      }
    }

    // 2. Try Brevo HTTP API (Port 443 HTTPS - Bypasses Render SMTP port blocking)
    if (ENV.BREVO_API_KEY) {
      try {
        const fromEmail = ENV.SMTP_USER || ENV.FROM_EMAIL || 'concierge@suitstitch.com';
        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': ENV.BREVO_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sender: { name: 'Suit & Stitch Atelier', email: fromEmail },
            to: [{ email: to }],
            subject,
            htmlContent: html,
          }),
        });
        const data = await res.json() as any;
        console.log('[NotificationService] Brevo API response:', data);
        if (res.ok && data?.messageId) return true;
      } catch (err) {
        console.warn('[NotificationService] Brevo API error:', err);
      }
    }

    // 3. Fallback to standard SMTP (May time out if Render blocks port 587/465)
    if (!this.transporter) {
      console.log(`[NotificationService] SMTP not configured - simulated delivery for ${to}`);
      return false;
    }

    // Gmail requires from address to match authenticated user
    const fromAddress = (ENV.SMTP_USER && ENV.SMTP_USER.includes('@gmail.com'))
      ? `"Suit & Stitch Atelier" <${ENV.SMTP_USER}>`
      : `"Suit & Stitch Atelier" <${ENV.FROM_EMAIL || ENV.SMTP_USER}>`;

    try {
      const info = await this.transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        html,
      });
      console.log(`[NotificationService] Email delivered successfully to ${to}, MessageId: ${info.messageId}`);
      return true;
    } catch (err: any) {
      if (err?.code === 'ETIMEDOUT') {
        console.error('[NotificationService] Outbound SMTP connection blocked by Render firewall (ETIMEDOUT on port 587/465). Use RESEND_API_KEY or BREVO_API_KEY over HTTPS port 443 instead.');
      } else {
        console.error('[NotificationService] Email delivery failure:', err);
      }
      return false;
    }
  }
}

export const notificationService = new NotificationService();
export default notificationService;
