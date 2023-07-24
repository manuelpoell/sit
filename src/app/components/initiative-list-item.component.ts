import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InitiativeItem } from 'src/app/models/intitiative-list-item';

@Component({
  selector: 'app-initiative-list-item',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="list-item" [class.active]="item.active">
      <span (click)="onDisplayNameClick()">{{ item.displayName || item.name }}</span>
      <input type="number" [value]="item.initiative" (change)="updateInitiative($event)" />
    </div>
  `,
  styleUrls: ['./initiative-list-item.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InitiativeListItemComponent {
  @Input() item!: InitiativeItem;
  @Output() initiativeChange = new EventEmitter<number>();
  @Output() displayNameClick = new EventEmitter<void>();

  constructor() {}

  updateInitiative(e: any): void {
    this.initiativeChange.emit(e.target.valueAsNumber);
  }

  onDisplayNameClick(): void {
    this.displayNameClick.emit();
  }
}
