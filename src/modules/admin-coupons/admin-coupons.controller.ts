import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam, ApiBody } from '@nestjs/swagger';
import { AdminCouponsService } from './admin-coupons.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@ApiTags('Admin Coupons')
@Controller('admin/coupons')
export class AdminCouponsController {
  constructor(private adminCouponsService: AdminCouponsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all coupons' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  async findAll(@Query() query: any) {
    return this.adminCouponsService.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get coupon by ID' })
  @ApiParam({ name: 'id', type: Number })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.adminCouponsService.findOne(id);
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate coupon code (public)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'DISCOUNT10' },
      },
      required: ['code'],
    },
  })
  async validateCoupon(@Body() body: { code: string }) {
    return this.adminCouponsService.validateCoupon(body.code);
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create new coupon' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'DISCOUNT10' },
        discount_type: { type: 'string', example: 'percentage' },
        discount_value: { type: 'number', example: 10 },
        min_purchase: { type: 'number' },
        max_discount: { type: 'number' },
        valid_from: { type: 'string' },
        valid_to: { type: 'string' },
        usage_limit: { type: 'number' },
        status: { type: 'number', example: 1 },
      },
      required: ['code', 'discount_type', 'discount_value'],
    },
  })
  async create(@Body() createCouponDto: any) {
    return this.adminCouponsService.create(createCouponDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update coupon' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        discount_type: { type: 'string' },
        discount_value: { type: 'number' },
        min_purchase: { type: 'number' },
        max_discount: { type: 'number' },
        valid_from: { type: 'string' },
        valid_to: { type: 'string' },
        usage_limit: { type: 'number' },
        status: { type: 'number' },
      },
    },
  })
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateCouponDto: any) {
    return this.adminCouponsService.update(id, updateCouponDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete coupon' })
  @ApiParam({ name: 'id', type: Number })
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.adminCouponsService.delete(id);
    return { message: 'Coupon deleted successfully' };
  }
}
