import { Component, Inject, computed } from '@angular/core';
import { WORKSPACE_NAVIGATION, WorkspaceNavigation } from '@core/navigation/workspace-navigation';
import { SHARED_IMPORTS } from '@shared/shared-imports';

@Component({
  selector: 'app-access-denied',
  imports: [SHARED_IMPORTS],
  templateUrl: './access-denied.component.html',
})
export class AccessDeniedComponent {
  // System variables
  readonly canReturn = computed(
    () => this.navigation.collections().length > 0 || this.navigation.system().length > 0,
  );

  // Business variables

  constructor(@Inject(WORKSPACE_NAVIGATION) private readonly navigation: WorkspaceNavigation) {}
}

export { AccessDeniedComponent as AccessDenied };
