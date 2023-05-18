import { Injectable } from '@angular/core';
import OBR from '@owlbear-rodeo/sdk';
import { ID } from '../utils/config';
import { InitiativeItem } from '../models/intitiative-list-item';
import { BehaviorSubject } from 'rxjs';

@Injectable()
export class InitiativeListService {
  private initiativeItemsSubject = new BehaviorSubject<Array<InitiativeItem>>([]);
  initiativeItems$ = this.initiativeItemsSubject.asObservable();

  private currentRoundSubject = new BehaviorSubject<number>(1);
  currentRound$ = this.currentRoundSubject.asObservable();

  constructor() {}

  setup(): void {
    const renderList = (items: Array<any>) => {
      const initiativeItems: Array<InitiativeItem> = [];
      for (const item of items) {
        const metadata = item.metadata[`${ID}/metadata`];
        if (metadata) {
          initiativeItems.push({
            id: item.id,
            initiative: +metadata.initiative,
            name: item.name,
            active: metadata.active,
            rounds: metadata.rounds || 1,
          });
        }
      }

      const sortedItems = initiativeItems.sort((a, b) => b.initiative - a.initiative);
      this.initiativeItemsSubject.next([...sortedItems]);
      this.currentRoundSubject.next(sortedItems[0]?.rounds || 1);

      const newHeight = (sortedItems.length + 1) * 50 + 25;
      const minHeight = 225;
      OBR.action.setHeight(newHeight > minHeight ? newHeight : minHeight);
    };
    OBR.scene.items.onChange(renderList);
    OBR.scene.items.getItems().then(renderList);
  }

  updateInitiative(id: string, initiative: number): void {
    OBR.scene.items.updateItems(
      (item) => item.id === id,
      (items) => {
        const metadata: any = items[0].metadata[`${ID}/metadata`];
        items[0].metadata[`${ID}/metadata`] = {
          ...metadata,
          initiative,
        };
      }
    );
  }

  iterateNext(): void {
    OBR.scene.items
      .getItems((item) => item.metadata[`${ID}/metadata`] != null)
      .then((items) => {
        if (items.length === 0) return;
        const itemMeta = items
          .map((item) => item.metadata[`${ID}/metadata`] as any)
          .sort((a, b) => b.initiative - a.initiative);

        const activeIndex = itemMeta.findIndex((item) => item.active);
        const nextRound: boolean = activeIndex === itemMeta.length - 1;
        const nextActiveID = nextRound || activeIndex < 0 ? itemMeta[0].id : itemMeta[activeIndex + 1].id;

        if (nextRound) {
          this.currentRoundSubject.next((items[0].metadata[`${ID}/metadata`] as any).rounds + 1);
        }

        OBR.scene.items.updateItems(
          (item) => item.metadata[`${ID}/metadata`] != null,
          (items) => {
            for (const item of items) {
              const metadata: any = item.metadata[`${ID}/metadata`];
              item.metadata[`${ID}/metadata`] = {
                ...metadata,
                active: metadata.id === nextActiveID,
                rounds: nextRound ? metadata.rounds + 1 : metadata.rounds,
              };
            }
          }
        );
      });
  }

  resetRounds(): void {
    OBR.scene.items.updateItems(
      (item) => item.metadata[`${ID}/metadata`] != null,
      (items) => {
        for (const item of items) {
          const metadata: any = item.metadata[`${ID}/metadata`];
          item.metadata[`${ID}/metadata`] = {
            ...metadata,
            rounds: 1,
          };
        }
      }
    );
    this.currentRoundSubject.next(1);
  }
}
