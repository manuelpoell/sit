import { Injectable } from "@angular/core";
import OBR from "@owlbear-rodeo/sdk";
import { GMConfig } from "../models/gm-config";
import { ID } from "../utils/config";

@Injectable()
export class GMConfigService {
  private gmConfig: GMConfig = {
    autoCenterActiveItem: true,
    redactInvisibleItems: false,
  };

  // Add caching
  private cachedRoomMetadata: any = null;

  constructor() {}

  get config(): GMConfig {
    return this.gmConfig;
  }

  setup(): void {
    OBR.room.getMetadata().then(
      (roomMeta) => {
        this.cachedRoomMetadata = roomMeta;
        const metadata = roomMeta[`${ID}/metadata`];
        if ((metadata as any)?.config) {
          this.gmConfig = {
            ...this.gmConfig,
            ...(metadata as any).config,
          };
        }
      },
      (error) => console.warn(error)
    );

    const onMetaChange = (roomMeta: any) => {
      this.cachedRoomMetadata = roomMeta;
      const metadata = roomMeta[`${ID}/metadata`];
      if (!metadata) {
        return;
      }

      this.gmConfig = {
        ...this.gmConfig,
        ...metadata.config,
      };
    };
    OBR.room.onMetadataChange(onMetaChange);
  }

  update(config: Partial<GMConfig>): void {
    const metadata: any = {};
    metadata[`${ID}/metadata`] = { config: { ...this.gmConfig, ...config } };

    // Update cached metadata
    this.cachedRoomMetadata = {
      ...this.cachedRoomMetadata,
      ...metadata,
    };

    OBR.room.setMetadata(metadata);
  }
}
