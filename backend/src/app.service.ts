import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello() {
    return {
      name: 'Leadflow API',
      status: 'ok',
      version: '1.0.0',
    };
  }
}
