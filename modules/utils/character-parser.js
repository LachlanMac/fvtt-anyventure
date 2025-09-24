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

  // Merge abilities (avoid duplicates)
  if (sourceDelta.abilities && sourceDelta.abilities.length > 0) {
    if (!targetDelta.abilities) targetDelta.abilities = [];
    sourceDelta.abilities.forEach(ability => {
      targetDelta.abilities.push(ability);
    });
  }

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

  // Merge boolean flags
  Object.entries(sourceDelta.flags || {}).forEach(([name, val]) => {
    if (val) targetDelta.flags[name] = true;
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
  // 2. Parse trait effects (commented out for now)
  // parseTrait(actor, delta);
  // 3. Parse ancestry effects
  parseAncestry(actor, delta);
  // 4. Parse module effects
  parseModules(actor, delta);
  // 5. Parse traits (TA, TG, TC)
  parseTraits(actor, delta);
  console.log('Character parsing complete. Final delta:', delta);
  return delta;
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
  console.log('=== PARSING ANCESTRY EFFECTS ===');
  console.log('Actor name:', actor.name);

  // Get all ancestry items from the actor
  const ancestries = actor.items?.filter(item => item.type === 'ancestry') || [];
  console.log('Found ancestries:', ancestries.length);

  for (const ancestry of ancestries) {
    console.log(`Processing ancestry: ${ancestry.name}`);
    console.log('Ancestry details:', {
      name: ancestry.name,
      size: ancestry.system?.size,
      homeworld: ancestry.system?.homeworld,
      language: ancestry.system?.language
    });

    // Unlike modules, ancestries automatically give ALL their racial traits
    // All options should already be marked as selected: true
    const options = ancestry.system?.options || [];
    console.log(`Ancestry has ${options.length} racial traits to apply`);

    if (options.length > 0) {
      console.log('All ancestry traits:', options.map(opt => ({
        name: opt.name,
        description: opt.description.substring(0, 100) + '...',
        data: opt.data,
        selected: opt.selected
      })));
    }

    // Get selected subchoices from flags for this ancestry
    const selectedOptionsFlags = ancestry.flags?.anyventure?.selectedOptions || [];
    console.log('Selected options from flags:', selectedOptionsFlags);

    // Process ALL ancestry options (they should all be selected: true)
    for (const option of options) {
      console.log(`Processing racial trait: ${option.name}`);

      // Check if this option has subchoices
      if (option.subchoices && option.subchoices.length > 0) {
        console.log(`  → Option has ${option.subchoices.length} subchoices, looking for selected one...`);

        // Find which subchoice was selected from flags
        const selectedFlag = selectedOptionsFlags.find(flag => flag.name === option.name);
        if (selectedFlag && selectedFlag.selectedSubchoice) {
          const selectedSubchoice = option.subchoices.find(sub => sub.id === selectedFlag.selectedSubchoice);

          if (selectedSubchoice) {
            console.log(`✓ Applying subchoice: ${selectedSubchoice.name} (${selectedSubchoice.id})`);
            console.log(`  → Data code: ${selectedSubchoice.data}`);

            // Check if this contains an ability code (XIME=1, ZINE=2, etc.)
            const hasAbilityCode = selectedSubchoice.data && selectedSubchoice.data.match(/[XZ][ID][MN]E=\d+/);

            const subchoiceDelta = parseDataCode(selectedSubchoice.data);

            // If abilities were added, use the SUBCHOICE's name and description
            if (hasAbilityCode && subchoiceDelta.abilities && subchoiceDelta.abilities.length > 0) {
              subchoiceDelta.abilities.forEach(ability => {
                ability.name = selectedSubchoice.name || 'Unknown Ability';
                ability.description = selectedSubchoice.description || '';
              });
            }

            console.log(`  → Generated delta:`, subchoiceDelta);

            mergeDeltas(subchoiceDelta, delta);
          } else {
            console.log(`⚠ Could not find subchoice "${selectedFlag.selectedSubchoice}" for option "${option.name}"`);
          }
        } else {
          console.log(`⚠ No subchoice selected for option "${option.name}" that requires choice`);
        }
      } else if (option.data) {
        // Regular option with direct data code
        console.log(`✓ Applying racial trait: ${option.name}`);
        console.log(`  → Data code: ${option.data}`);

        // Check if this contains an ability code (XIME=1, ZINE=2, etc.)
        const hasAbilityCode = option.data.match(/[XZ][ID][MN]E=\d+/);

        const optionDelta = parseDataCode(option.data);

        // If abilities were added, use the OPTION's name and description
        if (hasAbilityCode && optionDelta.abilities && optionDelta.abilities.length > 0) {
          optionDelta.abilities.forEach(ability => {
            ability.name = option.name || 'Unknown Ability';
            ability.description = option.description || '';
          });
        }

        console.log(`  → Generated delta:`, optionDelta);

        mergeDeltas(optionDelta, delta);
      } else {
        console.log(`ℹ Racial trait "${option.name}" has no mechanical effects (no data code)`);
      }
    }

    // Size-based skill modifications are handled automatically through ancestry data codes
    // (e.g., SSA=Y:SSB=Y:SSC=Y:SSD=Y:SSE=X:SSF=X:SSG=X:SSH=X for Small size)
    // No additional processing needed here
  }

  console.log('=== ANCESTRY PARSING COMPLETE ===');
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
  for (const module of modules) {
    console.log('Processing module:', module.name);

    // Skip personality modules for point calculations
    const isPersonality = module.system?.mtype === 'personality';

    // Get selected options
    const options = module.system?.options || [];
    const selectedOptions = options.filter(option => option.selected);
    // Parse each selected option and apply directly to the delta
    for (const option of selectedOptions) {
      if (option.data) {
        // Check if this contains an ability code (XIME=1, ZINE=2, etc.)
        const hasAbilityCode = option.data.match(/[XZ][ID][MN]E=\d+/);

        if (hasAbilityCode) {
          // Parse the data code
          const optionDelta = parseDataCode(option.data);

          // If abilities were added, use the OPTION's name and description
          if (optionDelta.abilities && optionDelta.abilities.length > 0) {
            optionDelta.abilities.forEach(ability => {
              ability.name = option.name || 'Unknown Ability'; // Use the OPTION's name field
              ability.description = option.description || ''; // Use the OPTION's description field
            });
          }

          mergeDeltas(optionDelta, delta);
        } else {
          // Normal parsing for non-ability data
          const optionDelta = parseDataCode(option.data);
          mergeDeltas(optionDelta, delta);
        }
      } else {
        //console.log(`✗ Skipping option: ${option.name} (no data code)`);
      }
    }
  }

  console.log('Module parsing complete.');
}

/**
 * Parse traits and collect them by category
 * @param {Object} actor - The actor to parse
 * @param {Object} delta - The delta object to mutate
 */
export function parseTraits(actor, delta) {
  console.log('=== PARSING TRAITS ===');
  console.log('Actor name:', actor.name);

  if (!delta.traits || delta.traits.length === 0) {
    console.log('No traits to parse');
    return;
  }

  // Initialize trait collections if not present
  if (!delta.traitCollections) {
    delta.traitCollections = {
      ancestry: [],
      general: [],
      crafting: []
    };
  }

  // Get all modules from the actor to extract trait information
  const modules = actor.items?.filter(item => item.type === 'module') || [];

  console.log(`Found ${delta.traits.length} trait markers to process`);

  for (const traitMarker of delta.traits) {
    console.log(`Processing trait marker: ${traitMarker.marker} (${traitMarker.type})`);

    // Find modules that contain this trait marker
    for (const module of modules) {
      const options = module.system?.options || [];
      const selectedOptions = options.filter(option => option.selected && option.data);

      for (const option of selectedOptions) {
        // Check if this option contains the trait marker
        if (option.data.includes(traitMarker.marker)) {
          console.log(`Found trait in module "${module.name}", option "${option.name}"`);

          // Create trait object
          const trait = {
            name: option.name,
            description: option.description,
            source: module.name,
            marker: traitMarker.marker,
            moduleId: module._id,
            optionId: option._id || option.name
          };

          // Add to appropriate collection
          delta.traitCollections[traitMarker.type].push(trait);
        }
      }
    }
  }

  console.log('Trait collections:', delta.traitCollections);
  console.log('=== TRAIT PARSING COMPLETE ===');
}

/**
 * Apply parsed effects to a character
 * @param {Object} actor - The actor to modify
 * @param {Object} delta - The delta to apply
 */
export function applyParsedEffectsToCharacter(actor, delta) {
  console.log('Applying parsed effects to character:', actor.name);

  // Convert FoundryVTT actor system to format expected by applyDeltaToCharacter
  const dup = (v) => (foundry?.utils?.duplicate ? foundry.utils.duplicate(v) : JSON.parse(JSON.stringify(v)));
  const character = {
    attributes: dup(actor.system.attributes || {}),
    skills: dup(actor.system.basic || {}),          // FoundryVTT stores basic skills in 'basic', not 'skills'
    weaponSkills: dup(actor.system.weapon || {}),   // FoundryVTT stores weapon skills in 'weapon'
    magicSkills: dup(actor.system.magic || {}),     // FoundryVTT stores magic skills in 'magic'
    craftingSkills: dup(actor.system.crafting || {}),  // FoundryVTT stores crafting skills in 'crafting'
    mitigation: dup(actor.system.mitigation || {}),
    resources: dup(actor.system.resources || {}),
    movement: dup(actor.system.movement ?? 0),
    immunities: dup(actor.system.immunities || []),
    conditionals: dup(actor.system.conditionals || {})
  };

  // Ensure baseline resource maxima before applying deltas (so +X adds to defaults, not zero)
  const r = character.resources || (character.resources = {});
  const ensureObj = (o) => (o && typeof o === 'object') ? o : { value: undefined, max: 0, temp: 0 };
  r.health = ensureObj(r.health);
  r.resolve = ensureObj(r.resolve);
  r.morale = ensureObj(r.morale);
  r.energy = ensureObj(r.energy);
  const baseMax = { health: 20, resolve: 20, morale: 10, energy: 5 };
  if (!r.health.max) r.health.max = baseMax.health;
  if (!r.resolve.max) r.resolve.max = baseMax.resolve;
  if (!r.morale.max) r.morale.max = baseMax.morale;
  if (!r.energy.max) r.energy.max = baseMax.energy;

  // Apply the delta
  applyDeltaToCharacter(character, delta);

  // Convert back and update the actor
  const updateData = {
    'system.attributes': character.attributes,
    'system.basic': character.skills,          // Convert back to FoundryVTT structure
    'system.weapon': character.weaponSkills,   // Convert back to FoundryVTT structure
    'system.magic': character.magicSkills,     // Convert back to FoundryVTT structure
    'system.crafting': character.craftingSkills,  // Convert back to FoundryVTT structure
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
    // Block ephemeral overlays and baseline restore during rebuild
    actor._blockOverlays = true;
    actor._suspendRestore = true;
    // First, reset all calculated values to base (like prepareBaseData does)
    await resetCharacterToBase(actor);

    // Parse all character effects
    const combinedDelta = parseCharacter(actor);

    // Parse and create ability items
    await parseAbilities(actor, combinedDelta);

  // Apply effects to character (returns a plain, detached structure)
  const updateDataRaw = applyParsedEffectsToCharacter(actor, combinedDelta);
  const dup = (v) => (foundry?.utils?.duplicate ? foundry.utils.duplicate(v) : JSON.parse(JSON.stringify(v)));
  // Deep-clone to avoid any mutation by prepareDerivedData during the update cycle
  const updateData = dup(updateDataRaw);

  // Ensure resource base defaults are present in the recalculated data
  const ensureBaseResources = (res) => {
    const r = res || {};
    const h = r.health || (r.health = { value: undefined, max: 0, temp: 0 });
    const rv = r.resolve || (r.resolve = { value: undefined, max: 0, temp: 0 });
    const m = r.morale || (r.morale = { value: undefined, max: 0, temp: 0 });
    const e = r.energy || (r.energy = { value: undefined, max: 0, temp: 0 });
    const base = { health: 20, resolve: 20, morale: 10, energy: 5 };
    if (!h.max) h.max = base.health;
    if (!rv.max) rv.max = base.resolve;
    if (!m.max) m.max = base.morale;
    if (!e.max) e.max = base.energy;
    // Only clamp current down if it exceeds max; never raise it to max
    if (typeof h.value === 'number' && h.value > h.max) h.value = h.max;
    if (typeof rv.value === 'number' && rv.value > rv.max) rv.value = rv.max;
    if (typeof m.value === 'number' && m.value > m.max) m.value = m.max;
    if (typeof e.value === 'number' && e.value > e.max) e.value = e.max;
    return r;
  };

  updateData['system.resources'] = ensureBaseResources(updateData['system.resources']);

  // Ensure movement base defaults are present in the recalculated data
  const ensureBaseMovement = (mv) => {
    const m = mv || {};
    if (typeof m === 'number') {
      return { walk: m || 5, swim: Math.floor((m || 5) / 2), climb: Math.floor((m || 5) / 2), fly: 0 };
    }
    // Normalize to full object with defaults
    return {
      walk: typeof m.walk === 'number' ? m.walk : 5,
      swim: typeof m.swim === 'number' ? m.swim : 0,
      climb: typeof m.climb === 'number' ? m.climb : 0,
      fly: typeof m.fly === 'number' ? m.fly : 0
    };
  };

  updateData['system.movement'] = ensureBaseMovement(updateData['system.movement']);

  // Create a persistent base snapshot from the recalculated state only
  // Use the fresh updateData to avoid capturing any transient/derived values
  const baseSnapshot = {
    attributes: dup(updateData['system.attributes'] || {}),
    basic: dup(updateData['system.basic'] || {}),
    weapon: dup(updateData['system.weapon'] || {}),
    magic: dup(updateData['system.magic'] || {}),
    crafting: dup(updateData['system.crafting'] || {}),
    mitigation: dup(updateData['system.mitigation'] || {}),
    resources: dup(updateData['system.resources'] || {}),
    movement: dup(updateData['system.movement'] || { walk: 5, swim: 0, climb: 0, fly: 0 })
  };
  updateData['system._base'] = dup(baseSnapshot);

    // Update the actor with the new data (including base snapshot)
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
  } finally {
    actor._blockOverlays = false;
    actor._suspendRestore = false;
    // Run a fresh prepare pass so overlays apply and sheets see final derived values
    try {
      actor.prepareData();
    } catch (prepErr) {
      console.warn('Post-recalculate prepareData failed:', prepErr);
    }
  }
}

/**
 * Reset character to base values (like _resetToBaseValues in actor.mjs)
 * @param {Object} actor - The actor to reset
 */
async function resetCharacterToBase(actor) {
  console.log('Resetting character to base values:', actor.name);

  const updateData = {};

  // Do not force movement here; movement is normalized later in the pass

  // Reset health max to base (will be recalculated)
  updateData['system.resources.health.max'] = 0;
  updateData['system.resources.energy.max'] = 0;
  updateData['system.resources.resolve.max'] = 0;
  updateData['system.resources.morale.max'] = 0;

  // Reset basic skills to zero (stored in system.basic in FoundryVTT)
  if (actor.system.basic) {
    Object.keys(actor.system.basic).forEach(skillKey => {
      updateData[`system.basic.${skillKey}.value`] = 0;
      if (actor.system.basic[skillKey].diceTierModifier !== undefined) {
        updateData[`system.basic.${skillKey}.diceTierModifier`] = 0;
      }
    });
  }

  // Reset weapon/magic/crafting skills to base values (using correct FoundryVTT structure)
  const skillCategories = [
    { system: 'weapon', name: 'weapon' },
    { system: 'magic', name: 'magic' },
    { system: 'crafting', name: 'crafting' }
  ];

  skillCategories.forEach(({ system: systemKey, name: categoryName }) => {
    if (actor.system[systemKey]) {
      Object.keys(actor.system[systemKey]).forEach(skillKey => {
        const skill = actor.system[systemKey][skillKey];

        updateData[`system.${systemKey}.${skillKey}.value`] = 0;
        updateData[`system.${systemKey}.${skillKey}.diceTierModifier`] = 0;

        // Reset talent to base talent (character creation choice) if it exists
        if (skill.baseTalent !== undefined) {
          updateData[`system.${systemKey}.${skillKey}.talent`] = skill.baseTalent;
          console.log(`  Reset ${categoryName}.${skillKey} talent to base: ${skill.baseTalent}`);
        } else {
          // If no baseTalent stored, use current talent as base and store it
          updateData[`system.${systemKey}.${skillKey}.baseTalent`] = skill.talent || 0;
          updateData[`system.${systemKey}.${skillKey}.talent`] = skill.talent || 0;
          console.log(`  Stored base talent for ${categoryName}.${skillKey}: ${skill.talent || 0}`);
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

  // Reset immunities and conditionals (preserve boolean flags if present)
  updateData['system.immunities'] = [];
  const existingFlags = actor.system.conditionals?.flags || {};
  updateData['system.conditionals'] = {
    noArmor: [],
    lightArmor: [],
    heavyArmor: [],
    anyArmor: [],
    anyShield: [],
    lightShield: [],
    heavyShield: [],
    flags: existingFlags
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

/**
 * Parse abilities (actions/reactions/passives) and create items
 * @param {Object} actor - The actor to process
 * @param {Object} delta - The delta containing abilities to process
 */
export async function parseAbilities(actor, delta) {
  console.log('=== PARSING ABILITIES ===');
  console.log('Actor name:', actor.name);

  // Prevent infinite loops during item creation
  if (actor._isCreatingAbilities) {
    console.log('Skipping ability parsing (already creating abilities)');
    return;
  }

  if (!delta.abilities || delta.abilities.length === 0) {
    console.log('No abilities to parse');
    return;
  }

  console.log(`Found ${delta.abilities.length} abilities to process:`, delta.abilities);

  // Set flag to prevent re-parsing during item creation
  actor._isCreatingAbilities = true;

  try {
    for (const ability of delta.abilities) {
      await processAbility(actor, ability);
    }
  } finally {
    // Always clear the flag
    actor._isCreatingAbilities = false;
  }

  console.log('=== ABILITY PARSING COMPLETE ===');
}

/**
 * Process a single ability and create/update the corresponding item
 * @param {Object} actor - The actor to process
 * @param {Object} ability - The ability data from delta
 */
async function processAbility(actor, ability) {
  console.log(`Processing ability:`, ability);

  const { type, daily, magic, energy, name, description } = ability;

  // Use the provided name or generate one if not available
  const abilityName = name || (() => {
    const dailyText = daily ? 'Daily' : '';
    const magicText = magic ? 'Magic' : '';
    const parts = [dailyText, magicText, `${type.charAt(0).toUpperCase() + type.slice(1)} Ability`].filter(part => part);
    return parts.join(' ');
  })();

  // Try to find the ability in compendiums first
  let abilityData = await findAbilityInCompendium(type, daily, magic, energy, abilityName);

  if (!abilityData) {
    // Create a basic ability item if not found in compendium
    abilityData = {
      name: abilityName,
      type: type,
      system: {
        description: description || '', // Use the description from the module option
        source: "Character Progression",
        energy: energy,
        daily: daily,
        magic: magic,
        used: false,
        abilityType: type,
        anyventure_id: `generated_${type}_${Date.now()}` // Temporary ID
      }
    };
  }

  // Check if this ability already exists on the character (by anyventure_id or name)
  const existingAbility = actor.items.find(item =>
    (item.system?.anyventure_id && item.system.anyventure_id === abilityData.system.anyventure_id) ||
    (item.type === type && item.name === abilityData.name)
  );

  if (existingAbility) {
    console.log(`Ability "${abilityData.name}" already exists, skipping creation`);
    return;
  }

  console.log(`Creating ability item:`, abilityData);

  try {
    const createdItem = await actor.createEmbeddedDocuments('Item', [abilityData]);
    console.log(`✓ Created ability: ${abilityData.name}`);
  } catch (error) {
    console.error(`✗ Failed to create ability "${abilityData.name}":`, error);
  }
}

/**
 * Search for an ability in compendiums
 * @param {string} type - The ability type (action, reaction, passive)
 * @param {boolean} daily - Whether it's a daily ability
 * @param {boolean} magic - Whether it's a magical ability
 * @param {number} energy - Energy cost
 * @param {string} name - The name of the ability
 * @returns {Object|null} - The ability data if found, null otherwise
 */
async function findAbilityInCompendium(type, daily, magic, energy, name) {
  console.log(`Searching compendiums for ability: "${name}" (${type}, daily: ${daily}, magic: ${magic}, energy: ${energy})`);

  try {
    // Look for actions/reactions/passives compendium in anyventure-core-data
    const pack = game.packs.get('anyventure-core-data.actions') ||
                 game.packs.get('anyventure-core-data.abilities');

    if (!pack) {
      console.log('No abilities compendium found, will create basic ability');
      return null;
    }

    // Search the compendium for abilities of the specified type
    const packContent = await pack.getDocuments();

    // Look for ability matching type, daily, magic, and energy properties
    const matchingAbility = packContent.find(item =>
      item.type === type &&
      item.system?.abilityType === type &&
      item.system?.daily === daily &&
      item.system?.magic === magic &&
      item.system?.energy === energy
    );

    // If no exact match, look for any ability of the correct type as fallback
    const fallbackAbility = !matchingAbility ? packContent.find(item =>
      item.type === type &&
      item.system?.abilityType === type
    ) : null;

    const abilityToUse = matchingAbility || fallbackAbility;

    if (abilityToUse) {
      const exactMatch = !!matchingAbility;
      console.log(`Found ability in compendium: ${abilityToUse.name} (${exactMatch ? 'exact match' : 'fallback match'})`);

      // Convert to plain object for item creation
      const abilityData = {
        name: abilityToUse.name,
        type: abilityToUse.type,
        system: abilityToUse.system.toObject ? abilityToUse.system.toObject() : { ...abilityToUse.system }
      };

      // If using fallback, update the properties to match what was requested
      if (!exactMatch) {
        abilityData.system.daily = daily;
        abilityData.system.magic = magic;
        abilityData.system.energy = energy;
        console.log(`Updated fallback ability properties: daily=${daily}, magic=${magic}, energy=${energy}`);
      }

      return abilityData;
    }

    console.log(`No matching ${type} ability found in compendium`);
    return null;

  } catch (error) {
    console.error('Error searching compendium for abilities:', error);
    return null;
  }
}
