import { Module } from '@nestjs/common';
import { StorePaymentController } from './store-payment.controller';
import { StorePaymentService } from './store-payment.service';
import { CommonModule } from '../../common/common.module';
import { AdminXeroModule } from '../admin-xero/admin-xero.module';

@Module({
  imports: [CommonModule, AdminXeroModule],
  controllers: [StorePaymentController],
  providers: [StorePaymentService],
  exports: [StorePaymentService],
})
export class StorePaymentModule {}
