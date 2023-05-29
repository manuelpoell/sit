import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import OBR from '@owlbear-rodeo/sdk';
import { ThemeService } from './services/theme.service';
import { ContextMenuService } from './services/context-menu.service';
import { InitiativeListService } from './services/initiative-list.service';
import { InitiativeItem } from './models/intitiative-list-item';
import { InitiativeListItemComponent } from './components/initiative-list-item.component';
import { Subscription } from 'rxjs';
import { EffectListComponent } from './components/effect-list.component';
import { slideInOutTrigger } from './animations/roll-up-down.animation';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, InitiativeListItemComponent, EffectListComponent],
  template: `
    <div class="app-container">
      <app-effect-list *ngIf="showEffectList" @slideInOut (onClose)="onEffectsButtonClick()"></app-effect-list>
      <div class="app-placeholder" [style.display]="initiativeItems.length > 0 ? 'none' : 'flex'">
        <span id="app-placeholder-text">Schmandi's<br />Initiative Tracker</span>
      </div>
      <ng-container *ngIf="initiativeItems.length > 0">
        <div class="app-header">
          <span class="rounds-counter" (click)="onRoundCounterClick()">Round {{ roundCounter }}</span>
          <div class="action-buttons">
            <span class="effects-button" (click)="onEffectsButtonClick()">&#x2630;</span>
            <span class="next-button" (click)="onNextButtonClick()">&#x25B6;</span>
          </div>
        </div>
        <ng-container *ngFor="let item of initiativeItems">
          <app-initiative-list-item
            [item]="item"
            (initiativeChange)="onInitiativeChange(item.id, $event)"
          ></app-initiative-list-item>
        </ng-container>
      </ng-container>
    </div>
  `,
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [slideInOutTrigger],
})
export class AppComponent implements OnInit, OnDestroy {
  initiativeItems: Array<InitiativeItem> = [];
  roundCounter: number = 1;
  showEffectList: boolean = false;
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
    let s = this.initiativeListService.initiativeItems$.subscribe((items) => {
      this.initiativeItems = [...items];
      this.cdRef.detectChanges();
    });
    this.subscription.add(s);

    s = this.initiativeListService.currentRound$.subscribe((round) => {
      this.roundCounter = round;
      this.cdRef.detectChanges();
    });
    this.subscription.add(s);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  onInitiativeChange(id: string, initiative: number): void {
    this.initiativeListService.updateInitiative(id, initiative);
  }

  onNextButtonClick(): void {
    this.initiativeListService.iterateNext();
  }

  onRoundCounterClick(): void {
    const roundsInput = window.prompt('Enter current round:');
    if (roundsInput && parseInt(roundsInput)) {
      this.initiativeListService.setRounds(parseInt(roundsInput) > 0 ? parseInt(roundsInput) : 0);
    }
  }

  onEffectsButtonClick(): void {
    this.showEffectList = !this.showEffectList;
    this.cdRef.detectChanges();
  }
}
