import { Module } from '@nestjs/common';
import { ConfigModule } from '../../config/config.module';
import { AdminXeroController } from './admin-xero.controller';
import { AdminXeroService } from './admin-xero.service';

@Module({
  imports: [ConfigModule],
  controllers: [AdminXeroController],
  providers: [AdminXeroService],
  exports: [AdminXeroService],
})
export class AdminXeroModule {}
