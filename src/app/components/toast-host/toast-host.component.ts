import { Component } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { ToastService, ToastViewModel } from '../../services/toast.service';

@Component({
  selector: 'app-toast-host',
  standalone: true,
  imports: [NgFor, NgIf],
  templateUrl: './toast-host.component.html',
  styleUrl: './toast-host.component.css',
})
export class ToastHostComponent {
  constructor(protected readonly toasts: ToastService) {}

  protected trackById(_index: number, toast: ToastViewModel): string {
    return toast.id;
  }
}
