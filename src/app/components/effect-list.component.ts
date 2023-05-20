import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { EffectListService } from '../services/effect-list.service';
import { Subscription } from 'rxjs';
import { EffectListItem } from '../models/effect-list-item';
import { EffectListItemComponent } from './effect-list-item.component';

@Component({
  selector: 'app-effect-list',
  standalone: true,
  imports: [CommonModule, EffectListItemComponent],
  template: `
    <div class="effect-list-header">
      <span class="close-button" (click)="onClose.emit()">&#x26CC;</span>
    </div>
    <div class="effects-placeholder" *ngIf="effectList.length < 1">
      <span>No effects active</span>
    </div>
    <ng-container *ngFor="let item of effectList">
      <app-effect-list-item
        [item]="item"
        (roundsChange)="onEffectRoundsChange(item.characterId, item.id, $event)"
      ></app-effect-list-item>
    </ng-container>
  `,
  styleUrls: ['./effect-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EffectListComponent implements OnInit, OnDestroy {
  @Output() onClose = new EventEmitter();
  effectList: Array<EffectListItem> = [];
  subscriptions = new Subscription();

  constructor(private effectListService: EffectListService, private cdRef: ChangeDetectorRef) {}

  ngOnInit(): void {
    let s = this.effectListService.effectList$.subscribe((effects) => {
      this.effectList = effects?.sort((a, b) => a.rounds - b.rounds);
      this.cdRef.detectChanges();
    });
    this.subscriptions.add(s);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  onEffectRoundsChange(characterId: string, id: string, rounds: number): void {
    this.effectListService.updateEffectRounds(characterId, id, rounds);
  }
}
