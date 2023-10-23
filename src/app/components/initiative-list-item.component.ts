import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InitiativeItem } from 'src/app/models/intitiative-list-item';
import { GMConfigService } from '../services/gm-config.service';

@Component({
  selector: 'app-initiative-list-item',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="list-item" [class.active]="item.active">
      <span (click)="onDisplayNameClick()">{{ getDisplayName() }}</span>
      <input type="number" [value]="item.initiative" (change)="updateInitiative($event)" />
    </div>
  `,
  styleUrls: ['./initiative-list-item.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InitiativeListItemComponent implements OnInit {
  @Input() item!: InitiativeItem;
  @Output() initiativeChange = new EventEmitter<number>();
  @Output() displayNameClick = new EventEmitter<void>();

  redactInvisibleItems: boolean = false;

  constructor(private gmConfigService: GMConfigService) {}

  ngOnInit(): void {
    this.redactInvisibleItems = this.gmConfigService.config.redactInvisibleItems;
  }

  updateInitiative(e: any): void {
    this.initiativeChange.emit(e.target.valueAsNumber);
  }

  onDisplayNameClick(): void {
    this.displayNameClick.emit();
  }

  getDisplayName(): string {
    if (this.redactInvisibleItems && !this.item.visible) {
      return '[HIDDEN]';
    }
    return this.item.displayName || this.item.name;
  }
}
