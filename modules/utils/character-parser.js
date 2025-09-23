/**
 * Character Parser for FoundryVTT Anyventure System
 *
 * This module provides centralized character parsing functionality
 * in the correct order: Size → Traits → Ancestry → Modules
 */

// Import the data parsing utilities
import { parseDataCode, createEmptyDelta, combineDeltas, applyDeltaToCharacter } from './data-parser.js';

/**
 * Merge one delta into another (mutates target delta)
 * @param {Object} sourceDelta - The delta to merge from
 * @param {Object} targetDelta - The delta to merge into (mutated)
 */
function mergeDeltas(sourceDelta, targetDelta) {
  // Merge attributes
  Object.entries(sourceDelta.attributes).forEach(([attr, value]) => {
    targetDelta.attributes[attr] += value;
  });

  // Merge skills
  Object.entries(sourceDelta.skills).forEach(([skill, value]) => {
    targetDelta.skills[skill] += value;
  });

  // Merge skill dice tier modifiers
  Object.entries(sourceDelta.skillDiceTierModifiers).forEach(([skill, modifier]) => {
    targetDelta.skillDiceTierModifiers[skill] += modifier;
  });

  // Merge weapon skills
  Object.entries(sourceDelta.weaponSkills).forEach(([weapon, data]) => {
    targetDelta.weaponSkills[weapon].skill += data.skill;
    targetDelta.weaponSkills[weapon].talent += data.talent;
    targetDelta.weaponSkills[weapon].diceTierModifier += data.diceTierModifier;
  });

  // Merge magic skills
  Object.entries(sourceDelta.magicSkills).forEach(([magic, data]) => {
    targetDelta.magicSkills[magic].skill += data.skill;
    targetDelta.magicSkills[magic].talent += data.talent;
    targetDelta.magicSkills[magic].diceTierModifier += data.diceTierModifier;
  });

  // Merge crafting skills
  Object.entries(sourceDelta.craftingSkills).forEach(([craft, data]) => {
    targetDelta.craftingSkills[craft].skill += data.skill;
    targetDelta.craftingSkills[craft].talent += data.talent;
    targetDelta.craftingSkills[craft].diceTierModifier += data.diceTierModifier;
  });

  // Merge mitigation
  Object.entries(sourceDelta.mitigation).forEach(([type, value]) => {
    targetDelta.mitigation[type] += value;
  });

  // Merge resources
  Object.entries(sourceDelta.resources).forEach(([resource, value]) => {
    targetDelta.resources[resource] += value;
  });

  // Merge movement
  Object.entries(sourceDelta.movement).forEach(([type, value]) => {
    targetDelta.movement[type] += value;
  });

  // Merge immunities (avoid duplicates)
  sourceDelta.immunities.forEach(immunity => {
    if (!targetDelta.immunities.includes(immunity)) {
      targetDelta.immunities.push(immunity);
    }
  });

  // Merge conditionals
  Object.entries(sourceDelta.conditionals).forEach(([condition, effects]) => {
    targetDelta.conditionals[condition].push(...effects);
  });
}

/**
 * Main function to parse an entire character
 * Calls all parsing functions in the correct order
 * @param {Object} actor - The actor to parse
 * @returns {Object} - Combined delta of all character effects
 */
export function parseCharacter(actor) {
  console.log('Parsing character:', actor.name);

  // Create single delta that will be mutated by all parsing functions
  const delta = createEmptyDelta();

  // 1. Parse size effects
  parseSize(actor, delta);

  // 2. Parse trait effects (commented out for now)
  // parseTrait(actor, delta);

  // 3. Parse ancestry effects (commented out for now)
  // parseAncestry(actor, delta);

  // 4. Parse module effects
  parseModules(actor, delta);

  console.log('Character parsing complete. Final delta:', delta);
  return delta;
}

/**
 * Parse size effects for the character
 * @param {Object} actor - The actor to parse
 * @param {Object} delta - The delta object to mutate
 */
export function parseSize(actor, delta) {
  console.log('Parsing size effects for:', actor.name);

  // Size effects are handled through ancestry options instead of here
  // This function is kept for consistency but does no processing
}

/**
 * Parse trait effects for the character
 * @param {Object} actor - The actor to parse
 * @param {Object} delta - The delta object to mutate
 */
export function parseTrait(actor, delta) {
  console.log('Parsing trait effects for:', actor.name);

  // TODO: Implement trait parsing logic
  // This would handle character traits like:
  // - Background traits
  // - Personality traits
  // - Custom traits

  // Trait parsing logic would go here
  // For example, iterating through actor.system.traits
  // and parsing each trait's data codes, then merging into delta
}

/**
 * Parse ancestry effects for the character
 * @param {Object} actor - The actor to parse
 * @param {Object} delta - The delta object to mutate
 */
