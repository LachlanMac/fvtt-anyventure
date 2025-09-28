/**
 * Anyventure Conditions System
 *
 * Handles Active Effects for conditions, adding custom mechanical data
 * and managing condition-specific logic.
 */

/**
 * Initialize condition system hooks and handlers
 */
export function initializeConditions() {
  // Hook to add custom data to condition Active Effects
  Hooks.on("preCreateActiveEffect", (effect, data, options, userId) => {
    // Add custom mechanical data for specific conditions
    if (effect.statuses.has("maddened")) {
      const actor = effect.parent;
      let startingCheck = 10;

      console.log(actor.name, actor.conditionals.flags);

      // Check for specific traits
      const traits = actor.items.filter(item => item.type === "trait");

      for (const trait of traits) {
        if (trait.name.includes("Mental Fortitude")) {
          startingCheck -= 2;
        }
        if (trait.name.includes("Vulnerable Mind")) {
          startingCheck += 2;
        }
        // Could also check trait.system.effects or trait.system.bonuses
      }

      effect.updateSource({
        "flags.anyventure": {
          checkType: "resilience",
          startingCheck: Math.max(1, startingCheck),
          currentCheck: Math.max(1, startingCheck),
          actionsActive: 0,
          reduceBy:1,
        }
      });
    }
  });
}