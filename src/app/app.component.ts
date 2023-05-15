import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import OBR from '@owlbear-rodeo/sdk';
import { ThemeService } from './services/theme.service';
import { ContextMenuService } from './services/context-menu.service';
import { InitiativeListService } from './services/initiative-list.service';
import { InitiativeItem } from './models/intitiative-list-item';
import { InitiativeListItemComponent } from './components/initiative-list-item.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, InitiativeListItemComponent],
  template: `
    <ng-container *ngFor="let item of initiativeItems">
      <app-initiative-list-item [item]="item"></app-initiative-list-item>
    </ng-container>
  `,
  styles: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, OnDestroy {
  initiativeItems: Array<InitiativeItem> = [];
  private subscription = new Subscription();

  constructor(
    private initiativeListService: InitiativeListService,
    private themeService: ThemeService,
    private contextMenuService: ContextMenuService,
    private cdRef: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    OBR.onReady(() => {
      this.contextMenuService.setup();
      this.initiativeListService.setup();
      OBR.theme.getTheme().then(
        (theme) => this.themeService.setTheme(theme),
        (error) => console.error(error)
      );
      OBR.theme.onChange((theme) => this.themeService.setTheme(theme));
    });

    // subscribe manually because async pipe does not work somehow
    const s = this.initiativeListService.initiativeItems$.subscribe((v) => {
      this.initiativeItems = [...v];
      this.cdRef.detectChanges();
    });
    this.subscription.add(s);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
