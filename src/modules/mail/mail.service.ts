import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpPurpose } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import { Env } from '../../config/env.validation';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(config: ConfigService<Env, true>) {
    const user = config.get('SMTP_USER', { infer: true });
    const pass = config.get('SMTP_PASS', { infer: true });
    const port = config.get('SMTP_PORT', { infer: true });

    this.from = config.get('MAIL_FROM', { infer: true });
    this.transporter = nodemailer.createTransport({
      host: config.get('SMTP_HOST', { infer: true }),
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  async sendOtp(to: string, code: string, purpose: OtpPurpose): Promise<void> {
    const reset = purpose === OtpPurpose.PASSWORD_RESET;
    const subject = reset ? 'Your password reset code' : 'Verify your email';
    const intro = reset ? 'Use this code to reset your password:' : 'Use this code to verify your email:';

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        text: `${intro} ${code}. It expires in 5 minutes. If you did not request it, ignore this email.`,
        html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
                 <h2 style="color: #333;">Salon & Parlour Booking</h2>
                 <p>${intro}</p>
                 <h1 style="background: #f4f4f4; padding: 12px; letter-spacing: 6px; text-align: center; border-radius: 4px; color: #1a1a1a;">${code}</h1>
                 <p style="color: #666; font-size: 14px;">It expires in 5 minutes. If you did not request this, you can ignore this email.</p>
               </div>`,
      });
    } catch (err: any) {
      if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
        this.logger.warn(`SMTP offline (${err.message}). OTP for ${to} [${purpose}]: ${code}`);
        return;
      }
      throw err;
    }
  }
}

