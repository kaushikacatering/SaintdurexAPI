import { Module } from '@nestjs/common';
import { AdminSubscriptionsController } from './admin-subscriptions.controller';
import { AdminSubscriptionsService } from './admin-subscriptions.service';
import { SubscriptionSchedulerService } from './subscription-scheduler.service';
import { SubscriptionCronService } from './subscription-cron.service';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [AdminSubscriptionsController],
  providers: [AdminSubscriptionsService, SubscriptionSchedulerService, SubscriptionCronService],
  exports: [AdminSubscriptionsService, SubscriptionSchedulerService],
})
export class AdminSubscriptionsModule {}