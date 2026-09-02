// Scraper recipe system re-exports
export {
  SCRAPER_RECIPES,
  getRecipeById,
  getRecipesForEntityType,
  resolveRecipeLanguageGroup,
  type RecipeLanguageGroup,
  type ScraperRecipe,
  type ScraperRecipeSlotPlan,
  type ScraperRecipeVariant
} from './recipes'
export {
  assessRecipeAvailability,
  computeRecipeFingerprint,
  materializeRecipe,
  resolveVariantForLocale,
  type MaterializedRecipe,
  type RecipeAvailability,
  type RecipeProviderAvailability
} from './materialize'
