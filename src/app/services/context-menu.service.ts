import { Injectable } from '@angular/core';
import OBR from '@owlbear-rodeo/sdk';
import { ID } from '../utils/config';

@Injectable()
export class ContextMenuService {
  constructor() {}

  setup(): void {
    OBR.contextMenu.create({
      id: `${ID}/context-menu`,
      icons: [
        {
          icon: '/assets/add-icon.svg',
          label: 'Add to SIT',
          filter: {
            every: [
              { key: 'layer', value: 'CHARACTER' },
              { key: ['metadata', `${ID}/metadata`], value: undefined },
            ],
          },
        },
        {
          icon: '/assets/remove-icon.svg',
          label: 'Remove from SIT',
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
  }
}
