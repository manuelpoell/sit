import { effect, Injectable, OnDestroy } from "@angular/core";
import OBR, {
  buildImage,
  buildImageUpload,
  ImageContent,
  ImageUpload,
  Item,
  Image,
} from "@owlbear-rodeo/sdk";
import { isImage } from "@owlbear-rodeo/sdk";
import { ID } from "../utils/config";
import { InitiativeItem } from "../models/intitiative-list-item";
import { BehaviorSubject } from "rxjs";
import { EffectListService } from "./effect-list.service";
import { EffectListItem } from "../models/effect-list-item";
import { GMConfigService } from "./gm-config.service";
import { GroupedItemService } from "./grouped-item.service";

@Injectable()
export class InitiativeListService implements OnDestroy {
  private initiativeItemsSubject = new BehaviorSubject<Array<InitiativeItem>>(
    []
  );
  initiativeItems$ = this.initiativeItemsSubject.asObservable();

  private currentRoundSubject = new BehaviorSubject<number>(1);
  currentRound$ = this.currentRoundSubject.asObservable();

  private lastActiveID: string | null = null;
  private lastActiveItemScale: { x: number; y: number } | null = null;
  private lastGroupItemsScales: Map<string, { x: number; y: number }> =
    new Map();
  private highlighterUpdateTimeout: any = null;
  private isUpdatingHighlighter: boolean = false;
  private isUpdatingHighlighterPosition: boolean = false;

  // Add caching properties
  private cachedPlayerRole: string | null = null;
  private cachedGridDpi: number | null = null;
  private cachedSceneMetadata: any = null;
  private pendingMetadataUpdate: any = null;
  private metadataUpdateTimeout: any = null;

  constructor(
    private effectListService: EffectListService,
    private gmConfigService: GMConfigService,
    private groupedItemService: GroupedItemService
  ) {}

