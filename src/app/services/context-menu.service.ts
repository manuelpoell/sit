import { Injectable } from '@angular/core';
import OBR from '@owlbear-rodeo/sdk';
import * as uuid from 'uuid';
import { ID } from '../utils/config';

@Injectable()
export class ContextMenuService {
  constructor() {}

  setup(): void {
    // add/remove item to initiative tracking
    OBR.contextMenu.create({
      id: `${ID}/context-menu`,
      icons: [
        {
          icon: '/assets/add-icon.svg',
          label: 'SIT - Add tracking',
          filter: {
            every: [
              { key: 'layer', value: 'CHARACTER' },
              { key: ['metadata', `${ID}/metadata`], value: undefined },
            ],
          },
        },
        {
          icon: '/assets/remove-icon.svg',
          label: 'SIT - Remove tracking',
          filter: {
            every: [{ key: 'layer', value: 'CHARACTER' }],
          },
        },
      ],
      onClick(context) {
        const addToInitiative = context.items.every((item) => item.metadata[`${ID}/metadata`] === undefined);
        if (addToInitiative) {
          const initiativeRequest = window.prompt('Enter initiative:');
          const initiative = initiativeRequest && parseInt(initiativeRequest) ? parseInt(initiativeRequest) : 0;

          OBR.scene.items.updateItems(context.items, (items) => {
            for (let item of items) {
              item.metadata[`${ID}/metadata`] = {
                id: item.id,
                initiative,
                rounds: 1,
                effects: [],
              };
            }
          });
        } else {
          OBR.scene.items.updateItems(context.items, (items) => {
            for (let item of items) {
              delete item.metadata[`${ID}/metadata`];
            }
          });
        }
      },
    });

    // add new effect of this item
    OBR.contextMenu.create({
      id: `${ID}/context-menu-effects`,
      icons: [
        {
          icon: '/assets/add-icon.svg',
          label: 'SIT - Add effect',
          filter: {
            every: [
              { key: 'layer', value: 'CHARACTER' },
              { key: ['metadata', `${ID}/metadata`], value: undefined, operator: '!=' },
            ],
          },
        },
      ],
      onClick(context) {
        const description = window.prompt('Enter description for this effect:');
        const roundsRequest = window.prompt('Enter duration in rounds:');
        const rounds = roundsRequest && parseInt(roundsRequest) ? parseInt(roundsRequest) : 1;

        OBR.scene.items.updateItems(context.items, (items) => {
          for (let item of items) {
            if (!item.metadata[`${ID}/metadata`]) continue;
            (item.metadata[`${ID}/metadata`] as any).effects?.push({
              id: uuid.v4(),
              characterId: item.id,
              description,
              rounds,
            });
          }
        });
      },
    });
  }
}
