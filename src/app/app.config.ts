import { ApplicationConfig } from '@angular/core';
import { ThemeService } from './services/theme.service';

export const appConfig: ApplicationConfig = {
  providers: [ThemeService],
};
