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
  Hooks.on("preCreateActiveEffect", async (effect, data, options, userId) => {
    try {
      // Skip if no statuses or not a condition we handle
      if (!effect.statuses || effect.statuses.size === 0) {
        return;
      }

      // Helper function to check if actor is numbed
      const isActorNumbed = (actor) => {
        return actor?.effects?.some(e => e.statuses?.has("numbed")) || false;
      }

      // Helper function to check if actor is broken
      const isActorBroken = (actor) => {
        return actor?.effects?.some(e => e.statuses?.has("broken")) || false;
      }
      // Add custom mechanical data for specific conditions
      if (effect.statuses.has("maddened")) {
        const actor = effect.parent;
        if (!actor) {
          console.warn("Anyventure Conditions: No actor found for effect");
          return;
        }
        let startingCheck = 10;
        const numbed = isActorNumbed(actor);
        const broken = isActorBroken(actor);

        if (actor.system?.conditionals?.flags) {
          console.log("Actor conditional flags:", actor.system.conditionals.flags);
        }

        effect.updateSource({
          "flags.anyventure": {
            checkType: "resilience",
            startingCheck: numbed ? 4 : Math.max(1, startingCheck),
            currentCheck: numbed ? 4 : Math.max(1, startingCheck),
            turnsActive: 0,
            reduceBy: numbed ? 0 : 1,
            noReduce: numbed,
            autoFail: broken, // Broken causes auto-fail on checks against this condition
            interval: "turn", // Recovery check at end of turn
          }
        });
        console.log(`Maddened condition configured with starting DC: ${numbed ? 4 : startingCheck}${numbed ? ' (affected by numbed)' : ''}${broken ? ' (auto-fail due to broken)' : ''}`);
      }

      // Add stunned condition handler
      if (effect.statuses.has("stunned")) {
        const actor = effect.parent;
        if (!actor) {
          console.warn("Anyventure Conditions: No actor found for stunned effect");
          return;
        }
        let startingCheck = 10;
        if (actor.system?.conditionals?.flags) {
          console.log("Actor conditional flags:", actor.system.conditionals.flags);
        }
        effect.updateSource({
          "flags.anyventure": {
            checkType: "concentration",
            startingCheck: Math.max(1, startingCheck),
            currentCheck: Math.max(1, startingCheck),
            actionsActive: 0,
            reduceBy: 1,
            interval: "action", // Must use action to attempt recovery
          }
        });
        console.log(`Stunned condition configured with starting DC: ${startingCheck}`);
      }

      // Add confused condition handler
      if (effect.statuses.has("confused")) {
        const actor = effect.parent;
        if (!actor) {
          console.warn("Anyventure Conditions: No actor found for confused effect");
          return;
        }
        let startingCheck = 10;
        const numbed = isActorNumbed(actor);
        const broken = isActorBroken(actor);

        if (actor.system?.conditionals?.flags) {
          console.log("Actor conditional flags:", actor.system.conditionals.flags);
        }

        effect.updateSource({
          "flags.anyventure": {
            checkType: "concentration",
            startingCheck: numbed ? 4 : Math.max(1, startingCheck),
            currentCheck: numbed ? 4 : Math.max(1, startingCheck),
            turnsActive: 0,
            reduceBy: numbed ? 0 : 1,
            noReduce: numbed,
            autoFail: broken,
            interval: "turn", // Recovery check at end of turn
          }
        });
        console.log(`Confused condition configured with starting DC: ${numbed ? 4 : startingCheck}${numbed ? ' (affected by numbed)' : ''}${broken ? ' (auto-fail due to broken)' : ''}`);
      }

      // Add afraid condition handler
      if (effect.statuses.has("afraid")) {
        const actor = effect.parent;
        if (!actor) {
          console.warn("Anyventure Conditions: No actor found for afraid effect");
          return;
        }
        let startingCheck = 10;
        const numbed = isActorNumbed(actor);
        const broken = isActorBroken(actor);

        if (actor.system?.conditionals?.flags) {
          console.log("Actor conditional flags:", actor.system.conditionals.flags);
        }

        effect.updateSource({
          "flags.anyventure": {
            checkType: "resilience",
            startingCheck: numbed ? 4 : Math.max(1, startingCheck),
            currentCheck: numbed ? 4 : Math.max(1, startingCheck),
            actionsActive: 0,
            reduceBy: numbed ? 0 : 1,
            noReduce: numbed,
            autoFail: broken,
            interval: "action", // Check when attempting to take actions
          }
        });
        console.log(`Afraid condition configured with starting DC: ${numbed ? 4 : startingCheck}${numbed ? ' (affected by numbed)' : ''}${broken ? ' (auto-fail due to broken)' : ''}`);
      }

      // Add numbed condition handler
      if (effect.statuses.has("numbed")) {
        const actor = effect.parent;
        if (!actor) {
          console.warn("Anyventure Conditions: No actor found for numbed effect");
          return;
        }
        let startingCheck = 10;
        if (actor.system?.conditionals?.flags) {
          console.log("Actor conditional flags:", actor.system.conditionals.flags);
        }
        effect.updateSource({
          "flags.anyventure": {
            checkType: "resilience",
            startingCheck: Math.max(1, startingCheck),
            currentCheck: Math.max(1, startingCheck),
            daysActive: 0,
            reduceBy: 1,
            interval: "day", // Recovery check at end of full rest
          }
        });
        console.log(`Numbed condition configured with starting DC: ${startingCheck}`);

        // Update any existing mental conditions to be affected by numbed
        const mentalConditions = ['maddened', 'confused', 'afraid'];
        for (const existingEffect of actor.effects) {
          const hasMenutalCondition = mentalConditions.some(cond => existingEffect.statuses?.has(cond));
          if (hasMenutalCondition) {
            const conditionName = Array.from(existingEffect.statuses)[0];
            console.log(`Updating existing ${conditionName} condition due to numbed`);

            // Update the existing effect's flags
            existingEffect.update({
              "flags.anyventure.currentCheck": 4,
              "flags.anyventure.startingCheck": 4,
              "flags.anyventure.reduceBy": 0,
              "flags.anyventure.noReduce": true,
            });
          }
        }
      }

      // Add dazed condition handler
      if (effect.statuses.has("dazed")) {
        const actor = effect.parent;
        if (!actor) {
          console.warn("Anyventure Conditions: No actor found for dazed effect");
          return;
        }

        effect.updateSource({
          "flags.anyventure": {
            // Dazed doesn't have a recovery check - it ends at end of next turn
            // But we track if penalty has been applied to first defense
            penaltyApplied: false,
            roundsActive: 0,
            interval: "round", // Automatically ends at end of next turn
          }
        });
        console.log(`Dazed condition configured for ${actor.name}`);
      }

      // Add broken condition handler
      if (effect.statuses.has("broken")) {
        const actor = effect.parent;
        if (!actor) {
          console.warn("Anyventure Conditions: No actor found for broken effect");
          return;
        }
        let startingCheck = 12; // DC 12 to recover from broken

        if (actor.system?.conditionals?.flags) {
          console.log("Actor conditional flags:", actor.system.conditionals.flags);
        }

        effect.updateSource({
          "flags.anyventure": {
            checkType: "resilience",
            startingCheck: Math.max(1, startingCheck),
            currentCheck: Math.max(1, startingCheck),
            daysActive: 0,
            reduceBy: 1,  // Reduces by 1 per full rest
            requiresFullRest: true, // Can only be rolled at end of full rest
            // Broken also affects mind, knowledge, social checks
            affectedAttributes: ["mind", "knowledge", "social"],
            penaltyDice: 1,
            interval: "day", // Recovery check at end of full rest
          }
        });
        console.log(`Broken condition configured with starting DC: ${startingCheck}`);

        // Update any existing mental conditions to be auto-fail
        const mentalConditions = ['maddened', 'confused', 'afraid', 'charmed'];
        for (const existingEffect of actor.effects) {
          const hasMentalCondition = mentalConditions.some(cond => existingEffect.statuses?.has(cond));
          if (hasMentalCondition) {
            const conditionName = Array.from(existingEffect.statuses)[0];
            console.log(`Updating existing ${conditionName} condition to auto-fail due to broken`);

            // Update the existing effect's flags
            await existingEffect.update({
              "flags.anyventure.autoFail": true,
            });
          }
        }
      }

      // Add poisoned condition handler
      if (effect.statuses.has("poisoned")) {
        const actor = effect.parent;
        if (!actor) {
          console.warn("Anyventure Conditions: No actor found for poisoned effect");
          return;
        }
        let startingCheck = 10; // Default endurance check

        effect.updateSource({
          "flags.anyventure": {
            checkType: "endurance",
            startingCheck: Math.max(1, startingCheck),
            currentCheck: Math.max(1, startingCheck),
            turnsActive: 0,
            reduceBy: 1, // Check gets easier each turn
            interval: "turn", // Check at end of turn after taking damage
            // Poisoned deals damage at end of turn, then rolls to recover
            damageAtTurnEnd: true,
          }
        });
        console.log(`Poisoned condition configured with starting DC: ${startingCheck}`);
      }

      // Add unconscious condition handler
      if (effect.statuses.has("unconscious")) {
        const actor = effect.parent;
        if (!actor) {
          console.warn("Anyventure Conditions: No actor found for unconscious effect");
          return;
        }

        effect.updateSource({
          "flags.anyventure": {
            // Unconscious uses d12 roll, needs 9+ to recover
            checkType: "special", // Not a normal skill check
            dieType: "d12",
            successOn: 9, // Need 9 or higher
            interval: "turn", // Roll at end of each turn
            // Unconscious characters are extremely vulnerable
            vulnerableToMelee: true,
          }
        });
        console.log(`Unconscious condition configured - d12, success on 9+`);
      }

      // Add ignited condition handler
      if (effect.statuses.has("ignited")) {
        const actor = effect.parent;
        if (!actor) {
          console.warn("Anyventure Conditions: No actor found for ignited effect");
          return;
        }
        let startingCheck = 6; // Coordination check

        effect.updateSource({
          "flags.anyventure": {
            checkType: "coordination",
            startingCheck: Math.max(1, startingCheck),
            currentCheck: Math.max(1, startingCheck),
            actionsActive: 0,
            reduceBy: 0, // DC doesn't change
            interval: "action", // Can attempt as action
            // Ignited deals increasing heat damage
            damageAtTurnEnd: true,
            damageType: "heat",
            baseDamage: 5,
            increasingDamage: true, // +1 each turn, max 10
            maxDamage: 10,
            allyCanHelp: true, // Ally can attempt DC 4 coordination
            allyDC: 4,
          }
        });
        console.log(`Ignited condition configured with starting DC: ${startingCheck}`);
      }

      // Add bleeding condition handler
      if (effect.statuses.has("bleeding")) {
        const actor = effect.parent;
        if (!actor) {
          console.warn("Anyventure Conditions: No actor found for bleeding effect");
          return;
        }
        let startingCheck = 10; // Endurance check

        effect.updateSource({
          "flags.anyventure": {
            checkType: "endurance",
            startingCheck: Math.max(1, startingCheck),
            currentCheck: Math.max(1, startingCheck),
            turnsActive: 0,
            reduceBy: 1, // Gets easier each turn
            interval: "turn", // Check at end of turn after taking damage
            // Bleeding deals 1 damage at end of turn
            damageAtTurnEnd: true,
            damageType: "physical",
            fixedDamage: 1,
            // Special rule: bleeding at 0 health requires resilience check
            dangerousAtZeroHealth: true,
          }
        });
        console.log(`Bleeding condition configured with starting DC: ${startingCheck}`);
      }

    } catch (error) {
      console.error("Anyventure Conditions: Error in preCreateActiveEffect hook", error);
    }
  });
}