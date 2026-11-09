import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { AuthUser } from '../auth/interfaces/jwt-payload.interface';
import { AdminService } from './admin.service';
import { RejectBranchDto } from './dto/reject-branch.dto';
import { TrustBrandDto } from './dto/trust-brand.dto';

@ApiTags('Admin Salon Moderation & Approvals')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('branches/pending')
  @ApiOperation({ summary: 'List all branches awaiting admin review and verification' })
  listPending(@Query() pagination: PaginationQueryDto) {
    return this.adminService.listPendingBranches(pagination.page, pagination.limit);
  }

  @Post('branches/:branchId/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a submitted branch (and verify Brand if first approval)' })
  @ApiResponse({ status: 200, description: 'Branch approved' })
  approveBranch(
    @CurrentUser() admin: AuthUser,
    @Param('branchId', ParseUUIDPipe) branchId: string,
  ) {
    return this.adminService.approveBranch(branchId, admin.id);
  }

  @Post('branches/:branchId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a submitted branch with actionable feedback' })
  @ApiResponse({ status: 200, description: 'Branch rejected with feedback' })
  rejectBranch(
    @CurrentUser() admin: AuthUser,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: RejectBranchDto,
  ) {
    return this.adminService.rejectBranch(branchId, admin.id, dto.reason);
  }

  @Patch('brands/:brandId/trust')
  @ApiOperation({ summary: 'Mark brand as trusted (auto-approves future branches) & set branch limit' })
  setBrandTrust(
    @Param('brandId', ParseUUIDPipe) brandId: string,
    @Body() dto: TrustBrandDto,
  ) {
    return this.adminService.setBrandTrust(brandId, dto.isTrusted, dto.branchLimit);
  }
}