  async setup(): Promise<void> {
    // Cache player role once
    this.cachedPlayerRole = await OBR.player.getRole();

    // Set up scene metadata change listener to keep cache synchronized
    OBR.scene.onMetadataChange((metadata) => {
      const sceneMetadata = metadata[`${ID}/metadata`] as any;
      if (sceneMetadata) {
        this.cachedSceneMetadata = sceneMetadata;
      }
    });

    const renderList = async (items: Array<any>) => {
      const initiativeItems: Array<InitiativeItem> = [];
      for (const item of items) {
        const metadata = item.metadata[`${ID}/metadata`] as any;

        const group = metadata?.group
          ? await this.groupedItemService.getGroup(metadata?.group)
          : undefined;

        console.log("Item:", item, "Metadata:", metadata, "Group:", group);

        if (group && initiativeItems.some((i) => i.id === group.id)) continue;

        if (metadata) {
          if (group && group.hidden && this.cachedPlayerRole === "PLAYER") {
            // Skip hidden groups for players
            continue;
          }
          if (metadata.hidden && this.cachedPlayerRole === "PLAYER") {
            // Skip hidden items for players
            continue;
          }
          initiativeItems.push({
            id: group ? group.id : item.id,
            characterId: item.id,
            initiative: group ? +group.initiative : +metadata.initiative,
            name: group
              ? group.name
              : item.text.plainText == ""
              ? item.name
              : item.text.plainText,
            active: metadata.active,
            rounds: metadata.rounds || 1,
            effects: metadata.effects,
            displayName: metadata.displayName,
            visible: group ? group.hidden : metadata.hidden,
            isGroup: group !== undefined,
          });
        }
      }

      const sortedItems = initiativeItems.sort(
        (a, b) => b.initiative - a.initiative
      );

      this.initiativeItemsSubject.next([...sortedItems]);
      this.currentRoundSubject.next(sortedItems[0]?.rounds || 1);

      let currentEffects: Array<EffectListItem> = [];
      for (const item of sortedItems.filter((i) => i.effects?.length > 0)) {
        currentEffects = currentEffects.concat(item.effects);
      }

      if (sortedItems.some((item) => item.isGroup)) {
        let groupedItems = items.filter((item) => {
          const metadata = item.metadata[`${ID}/metadata`] as any;

          if (!metadata?.group) return false;

          if (!metadata.effects || metadata.effects.length === 0) return false;

          if (!sortedItems.some((i) => i.id === metadata.group)) return false;

          if (sortedItems.some((e) => e.characterId == item.id)) return false;
          return true;
        });
        const groupedEffects = groupedItems
          .map((item) => item.metadata[`${ID}/metadata`]?.effects)
          .flat();
        currentEffects = currentEffects.concat(groupedEffects);
      }

      this.effectListService.setEffectList(currentEffects);

      const newHeight = (sortedItems.length + 1) * 50 + 25;
      const minHeight = 225;
      OBR.action.setHeight(newHeight > minHeight ? newHeight : minHeight);

      if (this.cachedPlayerRole === "GM") {
        // Cache grid DPI if not already cached
        if (!this.cachedGridDpi) {
          this.cachedGridDpi = await OBR.scene.grid.getDpi();
        }

        // Get scene metadata once and cache it
        if (!this.cachedSceneMetadata) {
          this.cachedSceneMetadata = (await OBR.scene.getMetadata())[
            `${ID}/metadata`
          ] as any;
        }

        let highlightersChanged = false;
        for (const highlighter of this.cachedSceneMetadata?.highlighters ||
          []) {
          const exists = items.some((item) => item.id === highlighter);
          if (!exists) {
            highlightersChanged = true;
            this.cachedSceneMetadata.highlighters =
              this.cachedSceneMetadata.highlighters.filter(
                (id: string) => id !== highlighter
              );
          }
        }

        if (highlightersChanged) {
          // Debounce metadata updates
          this.pendingMetadataUpdate = {
            [`${ID}/metadata`]: {
              ...this.cachedSceneMetadata,
              highlighters: this.cachedSceneMetadata?.highlighters || [],
            },
          };

          if (this.metadataUpdateTimeout) {
            clearTimeout(this.metadataUpdateTimeout);
          }

          this.metadataUpdateTimeout = setTimeout(async () => {
            if (this.pendingMetadataUpdate) {
              await OBR.scene.setMetadata(this.pendingMetadataUpdate);
              this.cachedSceneMetadata =
                this.pendingMetadataUpdate[`${ID}/metadata`];
              this.pendingMetadataUpdate = null;
            }
          }, 100);
        }
      }

      if (this.isUpdatingHighlighterPosition) return;

      // Check if active item or its scale changed
      const activeItem = sortedItems.find((item) => item.active);
      const activeItemId = activeItem?.isGroup ? activeItem.id : activeItem?.id;

      // Get the actual item(s) from the scene to check scale changes
      let activeItemData = null;
      let currentScale = null;
      let scaleChanged = false;

      if (activeItem?.isGroup) {
        const groupId = activeItem.id;
        const groupedItems = items.filter((item) => {
          const metadata = item.metadata[`${ID}/metadata`] as any;
          return metadata?.group === groupId;
        });

        // Check if any item in the group has changed scale
        for (const groupItem of groupedItems) {
          const currentItemScale = groupItem.scale;
          const lastItemScale = this.lastGroupItemsScales.get(groupItem.id);

          if (
            lastItemScale &&
            currentItemScale &&
            (currentItemScale.x !== lastItemScale.x ||
              currentItemScale.y !== lastItemScale.y)
          ) {
            scaleChanged = true;
          }

          // Update the stored scale for this item
          if (currentItemScale) {
            this.lastGroupItemsScales.set(groupItem.id, {
              ...currentItemScale,
            });
          }
        }

        // Clean up scales for items that are no longer in the group
        const currentGroupItemIds = new Set(
          groupedItems.map((item) => item.id)
        );
        for (const [itemId] of this.lastGroupItemsScales) {
          if (!currentGroupItemIds.has(itemId)) {
            this.lastGroupItemsScales.delete(itemId);
          }
        }

        // Use the first item's scale as reference for the group
        activeItemData = groupedItems[0];
        currentScale = activeItemData?.scale;
      } else if (activeItem) {
        activeItemData = items.find((item) => item.id === activeItem.id);
        currentScale = activeItemData?.scale;

        // Check scale change for individual item
        if (
          currentScale &&
          this.lastActiveItemScale &&
          (currentScale.x !== this.lastActiveItemScale.x ||
            currentScale.y !== this.lastActiveItemScale.y)
        ) {
          scaleChanged = true;
        }
      }

      // Check if active item changed OR scale changed
      const activeItemChanged =
        activeItemId && activeItemId !== this.lastActiveID;

      if (activeItemChanged || scaleChanged) {
        this.lastActiveID = activeItemId || null;
        this.lastActiveItemScale = currentScale ? { ...currentScale } : null;

        // Clear any existing timeout
        if (this.highlighterUpdateTimeout) {
          clearTimeout(this.highlighterUpdateTimeout);
        }

        // Debounce the highlighter update
        this.highlighterUpdateTimeout = setTimeout(async () => {
          this.isUpdatingHighlighterPosition = true;

          try {
            if (!activeItem) return;

            if (activeItem.isGroup) {
              const groupId = activeItem.id;
              const groupedItems = items.filter((item) => {
                const metadata = item.metadata[`${ID}/metadata`] as any;
                return metadata?.group === groupId;
              });

              if (groupedItems.length > 0) {
                await this.updateHighlighterPosition(groupedItems).catch(
                  (error) => {
                    console.error(
                      "Error updating highlighter position for grouped items:",
                      error
                    );
                  }
                );
              }
            } else {
              const activeItemData = items.find(
                (item) => item.id === activeItem.id
              );
              if (activeItemData) {
                await this.updateHighlighterPosition([activeItemData]).catch(
                  (error) => {
                    console.error(
                      "Error updating highlighter position:",
                      error
                    );
                  }
                );
              }
            }
          } catch (error) {
            console.error("Error updating highlighter position:", error);
          } finally {
            this.isUpdatingHighlighterPosition = false;
          }
        }, 150); // Reduced debounce time for scale changes
      }
    };

    OBR.scene.items.onChange(renderList);
  }