export function parseAncestry(actor, delta) {
  console.log('Parsing ancestry effects for:', actor.name);

  // TODO: Implement ancestry parsing logic
  // This would handle racial bonuses like:
  // - Attribute bonuses
  // - Skill bonuses
  // - Special abilities
  // - Resistances/immunities

  // Ancestry parsing logic would go here
  // For example, parsing actor.system.ancestry data codes, then merging into delta
}

/**
 * Parse module effects for the character
 * @param {Object} actor - The actor to parse
 * @param {Object} delta - The delta object to mutate
 */
export function parseModules(actor, delta) {
  console.log('Parsing module effects for:', actor.name);

  // Get all modules from the actor
  const modules = actor.items?.filter(item => item.type === 'module') || [];

  console.log('Found modules:', modules.length);

  for (const module of modules) {
    console.log('Processing module:', module.name);

    // Skip personality modules for point calculations
    const isPersonality = module.system?.mtype === 'personality';

    // Get selected options
    const options = module.system?.options || [];
    const selectedOptions = options.filter(option => option.selected);

    console.log(`Module ${module.name}: ${selectedOptions.length} selected options`);

    // Parse each selected option and apply directly to the delta
    for (const option of selectedOptions) {
      if (option.data) {
        console.log(`✓ Parsing option: ${option.name} with data: ${option.data}`);

        // Split data by colons and parse each part
        const dataParts = option.data.split(':').filter(part => part.trim());
        console.log(`  → Split into ${dataParts.length} data codes:`, dataParts);

        const optionDelta = parseDataCode(option.data);
        console.log(`  → Generated delta:`, optionDelta);

        // Merge this option's delta into the main delta
        mergeDeltas(optionDelta, delta);
      } else {
        console.log(`✗ Skipping option: ${option.name} (no data code)`);
      }
    }
  }

  console.log('Module parsing complete.');
}

/**
 * Apply parsed effects to a character
 * @param {Object} actor - The actor to modify
 * @param {Object} delta - The delta to apply
 */
export function applyParsedEffectsToCharacter(actor, delta) {
  console.log('Applying parsed effects to character:', actor.name);

  // Convert FoundryVTT actor system to format expected by applyDeltaToCharacter
  const character = {
    attributes: actor.system.attributes || {},
    skills: actor.system.skills || {},
    weaponSkills: actor.system.weaponSkills || {},
    magicSkills: actor.system.magicSkills || {},
    craftingSkills: actor.system.craftingSkills || {},
    mitigation: actor.system.mitigation || {},
    resources: actor.system.resources || {},
    movement: actor.system.movement || 0,
    immunities: actor.system.immunities || [],
    conditionals: actor.system.conditionals || {}
  };

  // Apply the delta
  applyDeltaToCharacter(character, delta);

  // Convert back and update the actor
  const updateData = {
    'system.attributes': character.attributes,
    'system.skills': character.skills,
    'system.weaponSkills': character.weaponSkills,
    'system.magicSkills': character.magicSkills,
    'system.craftingSkills': character.craftingSkills,
    'system.mitigation': character.mitigation,
    'system.resources': character.resources,
    'system.movement': character.movement,
    'system.immunities': character.immunities,
    'system.conditionals': character.conditionals
  };

  console.log('Character effects applied. Update data prepared.');
  return updateData;
}

/**
 * Parse character effects and apply them directly to character data (no actor.update calls)
 * Used during prepareDerivedData to avoid infinite loops
 * @param {Object} actor - The actor to process
 */
export function parseAndApplyCharacterEffectsInPlace(actor) {
  try {
    // Guard against re-entry during parsing
    if (actor._isParsingEffects) {
      console.log('Skipping character parsing (already in progress) for:', actor.name);
      return;
    }

    actor._isParsingEffects = true;
    console.log('Starting character parsing (in-place) for:', actor.name);

    // Parse all character effects
    const combinedDelta = parseCharacter(actor);

    // Apply effects directly to the actor's system data (no update call)
    const character = {
      attributes: actor.system.attributes || {},
      skills: actor.system.skills || {},
      weaponSkills: actor.system.weaponSkills || {},
      magicSkills: actor.system.magicSkills || {},
      craftingSkills: actor.system.craftingSkills || {},
      mitigation: actor.system.mitigation || {},
      resources: actor.system.resources || {},
      movement: actor.system.movement || 0,
      immunities: actor.system.immunities || [],
      conditionals: actor.system.conditionals || {}
    };

    // Apply the delta directly
    applyDeltaToCharacter(character, combinedDelta);

    // Update the actor's system data directly (no actor.update call)
    actor.system.attributes = character.attributes;
    actor.system.skills = character.skills;
    actor.system.weaponSkills = character.weaponSkills;
    actor.system.magicSkills = character.magicSkills;
    actor.system.craftingSkills = character.craftingSkills;
    actor.system.mitigation = character.mitigation;
    actor.system.resources = character.resources;
    actor.system.movement = character.movement;
    actor.system.immunities = character.immunities;
    actor.system.conditionals = character.conditionals;

    console.log('Character parsing (in-place) complete for:', actor.name);

  } catch (error) {
    console.error('Error parsing character effects:', error);
  } finally {
    // Always clear the parsing flag
    actor._isParsingEffects = false;
  }
}

