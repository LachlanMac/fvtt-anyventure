/**
 * Anyventure Formatters
 *
 * This module provides formatting utilities for displaying game data
 * including ranges, categories, and damage types for the Anyventure system.
 */

/**
 * Range definitions for translating KEY values to descriptive text
 */
const RANGE_DEFINITIONS = [
  { key: 0, name: "Self", minUnits: null, maxUnits: null },
  { key: 1, name: "Adjacent", minUnits: 0, maxUnits: 0 },
  { key: 2, name: "Nearby", minUnits: 1, maxUnits: 1 },
  { key: 3, name: "Very Short", minUnits: 2, maxUnits: 5 },
  { key: 4, name: "Short", minUnits: 6, maxUnits: 10 },
  { key: 5, name: "Moderate", minUnits: 11, maxUnits: 20 },
  { key: 6, name: "Distant", minUnits: 21, maxUnits: 40 },
  { key: 7, name: "Remote", minUnits: 41, maxUnits: 100 },
  { key: 8, name: "Planar", minUnits: 100, maxUnits: Infinity }
];

/**
 * Get range category for a specific KEY value
 * @param {number} rangeKey - The range KEY value to look up
 * @returns {Object} - Range category information
 */
function getRangeCategory(rangeKey) {
  const rangeDef = RANGE_DEFINITIONS.find(def => def.key === rangeKey);
  return rangeDef || RANGE_DEFINITIONS[8]; // Default to Planar for out of range
}

/**
 * Convert range KEY values to descriptive range text
 * @param {number} minRangeKey - Minimum range KEY value
 * @param {number} maxRangeKey - Maximum range KEY value
 * @returns {string} - Descriptive range text
 */
export function formatRange(minRangeKey, maxRangeKey) {
  // Handle single range
  if (minRangeKey === maxRangeKey) {
    const category = getRangeCategory(minRangeKey);

    if (category.name === "Self") {
      return "Self";
    } else if (category.name === "Adjacent") {
      return "Adjacent"; // No units for Adjacent
    } else if (category.name === "Nearby") {
      return "Nearby [1 Unit]";
    } else if (category.maxUnits === Infinity) {
      return `${category.name} [${category.minUnits}+ Units]`;
    } else {
      return `${category.name} [${category.minUnits}-${category.maxUnits} Units]`;
    }
  }

  // Handle range spans
  const minCategory = getRangeCategory(minRangeKey);
  const maxCategory = getRangeCategory(maxRangeKey);

  // Special case: Adjacent to Nearby should just show Nearby [1 Unit]
  if (minCategory.name === "Adjacent" && maxCategory.name === "Nearby") {
    return "Nearby [1 Unit]";
  }

  // Special case: If minimum is Adjacent (0 units), ignore it and just show the max range
  if (minCategory.name === "Adjacent" && maxCategory.name !== "Adjacent") {
    if (maxCategory.maxUnits === Infinity) {
      return `${maxCategory.name} [0-${maxCategory.minUnits}+ Units]`;
    } else {
      return `${maxCategory.name} [0-${maxCategory.maxUnits} Units]`;
    }
  }

  if (minCategory.name === maxCategory.name) {
    // Both ranges are in the same category (shouldn't happen with proper keys)
    return `${minCategory.name} [${minCategory.minUnits}-${minCategory.maxUnits} Units]`;
  } else {
    // Ranges span multiple categories
    const minUnits = minCategory.minUnits;
    const maxUnits = maxCategory.maxUnits === Infinity ? `${maxCategory.minUnits}+` : maxCategory.maxUnits;

    return `${minCategory.name} to ${maxCategory.name} [${minUnits}-${maxUnits} Units]`;
  }
}

/**
 * Convert category text to properly formatted display text
 * @param {string} category - The category string to format
 * @returns {string} - Formatted category text
 */
export function formatCategory(category) {
  if (!category) return '';

  // Handle magic categories with underscores
  const magicCategories = {
    'primal_magic': 'Primal Magic',
    'black_magic': 'Black Magic',
    'divine_magic': 'Divine Magic',
    'meta_magic' : 'Meta Magic',
    'mysticism_magic':'Mysticism Magic'
  };

  if (magicCategories[category]) {
    return magicCategories[category];
  }

  // Handle general categories - capitalize first letter and replace underscores with spaces
  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Convert damage type to properly formatted display text and return CSS class
 * @param {string} damageType - The damage type string to format
 * @returns {Object} - Object with formatted text and CSS class
 */
export function formatDamageType(damageType) {
  if (!damageType) return { text: '', cssClass: '' };

  // Capitalize the damage type
  const formattedText = damageType.charAt(0).toUpperCase() + damageType.slice(1).toLowerCase();

  // Return formatted text and corresponding CSS class
  return {
    text: formattedText,
    cssClass: `damage-type-${damageType.toLowerCase()}`
  };
}