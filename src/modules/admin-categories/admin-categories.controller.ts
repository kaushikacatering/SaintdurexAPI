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
import { AdminCategoriesService } from './admin-categories.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@ApiTags('Admin Categories')
@Controller('admin/categories')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminCategoriesController {
  constructor(private adminCategoriesService: AdminCategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'List all categories' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  async findAll(@Query() query: any) {
    return this.adminCategoriesService.findAll(query);
  }

  @Put('reorder')
  @ApiOperation({ summary: 'Reorder categories' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        categoryIds: {
          type: 'array',
          items: { type: 'number' },
          example: [5, 2, 8, 1, 3],
          description: 'Array of category IDs in desired order',
        },
      },
      required: ['categoryIds'],
    },
  })
  async reorder(@Body() body: { categoryIds: number[] }) {
    return this.adminCategoriesService.reorder(body.categoryIds);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get category by ID' })
  @ApiParam({ name: 'id', type: Number })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.adminCategoriesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new category' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        category_name: { type: 'string', example: 'Category Name' },
        category_description: { type: 'string' },
        parent_id: { type: 'number' },
        status: { type: 'number', example: 1 },
        sort_order: { type: 'number' },
      },
      required: ['category_name'],
    },
  })
  async create(@Body() createCategoryDto: any) {
    return this.adminCategoriesService.create(createCategoryDto);
  }


  @Put(':id')
  @ApiOperation({ summary: 'Update category' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        category_name: { type: 'string' },
        category_description: { type: 'string' },
        parent_id: { type: 'number' },
        status: { type: 'number' },
        sort_order: { type: 'number' },
      },
    },
  })
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateCategoryDto: any) {
    return this.adminCategoriesService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete category' })
  @ApiParam({ name: 'id', type: Number })
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.adminCategoriesService.delete(id);
    return { message: 'Category deleted successfully' };
  }
}
