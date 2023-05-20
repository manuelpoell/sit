import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EffectListItem } from '../models/effect-list-item';

@Component({
  selector: 'app-effect-list-item',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="list-item">
      <span>{{ item.description }}</span>
      <input type="number" [value]="item.rounds" (change)="updateRounds($event)" />
    </div>
  `,
  styleUrls: ['./effect-list-item.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EffectListItemComponent {
  @Input() item!: EffectListItem;
  @Output() roundsChange = new EventEmitter<number>();

  constructor() {}

  updateRounds(e: any): void {
    this.roundsChange.emit(e.target.valueAsNumber);
  }
}
