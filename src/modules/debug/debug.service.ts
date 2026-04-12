import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DebugService implements OnModuleInit {
  private readonly logger = new Logger(DebugService.name);
  constructor(private dataSource: DataSource) {}
  async onModuleInit() {
    const columns = await this.dataSource.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'orders'`);
    this.logger.log('COLUMN NAMES: ' + JSON.stringify(columns.map(c => c.column_name)));
  }
}
