import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import OBR from "@owlbear-rodeo/sdk";
import { ThemeService } from "./services/theme.service";
import { ContextMenuService } from "./services/context-menu.service";
import { InitiativeListService } from "./services/initiative-list.service";
import { InitiativeItem } from "./models/intitiative-list-item";
import { InitiativeListItemComponent } from "./components/initiative-list-item.component";
import { Subscription } from "rxjs";
import { EffectListComponent } from "./components/effect-list.component";
import { slideInOutTrigger } from "./animations/roll-up-down.animation";
import { GMConfigService } from "./services/gm-config.service";
import { GMConfigComponent } from "./components/gm-config.component";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    CommonModule,
    InitiativeListItemComponent,
    EffectListComponent,
    GMConfigComponent,
  ],
  template: `
    <div class="app-container">
      <app-effect-list
        *ngIf="showEffectList"
        @slideInOut
        (onClose)="onEffectsButtonClick()"
      ></app-effect-list>
      <app-gm-config
        *ngIf="showGMConfig"
        @slideInOut
        (onClose)="onConfigButtonClick()"
      ></app-gm-config>
      <div
        class="app-placeholder"
        [style.display]="initiativeItems.length > 0 ? 'none' : 'flex'"
      >
        <span id="app-placeholder-text"
          >Schmandi's<br />Initiative Tracker</span
        >
      </div>
      <ng-container *ngIf="initiativeItems.length > 0">
        <div class="app-header">
          <span class="rounds-counter" (click)="onRoundCounterClick()"
            >Round {{ roundCounter }}</span
          >
          <div class="action-buttons">
            <span
              *ngIf="enableGMConfigButton"
              class="icon-button clear-button"
              (click)="onClearButtonClick()"
            >
              &#x26CC;
            </span>
            <span
              *ngIf="enableGMConfigButton"
              class="icon-button config-button"
              (click)="onConfigButtonClick()"
            >
              &#x2699;
            </span>
            <span
              class="icon-button effects-button"
              (click)="onEffectsButtonClick()"
              >&#x2630;</span
            >
            <span class="icon-button next-button" (click)="onNextButtonClick()"
              >&#x25B6;</span
            >
          </div>
        </div>
        <ng-container *ngFor="let item of initiativeItems">
          <app-initiative-list-item
            [item]="item"
            (initiativeChange)="onInitiativeChange(item.id, $event)"
            (displayNameClick)="onDisplayNameClick(item.id)"
          ></app-initiative-list-item>
        </ng-container>
      </ng-container>
    </div>
  `,
  styleUrls: ["./app.component.css"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [slideInOutTrigger],
})
export class AppComponent implements OnInit, OnDestroy {
  initiativeItems: Array<InitiativeItem> = [];
  roundCounter: number = 1;
  showEffectList: boolean = false;
  enableGMConfigButton: boolean = false;
  showGMConfig: boolean = false;
  private subscription = new Subscription();

  constructor(
    private initiativeListService: InitiativeListService,
    private themeService: ThemeService,
    private contextMenuService: ContextMenuService,
    private gmConfigService: GMConfigService,
    private cdRef: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    OBR.onReady(() => {
      this.contextMenuService.setup();
      this.initiativeListService.setup();
      this.gmConfigService.setup();
      OBR.theme.getTheme().then(
        (theme) => this.themeService.setTheme(theme),
        (error) => console.error(error),
      );
      OBR.theme.onChange((theme) => this.themeService.setTheme(theme));
      OBR.player
        .getRole()
        .then((role) => {
          this.enableGMConfigButton = role === "GM";
          this.cdRef.detectChanges();
        })
        .catch(() => null);
      OBR.action.setHeight(225);
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

  onDisplayNameClick(id: string): void {
    const displayNameInput = window.prompt(
      "Enter display name (Leave blank to reset):",
    );
    if (displayNameInput == null) return;
    this.initiativeListService.updateDisplayName(id, displayNameInput);
  }

  onNextButtonClick(): void {
    this.initiativeListService.iterateNext();
  }

  onRoundCounterClick(): void {
    const roundsInput = window.prompt("Enter current round:");
    if (roundsInput && parseInt(roundsInput)) {
      this.initiativeListService.setRounds(
        parseInt(roundsInput) > 0 ? parseInt(roundsInput) : 0,
      );
    }
  }

  onEffectsButtonClick(): void {
    this.showEffectList = !this.showEffectList;
    this.cdRef.detectChanges();
  }

  onClearButtonClick(): void {
    const confirmation = window.confirm(
      "Are you sure you want to reset the initiative tracking?",
    );
    if (!confirmation) return;
    this.initiativeListService.reset();
  }

  onConfigButtonClick(): void {
    this.showGMConfig = !this.showGMConfig;
    this.cdRef.detectChanges();
  }
}
