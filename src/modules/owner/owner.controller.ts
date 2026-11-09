import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../auth/interfaces/jwt-payload.interface';
import { CreateBranchDto } from './dto/create-branch.dto';
import { Step1OnboardingDto } from './dto/step1-onboarding.dto';
import { Step3HoursDto } from './dto/step3-hours.dto';
import { OwnerService } from './owner.service';

@ApiTags('Owner Onboarding & Branch Management')
@ApiBearerAuth()
@Roles(Role.OWNER)
@Controller('owner')
export class OwnerController {
  constructor(private readonly ownerService: OwnerService) {}

  @Get('onboarding')
  @ApiOperation({ summary: 'Get current salon onboarding progress and active branch' })
  getOnboardingState(@CurrentUser() user: AuthUser) {
    return this.ownerService.getOnboardingState(user.id);
  }

  @Post('onboarding/step1')
  @ApiOperation({ summary: 'Step 1: Save Brand details + First Branch + 1 to 3 Images' })
  @ApiResponse({ status: 201, description: 'Step 1 saved, proceed to Step 3 Operating Hours' })
  saveStep1(@CurrentUser() user: AuthUser, @Body() dto: Step1OnboardingDto) {
    return this.ownerService.saveStep1(user.id, dto);
  }

  @Post('branches/:branchId/hours')
  @ApiOperation({ summary: 'Step 3: Save branch operating hours and open days' })
  saveHours(
    @CurrentUser() user: AuthUser,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: Step3HoursDto,
  ) {
    return this.ownerService.saveStep3Hours(user.id, branchId, dto);
  }

  @Post('branches/:branchId/submit')
  @ApiOperation({ summary: 'Submit branch for Admin approval (or auto-approves if Brand is trusted)' })
  submitBranch(@CurrentUser() user: AuthUser, @Param('branchId', ParseUUIDPipe) branchId: string) {
    return this.ownerService.submitForApproval(user.id, branchId);
  }

  @Post('branches')
  @ApiOperation({ summary: 'Create an additional branch under existing Brand' })
  createBranch(@CurrentUser() user: AuthUser, @Body() dto: CreateBranchDto) {
    return this.ownerService.createBranch(user.id, dto);
  }

  @Get('branches')
  @ApiOperation({ summary: 'List all branches belonging to current salon owner' })
  listBranches(@CurrentUser() user: AuthUser) {
    return this.ownerService.listBranches(user.id);
  }

  @Get('branches/:branchId')
  @ApiOperation({ summary: 'Get details, hours, and status history of a specific branch' })
  getBranch(@CurrentUser() user: AuthUser, @Param('branchId', ParseUUIDPipe) branchId: string) {
    return this.ownerService.getBranch(user.id, branchId);
  }
}

