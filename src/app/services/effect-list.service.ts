import { Injectable } from '@angular/core';
import { BehaviorSubject, first } from 'rxjs';
import { EffectListItem } from '../models/effect-list-item';
import OBR from '@owlbear-rodeo/sdk';
import { ID } from '../utils/config';

@Injectable()
export class EffectListService {
  private effectListSubject = new BehaviorSubject<Array<EffectListItem>>([]);
  effectList$ = this.effectListSubject.asObservable();

  constructor() {}

  setEffectList(list: Array<EffectListItem>): void {
    this.effectList$.pipe(first()).subscribe((currentList) => {
      currentList.forEach((effect) => {
        if (!list.find((newEffect) => newEffect.id === effect.id)) {
          OBR.notification.show(`"${effect.description}" is fading...`);
        }
      });
    });
    this.effectListSubject.next([...list]);
  }

  updateEffectRounds(characterId: string, id: string, rounds: number): void {
    OBR.scene.items.updateItems(
      (item) => item.id === characterId,
      (items) => {
        const metadata: any = items[0].metadata[`${ID}/metadata`];
        let effects: Array<EffectListItem> = metadata.effects;
        effects = effects
          .map((effect) => {
            if (effect.id === id) effect.rounds = rounds;
            return effect;
          })
          .filter((effect) => effect.rounds > 0);

        items[0].metadata[`${ID}/metadata`] = {
          ...metadata,
          effects,
        };
      }
    );
  }
}
