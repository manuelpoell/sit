import { Injectable } from "@angular/core";
import OBR from "@owlbear-rodeo/sdk";
import * as uuid from "uuid";
import { ID } from "../utils/config";
import { BehaviorSubject } from "rxjs";

@Injectable()
export class GroupedItemService {
  private groupedItemSubject = new BehaviorSubject<Array<GroupedItemService>>(
    []
  );
  groupedItems$ = this.groupedItemSubject.asObservable(); // Read-only access

  // Add caching
  private cachedSceneMetadata: any = null;
  private metadataUpdateTimeout: any = null;

  constructor() {
    // this.setupMetadataListener();
  }

  setupMetadataListener(): void {
    // Set up scene metadata change listener to keep cache synchronized
    OBR.scene.onMetadataChange((metadata) => {
      const sceneMetadata = metadata[`${ID}/metadata`] as any;
      if (sceneMetadata) {
        this.cachedSceneMetadata = sceneMetadata;
      }
    });
  }

  private async getSceneMetadata(): Promise<any> {
    if (!this.cachedSceneMetadata) {
      this.cachedSceneMetadata = (await OBR.scene.getMetadata())[
        `${ID}/metadata`
      ] as any;
    }
    return this.cachedSceneMetadata;
  }

  private async updateSceneMetadata(metadata: any): Promise<void> {
    this.cachedSceneMetadata = metadata;

    // Debounce metadata updates
    if (this.metadataUpdateTimeout) {
      clearTimeout(this.metadataUpdateTimeout);
    }

    this.metadataUpdateTimeout = setTimeout(async () => {
      await OBR.scene.setMetadata({
        [`${ID}/metadata`]: metadata,
      });
    }, 50);
  }

  async createGroup(groupName: string, initiative: number): Promise<string> {
    const groupId = uuid.v4();
    const sceneMetadata = await this.getSceneMetadata();

    let newSceneMetadata = sceneMetadata;

    if (!sceneMetadata || !sceneMetadata.groups) {
      newSceneMetadata = {
        ...sceneMetadata,
        groups: [],
      };
    }

    newSceneMetadata.groups.push({
      id: groupId,
      name: groupName || "Unnamed Group",
      initiative: initiative || 0,
      hidden: false,
    });

    await this.updateSceneMetadata(newSceneMetadata);
    return groupId;
  }

  async toggleGroupVisibility(groupId: string): Promise<void> {
    const sceneMetadata = await this.getSceneMetadata();

    if (!sceneMetadata || !sceneMetadata.groups) {
      console.warn("No groups found in scene metadata");
      return;
    }

    const group = sceneMetadata.groups.find((g: any) => g.id === groupId);
    if (!group) {
      console.warn(`Group with ID ${groupId} not found`);
      return;
    }

    group.hidden = !group.hidden;
    await this.updateSceneMetadata(sceneMetadata);

    OBR.scene.items.updateItems(
      (item) => (item.metadata[`${ID}/metadata`] as any)?.group === groupId,
      (items) => {
        for (let item of items) {
          const metadata = item.metadata[`${ID}/metadata`] as any;
          if (metadata) {
            metadata.hidden = group.hidden;
          }
        }
      }
    );
  }

  async updateInitiative(groupId: string, initiative: number): Promise<void> {
    const sceneMetadata = await this.getSceneMetadata();

    if (!sceneMetadata || !sceneMetadata.groups) {
      console.warn("No groups found in scene metadata");
      return;
    }

    const group = sceneMetadata.groups.find((g: any) => g.id === groupId);
    if (!group) {
      console.warn(`Group with ID ${groupId} not found`);
      return;
    }

    group.initiative = initiative;
    await this.updateSceneMetadata(sceneMetadata);
  }

  async changeGroupName(groupId: string, newName: string): Promise<void> {
    const sceneMetadata = await this.getSceneMetadata();
    if (!sceneMetadata || !sceneMetadata.groups) {
      console.warn("No groups found in scene metadata");
      return;
    }
    const group = sceneMetadata.groups.find((g: any) => g.id === groupId);
    if (!group) {
      console.warn(`Group with ID ${groupId} not found`);
      return;
    }
    group.name = newName;
    await this.updateSceneMetadata(sceneMetadata);
  }

  async getGroup(id: string): Promise<any> {
    const sceneMetadata = await this.getSceneMetadata();

    if (!sceneMetadata || !sceneMetadata.groups) {
      console.warn("No groups found in scene metadata");
      return null;
    }

    const group = sceneMetadata.groups.find((g: any) => g.id === id);
    if (!group) {
      console.warn(`Group with ID ${id} not found`);
      return null;
    }

    return group;
  }

  async getAllGroups(): Promise<any[]> {
    const sceneMetadata = await this.getSceneMetadata();
    if (!sceneMetadata || !sceneMetadata.groups) {
      console.warn("No groups found in scene metadata");
      return [];
    }
    return sceneMetadata.groups;
  }

  async removeGroup(groupId: string): Promise<void> {
    const sceneMetadata = await this.getSceneMetadata();

    if (!sceneMetadata || !sceneMetadata.groups) {
      console.warn("No groups found in scene metadata");
      return;
    }

    const groupIndex = sceneMetadata.groups.findIndex(
      (g: any) => g.id === groupId
    );
    if (groupIndex === -1) {
      console.warn(`Group with ID ${groupId} not found`);
      return;
    }

    sceneMetadata.groups.splice(groupIndex, 1);
    await this.updateSceneMetadata(sceneMetadata);

    await OBR.scene.items.updateItems(
      (item) => (item.metadata[`${ID}/metadata`] as any)?.group === groupId,
      (items) => {
        for (let item of items) {
          delete item.metadata[`${ID}/metadata`];
        }
      }
    );
  }

  async renameGroup(groupId: string, newName: string): Promise<void> {
    const sceneMetadata = await this.getSceneMetadata();

    if (!sceneMetadata || !sceneMetadata.groups) {
      console.warn("No groups found in scene metadata");
      return;
    }

    const group = sceneMetadata.groups.find((g: any) => g.id === groupId);
    if (!group) {
      console.warn(`Group with ID ${groupId} not found`);
      return;
    }

    group.name = newName;
    await this.updateSceneMetadata(sceneMetadata);
  }
}
