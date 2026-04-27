import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailService } from './services/email.service';
import { NotificationService } from './services/notification.service';
import { FileStorageService } from './services/file-storage.service';
import { InvoiceService } from './services/invoice.service';
import { StripeService } from './services/stripe.service';
import { PricingService } from './services/pricing.service';
import { Order } from '../entities/Order';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Order])],
  providers: [EmailService, NotificationService, FileStorageService, InvoiceService, StripeService, PricingService],
  exports: [EmailService, NotificationService, FileStorageService, InvoiceService, StripeService, PricingService],
})
export class CommonModule {}

