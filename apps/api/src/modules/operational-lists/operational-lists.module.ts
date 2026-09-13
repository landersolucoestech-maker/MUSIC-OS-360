import { Module } from '@nestjs/common';
import { OperationalListsController } from './operational-lists.controller';
import { OperationalListsService } from './operational-lists.service';

@Module({
  controllers: [OperationalListsController],
  providers: [OperationalListsService],
  exports: [OperationalListsService],
})
export class OperationalListsModule {}
