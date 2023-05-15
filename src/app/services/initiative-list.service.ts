import { Injectable } from '@angular/core';
import OBR from '@owlbear-rodeo/sdk';
import { ID } from '../utils/config';
import { InitiativeItem } from '../models/intitiative-list-item';
import { BehaviorSubject } from 'rxjs';

@Injectable()
export class InitiativeListService {
  initiativeItems$ = new BehaviorSubject<Array<InitiativeItem>>([]);

  constructor() {}

  setup(): void {
    const renderList = (items: Array<any>) => {
      const initiativeItems: Array<InitiativeItem> = [];
      for (const item of items) {
        const metadata = item.metadata[`${ID}/metadata`];
        if (metadata) {
          initiativeItems.push({
            initiative: +metadata.initiative,
            name: item.name,
          });
        }
      }

      const sortedItems = initiativeItems.sort(
        (a, b) => b.initiative - a.initiative
      );
      this.initiativeItems$.next([...sortedItems]);
    };
    OBR.scene.items.onChange(renderList);
    OBR.scene.items.getItems().then(renderList);
  }
}
