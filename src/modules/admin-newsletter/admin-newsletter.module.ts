import { Module } from '@nestjs/common';
import { AdminNewsletterController } from './admin-newsletter.controller';
import { AdminNewsletterService } from './admin-newsletter.service';

@Module({
    controllers: [AdminNewsletterController],
    providers: [AdminNewsletterService],
    exports: [AdminNewsletterService],
})
export class AdminNewsletterModule { }
