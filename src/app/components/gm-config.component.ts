import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, OnInit, Output } from '@angular/core';
import { GMConfigService } from '../services/gm-config.service';
import { GMConfig } from '../models/gm-config';

@Component({
  selector: 'app-gm-config',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="config-header">
      <span class="icon-button close-button" (click)="close()">&#x26CC;</span>
    </div>
    <div class="config-body">
      <label class="checkbox-container">
        Focus active token
        <input
          type="checkbox"
          [checked]="autoCenterActiveItem"
          (change)="autoCenterActiveItem = !autoCenterActiveItem"
        />
      </label>
    </div>
  `,
  styleUrls: ['./gm-config.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GMConfigComponent implements OnInit {
  @Output() onClose = new EventEmitter();
  autoCenterActiveItem: boolean = false;

  constructor(private gmConfigService: GMConfigService) {}

  ngOnInit(): void {
    const config = this.gmConfigService.config;
    this.autoCenterActiveItem = config.autoCenterActiveItem;
  }

  close(): void {
    const config: GMConfig = {
      autoCenterActiveItem: this.autoCenterActiveItem,
    };

    this.gmConfigService.update(config);
    this.onClose.emit();
  }
}