  async reset(): Promise<void> {
    try {
      await OBR.scene.items.updateItems(
        (item) => item.metadata[`${ID}/metadata`] != null,
        (items) => {
          for (let item of items) {
            delete item.metadata[`${ID}/metadata`];
          }
        }
      );

      // Remove highlighter if it exists
      const sceneMetadata = (await OBR.scene.getMetadata())[
        `${ID}/metadata`
      ] as any;
      if (sceneMetadata?.highlighters) {
        //console.log("Removing highlighters:", sceneMetadata.highlighters);
        await OBR.scene.items.deleteItems(sceneMetadata.highlighters);
      }

      // Reset scene metadata
      await OBR.scene.setMetadata({
        [`${ID}/metadata`]: undefined,
      });

      // Clear cached metadata
      this.cachedSceneMetadata = null;

      // Reset tracking variables
      this.lastActiveID = null;
      this.lastActiveItemScale = null;
      this.lastGroupItemsScales.clear();

      if (this.highlighterUpdateTimeout) {
        clearTimeout(this.highlighterUpdateTimeout);
        this.highlighterUpdateTimeout = null;
      }
    } catch (error) {
      console.error("Failed to reset initiative:", error);
    }
  }

  async updateInitiative(id: string, initiative: number): Promise<void> {
    try {
      const groups = await this.groupedItemService.getAllGroups();

      if (groups.some((group) => group.id === id)) {
        //console.log('Updating initiative for group:', id, initiative);
        await this.groupedItemService.updateInitiative(id, initiative);
        await OBR.scene.items.updateItems(isImage, (items) => {
          for (const item of items) {
            const metadata: any = item.metadata[`${ID}/metadata`];

            if (!metadata) continue;
            if (metadata.group !== id) continue;

            item.metadata[`${ID}/metadata`] = {
              ...metadata,
              initiative,
            };
          }
        });
        return;
      }

      await OBR.scene.items.updateItems(
        (item) => item.id === id,
        (items) => {
          const metadata: any = items[0].metadata[`${ID}/metadata`];

          items[0].metadata[`${ID}/metadata`] = {
            ...metadata,
            initiative,
          };
        }
      );
    } catch (error) {
      console.error("Error updating initiative:", error);
    }
  }

  async updateDisplayName(id: string, displayName: string): Promise<void> {
    try {
      const groups = await this.groupedItemService.getAllGroups();

      if (groups.some((group) => group.id === id)) {
        await this.groupedItemService.changeGroupName(id, displayName);

        await OBR.scene.items.updateItems(isImage, (items) => {
          for (const item of items) {
            const metadata: any = item.metadata[`${ID}/metadata`];

            if (!metadata) continue;
            if (metadata.group !== id) continue;

            item.metadata[`${ID}/metadata`] = {
              ...metadata,
              groupChanged: metadata.groupChanged ? true : false,
            };
          }
        });
        return;
      }

      await OBR.scene.items.updateItems(
        (item) => item.id === id,
        (items) => {
          const metadata: any = items[0].metadata[`${ID}/metadata`];
          items[0].metadata[`${ID}/metadata`] = {
            ...metadata,
            displayName,
          };
        }
      );
    } catch (error) {
      console.error("Error updating display name:", error);
    }
  }

