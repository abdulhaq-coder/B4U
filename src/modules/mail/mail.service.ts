import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Env } from '../../config/env.validation';

@Injectable()
export class MailService {
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

  async sendOtp(to: string, code: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Your verification code',
      text: `Your verification code is ${code}. It expires in 5 minutes. Do not share it with anyone.`,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
               <h2 style="color: #333;">Salon & Parlour Verification</h2>
               <p>Use the following 6-digit code to complete your verification:</p>
               <h1 style="background: #f4f4f4; padding: 12px; letter-spacing: 6px; text-align: center; border-radius: 4px; color: #1a1a1a;">${code}</h1>
               <p style="color: #666; font-size: 14px;">This code will expire in 5 minutes. If you did not request this code, please ignore this email.</p>
             </div>`,
    });
  }
}

