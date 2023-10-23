import { Injectable } from '@angular/core';
import OBR from '@owlbear-rodeo/sdk';
import { GMConfig } from '../models/gm-config';
import { ID } from '../utils/config';

@Injectable()
export class GMConfigService {
  private gmConfig: GMConfig = {
    autoCenterActiveItem: true,
    redactInvisibleItems: false,
  };

  constructor() {}

  get config(): GMConfig {
    return this.gmConfig;
  }

  setup(): void {
    OBR.room.getMetadata().then(
      (roomMeta) => {
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

    OBR.room.setMetadata(metadata);
  }
}
