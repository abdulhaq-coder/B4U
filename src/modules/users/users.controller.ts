import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ageInYears, parseIsoDate } from '../../common/utils/date.util';
import { toE164 } from '../../common/utils/phone.util';
import { AuthUser } from '../auth/interfaces/jwt-payload.interface';
import { LocationsService } from '../locations/locations.service';
import { MediaService } from '../media/media.service';
import { EditProfileDto } from './dto/edit-profile.dto';
import { nextStepFor, toPublicUser } from './user.mapper';
import { UsersService } from './users.service';

@ApiTags('Users & Profile')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly locations: LocationsService,
    private readonly media: MediaService,
  ) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@CurrentUser() authUser: AuthUser) {
    const user = await this.users.findById(authUser.id);
    if (!user) throw new BadRequestException('User not found');
    return { user: toPublicUser(user), nextStep: nextStepFor(user) };
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update profile (fullName, phone, DOB, gender, city, avatar)' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfile(@CurrentUser() authUser: AuthUser, @Body() dto: EditProfileDto) {
    const user = await this.users.findById(authUser.id);
    if (!user) throw new BadRequestException('User not found');

    const updateData: Parameters<UsersService['updateProfile']>[1] = {};

    if (dto.fullName) updateData.fullName = dto.fullName;
    if (dto.gender) updateData.gender = dto.gender;

    if (dto.dateOfBirth) {
      const dob = parseIsoDate(dto.dateOfBirth);
      if (!dob) throw new BadRequestException('dateOfBirth must be a valid date (YYYY-MM-DD)');
      const age = ageInYears(dob);
      if (age < 13 || age > 100) throw new BadRequestException('Invalid date of birth');
      updateData.dateOfBirth = dob;
    }

    const country = dto.countryCode || user.countryCode || 'PK';
    if (dto.cityId) {
      const city = await this.locations.findCity(dto.cityId);
      if (!city || !city.isActive || city.countryCode !== country) {
        throw new BadRequestException('Selected city is invalid for this country');
      }
      updateData.cityId = city.id;
      updateData.countryCode = country;
    }

    if (dto.phone) {
      const phone = toE164(dto.phone, country);
      if (!phone) throw new BadRequestException('Phone number is invalid');
      updateData.phone = phone;
    }

    if (dto.avatarId !== undefined) {
      if (dto.avatarId === null) {
        updateData.avatarId = null;
      } else {
        await this.media.setAvatar(user.id, dto.avatarId);
      }
    }

    const updated = await this.users.updateProfile(user.id, updateData);
    return {
      message: 'Profile updated successfully',
      user: toPublicUser(updated),
      nextStep: nextStepFor(updated),
    };
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete account and all associated personal data (App Store & Play Store required)' })
  @ApiResponse({ status: 200, description: 'Account permanently deleted' })
  async deleteAccount(@CurrentUser() authUser: AuthUser) {
    await this.users.deleteAccount(authUser.id);
    return { message: 'Account permanently deleted' };
  }
}

