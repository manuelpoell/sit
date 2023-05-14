import { Injectable } from '@angular/core';
import { Theme } from '@owlbear-rodeo/sdk';

@Injectable()
export class ThemeService {
  constructor() {}

  setTheme(theme: Theme): void {
    document.body.style.color = theme.text.primary;
  }
}
