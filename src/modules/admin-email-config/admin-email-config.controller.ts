import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { AdminEmailConfigService } from './admin-email-config.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';


@ApiTags('Admin Email Configuration')
@Controller('admin/email-config')

@ApiBearerAuth()
export class AdminEmailConfigController {
  constructor(private readonly adminEmailConfigService: AdminEmailConfigService) { }

  @Get('configurations')
  @ApiOperation({ summary: 'Get all email configurations' })
  async getConfigurations() {
    return this.adminEmailConfigService.getConfigurations();
  }

  @Put('configurations/:key')
  @ApiOperation({ summary: 'Update email configuration' })
  @ApiParam({ name: 'key', type: String })
  async updateConfiguration(
    @Param('key') key: string,
    @Body() body: { config_value: string; description?: string },
  ) {
    return this.adminEmailConfigService.updateConfiguration(key, body.config_value, body.description);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Get all email templates' })
  async getTemplates() {
    return this.adminEmailConfigService.getTemplates();
  }

  @Get('templates/:key')
  @ApiOperation({ summary: 'Get single email template' })
  @ApiParam({ name: 'key', type: String })
  async getTemplate(@Param('key') key: string) {
    return this.adminEmailConfigService.getTemplate(key);
  }

  @Put('templates/:key')
  @ApiOperation({ summary: 'Update email template' })
  @ApiParam({ name: 'key', type: String })
  async updateTemplate(
    @Param('key') key: string,
    @Body() body: {
      template_name?: string;
      subject?: string;
      body_html?: string;
      body_text?: string;
      variables?: any;
      is_active?: boolean;
    },
  ) {
    return this.adminEmailConfigService.updateTemplate(key, body);
  }

  @Post('templates/upsert')
  @ApiOperation({ summary: 'Upsert multiple email templates' })
  async upsertTemplates(
    @Body() body: Array<{
      template_key: string;
      template_name?: string;
      subject?: string;
      body_html?: string;
      body_text?: string;
      variables?: any;
      is_active?: boolean;
    }>
  ) {
    return this.adminEmailConfigService.upsertTemplates(body);
  }

  @Post('templates/seed-stdreux')
  @ApiOperation({ summary: 'Seed St Dreux default templates (registration, reset, subscription, wholesale)' })
  async seedStdreuxDefaults() {
    const companyName = 'St Dreux Coffee';
    const templates = [
      {
        template_key: 'customer_registration',
        template_name: 'Customer Registration',
        subject: 'Welcome to St Dreux Coffee – Your Account is Ready',
        variables: { customer_name: '', login_link: '', contact_number: '', contact_email: '', company_name: companyName },
        body_html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background-color: #fff; padding: 20px; }
    .header { background-color: #2952E6; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    a.link { color: #000; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{company_name}}</h1>
    </div>
    <div class="content">
      <p>Dear {{customer_name}},</p>
      <p>Welcome to {{company_name}}.</p>
      <p>Your retailer account has been successfully created. You can now sign in to browse products, place orders, and manage your account anytime.</p>
      <p>Login here: <a href="{{login_link}}" class="link">Login Link</a></p>
      <p>If you have any questions, please contact us at {{contact_number}} {{contact_email}}.</p>
      <p>Kind regards,<br/>{{company_name}} Team</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} {{company_name}}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
        `,
      },
      {
        template_key: '',
        template_name: 'Forgot Password',
        subject: 'Reset Your Password - St Dreux Coffee',
        variables: { customer_name: '', reset_link: '', contact_number: '', contact_email: '', company_name: companyName },
        body_html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background-color: #fff; padding: 20px; }
    .header { background-color: #2952E6; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    a.link { color: #000; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Reset Your Password</h1>
    </div>
    <div class="content">
      <p>Dear {{customer_name}},</p>
      <p>We received a request to reset the password for your {{company_name}} account.</p>
      <p>To reset your password, please click the link below:</p>
      <p><a href="{{reset_link}}" class="link">Reset Password</a></p>
      <p>If you did not request a password reset, please disregard this email.</p>
      <p>If you have any questions, please contact us at {{contact_number}} or {{contact_email}}.</p>
      <p>Kind regards,<br/>{{company_name}} Team</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} {{company_name}}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
        `,
      },
      {
        template_key: 'subscription_cancelled',
        template_name: 'Subscription Cancelled',
        subject: 'Subscription Cancelled – St Dreux Coffee',
        variables: { customer_name: '', login_link: '', contact_number: '', contact_email: '', company_name: companyName },
        body_html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background-color: #fff; padding: 20px; }
    .header { background-color: #2952E6; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    a.link { color: #000; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{company_name}}</h1>
    </div>
    <div class="content">
      <p>Dear {{customer_name}},</p>
      <p>This email confirms that your subscription has been cancelled.</p>
      <p>You will continue to have access to your account until the end of your current subscription period.</p>
      <p>If you wish to reactivate your subscription, please contact our admin team on {{contact_number}}.</p>
      <p>Login here to manage your account: <a href="{{login_link}}" class="link">Login Link</a></p>
      <p>If you have any questions, please contact us at {{contact_number}} or {{contact_email}}.</p>
      <p>Kind regards,<br/>{{company_name}} Team</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} {{company_name}}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
        `,
      },
      {
        template_key: 'wholesale_registration',
        template_name: 'Wholesale Registration (Pending)',
        subject: 'Welcome to St Dreux Coffee – Wholesale Account Pending Approval',
        variables: { customer_name: '', status: '', approved: false, company_name: companyName },
        body_html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background-color: #fff; padding: 20px; }
    .header { background-color: #2952E6; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{company_name}}</h1>
    </div>
    <div class="content">
      <p>Dear {{customer_name}},</p>
      <p>Welcome to {{company_name}}.</p>
      <p>Your wholesale account has been successfully created and is currently pending approval by the store manager.</p>
      <p>You will be notified once your account has been approved.</p>
      <p>If you have any questions, please contact us.</p>
      <p>Kind regards,<br/>{{company_name}} Team</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} {{company_name}}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
        `,
      },
      {
        template_key: 'wholesale_premium_pending',
        template_name: 'Wholesale Premium Pending Approval',
        subject: 'Welcome to St Dreux Coffee – Wholesale Premium Account Pending Approval',
        variables: { customer_name: '', contact_number: '', contact_email: '', company_name: companyName },
        body_html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background-color: #fff; padding: 20px; }
    .header { background-color: #2952E6; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{company_name}}</h1>
    </div>
    <div class="content">
      <p>Dear {{customer_name}}</p>
      <p>Welcome to {{company_name}}.</p>
      <p>Your Wholesale Premium account has been successfully created and is currently pending approval by the store manager. Once your account is approved, you will be able to log in, access premium wholesale pricing, and place orders online.</p>
      <p>You will be notified once your account has been approved.</p>
      <p>If you have any questions, please contact us at {{contact_number}} or {{contact_email}}</p>
      <p>Kind regards,<br/>{{company_name}} Team</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} {{company_name}}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
        `,
      },
      {
        template_key: 'wholesale_essential_pending',
        template_name: 'Wholesale Essential Pending Approval',
        subject: 'Welcome to St Dreux Coffee – Wholesale Essential Account Pending Approval',
        variables: { customer_name: '', contact_number: '', contact_email: '', company_name: companyName },
        body_html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background-color: #fff; padding: 20px; }
    .header { background-color: #2952E6; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{company_name}}</h1>
    </div>
    <div class="content">
      <p>Dear {{customer_name}},</p>
      <p>Welcome to {{company_name}}.</p>
      <p>Your **Wholesale Essential** account has been successfully created and is currently pending approval by the store manager. Once your account is approved, you will be able to log in, access wholesale pricing, and place orders online.</p>
      <p>You will be notified once your account has been approved.</p>
      <p>If you have any questions, please contact us at {{contact_number}} or {{contact_email}}.</p>
      <p>Kind regards,<br/>{{company_name}} Team</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} {{company_name}}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
        `,
      },
      {
        template_key: 'wholesale_essential_approved',
        template_name: 'Wholesale Essential Approved',
        subject: 'Your Wholesale Essential Account Has Been Approved – St Dreux Coffee',
        variables: { customer_name: '', login_link: '', contact_number: '', contact_email: '', company_name: companyName },
        body_html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background-color: #fff; padding: 20px; }
    .header { background-color: #2952E6; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    a.link { color: #000; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{company_name}}</h1>
    </div>
    <div class="content">
      <p>Dear {{customer_name}},</p>
      <p>We’re pleased to let you know that your **Wholesale Essential** account has been approved by the store manager.</p>
      <p>You can now log in to your {{company_name}} account, access wholesale pricing, and place orders online.</p>
      <p>Login here: <a href="{{login_link}}" class="link">Login Link</a></p>
      <p>If you have any questions, please contact us at {{contact_number}} or {{contact_email}}.</p>
      <p>Kind regards,<br/>{{company_name}} Team</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} {{company_name}}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
        `,
      },
      {
        template_key: 'wholesale_premium_approved',
        template_name: 'Wholesale Premium Approved',
        subject: 'Your Wholesale Premium Account Has Been Approved – St Dreux Coffee',
        variables: { customer_name: '', login_link: '', contact_number: '', contact_email: '', company_name: companyName },
        body_html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background-color: #fff; padding: 20px; }
    .header { background-color: #2952E6; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    a.link { color: #000; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{company_name}}</h1>
    </div>
    <div class="content">
      <p>Dear {{customer_name}},</p>
      <p>We’re pleased to let you know that your **Wholesale Premium** account has been approved by the store manager.</p>
      <p>You can now log in to your {{company_name}} account, access premium wholesale pricing, and place orders online.</p>
      <p>Login here: <a href="{{login_link}}" class="link">Login Link</a></p>
      <p>If you have any questions, please contact us at {{contact_number}} or {{contact_email}}.</p>
      <p>Kind regards,<br/>{{company_name}} Team</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} {{company_name}}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
        `,
      },
      {
        template_key: 'order_payment_received',
        template_name: 'Order Payment Received',
        subject: 'Payment Received – Order #{{order_number}} – St Dreux Coffee',
        variables: {
          customer_name: '',
          order_number: '',
          invoice_number: '',
          amount_paid: '',
          company_name: companyName,
        },
        body_html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background-color: #fff; padding: 20px; }
    .header { background-color: #2952E6; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{company_name}}</h1>
    </div>
    <div class="content">
      <p>Dear {{customer_name}},</p>
      <p>Thank you for your payment.</p>
      <p>This email confirms that payment has been successfully received for your order. Your **tax invoice number** is attached to this email for your records.</p>
      <p>Order number: {{order_number}}<br/>Invoice number: {{invoice_number}}<br/>Payment amount: {{amount_paid}}</p>
      <p>If you have any questions, please contact us at {{contact_number}} or {{contact_email}}.</p>
      <p>Kind regards,<br/>{{company_name}} Team</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} {{company_name}}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
        `,
      },
      {
        template_key: 'wholesale_premium_order_received',
        template_name: 'Wholesale Premium Order Received (No Payment)',
        subject: 'Order Received – Order #{{order_number}} – St Dreux Coffee',
        variables: { customer_name: '', order_number: '', order_date: '', company_name: companyName, contact_number: '', contact_email: '' },
        body_html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background-color: #fff; padding: 20px; }
    .header { background-color: #000; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{company_name}}</h1>
    </div>
    <div class="content">
      <p>Dear {{customer_name}},</p>
      <p>Thank you for placing your order with St Dreux Coffee.</p>
      <p>This email confirms that your <strong>Wholesale Premium</strong> order has been successfully received and is currently being reviewed by our team.</p>
      <p>Order number: {{order_number}} — Wholesale Premium<br/>Order date: {{order_date}}</p>
      <p>You will be notified once your order has been processed and is ready for dispatch or collection.</p>
      <p>If you have any questions regarding your order, please contact us at {{contact_number}} or {{contact_email}}.</p>
      <p>Kind regards,<br/>St Dreux Coffee Team</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} {{company_name}}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
        `,
      },
      {
        template_key: 'wholesale_essential_order_received',
        template_name: 'Wholesale Essential Order Received (No Payment)',
        subject: 'Order Received – Order #{{order_number}} – St Dreux Coffee',
        variables: { customer_name: '', order_number: '', order_date: '', company_name: companyName, contact_number: '', contact_email: '' },
        body_html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background-color: #fff; padding: 20px; }
    .header { background-color: #000; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{company_name}}</h1>
    </div>
    <div class="content">
      <p>Dear {{customer_name}},</p>
      <p>Thank you for placing your order with St Dreux Coffee.</p>
      <p>This email confirms that your <strong>Wholesale Essential</strong> order has been successfully received and is currently being reviewed by our team.</p>
      <p>Order number: {{order_number}} — Wholesale Essential<br/>Order date: {{order_date}}</p>
      <p>You will be notified once your order has been processed and is ready for dispatch or collection.</p>
      <p>If you have any questions regarding your order, please contact us at {{contact_number}} or {{contact_email}}.</p>
      <p>Kind regards,<br/>St Dreux Coffee Team</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} {{company_name}}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
        `,
      },
      {
        template_key: 'retailer_order_received',
        template_name: 'Retailer Order Received (No Payment)',
        subject: 'Order Received – Order #{{order_number}} – St Dreux Coffee',
        variables: { customer_name: '', order_number: '', order_date: '', company_name: companyName, contact_number: '', contact_email: '' },
        body_html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background-color: #fff; padding: 20px; }
    .header { background-color: #000; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{company_name}}</h1>
    </div>
    <div class="content">
      <p>Dear {{customer_name}},</p>
      <p>Thank you for placing your order with St Dreux Coffee.</p>
      <p>This email confirms that your <strong>Retailer</strong> order has been successfully received and is currently being reviewed by our team.</p>
      <p>Order number: {{order_number}} — Retailer<br/>Order date: {{order_date}}</p>
      <p>You will be notified once your order has been processed and is ready for dispatch or collection.</p>
      <p>If you have any questions regarding your order, please contact us at {{contact_number}} or {{contact_email}}.</p>
      <p>Kind regards,<br/>St Dreux Coffee Team</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} {{company_name}}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
        `,
      },
    ];
    return this.adminEmailConfigService.upsertTemplates(templates);
  }
  @Get('logs')
  @ApiOperation({ summary: 'Get email logs' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'templateKey', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'recipientEmail', required: false, type: String })
  async getEmailLogs(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('templateKey') templateKey?: string,
    @Query('status') status?: string,
    @Query('recipientEmail') recipientEmail?: string,
  ) {
    return this.adminEmailConfigService.getEmailLogs(
      limit ? parseInt(limit) : 50,
      offset ? parseInt(offset) : 0,
      { templateKey, status, recipientEmail },
    );
  }

  @Post('test')
  @ApiOperation({ summary: 'Test email configuration' })
  async testEmailConfiguration(@Body() body: { recipient_email: string }) {
    return this.adminEmailConfigService.testEmailConfiguration(body.recipient_email);
  }
}

