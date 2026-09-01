import type { GeneratedAccessRecipe } from "@hk-open-data/schemas";

export interface AccessRecipeQuery {
  adapter?: string;
  status?: string;
  authentication?: string;
  verificationFreshness?: "current" | "stale" | "never";
  cursor?: string;
  limit: number;
}

export interface AccessRecipePage {
  items: GeneratedAccessRecipe[];
  nextCursor: string | null;
}

export class AccessRegistry {
  readonly #recipes: readonly GeneratedAccessRecipe[];
  readonly #byReference: ReadonlyMap<string, GeneratedAccessRecipe>;
  readonly #clock: () => Date;

  constructor(recipes: readonly GeneratedAccessRecipe[], clock: () => Date) {
    const sorted = [...recipes].sort((left, right) =>
      left.sourceReference.localeCompare(right.sourceReference, "en", { numeric: true }),
    );
    const byReference = new Map<string, GeneratedAccessRecipe>();
    for (const recipe of sorted) {
      if (byReference.has(recipe.sourceReference)) {
        throw new Error(`duplicate access recipe: ${recipe.sourceReference}`);
      }
      byReference.set(recipe.sourceReference, recipe);
    }
    this.#recipes = Object.freeze(sorted);
    this.#byReference = byReference;
    this.#clock = clock;
  }

  get(sourceReference: string): GeneratedAccessRecipe | undefined {
    return this.#byReference.get(sourceReference);
  }

  list(query: AccessRecipeQuery): AccessRecipePage {
    const filtered = this.#recipes.filter(
      (recipe) =>
        (query.adapter === undefined || recipe.adapter === query.adapter) &&
        (query.status === undefined || recipe.effectiveStatus === query.status) &&
        (query.authentication === undefined || recipe.authentication.type === query.authentication) &&
        (query.verificationFreshness === undefined ||
          this.#freshness(recipe) === query.verificationFreshness),
    );
    const start =
      query.cursor === undefined
        ? 0
        : Math.max(
            0,
            filtered.findIndex((recipe) => recipe.sourceReference === query.cursor) + 1,
          );
    const items = filtered.slice(start, start + query.limit);
    const hasMore = start + items.length < filtered.length;
    return {
      items,
      nextCursor: hasMore ? (items.at(-1)?.sourceReference ?? null) : null,
    };
  }

  #freshness(recipe: GeneratedAccessRecipe): "current" | "stale" | "never" {
    if (recipe.verification === null) return "never";
    return new Date(recipe.verification.validUntil).getTime() > this.#clock().getTime()
      ? "current"
      : "stale";
  }
}
