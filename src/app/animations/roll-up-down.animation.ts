import { animate, state, style, transition, trigger } from '@angular/animations';

export const slideInOutTrigger = trigger('slideInOut', [
  state('in', style({ transform: 'translateY(0)' })),
  transition('void => *', [style({ transform: 'translateY(-100%)' }), animate('0.2s 0ms ease-out')]),
  transition('* => void', [animate('0.2s 0ms ease-out', style({ transform: 'translateY(-100%)' }))]),
]);
