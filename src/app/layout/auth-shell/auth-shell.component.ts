import { Component, ViewEncapsulation } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-shell',
  encapsulation: ViewEncapsulation.None,
  imports: [RouterOutlet],
  styleUrls: ['../../../styles/admin/_auth.scss', '../../../styles/admin/_forms.scss'],
  template: '<router-outlet />',
})
export class AuthShell {}
