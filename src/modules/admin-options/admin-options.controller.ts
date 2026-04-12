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
import { AdminOptionsService } from './admin-options.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@ApiTags('Admin Options')
@Controller('admin/options')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminOptionsController {
  constructor(private adminOptionsService: AdminOptionsService) {}

  @Get()
  @ApiOperation({ summary: 'List all options' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  async findAll(@Query() query: any) {
    return this.adminOptionsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get option by ID' })
  @ApiParam({ name: 'id', type: Number })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.adminOptionsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new option' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        option_name: { type: 'string', example: 'Option Name' },
        option_type: { type: 'string', example: 'select' },
        option_values: { type: 'array', items: { type: 'object' } },
        required: { type: 'boolean' },
        sort_order: { type: 'number' },
      },
      required: ['option_name', 'option_type'],
    },
  })
  async create(@Body() createOptionDto: any) {
    return this.adminOptionsService.create(createOptionDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update option' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        option_name: { type: 'string' },
        option_type: { type: 'string' },
        option_values: { type: 'array', items: { type: 'object' } },
        required: { type: 'boolean' },
        sort_order: { type: 'number' },
      },
    },
  })
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateOptionDto: any) {
    return this.adminOptionsService.update(id, updateOptionDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete option' })
  @ApiParam({ name: 'id', type: Number })
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.adminOptionsService.delete(id);
    return { message: 'Option deleted successfully' };
  }
}
