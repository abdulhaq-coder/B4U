import { Module } from '@nestjs/common';
import { LocationsModule } from '../locations/locations.module';
import { MediaModule } from '../media/media.module';
import { OwnerController } from './owner.controller';
import { OwnerService } from './owner.service';

@Module({
  imports: [LocationsModule, MediaModule],
  controllers: [OwnerController],
  providers: [OwnerService],
  exports: [OwnerService],
})
export class OwnerModule {}

