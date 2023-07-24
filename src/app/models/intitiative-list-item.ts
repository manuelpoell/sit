import { EffectListItem } from './effect-list-item';

export interface InitiativeItem {
  id: string;
  name: string;
  initiative: number;
  active: boolean;
  rounds: number;
  effects: Array<EffectListItem>;
  displayName?: string;
}
