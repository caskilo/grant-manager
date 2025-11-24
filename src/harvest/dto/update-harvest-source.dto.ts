import { PartialType } from '@nestjs/mapped-types';
import { CreateHarvestSourceDto } from './create-harvest-source.dto';

export class UpdateHarvestSourceDto extends PartialType(CreateHarvestSourceDto) {}
