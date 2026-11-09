import { Module } from '@nestjs/common';
import { LocationsModule } from '../locations/locations.module';
import { MediaModule } from '../media/media.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [LocationsModule, MediaModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
