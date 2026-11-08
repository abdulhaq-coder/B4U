import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ListCitiesQueryDto } from './dto/list-cities-query.dto';
import { LocationsService } from './locations.service';

@ApiTags('Locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Public()
  @Get('cities')
  @ApiOperation({ summary: 'List active cities by country code (defaults to PK)' })
  cities(@Query() query: ListCitiesQueryDto) {
    return this.locations.listCities(query.countryCode);
  }
}