/**
 * Full character parsing and application workflow (with actor.update calls)
 * Use this for manual parsing outside of prepareDerivedData
 * @param {Object} actor - The actor to process
 */
export async function parseAndApplyCharacterEffects(actor) {
  try {
    console.log('Starting full character parsing with reset for:', actor.name);

    // First, reset all calculated values to base (like prepareBaseData does)
    await resetCharacterToBase(actor);

    // Parse all character effects
    const combinedDelta = parseCharacter(actor);

    // Apply effects to character
    const updateData = applyParsedEffectsToCharacter(actor, combinedDelta);

    // Update the actor with the new data
    await actor.update(updateData);

    console.log('Character parsing and application complete for:', actor.name);

    // Store the delta for reference
    await actor.update({
      'system.appliedEffects': {
        timestamp: Date.now(),
        delta: combinedDelta
      }
    });

  } catch (error) {
    console.error('Error parsing character effects:', error);
    ui.notifications.error(`Error parsing character effects: ${error.message}`);
  }
}

/**
 * Reset character to base values (like _resetToBaseValues in actor.mjs)
 * @param {Object} actor - The actor to reset
 */
async function resetCharacterToBase(actor) {
  console.log('Resetting character to base values:', actor.name);

  const updateData = {};

  // Reset movement to base value
  updateData['system.movement'] = 6;

  // Reset health max to base (will be recalculated)
  updateData['system.resources.health.max'] = 0;

  // Reset all skills to zero
  if (actor.system.skills) {
    Object.keys(actor.system.skills).forEach(skillKey => {
      updateData[`system.skills.${skillKey}.value`] = 0;
      updateData[`system.skills.${skillKey}.diceTierModifier`] = 0;
    });
  }

  // Reset weapon/magic/crafting skills to base values
  ['weaponSkills', 'magicSkills', 'craftingSkills'].forEach(category => {
    if (actor.system[category]) {
      Object.keys(actor.system[category]).forEach(skillKey => {
        const skill = actor.system[category][skillKey];

        updateData[`system.${category}.${skillKey}.value`] = 0;
        updateData[`system.${category}.${skillKey}.diceTierModifier`] = 0;

        // Reset talent to base talent (character creation choice) if it exists
        if (skill.baseTalent !== undefined) {
          updateData[`system.${category}.${skillKey}.talent`] = skill.baseTalent;
          console.log(`  Reset ${category}.${skillKey} talent to base: ${skill.baseTalent}`);
        } else {
          // If no baseTalent stored, use current talent as base and store it
          updateData[`system.${category}.${skillKey}.baseTalent`] = skill.talent || 0;
          updateData[`system.${category}.${skillKey}.talent`] = skill.talent || 0;
          console.log(`  Stored base talent for ${category}.${skillKey}: ${skill.talent || 0}`);
        }
      });
    }
  });

  // Reset mitigations to zero
  if (actor.system.mitigation) {
    Object.keys(actor.system.mitigation).forEach(key => {
      updateData[`system.mitigation.${key}`] = 0;
    });
  }

  // Reset immunities and conditionals
  updateData['system.immunities'] = [];
  updateData['system.conditionals'] = {
    noArmor: [],
    lightArmor: [],
    heavyArmor: [],
    anyArmor: [],
    anyShield: [],
    lightShield: [],
    heavyShield: []
  };

  // Apply the reset
  await actor.update(updateData);
  console.log('Character reset complete');
}

/**
 * Migration function to add baseTalent to existing characters
 * Call this once to set up baseTalent for characters created before this system
 * @param {Object} actor - The actor to migrate
 */
export async function migrateCharacterBaseTalents(actor) {
  console.log('Migrating base talents for:', actor.name);

  const updateData = {};
  let needsUpdate = false;

  ['weaponSkills', 'magicSkills', 'craftingSkills'].forEach(category => {
    if (actor.system[category]) {
      Object.keys(actor.system[category]).forEach(skillKey => {
        const skill = actor.system[category][skillKey];

        // Only add baseTalent if it doesn't already exist
        if (skill.baseTalent === undefined) {
          updateData[`system.${category}.${skillKey}.baseTalent`] = skill.talent || 0;
          needsUpdate = true;
          console.log(`  Added baseTalent for ${category}.${skillKey}: ${skill.talent || 0}`);
        }
      });
    }
  });

  if (needsUpdate) {
    await actor.update(updateData);
    console.log('Base talent migration complete for:', actor.name);
  } else {
    console.log('No migration needed for:', actor.name);
  }
}