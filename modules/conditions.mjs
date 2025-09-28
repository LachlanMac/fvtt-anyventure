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
    try {
      // Skip if no statuses or not a condition we handle
      if (!effect.statuses || effect.statuses.size === 0) {
        return;
      }

      // Add custom mechanical data for specific conditions
      if (effect.statuses.has("maddened")) {
        const actor = effect.parent;

        // Safety check for actor
        if (!actor) {
          console.warn("Anyventure Conditions: No actor found for effect");
          return;
        }

        let startingCheck = 10;

        // Debug log (safe now with checks)
        console.log(`Adding maddened condition to ${actor.name}`);
        if (actor.system?.conditionals?.flags) {
          console.log("Actor conditional flags:", actor.system.conditionals.flags);
        }

        // Check for specific traits
        const traits = actor.items?.filter(item => item.type === "trait") || [];

        for (const trait of traits) {
          if (trait.name?.includes("Mental Fortitude")) {
            startingCheck -= 2;
            console.log("Found Mental Fortitude trait - reducing DC by 2");
          }
          if (trait.name?.includes("Vulnerable Mind")) {
            startingCheck += 2;
            console.log("Found Vulnerable Mind trait - increasing DC by 2");
          }
          // Could also check trait.system.effects or trait.system.bonuses
        }

        effect.updateSource({
          "flags.anyventure": {
            checkType: "resilience",
            startingCheck: Math.max(1, startingCheck),
            currentCheck: Math.max(1, startingCheck),
            actionsActive: 0,
            reduceBy: 1,
          }
        });

        console.log(`Maddened condition configured with starting DC: ${startingCheck}`);
      }

      // Add handlers for other conditions here as needed
      // Example:
      // if (effect.statuses.has("stunned")) {
      //   effect.updateSource({
      //     "flags.anyventure": {
      //       checkType: "endurance",
      //       startingCheck: 12,
      //       currentCheck: 12,
      //       actionsActive: 0,
      //       reduceBy: 2,
      //     }
      //   });
      // }

    } catch (error) {
      console.error("Anyventure Conditions: Error in preCreateActiveEffect hook", error);
    }
  });
}