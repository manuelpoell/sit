import { Injectable } from '@angular/core';
import { BehaviorSubject, first } from 'rxjs';
import { EffectListItem } from '../models/effect-list-item';
import OBR, {Command, Item , PathCommand, buildPath, buildShape, buildText, isPath, isText} from '@owlbear-rodeo/sdk';
import { ID } from '../utils/config';
import * as uuid from 'uuid';

@Injectable()
export class EffectListService {
  private effectListSubject = new BehaviorSubject<Array<EffectListItem>>([]);
  effectList$ = this.effectListSubject.asObservable();

  constructor() {}

  buildingProccessBar: Boolean = false;

  // Add caching
  private cachedPlayerRole: string | null = null;
  private cachedGridDpi: number | null = null;

  setupPlayerRoleListener(): void {
    // Set up player role change listener (though rare, it can happen)
    OBR.player.onChange((player) => {
      this.cachedPlayerRole = player.role;
    });
  }

  setEffectList(list: Array<EffectListItem>): void {
    this.effectList$.pipe(first()).subscribe(async (currentList) => {
      // Cache player role
      if (!this.cachedPlayerRole) {
        this.cachedPlayerRole = await OBR.player.getRole();
      }
      const isGM = this.cachedPlayerRole === "GM";
      
      for(let effect of currentList) {
        //console.log('EffectListService.setEffectList', effect);

        if(!effect.processBar && !this.buildingProccessBar && isGM) {
          this.buildingProccessBar = true;
          const processBarPath =  await this.buildProccessBar(effect);
          const processBarBackground = buildShape()
            .width(40)
            .height(40)
            .shapeType('CIRCLE')
            .fillOpacity(0)
            .strokeColor('#d6d6d6')
            .strokeOpacity(0.5)
            .strokeWidth(7) // Default stroke color
            .attachedTo(processBarPath.id)
            .locked(true)
            .position({
              x: processBarPath.position.x,
              y: processBarPath.position.y,
            })
            .build();

          const processBarText = buildText()
            .richText([{
              type: 'paragraph',
              children: [{ 
                text: effect.rounds.toString(), 
                bold: true
              }]
            }])
            .fontSize(18)
            .layer('ATTACHMENT')
            .attachedTo(processBarPath.id)
            .position({
              x: processBarPath.position.x - 50,
              y: processBarPath.position.y - 9,
            })
            .locked(true)
            .lineHeight(1)
            .width(100)
            .textAlign('CENTER')
            .build();

          //console.log('processBarText', processBarText);


          const processBar = {
            path: processBarPath.id,
            background: processBarBackground.id,
            text: processBarText.id,
          }

          let duplicate = false
          
          await OBR.scene.items.updateItems(
            (item) => item.id === effect.characterId,
            (items) => {
              const metadata: any = items[0].metadata[`${ID}/metadata`];
              if(metadata && metadata.effects) {
                const effectIndex = metadata.effects.findIndex((e: EffectListItem) => e.id === effect.id);

                if(metadata.effects[effectIndex].processBar){
                  duplicate = true;
                  return
                } 

                if (effectIndex !== -1) {
                  metadata.effects[effectIndex].processBar = processBar;
                } else {
                  metadata.effects.push({
                    ...effect,
                    processBar: processBar,});
                }
              }   
            }
          );

          if(duplicate) continue;
          await OBR.scene.items.addItems([processBarPath, processBarBackground, processBarText]);
        }

        this.buildingProccessBar = false;

        const newEffect = list.find((e) => e.id === effect.id);

        if(newEffect && newEffect.rounds != effect.rounds) {
          this.updateProcessBar(newEffect);
        }
        if (!newEffect) {
          OBR.scene.items.deleteItems([effect.processBar?.path, effect.processBar?.background, effect.processBar?.text]);
          OBR.notification.show(`${effect.description} is fading...`);
        }
      };
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

  updateProcessBar(effect: EffectListItem): void {
    const totalRounds = effect.totalRounds || effect.rounds;
    const percentage = (effect.rounds / totalRounds);

    const pathId = effect.processBar?.path;
    const textId = effect.processBar?.text;

    OBR.scene.items.updateItems(
      (item) => item.id == pathId || item.id == textId,
      (items) => {
        for(let item of items) {
          if (item.id == pathId && isPath(item)) {
            item.commands = this.arcPath(Math.PI*2*percentage, 20);
          }
          if (item.id == textId && isText(item)) {
            item.text.richText = [{
              type: 'paragraph',
              children: [{ 
                text: effect.rounds.toString(), 
                bold: true
              }]
            }];
          }
        }
      }
    )
  }

  async updatePostion(effect: EffectListItem): Promise<void> {
    const character = (await OBR.scene.items.getItems([effect.characterId]))

    if(!character || character.length === 0) return;

    // Use cached grid DPI with null safety
    if (!this.cachedGridDpi) {
      this.cachedGridDpi = await OBR.scene.grid.getDpi();
    }
    const gridDpi = this.cachedGridDpi || 1; // Fallback to 1 if still null

    await OBR.scene.items.updateItems(
      (item) => item.id === effect.processBar?.path,
      (items) => {
        const characterItem = items[0];
        if (characterItem && isPath(characterItem)) {
          characterItem.position = {
            x: character[0].position.x - Math.cos(Math.PI/4*3)*(character[0].scale.x * .5 * gridDpi + 30),
            y: character[0].position.y - Math.sin(Math.PI/4*3)*(character[0].scale.y * .5 * gridDpi + 30)
          };
        }
      }
    )
  }

  async deleteEffectsOnItem(item: Item): Promise<void> {
    //Remove process bars
    const metadata = (item.metadata[`${ID}/metadata`] as any).effects as Array<EffectListItem>;

    //console.log('EffectListService.deleteEffectsOnItem', item, metadata);

    metadata.forEach((effect) => {
      if (effect.processBar) {
        OBR.scene.items.deleteItems([effect.processBar.path, effect.processBar.background, effect.processBar.text]);
      }
    });

    //Remove effects from metadata
    await OBR.scene.items.updateItems(
      (i) => i.id === item.id,
      (items) => {
        const metadata: any = items[0].metadata[`${ID}/metadata`];
        if (metadata) {
          items[0].metadata[`${ID}/metadata`] = {
            ...metadata,
            effects: [],
          };
        }
      }
    );
  
  }


  async buildProccessBar(item: EffectListItem): Promise<Item>  {
    const totalRounds = item.totalRounds || item.rounds;
    const percentage = (item.rounds / totalRounds);

    const character = (await OBR.scene.items.getItems([item.characterId]))[0];

    // Use cached grid DPI with null safety
    if (!this.cachedGridDpi) {
      this.cachedGridDpi = await OBR.scene.grid.getDpi();
    }
    const gridDpi = this.cachedGridDpi || 1; // Fallback to 1 if still null

    const path = buildPath()
      .commands(
        this.arcPath(Math.PI*2*percentage, 20)
      )
      .strokeColor('#FFFFFF')
      .strokeWidth(7)
      .fillOpacity(0)
      .layer('ATTACHMENT')
      .zIndex(1000)
      .attachedTo(item.characterId)
      .position({
        x: character.position.x - Math.cos(Math.PI/4*3)*(character.scale.x * .5 * gridDpi + 30),
        y: character.position.y - Math.sin(Math.PI/4*3)*(character.scale.y * .5 * gridDpi + 30)
      })
      .locked(true)
      .disableAttachmentBehavior(['SCALE', 'ROTATION'])
      .build(); 

    return path
  }

  arcPath(angle: number = Math.PI, radius: number = 100): PathCommand[] {
    let path = [] as PathCommand[];
    const steps = Math.round(50/(2*Math.PI)*angle) // Number of steps based on the angle and radius
    path.push([Command.MOVE, 0, -radius]); // Start at the rightmost point of the arc
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = radius * Math.cos(angle * t - Math.PI / 2); // Start from the top of the circle
      const y = radius * Math.sin(angle * t - Math.PI / 2); // Start from the top of the circle
      path.push([Command.LINE, x, y]);
    }

    return path;
  }
}


