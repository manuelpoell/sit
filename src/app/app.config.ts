import { ApplicationConfig } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { ThemeService } from './services/theme.service';
import { ContextMenuService } from './services/context-menu.service';
import { InitiativeListService } from './services/initiative-list.service';
import { EffectListService } from './services/effect-list.service';

export const appConfig: ApplicationConfig = {
  providers: [ThemeService, ContextMenuService, InitiativeListService, EffectListService, provideAnimations()],
};
