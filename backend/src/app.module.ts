import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ActivityModule } from './activity/activity.module';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';
import { LeadsModule } from './leads/leads.module';
import { PrismaModule } from './prisma/prisma.module';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
      validate: (config: Record<string, unknown>) => {
        const required = ['DATABASE_URL', 'JWT_SECRET'];
        const missing = required.filter((key) => !config[key]);

        if (missing.length > 0) {
          throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
        }

        return config;
      },
    }),
    PrismaModule,
    AuthModule,
    EventsModule,
    ActivityModule,
    LeadsModule,
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    
    
    // ObserveModule.forRoot({
    //   appKey: 'process.env.OBSERVE_APP_KEY',
    //   appSecret: 'process.env.OBSERVE_APP_SECRET',
    //   serviceId: 'backend',
    // }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
