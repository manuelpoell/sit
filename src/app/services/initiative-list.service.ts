import { Injectable } from '@angular/core';
import OBR from '@owlbear-rodeo/sdk';
import { ID } from '../utils/config';
import { InitiativeItem } from '../models/intitiative-list-item';
import { BehaviorSubject } from 'rxjs';
import { EffectListService } from './effect-list.service';
import { EffectListItem } from '../models/effect-list-item';
import { GMConfigService } from './gm-config.service';

@Injectable()
export class InitiativeListService {
  private initiativeItemsSubject = new BehaviorSubject<Array<InitiativeItem>>([]);
  initiativeItems$ = this.initiativeItemsSubject.asObservable();

  private currentRoundSubject = new BehaviorSubject<number>(1);
  currentRound$ = this.currentRoundSubject.asObservable();

  constructor(private effectListService: EffectListService, private gmConfigService: GMConfigService) {}

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
            effects: metadata.effects,
          });
        }
      }

      const sortedItems = initiativeItems.sort((a, b) => b.initiative - a.initiative);
      this.initiativeItemsSubject.next([...sortedItems]);
      this.currentRoundSubject.next(sortedItems[0]?.rounds || 1);

      let currentEffects: Array<EffectListItem> = [];
      for (const item of sortedItems.filter((i) => i.effects?.length > 0)) {
        currentEffects = currentEffects.concat(item.effects);
      }
      this.effectListService.setEffectList(currentEffects);

      const newHeight = (sortedItems.length + 1) * 50 + 25;
      const minHeight = 225;
      OBR.action.setHeight(newHeight > minHeight ? newHeight : minHeight);
    };
    OBR.scene.items.onChange(renderList);
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

              let effects: Array<EffectListItem> = metadata.effects || [];
              effects = effects
                .map((effect) => {
                  effect.rounds = nextRound ? effect.rounds - 1 : effect.rounds;
                  return effect;
                })
                .filter((effect) => effect.rounds > 0);

              item.metadata[`${ID}/metadata`] = {
                ...metadata,
                active: metadata.id === nextActiveID,
                rounds: nextRound ? metadata.rounds + 1 : metadata.rounds,
                effects,
              };
            }
          }
        );
      })
      .catch(console.error);

    this.centerActiveItem();
  }

  setRounds(rounds: number = 1): void {
    OBR.scene.items.updateItems(
      (item) => item.metadata[`${ID}/metadata`] != null,
      (items) => {
        for (const item of items) {
          const metadata: any = item.metadata[`${ID}/metadata`];
          item.metadata[`${ID}/metadata`] = {
            ...metadata,
            rounds,
          };
        }
      }
    );
    this.currentRoundSubject.next(1);
  }

  private async centerActiveItem(): Promise<void> {
    if (!this.gmConfigService.config.autoCenterActiveItem) {
      return;
    }

    const items = await OBR.scene.items.getItems((item) => item.metadata[`${ID}/metadata`] != null).catch(() => []);
    const activeItem = items.find((item) => (item.metadata[`${ID}/metadata`] as any).active);

    const scale = await OBR.viewport.getScale();
    const width = (await OBR.viewport.getWidth()) / scale;
    const height = (await OBR.viewport.getHeight()) / scale;

    if (activeItem?.position && activeItem?.visible) {
      OBR.viewport.animateToBounds({
        center: activeItem.position,
        height,
        width,
        max: { x: activeItem.position.x + width / 2, y: activeItem.position.y + height / 2 },
        min: { x: activeItem.position.x - width / 2, y: activeItem.position.y - height / 2 },
      });
    }
  }
}
