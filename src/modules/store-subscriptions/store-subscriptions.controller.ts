import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiBody, ApiQuery } from '@nestjs/swagger';
import { StoreSubscriptionsService } from './store-subscriptions.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Store Subscriptions')
@Controller('store/subscriptions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StoreSubscriptionsController {
  constructor(private readonly storeSubscriptionsService: StoreSubscriptionsService) {}

  @Get()
  @ApiOperation({ summary: "List user's subscriptions (standing orders)" })
  async listSubscriptions(@Request() req: any) {
    const userId = req.user?.user_id;
    if (!userId) {
      throw new Error('Unauthorized');
    }
    return this.storeSubscriptionsService.listSubscriptions(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single subscription details' })
  @ApiParam({ name: 'id', type: Number })
  async getSubscription(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    const userId = req.user?.user_id;
    if (!userId) {
      throw new Error('Unauthorized');
    }
    return this.storeSubscriptionsService.getSubscription(userId, id);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get subscription status summary' })
  @ApiParam({ name: 'id', type: Number })
  async getSubscriptionStatus(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    const userId = req.user?.user_id;
    if (!userId) {
      throw new Error('Unauthorized');
    }
    return this.storeSubscriptionsService.getSubscriptionStatus(userId, id);
  }

  @Get(':id/upcoming')
  @ApiOperation({ summary: 'Get upcoming deliveries for a subscription' })
  @ApiParam({ name: 'id', type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of upcoming deliveries to return (default: 10)' })
  async getUpcomingDeliveries(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user?.user_id;
    if (!userId) {
      throw new Error('Unauthorized');
    }
    return this.storeSubscriptionsService.getUpcomingDeliveries(userId, id, limit ? parseInt(limit) : 10);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update subscription (frequency, delivery time, address)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        standing_order: { type: 'number', description: 'Frequency in days (7=weekly, 14=fortnightly)' },
        delivery_date_time: { type: 'string', format: 'date-time', description: 'Next delivery date/time' },
        delivery_address: { type: 'string', description: 'Delivery address' },
        order_comments: { type: 'string', description: 'Order notes/comments' },
      },
    },
  })
  async updateSubscription(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateData: {
      standing_order?: number;
      delivery_date_time?: string;
      delivery_address?: string;
      order_comments?: string;
    },
  ) {
    const userId = req.user?.user_id;
    if (!userId) {
      throw new Error('Unauthorized');
    }
    return this.storeSubscriptionsService.updateSubscription(userId, id, updateData);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel subscription' })
  @ApiParam({ name: 'id', type: Number })
  async cancelSubscription(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    const userId = req.user?.user_id;
    if (!userId) {
      throw new Error('Unauthorized');
    }
    return this.storeSubscriptionsService.cancelSubscription(userId, id);
  }

  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause subscription temporarily' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        resume_date: { type: 'string', format: 'date', description: 'Optional date to automatically resume' },
      },
    },
  })
  async pauseSubscription(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body('resume_date') resumeDate?: string,
  ) {
    const userId = req.user?.user_id;
    if (!userId) {
      throw new Error('Unauthorized');
    }
    return this.storeSubscriptionsService.pauseSubscription(userId, id, resumeDate);
  }

  @Post(':id/resume')
  @ApiOperation({ summary: 'Resume/reactivate a paused or cancelled subscription' })
  @ApiParam({ name: 'id', type: Number })
  async resumeSubscription(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    const userId = req.user?.user_id;
    if (!userId) {
      throw new Error('Unauthorized');
    }
    return this.storeSubscriptionsService.resumeSubscription(userId, id);
  }

  @Post(':id/skip')
  @ApiOperation({ summary: 'Skip a specific delivery date' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['delivery_date'],
      properties: {
        delivery_date: { type: 'string', format: 'date', description: 'Date to skip (YYYY-MM-DD)' },
      },
    },
  })
  async skipDelivery(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body('delivery_date') deliveryDate: string,
  ) {
    const userId = req.user?.user_id;
    if (!userId) {
      throw new Error('Unauthorized');
    }
    return this.storeSubscriptionsService.skipDelivery(userId, id, deliveryDate);
  }
}
