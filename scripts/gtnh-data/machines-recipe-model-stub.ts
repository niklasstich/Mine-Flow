// Minimal stand-in for gtnh/src/page.ts's RecipeModel/OverclockResult, scoped to
// exactly what machines.ts's coefficient functions touch. gtnh's real RecipeModel
// is a node in its PageModel/RecipeGroupModel tree (choices persistence, DOM
// rendering, etc.) -- none of that is relevant here; see the banner comment at the
// top of machines.ts for why page.ts itself isn't ported.
//
// Whatever §4 builds to actually run this coefficient model against a specific
// canvas recipe needs to produce an object satisfying this shape.

import type { Recipe } from "./repository-reader";

export type OverclockResult = {
  overclockSpeed: number;
  overclockPower: number;
  perfectOverclocks: number;
  overclockName: string;
};

export interface RecipeModel {
  recipe?: Recipe;
  voltageTier: number;
  choices: { [key: string]: number };
  overclockTiers: number;
  getOutputCount(): number;
  getItemInputCount(): number;
}
