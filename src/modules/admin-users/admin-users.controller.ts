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
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam, ApiBody } from '@nestjs/swagger';
import { AdminUsersService } from './admin-users.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@ApiTags('Admin Users')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminUsersController {
  constructor(private adminUsersService: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'List all users' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'auth_level', required: false, type: Number })
  async findAll(@Query() query: any, @Request() req: any) {
    const currentUserLevel = req.user?.auth_level;
    return this.adminUsersService.findAll(query, currentUserLevel);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', type: Number })
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    const currentUserLevel = req.user?.auth_level;
    return this.adminUsersService.findOne(id, currentUserLevel);
  }

  @Post()
  @ApiOperation({ summary: 'Create new user' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'user@example.com' },
        username: { type: 'string', example: 'username' },
        password: { type: 'string', example: 'password123' },
        firstname: { type: 'string', example: 'John' },
        lastname: { type: 'string', example: 'Doe' },
        auth_level: { type: 'number', example: 3 },
        role_id: { type: 'number' },
        telephone: { type: 'string' },
      },
      required: ['email', 'username', 'password'],
    },
  })
  async create(@Body() createUserDto: any, @Request() req: any) {
    const currentUserLevel = req.user?.auth_level;
    return this.adminUsersService.create(createUserDto, currentUserLevel);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update user' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        username: { type: 'string' },
        password: { type: 'string' },
        firstname: { type: 'string' },
        lastname: { type: 'string' },
        auth_level: { type: 'number' },
        role_id: { type: 'number' },
        telephone: { type: 'string' },
      },
    },
  })
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateUserDto: any, @Request() req: any) {
    const currentUserLevel = req.user?.auth_level;
    return this.adminUsersService.update(id, updateUserDto, currentUserLevel);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user' })
  @ApiParam({ name: 'id', type: Number })
  async delete(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    const currentUserId = req.user?.user_id;
    const currentUserLevel = req.user?.auth_level;
    await this.adminUsersService.delete(id, currentUserId, currentUserLevel);
    return { message: 'User deleted successfully' };
  }
}
