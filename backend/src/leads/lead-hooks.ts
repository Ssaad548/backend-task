import { Injectable } from '@nestjs/common';

@Injectable()
export class FollowUpScheduler {
  schedule(_leadId: string, _tenantId: string): void {}

  cancel(_leadId: string): void {}
}
