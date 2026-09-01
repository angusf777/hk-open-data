import type { AccessRecipe, OperatingProfile } from "@hk-open-data/schemas";

import type { RequestPrincipal, Scope } from "../auth.js";
import type { PlatformRepository } from "../repository.js";

export interface RouteContext {
  repository: PlatformRepository;
  clock: () => Date;
  operatingProfile: OperatingProfile;
  accessRecipes: ReadonlyMap<string, AccessRecipe>;
  authenticate(
    authorization: string | undefined,
    requiredScopes: readonly Scope[],
    optional: boolean,
  ): Promise<RequestPrincipal | null>;
}