  async iterateNext(): Promise<void> {
    try {
      const items = await OBR.scene.items.getItems(
        (item) => item.metadata[`${ID}/metadata`] != null
      );

      if (items.length === 0) return;

      const addedGroups: any[] = [];
      const allGroups = await this.groupedItemService.getAllGroups();

      const itemMeta = items
        .map((item) => {
          const metadata = item.metadata[`${ID}/metadata`] as any;
          const group = metadata?.group
            ? allGroups.find((g) => g.id === metadata.group)
            : undefined;

          if (group && addedGroups.some((i) => i.id === group.id))
            return undefined;

          if (group) {
            addedGroups.push(group);
          }

          //console.log('Item:', item, 'Metadata:', metadata, 'Group:', group);

          return metadata;
        })
        .filter((item) => item != undefined)
        .sort((a, b) => b.initiative - a.initiative);

      const activeIndex = itemMeta.findIndex((item) => item.active);

      const nextRound: boolean = activeIndex === itemMeta.length - 1;
      const nextActiveID =
        nextRound || activeIndex < 0
          ? itemMeta[0].id
          : itemMeta[activeIndex + 1].id;

      if (nextRound) {
        this.currentRoundSubject.next(
          (items[0].metadata[`${ID}/metadata`] as any).rounds + 1
        );
      }

      const nextActiveItem = items.find((item) => item.id === nextActiveID);

      const nextItemMetadata = nextActiveItem?.metadata[
        `${ID}/metadata`
      ] as any;

      if (allGroups.some((group) => group.id === nextItemMetadata?.group)) {
        const groupedItems = items.filter(
          (item) =>
            (item.metadata[`${ID}/metadata`] as any)?.group ===
            nextItemMetadata?.group
        );

        if (groupedItems.length > 0) {
          await this.updateHighlighterPosition(groupedItems).catch((error) => {
            console.error(
              "Error updating highlighter position for grouped items:",
              error
            );
          });
        }
      } else {
        if (nextActiveItem) {
          //console.log('Next Active Item:', nextActiveItem);
          await this.updateHighlighterPosition([nextActiveItem]).catch(
            (error) => {
              console.error("Error updating highlighter position:", error);
            }
          );
        }
      }

      // Check for highlighter only once per iteration

      await OBR.scene.items.updateItems(isImage, (items) => {
        for (const item of items) {
          if (item.metadata[`${ID}/metadata`] == null) continue;

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
      });
    } catch (error) {
      console.error("Error in iterateNext:", error);
    } finally {
      // Add a small delay before centering to avoid rapid API calls
      setTimeout(() => {
        this.centerActiveItem().catch((error) => {
          console.error("Error centering active item:", error);
        });
      }, 100);
    }
  }

  private buildHighlighter(): Image {
    const highlighter = buildImage(
      {
        height: 405,
        width: 635,
        url: "https://i.ibb.co/Q3w3Sp6x/Select-Arrow.png",
        mime: "image/png",
      },
      { dpi: 300, offset: { x: 635 / 2, y: 405 / 2 } }
    )
      .name("initiative-highlighter")
      .rotation(90)
      .locked(true)
      .scale({
        x: 0.5,
        y: 0.5,
      })
      .layer("ATTACHMENT")
      .disableAttachmentBehavior(["SCALE", "ROTATION"])
      .build();

    return highlighter;
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

  private async updateHighlighterPosition(
    activeItems: Item[] | undefined
  ): Promise<void> {
    if (this.isUpdatingHighlighter) {
      return;
    }
    this.isUpdatingHighlighter = true;

    if (this.cachedPlayerRole === "PLAYER") {
      this.isUpdatingHighlighter = false;
      return;
    }

    try {
      // Use cached metadata instead of fetching, but refresh if null
      let sceneMetadata = this.cachedSceneMetadata;

      if (!sceneMetadata) {
        // Refresh cache if metadata is null
        const freshMetadata = (await OBR.scene.getMetadata())[
          `${ID}/metadata`
        ] as any;
        sceneMetadata = freshMetadata || { highlighters: [] };
        this.cachedSceneMetadata = sceneMetadata;

        if (!freshMetadata) {
          await OBR.scene.setMetadata({
            [`${ID}/metadata`]: sceneMetadata,
          });
        }
      }

      if (sceneMetadata) {
        const highlighterCount = sceneMetadata.highlighters?.length || 0;
        const countOffset = activeItems
          ? activeItems.length - highlighterCount
          : 0;

        // Batch operations
        const operations = [];

        if (activeItems && countOffset < 0) {
          const highlightersToRemove = sceneMetadata.highlighters.slice(
            sceneMetadata.highlighters.length - Math.abs(countOffset)
          );
          operations.push(() =>
            OBR.scene.items.deleteItems(highlightersToRemove)
          );
        } else if (activeItems && countOffset > 0) {
          if (!sceneMetadata.highlighters) {
            sceneMetadata.highlighters = [];
          }

          let newHighlighters: Item[] = [];
          for (let i = 0; i < countOffset; i++) {
            const highlighter = this.buildHighlighter() as Image;
            sceneMetadata.highlighters.push(highlighter.id);
            newHighlighters.push(highlighter);
          }

          if (newHighlighters.length > 0) {
            operations.push(() => OBR.scene.items.addItems(newHighlighters));
          }
        }

        // Execute all operations
        for (const operation of operations) {
          await operation();
        }

        // Single highlighter position update
        await OBR.scene.items.updateItems(
          (item) => sceneMetadata.highlighters?.includes(item.id) || false,
          (items) => {
            let i = 0;
            for (const highlighter of items) {
              if (!activeItems || i >= activeItems.length) continue;

              const activeMeta = activeItems[i].metadata[
                `${ID}/metadata`
              ] as any;
              const gridDpi = this.cachedGridDpi || 1; // Null safety fallback

              highlighter.position = { ...activeItems[i].position };
              highlighter.position.y -=
                activeItems[i].scale.y * 0.5 * gridDpi +
                100 +
                (activeMeta.group ? -50 : 0);
              highlighter.attachedTo = activeItems[i].id;
              highlighter.visible = activeItems[i].visible;
              highlighter.scale = activeMeta.group
                ? { x: 0.25, y: 0.25 }
                : { x: 0.5, y: 0.5 };

              i++;
            }
          }
        );

        // Update cached metadata and scene metadata in one call
        this.cachedSceneMetadata = sceneMetadata;
        await OBR.scene.setMetadata({
          [`${ID}/metadata`]: sceneMetadata,
        });
      }
    } catch (error) {
      console.error("Failed to update highlighter position:", error);
    } finally {
      this.isUpdatingHighlighter = false;
    }
  }

  private async centerActiveItem(): Promise<void> {
    try {
      const items = await OBR.scene.items
        .getItems((item) => item.metadata[`${ID}/metadata`] != null)
        .catch(() => []);
      const activeItem = items.find(
        (item) => (item.metadata[`${ID}/metadata`] as any).active
      );

      if (!this.gmConfigService.config.autoCenterActiveItem) {
        return;
      }

      // Batch viewport calls
      const [scale, width, height] = await Promise.all([
        OBR.viewport.getScale(),
        OBR.viewport.getWidth(),
        OBR.viewport.getHeight(),
      ]);

      const adjustedWidth = width / scale;
      const adjustedHeight = height / scale;

      if (activeItem?.position && activeItem?.visible) {
        await OBR.viewport.animateToBounds({
          center: activeItem.position,
          height: adjustedHeight,
          width: adjustedWidth,
          max: {
            x: activeItem.position.x + adjustedWidth / 2,
            y: activeItem.position.y + adjustedHeight / 2,
          },
          min: {
            x: activeItem.position.x - adjustedWidth / 2,
            y: activeItem.position.y - adjustedHeight / 2,
          },
        });
      }
    } catch (error) {
      console.error("Failed to center active item:", error);
    }
  }

  ngOnDestroy(): void {
    if (this.highlighterUpdateTimeout) {
      clearTimeout(this.highlighterUpdateTimeout);
    }
    // Clear tracking variables
    this.lastActiveID = null;
    this.lastActiveItemScale = null;
    this.lastGroupItemsScales.clear();
    if (this.metadataUpdateTimeout) {
      clearTimeout(this.metadataUpdateTimeout);
    }
    // Clear cached data
    this.cachedPlayerRole = null;
    this.cachedGridDpi = null;
    this.cachedSceneMetadata = null;
  }
}
