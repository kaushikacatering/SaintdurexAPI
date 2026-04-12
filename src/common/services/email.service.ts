import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { MailerSend, EmailParams, Sender, Recipient, Attachment } from 'mailersend';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private mailerSend: MailerSend | null = null;
  private transporter: nodemailer.Transporter | null = null;
  private oauth2Transporter: nodemailer.Transporter | null = null;

  constructor(
    private configService: ConfigService,
    private dataSource: DataSource,
  ) {}

  /**
   * Get or create the SMTP transporter
   */
  private async getSMTPTransporter(): Promise<nodemailer.Transporter> {
    if (this.transporter) {
      return this.transporter;
    }

    // Try to get SMTP settings from the database first
    let dbConfig = new Map<string, string>();
    try {
      const records = await this.dataSource.query(
        `SELECT config_key, config_value FROM email_config WHERE is_active = TRUE`
      );
      records.forEach((record: any) => {
        dbConfig.set(record.config_key.toLowerCase(), record.config_value);
      });
      if (records.length > 0) {
        this.logger.log(`Loaded ${records.length} SMTP settings from database`);
      }
    } catch (error) {
      this.logger.warn('Failed to load email config from database, using environment variables:', error.message);
    }

    const smtpHost = dbConfig.get('smtp_host') || this.configService.get<string>('SMTP_HOST');
    const dbSmtpPort = dbConfig.get('smtp_port');
    const smtpPortNum = dbSmtpPort ? parseInt(dbSmtpPort, 10) : this.configService.get<number>('SMTP_PORT');
    const smtpPort = smtpPortNum || 587;
    const smtpUser = dbConfig.get('smtp_user') || this.configService.get<string>('SMTP_USER');
    const smtpPassword = dbConfig.get('smtp_password') || this.configService.get<string>('SMTP_PASSWORD');
    const smtpSecureStr = dbConfig.get('smtp_secure') || this.configService.get<string>('SMTP_SECURE');
    const smtpSecure = smtpSecureStr === 'true';

    if (!smtpHost || !smtpUser || !smtpPassword) {
      this.logger.error('SMTP configuration is incomplete. Please set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD in environment variables or Admin UI.');
      throw new Error('SMTP configuration is incomplete');
    }

    // Create transporter with flexible authentication options
    const transporterOptions: any = {
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
      tls: {
        // Do not fail on invalid certs
        rejectUnauthorized: false,
      },
      // Add connection timeout
      connectionTimeout: 15000, // 15 seconds
      greetingTimeout: 10000, // 10 seconds
    };

    // Better Gmail support
    if (smtpHost.toLowerCase().includes('gmail.com')) {
      transporterOptions.service = 'gmail';
      // When using 'gmail' service, host and port are handled internally by nodemailer
    }

    // For port 587, use STARTTLS
    if (!smtpSecure && smtpPort === 587) {
      transporterOptions.requireTLS = true;
      transporterOptions.requireTransportSecurity = false;
    }

    this.transporter = nodemailer.createTransport(transporterOptions);

    this.logger.log(`SMTP transporter initialized successfully for ${smtpHost}:${smtpPort} (secure: ${smtpSecure})`);
    this.logger.log(`SMTP user: ${smtpUser}`);
    return this.transporter;
  }

  /**
   * Check if SMTP is configured
   */
  private isSMTPConfigured(): boolean {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPassword = this.configService.get<string>('SMTP_PASSWORD');
    return !!(smtpHost && smtpUser && smtpPassword);
  }

  /**
   * Check if Google OAuth2 is configured
   */
  private isOAuth2Configured(): boolean {
    const googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const googleClientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const googleRefreshToken = this.configService.get<string>('GOOGLE_REFRESH_TOKEN');
    const googleEmailUser = this.configService.get<string>('GOOGLE_EMAIL_USER');
    const smtpAuthType = (this.configService.get<string>('SMTP_AUTH_TYPE') || '').toLowerCase();
    const smtpClientId = this.configService.get<string>('SMTP_OAUTH_CLIENT_ID');
    const smtpClientSecret = this.configService.get<string>('SMTP_OAUTH_CLIENT_SECRET');
    const smtpRefreshToken = this.configService.get<string>('SMTP_OAUTH_REFRESH_TOKEN');
    const smtpEmailUser = this.configService.get<string>('SMTP_OAUTH_USER') || this.configService.get<string>('SMTP_USER');
    const googleConfigured = !!(googleClientId && googleClientSecret && googleRefreshToken && googleEmailUser);
    const smtpOauthConfigured = smtpAuthType === 'oauth2' && !!(smtpClientId && smtpClientSecret && smtpRefreshToken && smtpEmailUser);
    return googleConfigured || smtpOauthConfigured;
  }

  /**
   * Get or create the OAuth2 transporter for Gmail
   */
  private async getOAuth2Transporter(): Promise<nodemailer.Transporter> {
    if (this.oauth2Transporter) {
      return this.oauth2Transporter;
    }

    const smtpAuthType = (this.configService.get<string>('SMTP_AUTH_TYPE') || '').toLowerCase();
    const googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const googleClientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const googleRefreshToken = this.configService.get<string>('GOOGLE_REFRESH_TOKEN');
    const googleAccessToken = this.configService.get<string>('GOOGLE_ACCESS_TOKEN');
    const googleEmailUser = this.configService.get<string>('GOOGLE_EMAIL_USER');
    const smtpClientId = this.configService.get<string>('SMTP_OAUTH_CLIENT_ID');
    const smtpClientSecret = this.configService.get<string>('SMTP_OAUTH_CLIENT_SECRET');
    const smtpRefreshToken = this.configService.get<string>('SMTP_OAUTH_REFRESH_TOKEN');
    const smtpAccessToken = this.configService.get<string>('SMTP_OAUTH_ACCESS_TOKEN');
    const smtpEmailUser = this.configService.get<string>('SMTP_OAUTH_USER') || this.configService.get<string>('SMTP_USER');
    const smtpHost = this.configService.get<string>('SMTP_HOST') || 'smtp.gmail.com';
    const smtpPort = this.configService.get<number>('SMTP_PORT') || 587;
    const smtpSecure = this.configService.get<string>('SMTP_SECURE') === 'true';

    const useGoogle = !!(googleClientId && googleClientSecret && googleRefreshToken && googleEmailUser);
    const useSmtpOauth = smtpAuthType === 'oauth2' && !!(smtpClientId && smtpClientSecret && smtpRefreshToken && smtpEmailUser);

    if (useGoogle) {
      this.oauth2Transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: googleEmailUser,
          clientId: googleClientId,
          clientSecret: googleClientSecret,
          refreshToken: googleRefreshToken,
          accessToken: googleAccessToken,
        },
      });
      this.logger.log(`OAuth2 transporter initialized for ${googleEmailUser} (Gmail)`);
      return this.oauth2Transporter;
    }

    if (useSmtpOauth) {
      const transporterOptions: any = {
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          type: 'OAuth2',
          user: smtpEmailUser,
          clientId: smtpClientId,
          clientSecret: smtpClientSecret,
          refreshToken: smtpRefreshToken,
          accessToken: smtpAccessToken,
        },
        tls: {
          rejectUnauthorized: false,
        },
        connectionTimeout: 15000,
        greetingTimeout: 10000,
      };
      if (!smtpSecure && smtpPort === 587) {
        transporterOptions.requireTLS = true;
        transporterOptions.requireTransportSecurity = false;
      }
      this.oauth2Transporter = nodemailer.createTransport(transporterOptions);
      this.logger.log(`OAuth2 transporter initialized for ${smtpEmailUser} via ${smtpHost}:${smtpPort}`);
      return this.oauth2Transporter;
    }

    throw new Error('OAuth2 configuration is incomplete');
  }

  /**
   * Send email via Google OAuth2
   */
  private async sendEmailViaOAuth2(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const transporter = await this.getOAuth2Transporter();

      const emailUser = this.configService.get<string>('GOOGLE_EMAIL_USER');
      const fromName = this.configService.get<string>('COMPANY_NAME') || 'St Dreux Coffee Roasters';

      // Prepare recipients
      const toEmails = Array.isArray(options.to) ? options.to : [options.to];
      const ccEmails = options.cc ? (Array.isArray(options.cc) ? options.cc : [options.cc]) : [];
      const bccEmails = options.bcc ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) : [];

      // Prepare mail options
      const mailOptions: nodemailer.SendMailOptions = {
        from: `"${fromName}" <${emailUser}>`,
        to: toEmails.join(', '),
        subject: options.subject,
        html: options.html,
        text: options.text || (options.html ? this.htmlToText(options.html) : undefined),
        replyTo: options.replyTo || emailUser,
      };

      // Add CC if provided
      if (ccEmails.length > 0) {
        mailOptions.cc = ccEmails.join(', ');
      }

      // Add BCC if provided
      if (bccEmails.length > 0) {
        mailOptions.bcc = bccEmails.join(', ');
      }

      // Handle attachments
      if (options.attachments && options.attachments.length > 0) {
        mailOptions.attachments = options.attachments.map(att => {
          if (Buffer.isBuffer(att.content)) {
            return {
              filename: att.filename,
              content: att.content,
              contentType: att.contentType,
            };
          } else {
            return {
              filename: att.filename,
              content: Buffer.from(att.content, 'base64'),
              contentType: att.contentType,
            };
          }
        });
      }

      // Send email
      const info = await transporter.sendMail(mailOptions);

      const messageId = info.messageId || 'unknown';
      this.logger.log(`Email sent successfully via Google OAuth2. Message ID: ${messageId}`);

      return {
        success: true,
        messageId: messageId,
      };
    } catch (error: any) {
      const errorMessage = error.message || error.toString() || 'Unknown error';
      this.logger.error('Google OAuth2 email sending error:', errorMessage);

      // Check if token needs refresh
      if (errorMessage.includes('invalid_grant') || errorMessage.includes('Token has been expired')) {
        this.oauth2Transporter = null; // Reset transporter to force re-creation
        this.logger.error('OAuth2 token may have expired. Please generate a new refresh token.');
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get or create the MailerSend client (fallback)
   */
  private getMailerSendClient(): MailerSend {
    if (this.mailerSend) {
      return this.mailerSend;
    }

    const apiKey = this.configService.get<string>('MAILERSEND_API_KEY');
    
    if (!apiKey) {
      this.logger.error('MailerSend API key is not configured. Please set MAILERSEND_API_KEY in environment variables.');
      throw new Error('MailerSend API key is not configured');
    }

    this.mailerSend = new MailerSend({
      apiKey: apiKey,
    });

    this.logger.log('MailerSend client initialized successfully');
    return this.mailerSend;
  }

  /**
   * Verify email connection (OAuth2, SMTP, or MailerSend)
   */
  async verifyEmailConnection(): Promise<boolean> {
    try {
      if (this.isOAuth2Configured()) {
        const transporter = await this.getOAuth2Transporter();
        await transporter.verify();
        this.logger.log('Google OAuth2 connection verified successfully');
        return true;
      } else if (this.isSMTPConfigured()) {
        const transporter = await this.getSMTPTransporter();
        await transporter.verify();
        this.logger.log('SMTP connection verified successfully');
        return true;
      } else {
        const client = this.getMailerSendClient();
        // MailerSend doesn't have a direct verify method, but we can check if client is initialized
        if (client) {
          this.logger.log('MailerSend connection verified successfully');
          return true;
        }
        return false;
      }
    } catch (error) {
      this.logger.error('Email connection verification failed:', error);
      return false;
    }
  }

  /**
   * Send email with optional attachments (using OAuth2, SMTP, or MailerSend)
   */
  async sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Admin BCC logic removed to prevent duplicate/incorrect emails to the admin

    // Priority: 1. Google OAuth2, 2. SMTP, 3. MailerSend
    if (this.isOAuth2Configured()) {
      return this.sendEmailViaOAuth2(options);
    } else if (this.isSMTPConfigured()) {
      return this.sendEmailViaSMTP(options);
    } else {
      return this.sendEmailViaMailerSend(options);
    }
  }

  /**
   * Send email via SMTP
   */
  private async sendEmailViaSMTP(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const transporter = await this.getSMTPTransporter();
      
      // Get configuration
      const fromEmail = this.configService.get<string>('FROM_EMAIL') || 
                       this.configService.get<string>('SMTP_USER') || 
                       'noreply@stdreux.com';
      const fromName = this.configService.get<string>('COMPANY_NAME') || 
                      'St Dreux Coffee Roasters';

      // Prepare recipients
      const toEmails = Array.isArray(options.to) ? options.to : [options.to];
      const ccEmails = options.cc ? (Array.isArray(options.cc) ? options.cc : [options.cc]) : [];
      const bccEmails = options.bcc ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) : [];

      // Prepare mail options
      const mailOptions: nodemailer.SendMailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: toEmails.join(', '),
        subject: options.subject,
        html: options.html,
        text: options.text || (options.html ? this.htmlToText(options.html) : undefined),
        replyTo: options.replyTo || fromEmail,
      };

      // Add CC if provided
      if (ccEmails.length > 0) {
        mailOptions.cc = ccEmails.join(', ');
      }

      // Add BCC if provided
      if (bccEmails.length > 0) {
        mailOptions.bcc = bccEmails.join(', ');
      }

      // Handle attachments
      if (options.attachments && options.attachments.length > 0) {
        mailOptions.attachments = options.attachments.map(att => {
          if (Buffer.isBuffer(att.content)) {
            return {
              filename: att.filename,
              content: att.content,
              contentType: att.contentType,
            };
          } else {
            // If it's a string, assume it's base64
            return {
              filename: att.filename,
              content: Buffer.from(att.content, 'base64'),
              contentType: att.contentType,
            };
          }
        });
      }

      // Send email
      const info = await transporter.sendMail(mailOptions);
      
      const messageId = info.messageId || 'unknown';
      this.logger.log(`Email sent successfully via SMTP. Message ID: ${messageId}`);

      return {
        success: true,
        messageId: messageId,
      };
    } catch (error: any) {
      const errorMessage = error.message || error.toString() || 'Unknown error';
      const smtpHost = this.configService.get<string>('SMTP_HOST') || 'unknown';
      const smtpPort = this.configService.get<number>('SMTP_PORT') || 587;
      
      this.logger.error(`SMTP email sending error (${smtpHost}:${smtpPort}):`, errorMessage);
      
      // Provide helpful error messages
      let helpfulError = errorMessage;
      if (errorMessage.includes('Invalid login') || errorMessage.includes('Authentication failed') || errorMessage.includes('535')) {
        helpfulError = `Authentication failed. Please verify:
- SMTP_HOST: ${smtpHost}
- SMTP_USER: ${this.configService.get<string>('SMTP_USER')}
- SMTP_PASSWORD: (check if correct)
- Try alternative SMTP hosts: mail.saintdreux.com.au, smtp.saintdreux.com.au, smtp.gmail.com, or smtp.office365.com
- Try port 465 with SMTP_SECURE=true if port 587 doesn't work`;
      } else if (errorMessage.includes('timeout') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
        helpfulError = `Connection failed to ${smtpHost}:${smtpPort}. Please try:
- mail.saintdreux.com.au (most common for custom domains)
- smtp.saintdreux.com.au
- smtp.gmail.com (if Google Workspace)
- smtp.office365.com (if Office 365)`;
      }
      
      // Log full error for debugging
      if (error.response) {
        this.logger.error('SMTP error response:', JSON.stringify(error.response, null, 2));
      }
      if (error.code) {
        this.logger.error('SMTP error code:', error.code);
      }

      return {
        success: false,
        error: helpfulError,
      };
    }
  }

  /**
   * Reset transporter to force reload configuration
   */
  resetTransporter(): void {
    this.transporter = null;
    this.oauth2Transporter = null;
    this.logger.log('Email transporter configuration reset triggered');
  }

  /**
   * Send email via MailerSend (fallback)
   */
  private async sendEmailViaMailerSend(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const client = this.getMailerSendClient();
      
      // Get configuration
      const fromEmail = this.configService.get<string>('MAILERSEND_FROM_EMAIL') || 
                       this.configService.get<string>('FROM_EMAIL') || 
                       'noreply@stdreux.com';
      const fromName = this.configService.get<string>('MAILERSEND_FROM_NAME') || 
                      this.configService.get<string>('COMPANY_NAME') || 
                      'St Dreux Coffee Roasters';

      // Prepare recipients
      const toEmails = Array.isArray(options.to) ? options.to : [options.to];
      const recipients = toEmails.map(email => new Recipient(email));

      // Prepare CC recipients if provided
      const ccRecipients: Recipient[] = [];
      if (options.cc) {
        const ccEmails = Array.isArray(options.cc) ? options.cc : [options.cc];
        ccRecipients.push(...ccEmails.map(email => new Recipient(email)));
      }

      // Prepare BCC recipients if provided
      const bccRecipients: Recipient[] = [];
      if (options.bcc) {
        const bccEmails = Array.isArray(options.bcc) ? options.bcc : [options.bcc];
        bccRecipients.push(...bccEmails.map(email => new Recipient(email)));
      }

      // Create sender
      const sentFrom = new Sender(fromEmail, fromName);

      // Create email parameters
      const emailParams = new EmailParams()
        .setFrom(sentFrom)
        .setTo(recipients)
        .setSubject(options.subject);

      // Set HTML content
      if (options.html) {
        emailParams.setHtml(options.html);
      }

      // Set text content
      if (options.text) {
        emailParams.setText(options.text);
      } else if (options.html) {
        // If no text provided but HTML exists, create a basic text version
        emailParams.setText(this.htmlToText(options.html));
      }

      // Set reply-to if provided
      if (options.replyTo) {
        emailParams.setReplyTo(new Sender(options.replyTo, fromName));
      }

      // Add CC recipients
      if (ccRecipients.length > 0) {
        emailParams.setCc(ccRecipients);
      }

      // Add BCC recipients
      if (bccRecipients.length > 0) {
        emailParams.setBcc(bccRecipients);
      }

      // Handle attachments
      if (options.attachments && options.attachments.length > 0) {
        const attachments = options.attachments.map(att => {
          let content: string;
          
          if (Buffer.isBuffer(att.content)) {
            // Convert Buffer to base64 string
            content = att.content.toString('base64');
          } else {
            // If it's already a string, assume it's base64 or convert if needed
            content = typeof att.content === 'string' ? att.content : Buffer.from(att.content).toString('base64');
          }

          // Create MailerSend Attachment instance
          return new Attachment(
            content,
            att.filename,
            'attachment', // disposition
          );
        });

        emailParams.setAttachments(attachments);
      }

      // Send email
      const response = await client.email.send(emailParams);
      
      // Extract message ID from response
      // MailerSend returns response with headers containing X-Message-Id
      const messageId = response.headers?.['x-message-id'] || 
                       response.headers?.['X-Message-Id'] ||
                       'unknown';

      this.logger.log(`Email sent successfully via MailerSend. Message ID: ${messageId}`);

      return {
        success: true,
        messageId: messageId as string,
      };
    } catch (error: any) {
      const errorMessage = error.message || error.toString() || 'Unknown error';
      this.logger.error('MailerSend email sending error:', errorMessage);
      
      // Log full error for debugging
      if (error.response) {
        this.logger.error('MailerSend API response:', JSON.stringify(error.response.data || error.response, null, 2));
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Send invoice email with PDF attachment
   */
  async sendInvoiceEmail(
    recipientEmail: string,
    orderId: number,
    pdfBuffer: Buffer,
    customMessage?: string,
    customerName?: string,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const name = customerName || 'Customer';
    const companyName = this.configService.get<string>('COMPANY_NAME') || 
                       this.configService.get<string>('MAILERSEND_FROM_NAME') || 
                       'Sendrix';
    const emailSubject = `Invoice #${orderId} - ${companyName}`;

    const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background-color: #fff; padding: 20px; }
    .header { background-color: #0d6efd; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Invoice for Order #${orderId}</h1>
    </div>
    <div class="content">
      <p>Dear ${name},</p>
      <p>Please find attached the invoice for your order #${orderId}.</p>
      ${customMessage ? `<p>${customMessage}</p>` : ''}
      <p>Thank you for your business!</p>
    </div>
    <div class="footer">
      <p>If you have any questions, please contact us.</p>
      <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

    return this.sendEmail({
      to: recipientEmail,
      subject: emailSubject,
      html: emailBody,
      attachments: [
        {
          filename: `invoice-${orderId}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
  }

  /**
   * Convert HTML to plain text (basic implementation)
   */
  private htmlToText(html: string): string {
    // Remove HTML tags and decode entities
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }
}
