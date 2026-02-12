import { Module } from '@nestjs/common';
import { MockSecretsManagerService } from './secrets.manager.service';

@Module({
  providers: [
    {
      provide: 'SecretsManager',
      useClass: MockSecretsManagerService,
    },
  ],
  exports: ['SecretsManager'],
})
export class ServiceModule {}
