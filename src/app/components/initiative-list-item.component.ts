import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InitiativeItem } from 'src/app/models/intitiative-list-item';

@Component({
  selector: 'app-initiative-list-item',
  standalone: true,
  imports: [CommonModule],
  template: ` <p>{{ item.name }} {{ item.initiative }}</p> `,
  styles: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InitiativeListItemComponent {
  @Input() item!: InitiativeItem;

  constructor() {}
}
