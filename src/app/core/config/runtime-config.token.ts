import { InjectionToken, makeEnvironmentProviders } from '@angular/core';
import { RuntimeConfig } from './runtime-config';

export const RUNTIME_CONFIG = new InjectionToken<RuntimeConfig>('RuntimeConfig');

export function provideRuntimeConfig(config: RuntimeConfig) {
  return makeEnvironmentProviders([{ provide: RUNTIME_CONFIG, useValue: config }]);
}
