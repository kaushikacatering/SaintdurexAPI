import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StoreCouponsService } from './store-coupons.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Store Coupons')
@Controller('store/coupons')
export class StoreCouponsController {
  constructor(private readonly storeCouponsService: StoreCouponsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get list of available coupons' })
  async getAvailableCoupons() {
    return this.storeCouponsService.getAvailableCoupons();
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate coupon code' })
  async validateCoupon(
    @Body() data: {
      coupon_code: string;
      order_total?: number;
    },
  ) {
    return this.storeCouponsService.validateCoupon(data);
  }
}
