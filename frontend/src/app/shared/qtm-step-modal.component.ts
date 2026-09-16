import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Subscription } from 'rxjs';
import { I18nPropertiesService } from '../core/i18n-properties.service';

@Component({
  selector: 'qtm-step-modal',
  standalone: true,
  imports: [CommonModule],
  // Ensure ng-select2 styles are available to components using the modal
  template: `
    <div class="qtm-modal-backdrop">
      <div class="qtm-modal" role="dialog" aria-modal="true">
        <div class="qtm-modal-header">
          <div class="qtm-modal-header-top">
            <span class="qtm-modal-title">{{ title }}</span>
            <button class="qtm-modal-close" type="button" (click)="close.emit()" [attr.aria-label]="t('wizard.modal.close')">
              <span class="qtm-modal-close-circle" aria-hidden="true">
                <span class="qtm-modal-close-icon"></span>
              </span>
            </button>
          </div>
        </div>

        <div class="qtm-modal-stepper">
          <span class="qtm-modal-step-title">
            {{ t('wizard.modal.step') }} {{ step }} {{ t('wizard.modal.of') }} {{ totalSteps }}: {{ stepTitle }}
          </span>
          <span *ngIf="stepDescription" class="qtm-modal-step-description">{{ stepDescription }}</span>
          <div class="qtm-modal-progress-bar">
            <div class="qtm-modal-progress" [style.width.%]="progressPercent"></div>
          </div>
        </div>

        <div class="qtm-modal-content">
          <ng-content></ng-content>
        </div>

        <div class="qtm-modal-actions">
          <ng-content select="[modal-actions]"></ng-content>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./qtm-step-modal.component.css']
})
export class QtmStepModalComponent implements OnInit, OnDestroy {
  @Input() title = '';
  @Input() step = 1;
  @Input() totalSteps = 1;
  @Input() stepTitle = '';
  @Input() stepDescription = '';
  @Output() readonly close = new EventEmitter<void>();

  translations: Record<string, string> = {};
  private readonly subscriptions = new Subscription();

  constructor(private readonly i18nPropertiesService: I18nPropertiesService) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.i18nPropertiesService.loadTranslations(navigator.language).subscribe({
        next: (translationMap) => {
          this.translations = translationMap;
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get progressPercent(): number {
    return this.totalSteps > 1 ? (this.step / this.totalSteps) * 100 : 100;
  }

  t(key: string): string {
    return this.translations[key] ?? key;
  }
}