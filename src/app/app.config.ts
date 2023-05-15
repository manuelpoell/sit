import { ApplicationConfig } from '@angular/core';
import { ThemeService } from './services/theme.service';
import { ContextMenuService } from './services/context-menu.service';
import { InitiativeListService } from './services/initiative-list.service';

export const appConfig: ApplicationConfig = {
  providers: [ThemeService, ContextMenuService, InitiativeListService],
};
