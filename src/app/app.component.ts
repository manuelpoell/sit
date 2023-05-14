import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import OBR from '@owlbear-rodeo/sdk';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  constructor(private themeService: ThemeService) {}

  ngOnInit(): void {
    OBR.onReady(() => {
      OBR.theme.getTheme().then(
        (theme) => this.themeService.setTheme(theme),
        (error) => console.error(error)
      );
      OBR.theme.onChange((theme) => this.themeService.setTheme(theme));
    });
  }
}
