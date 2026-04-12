import { Controller, Get, Param, Put, Delete, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { AdminNewsletterService } from './admin-newsletter.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@ApiTags('Admin Newsletter')
@Controller('admin/newsletter')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminNewsletterController {
    constructor(private readonly adminNewsletterService: AdminNewsletterService) { }

    @Get()
    @ApiOperation({ summary: 'Get all newsletter subscriptions' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'search', required: false, type: String })
    @ApiQuery({ name: 'status', required: false, type: String })
    async findAll(
        @Query('page') page = '1',
        @Query('limit') limit = '10',
        @Query('search') search = '',
        @Query('status') status = '',
    ) {
        return this.adminNewsletterService.findAll({
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            search,
            status,
        });
    }

    @Put(':id/unsubscribe')
    @ApiOperation({ summary: 'Unsubscribe a user from newsletter' })
    @ApiParam({ name: 'id', type: Number })
    async unsubscribe(@Param('id', ParseIntPipe) id: number) {
        return this.adminNewsletterService.unsubscribe(id);
    }

    @Put(':id/reactivate')
    @ApiOperation({ summary: 'Reactivate a user subscription to newsletter' })
    @ApiParam({ name: 'id', type: Number })
    async reactivate(@Param('id', ParseIntPipe) id: number) {
        return this.adminNewsletterService.reactivate(id);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a newsletter subscription' })
    @ApiParam({ name: 'id', type: Number })
    async remove(@Param('id', ParseIntPipe) id: number) {
        return this.adminNewsletterService.delete(id);
    }
}
