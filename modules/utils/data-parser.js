/**
 * Core Data Code Parser for Anyventure
 *
 * This module provides the core data parsing functionality for interpreting
 * data codes from the datakey.txt specification into structured deltas.
 */

import { logError, logWarning } from './logger.js';

/**
 * Create an empty character delta structure
 */
export function createEmptyDelta() {
  return {
    // Core Attributes (1-5)
    attributes: {
      physique: 0,
      finesse: 0,
      mind: 0,
      knowledge: 0,
      social: 0
    },

    // Basic Skills (SSA-SST)
    skills: {
      fitness: 0,
      deflection: 0,
      might: 0,
      endurance: 0,
      evasion: 0,
      stealth: 0,
      coordination: 0,
      thievery: 0,
      resilience: 0,
      concentration: 0,
      senses: 0,
      logic: 0,
      wildcraft: 0,
      academics: 0,
      magic: 0,
      medicine: 0,
      expression: 0,
      presence: 0,
      insight: 0,
      persuasion: 0
    },

    // Skill Dice Tier Modifiers (X = +1, Y = -1)
    skillTierModifiers: {
      fitness: 0,
      deflection: 0,
      might: 0,
      endurance: 0,
      evasion: 0,
      stealth: 0,
      coordination: 0,
      thievery: 0,
      resilience: 0,
      concentration: 0,
      senses: 0,
      logic: 0,
      wildcraft: 0,
      academics: 0,
      magic: 0,
      medicine: 0,
      expression: 0,
      presence: 0,
      insight: 0,
      persuasion: 0
    },

    // Weapon Skills (WS1-WS6, WT1-WT6)
    weaponSkills: {
      brawling: { skill: 0, talent: 0, tier: 0 },
      throwing: { skill: 0, talent: 0, tier: 0 },
      simpleMeleeWeapons: { skill: 0, talent: 0, tier: 0 },
      simpleRangedWeapons: { skill: 0, talent: 0, tier: 0 },
      complexMeleeWeapons: { skill: 0, talent: 0, tier: 0 },
      complexRangedWeapons: { skill: 0, talent: 0, tier: 0 }
    },

    // Magic Skills (YS1-YS5, YT1-YT5)
    magicSkills: {
      black: { skill: 0, talent: 0, tier: 0 },
      primal: { skill: 0, talent: 0, tier: 0 },
      metamagic: { skill: 0, talent: 0, tier: 0 },
      divine: { skill: 0, talent: 0, tier: 0 },
      mysticism: { skill: 0, talent: 0, tier: 0 }
    },

    // Crafting Skills (CS1-CS6, CT1-CT6)
    craftingSkills: {
      engineering: { skill: 0, talent: 0, tier: 0 },
      fabrication: { skill: 0, talent: 0, tier: 0 },
      alchemy: { skill: 0, talent: 0, tier: 0 },
      cooking: { skill: 0, talent: 0, tier: 0 },
      glyphcraft: { skill: 0, talent: 0, tier: 0 },
      bioshaping: { skill: 0, talent: 0, tier: 0 }
    },

    // Mitigations (M1-M9, MA)
    mitigation: {
      physical: 0,
      heat: 0,
      cold: 0,
      electric: 0,
      dark: 0,
      divine: 0,
      aetheric: 0,
      psychic: 0,
      toxic: 0,
      true: 0
    },

    // Resources (A1-A9)
    resources: {
      health: 0,
      resolve: 0,
      energy: 0,
      healthRegen: 0,
      resolveRegen: 0,
      energyRegen: 0,
      maxMorale: 0,
      spellCapacity: 0,
      manaPoints: 0
    },

    // Movement (K1-K4)
    movement: {
      walk: 0,
      swim: 0,
      climb: 0,
      fly: 0
    },

    // Weapon Modifications (AA-AF from Auto codes)
    weaponModifications: {
      simpleRangedMinRange: 0,
      simpleRangedMaxRange: 0,
      complexRangedMinRange: 0,
      complexRangedMaxRange: 0,
      throwingMinRange: 0,
      throwingMaxRange: 0
    },

    // Special Combat Features (AZ from Auto codes)
    combatFeatures: {
      dualWieldTier: 0
    },

    // Immunities (I-series)
    immunities: [],

    // Special abilities (XINE, YINE, ZINE)
    abilities: [],

    // Traits (TA, TG, TC)
    traits: [],

    // Conditionals (C-series) - array-gated effects
    conditionals: {
      noArmor: [],
      lightArmor: [],
      heavyArmor: [],
      anyArmor: [],
      anyShield: [],
      lightShield: [],
      heavyShield: []
    },

    // Boolean flags (F-series) - simple toggles
    flags: {}
  };
}

/**
 * Parse a single data code string and return the delta to apply
 * @param {string} dataCode - The data code to parse (e.g. "SSA=1:WT3=2:M1=3")
 * @returns {Object} - Delta object with bonuses to apply
 */
export function parseDataCode(dataCode) {
  if (!dataCode || typeof dataCode !== 'string') {
    return createEmptyDelta();
  }

  const delta = createEmptyDelta();

  // Split by colon for multiple effects
  const effects = dataCode.split(':').map(e => e.trim()).filter(e => e);

  for (const effect of effects) {
    parseIndividualEffect(effect, delta);
  }

  return delta;
}

/**
 * Parse an individual effect and apply it to the delta
 * @param {string} effect - Single effect string (e.g. "SSA=1")
 * @param {Object} delta - Delta object to modify
 */
function parseIndividualEffect(effect, delta) {
  // Skills (S) - SSA=1, ST1=1, SSA=X, SSA=Y
  const skillMatch = effect.match(/^S([ST])([A-T0-9])=(-?\d+|[XY])$/);
  if (skillMatch) {
    parseSkillEffect(skillMatch, delta);
    return;
  }

  // Weapons (W) - WS1=1, WT3=1, WS1=X, WS1=Y
  const weaponMatch = effect.match(/^W([ST])([1-6])=(-?\d+|[XY])$/);
  if (weaponMatch) {
    parseWeaponEffect(weaponMatch, delta);
    return;
  }

  // Magic (Y) - YS1=1, YT3=1
  const magicMatch = effect.match(/^Y([ST])([1-5])=(-?\d+|[XY])$/);
  if (magicMatch) {
    parseMagicEffect(magicMatch, delta);
    return;
  }

  // Crafting (C) - CS1=1, CT3=1, CS1=X, CS1=Y
  const craftingMatch = effect.match(/^C([ST])([1-6])=(-?\d+|[XY])$/);
  if (craftingMatch) {
    parseCraftingEffect(craftingMatch, delta);
    return;
  }

  // Mitigations (M) - M1=1, M9=2, MA=1
  const mitigationMatch = effect.match(/^M([1-9A])=(-?\d+)$/);
  if (mitigationMatch) {
    parseMitigationEffect(mitigationMatch, delta);
    return;
  }

  // Auto/Resources (A) - A1=1, A9=2
  const autoMatch = effect.match(/^A([1-9A-HMZ])=(-?\d+)$/);
  if (autoMatch) {
    parseAutoEffect(autoMatch, delta);
    return;
  }

  // Movement (K) - K1=2, K4=6
  const movementMatch = effect.match(/^K([1-4])=(-?\d+)$/);
  if (movementMatch) {
    parseMovementEffect(movementMatch, delta);
    return;
  }

  // Immunities (I) - IA=1, IB=1
  const immunityMatch = effect.match(/^I([A-Z])=1$/);
  if (immunityMatch) {
    parseImmunityEffect(immunityMatch, delta);
    return;
  }

  // Conditionals (CC[M1=1,SSE=1], CA[SSE=1], etc.)
  const conditionalMatch = effect.match(/^C([A-G])\[([^\]]+)\]$/);
  if (conditionalMatch) {
    parseConditionalEffect(conditionalMatch, delta);
    return;
  }

  // Boolean flags (F-series): e.g., FA, FB, ... maps to named toggles
  const flagMatch = effect.match(/^F([A-Z])$/);
  if (flagMatch) {
    const code = flagMatch[1];
    const flagMap = {
      'A': 'NO_COMFORTS',
      'B': 'EMBRACE_SUFFERING',
      'C': 'URBAN_COMFORT',
      'D': 'BADGE_OF_HONOR',
      'E': 'WEAPON_COLLECTOR',
      'F': 'TWIN_FURY',
      'G': 'PASSIVE_SHELL',
      'H': 'EFFICIENT_WEAPONRY',
    };
    const key = flagMap[code];
    if (key) delta.flags[key] = true;
    else logWarning(`Unrecognized F-flag code: F${code}`);
    return;
  }

  // Handle trait markers
  const traitMatch = effect.match(/^(T[AGC])$/);
  if (traitMatch) {
    const traitType = traitMatch[1];

    // Collect trait information for later processing
    if (!delta.traits) delta.traits = [];
    delta.traits.push({
      type: traitType === 'TA' ? 'ancestry' : traitType === 'TG' ? 'general' : 'crafting',
      marker: traitType
    });
    return;
  }

  // Trait codes (T) - TA, TG, TC, TX (excluding TP talent points)
  const traitCodeMatch = effect.match(/^T([AGCX])(?:=(.+))?$/);
  if (traitCodeMatch) {
    parseTraitEffect(traitCodeMatch, delta);
    return;
  }

  // Handle TP (talent points) - ignore these as they're not needed
  if (effect.match(/^TP(?:=\d+)?$/)) {
    return;
  }

  // Handle special action/reaction abilities (format: XIME=2, ZINE=1, etc.)
  // Note: This should not be called directly - abilities should be parsed with their names
  const abilityMatch = effect.match(/^([XZ])([ID])([MN])E=(\d+)$/);
  if (abilityMatch) {
    const [_, type, frequency, magicType, energy] = abilityMatch;
    const abilityType = type === 'X' ? 'action' : 'reaction';
    const isDaily = frequency === 'D';
    const isMagic = magicType === 'M';


    // These don't have direct mechanical stat effects, they grant abilities
    if (!delta.abilities) delta.abilities = [];
    delta.abilities.push({
      type: abilityType,
      daily: isDaily,
      magic: isMagic,
      energy: parseInt(energy),
      name: null // Name should be provided separately
    });
    return;
  }

  // Log unrecognized effects for debugging
  logWarning(`Unrecognized effect: ${effect}`);
}

/**
 * Parse skill effects like SSA=1, ST1=1, SSA=X
 */
function parseSkillEffect([_, type, code, valueStr], delta) {
  const value = isNaN(parseInt(valueStr)) ? valueStr : parseInt(valueStr);

  if (type === 'S') { // Skill value or dice tier modifier
    if (/^[1-5]$/.test(code)) {
      // Attribute skill (SS1=1 for Physique)
      const attributeMap = { '1': 'physique', '2': 'finesse', '3': 'mind', '4': 'knowledge', '5': 'social' };
      const attrName = attributeMap[code];
      if (attrName && typeof value === 'number') {
        delta.attributes[attrName] += value;
      }
    } else {
      // Regular skill (SSA=1 for Fitness or SSA=X for dice tier upgrade)
      const skillMap = {
        'A': 'fitness', 'B': 'deflection', 'C': 'might', 'D': 'endurance',
        'E': 'evasion', 'F': 'stealth', 'G': 'coordination', 'H': 'thievery',
        'I': 'resilience', 'J': 'concentration', 'K': 'senses', 'L': 'logic',
        'M': 'wildcraft', 'N': 'academics', 'O': 'magic', 'P': 'medicine',
        'Q': 'expression', 'R': 'presence', 'S': 'insight', 'T': 'persuasion'
      };

      const skillName = skillMap[code];
      if (skillName) {
        if (typeof value === 'string' && (value === 'X' || value === 'Y')) {
          // Handle dice tier modifications
          const modifier = value === 'X' ? 1 : -1;
          delta.skillTierModifiers[skillName] += modifier;
        } else if (typeof value === 'number') {
          delta.skills[skillName] += value;
        }
      }
    }
  }
  // Note: Attribute talents (ST1=1) are not implemented in current system
}

/**
 * Parse weapon effects like WS1=1, WT3=1, WS1=X
 */
function parseWeaponEffect([_, type, code, valueStr], delta) {
  const value = isNaN(parseInt(valueStr)) ? valueStr : parseInt(valueStr);

  const weaponMap = {
    '1': 'brawling',
    '2': 'throwing',
    '3': 'simpleMeleeWeapons',
    '4': 'simpleRangedWeapons',
    '5': 'complexMeleeWeapons',
    '6': 'complexRangedWeapons'
  };

  const weaponName = weaponMap[code];
  if (!weaponName) return;

  if (type === 'S') { // Skill value or dice tier modifier
    if (typeof value === 'string' && (value === 'X' || value === 'Y')) {
      const modifier = value === 'X' ? 1 : -1;
      delta.weaponSkills[weaponName].tier += modifier;
    } else if (typeof value === 'number') {
      delta.weaponSkills[weaponName].skill += value;
    }
  } else if (type === 'T') { // Talent value
    if (typeof value === 'number') {
      delta.weaponSkills[weaponName].talent += value;
    }
  }
}

/**
 * Parse magic effects like YS1=1, YT3=1
 */
function parseMagicEffect([_, type, code, valueStr], delta) {
  const value = parseInt(valueStr);
  if (isNaN(value)) return;

  const magicMap = {
    '1': 'black',
    '2': 'primal',
    '3': 'metamagic',
    '4': 'divine',
    '5': 'mysticism'
  };

  const magicName = magicMap[code];
  if (!magicName) return;

  if (type === 'S') { // Skill value
    delta.magicSkills[magicName].skill += value;
  } else if (type === 'T') { // Talent value
    delta.magicSkills[magicName].talent += value;
  }
}

/**
 * Parse crafting effects like CS1=1, CT3=1, CS1=X
 */
function parseCraftingEffect([_, type, code, valueStr], delta) {
  const value = isNaN(parseInt(valueStr)) ? valueStr : parseInt(valueStr);

  const craftingMap = {
    '1': 'engineering',
    '2': 'fabrication',
    '3': 'alchemy',
    '4': 'cooking',
    '5': 'glyphcraft',
    '6': 'bioshaping'
  };

  const craftingName = craftingMap[code];
  if (!craftingName) return;

  if (type === 'S') { // Skill value or dice tier modifier
    if (typeof value === 'string' && (value === 'X' || value === 'Y')) {
      const modifier = value === 'X' ? 1 : -1;
      delta.craftingSkills[craftingName].tier += modifier;
    } else if (typeof value === 'number') {
      delta.craftingSkills[craftingName].skill += value;
    }
  } else if (type === 'T') { // Talent value
    if (typeof value === 'number') {
      delta.craftingSkills[craftingName].talent += value;
    }
  }
}

/**
 * Parse mitigation effects like M1=1, M9=2, MA=1
 */
function parseMitigationEffect([_, code, valueStr], delta) {
  const value = parseInt(valueStr);
  if (isNaN(value)) return;

  const mitigationMap = {
    '1': 'physical', '2': 'heat', '3': 'cold', '4': 'electric',
    '5': 'dark', '6': 'divine', '7': 'aetheric', '8': 'psychic',
    '9': 'toxic', 'A': 'true'
  };

  const mitigationType = mitigationMap[code];
  if (mitigationType) {
    delta.mitigation[mitigationType] += value;
  }
}

/**
 * Parse auto/resource effects like A1=1, A9=2
 */
function parseAutoEffect([_, code, valueStr], delta) {
  const value = parseInt(valueStr);
  if (isNaN(value)) return;

  const autoMap = {
    '1': 'health', '2': 'resolve', '3': 'energy',
    '5': 'healthRegen', '6': 'resolveRegen', '7': 'energyRegen',
    '8': 'maxMorale', '9': 'spellCapacity', 'M': 'manaPoints'
  };

  const weaponModMap = {
    'A': 'simpleRangedMinRange',
    'B': 'simpleRangedMaxRange',
    'C': 'complexRangedMinRange',
    'D': 'complexRangedMaxRange',
    'E': 'throwingMinRange',
    'F': 'throwingMaxRange'
  };

  if (autoMap[code]) {
    // Simple logging for mana parsing
    if (code === 'M') {
      console.log(`[Data Parser] Adding ${value} mana points`);
    }
    delta.resources[autoMap[code]] += value;
  } else if (weaponModMap[code]) {
    delta.weaponModifications[weaponModMap[code]] += value;
  } else if (code === 'Z') {
    // Handle dual wield tiers (AZ=1 or AZ=2)
    if (value === 1 || value === 2) {
      // Take the highest tier if multiple are applied
      delta.combatFeatures.dualWieldTier = Math.max(delta.combatFeatures.dualWieldTier, value);
    }
  }
}

/**
 * Parse trait effects like TA, TG, TC, TX (excluding TP talent points)
 */
function parseTraitEffect([_, code, value], delta) {
  const traitTypeMap = {
    'A': 'ancestry',
    'G': 'general',
    'C': 'crafting',
    'X': 'general' // TX maps to general traits
  };

  const traitType = traitTypeMap[code];
  if (!traitType) {
    return;
  }

  // Initialize traits array if it doesn't exist
  if (!delta.traits) {
    delta.traits = [];
  }

  // Add trait marker to the delta
  // The value parameter can be used for trait-specific data if needed
  const trait = {
    type: traitType,
    code: `T${code}`,
    value: value || null
  };

  // Check if this trait type already exists and merge if needed
  const existingIndex = delta.traits.findIndex(t => t.code === trait.code);
  if (existingIndex >= 0) {
    // Update existing trait
    if (trait.value !== null) {
      delta.traits[existingIndex].value = trait.value;
    }
  } else {
    // Add new trait
    delta.traits.push(trait);
  }
}

/**
 * Parse movement effects like K1=2, K4=6
 */
function parseMovementEffect([_, code, valueStr], delta) {
  const value = parseInt(valueStr);
  if (isNaN(value)) return;

  const movementMap = {
    '1': 'walk', '2': 'swim', '3': 'climb', '4': 'fly'
  };

  const movementType = movementMap[code];
  if (movementType) {
    delta.movement[movementType] += value;
  }
}

/**
 * Parse immunity effects like IA=1, IB=1
 */
function parseImmunityEffect([_, code], delta) {
  const immunityMap = {
    'A': 'afraid', 'B': 'bleeding', 'C': 'blinded', 'D': 'charmed',
    'E': 'confused', 'F': 'dazed', 'G': 'deafened', 'H': 'diseased',
    'I': 'winded', 'J': 'prone', 'K': 'poisoned', 'L': 'muted',
    'M': 'stunned', 'N': 'impaired', 'O': 'numbed', 'P': 'broken',
    'Q': 'incapacitated', 'R': 'ignited', 'S': 'hidden', 'T': 'maddened'
  };

  const immunityType = immunityMap[code];
  if (immunityType && !delta.immunities.includes(immunityType)) {
    delta.immunities.push(immunityType);
  }
}

/**
 * Parse conditional effects like CC[M1=1,SSE=1]
 */
function parseConditionalEffect([_, conditionType, effectsString], delta) {
  const conditionMap = {
    'A': 'noArmor',
    'B': 'lightArmor',
    'C': 'heavyArmor',
    'D': 'anyArmor',
    'E': 'anyShield',
    'F': 'lightShield',
    'G': 'heavyShield'
  };

  const conditionName = conditionMap[conditionType];
  if (!conditionName) return;

  const effects = effectsString.split(',').map(e => e.trim());

  for (const effectStr of effects) {
    // Create a sub-delta for this conditional effect
    const subDelta = createEmptyDelta();
    parseIndividualEffect(effectStr, subDelta);

    // Convert non-zero values to conditional effects
    addNonZeroValuesToConditional(subDelta, delta.conditionals[conditionName]);
  }
}

/**
 * Helper function to add non-zero values from a delta to conditional effects
 */
function addNonZeroValuesToConditional(subDelta, conditionalArray) {
  // Add skills
  Object.entries(subDelta.skills).forEach(([skill, value]) => {
    if (value !== 0) {
      conditionalArray.push({ type: 'skill', subtype: skill, value });
    }
  });

  // Add mitigation
  Object.entries(subDelta.mitigation).forEach(([type, value]) => {
    if (value !== 0) {
      conditionalArray.push({ type: 'mitigation', subtype: type, value });
    }
  });
}

/**
 * Combine multiple deltas into a single delta
 * @param {Array<Object>} deltas - Array of delta objects to combine
 * @returns {Object} - Combined delta
 */
export function combineDeltas(deltas) {
  const combined = createEmptyDelta();

  for (const delta of deltas) {
    // Combine attributes
    Object.entries(delta.attributes).forEach(([attr, value]) => {
      combined.attributes[attr] += value;
    });

    // Combine skills
    Object.entries(delta.skills).forEach(([skill, value]) => {
      combined.skills[skill] += value;
    });

    // Combine skill dice tier modifiers
    Object.entries(delta.skillTierModifiers).forEach(([skill, modifier]) => {
      combined.skillTierModifiers[skill] += modifier;
    });

    // Combine weapon skills
    Object.entries(delta.weaponSkills).forEach(([weapon, data]) => {
      combined.weaponSkills[weapon].skill += data.skill;
      combined.weaponSkills[weapon].talent += data.talent;
      combined.weaponSkills[weapon].tier += data.tier;
    });

    // Combine magic skills
    Object.entries(delta.magicSkills).forEach(([magic, data]) => {
      combined.magicSkills[magic].skill += data.skill;
      combined.magicSkills[magic].talent += data.talent;
      combined.magicSkills[magic].tier += data.tier;
    });

    // Combine crafting skills
    Object.entries(delta.craftingSkills).forEach(([craft, data]) => {
      combined.craftingSkills[craft].skill += data.skill;
      combined.craftingSkills[craft].talent += data.talent;
      combined.craftingSkills[craft].tier += data.tier;
    });

    // Combine mitigation
    Object.entries(delta.mitigation).forEach(([type, value]) => {
      combined.mitigation[type] += value;
    });

    // Combine resources
    Object.entries(delta.resources).forEach(([resource, value]) => {
      combined.resources[resource] += value;
    });

    // Combine movement
    Object.entries(delta.movement).forEach(([type, value]) => {
      combined.movement[type] += value;
    });

    // Combine weapon modifications
    Object.entries(delta.weaponModifications).forEach(([modification, value]) => {
      combined.weaponModifications[modification] += value;
    });

    // Combine combat features (take highest tier for dual wield)
    Object.entries(delta.combatFeatures).forEach(([feature, value]) => {
      if (feature === 'dualWieldTier') {
        combined.combatFeatures[feature] = Math.max(combined.combatFeatures[feature], value);
      } else {
        combined.combatFeatures[feature] += value;
      }
    });

    // Combine immunities (merge arrays)
    delta.immunities.forEach(immunity => {
      if (!combined.immunities.includes(immunity)) {
        combined.immunities.push(immunity);
      }
    });

    // Combine conditionals
    Object.entries(delta.conditionals).forEach(([condition, effects]) => {
      combined.conditionals[condition].push(...effects);
    });

    // Combine boolean flags
    Object.entries(delta.flags || {}).forEach(([name, val]) => {
      if (val) combined.flags[name] = true;
    });
  }

  return combined;
}

/**
 * Apply a delta to a character object
 * @param {Object} character - The character to modify
 * @param {Object} delta - The delta to apply
 */
export function applyDeltaToCharacter(character, delta) {
  // Apply attributes
  Object.entries(delta.attributes).forEach(([attr, value]) => {
    if (value === 0) return;
    if (!character.attributes || character.attributes[attr] === undefined) return;
    const current = character.attributes[attr];
    // Support both numeric attributes and object form with { value, min, max }
    if (current && typeof current === 'object' && current.value !== undefined) {
      character.attributes[attr].value += value;
    } else {
      character.attributes[attr] += value;
    }
  });

  // Apply skills
  Object.entries(delta.skills).forEach(([skill, value]) => {
    if (value !== 0 && character.skills && character.skills[skill]) {
      character.skills[skill].value += value;
    }
  });

  // Apply skill dice tier modifiers
  Object.entries(delta.skillTierModifiers).forEach(([skill, modifier]) => {
    if (modifier !== 0 && character.skills && character.skills[skill]) {
      if (!character.skills[skill].tier) {
        character.skills[skill].tier = 0;
      }
      character.skills[skill].tier += modifier;
    }
  });

  // Apply weapon skills
  Object.entries(delta.weaponSkills).forEach(([weapon, data]) => {
    if (character.weaponSkills && character.weaponSkills[weapon]) {
      if (data.skill !== 0) character.weaponSkills[weapon].value += data.skill;
      if (data.talent !== 0) character.weaponSkills[weapon].talent += data.talent;
      if (data.tier !== 0) {
        if (!character.weaponSkills[weapon].tier) {
          character.weaponSkills[weapon].tier = 0;
        }
        character.weaponSkills[weapon].tier += data.tier;
      }
    }
  });

  // Apply magic skills
  Object.entries(delta.magicSkills).forEach(([magic, data]) => {
    if (character.magicSkills && character.magicSkills[magic]) {
      if (data.skill !== 0) character.magicSkills[magic].value += data.skill;
      if (data.talent !== 0) character.magicSkills[magic].talent += data.talent;
      if (data.tier !== 0) {
        if (!character.magicSkills[magic].tier) {
          character.magicSkills[magic].tier = 0;
        }
        character.magicSkills[magic].tier += data.tier;
      }
    }
  });

  // Apply crafting skills
  Object.entries(delta.craftingSkills).forEach(([craft, data]) => {
    if (character.craftingSkills && character.craftingSkills[craft]) {
      if (data.skill !== 0) character.craftingSkills[craft].value += data.skill;
      if (data.talent !== 0) character.craftingSkills[craft].talent += data.talent;
      if (data.tier !== 0) {
        if (!character.craftingSkills[craft].tier) {
          character.craftingSkills[craft].tier = 0;
        }
        character.craftingSkills[craft].tier += data.tier;
      }
    }
  });

  // Apply mitigation
  Object.entries(delta.mitigation).forEach(([type, value]) => {
    if (value !== 0) {
      if (!character.mitigation) character.mitigation = {};
      character.mitigation[type] = (character.mitigation[type] || 0) + value;
    }
  });

  // Apply resources
  Object.entries(delta.resources).forEach(([resource, value]) => {
    if (value !== 0) {
      switch (resource) {
        case 'health':
          if (character.resources && character.resources.health) {
            character.resources.health.max += value;
          }
          break;
        case 'resolve':
          if (character.resources && character.resources.resolve) {
            character.resources.resolve.max += value;
          }
          break;
        case 'energy':
          if (character.resources && character.resources.energy) {
            character.resources.energy.max += value;
          }
          break;
        case 'spellCapacity':
          character.spellSlots = (character.spellSlots || 10) + value;
          break;
        case 'maxMorale':
          if (character.resources && character.resources.morale) {
            character.resources.morale.max += value;
          }
          break;
        case 'manaPoints':
          if (character.resources && character.resources.mana) {
            character.resources.mana.max += value;
          }
          break;
      }
    }
  });

  // Apply movement
  Object.entries(delta.movement).forEach(([type, value]) => {
    if (value !== 0) {
      if (type === 'walk') {
        character.movement += value;
      } else {
        // Store for later calculation
        if (!character.movement_bonuses) character.movement_bonuses = {};
        character.movement_bonuses[type] = (character.movement_bonuses[type] || 0) + value;
      }
    }
  });

  // Apply weapon modifications
  Object.entries(delta.weaponModifications).forEach(([modification, value]) => {
    if (value !== 0) {
      if (!character.weaponModifications) character.weaponModifications = {};
      character.weaponModifications[modification] = (character.weaponModifications[modification] || 0) + value;
    }
  });

  // Apply combat features
  Object.entries(delta.combatFeatures).forEach(([feature, value]) => {
    if (value !== 0) {
      if (!character.combatFeatures) character.combatFeatures = {};
      if (feature === 'dualWieldTier') {
        // Take the highest tier
        character.combatFeatures[feature] = Math.max(character.combatFeatures[feature] || 0, value);
      } else {
        character.combatFeatures[feature] = (character.combatFeatures[feature] || 0) + value;
      }
    }
  });

  // Apply immunities
  if (delta.immunities.length > 0) {
    if (!character.immunities) character.immunities = [];
    delta.immunities.forEach(immunity => {
      if (!character.immunities.includes(immunity)) {
        character.immunities.push(immunity);
      }
    });
  }

  // Apply conditionals
  Object.entries(delta.conditionals).forEach(([condition, effects]) => {
    if (effects.length > 0) {
      if (!character.conditionals) character.conditionals = {};
      if (!character.conditionals[condition]) character.conditionals[condition] = [];
      character.conditionals[condition].push(...effects);
    }
  });

  // Apply boolean flags
  if (delta.flags && Object.keys(delta.flags).length > 0) {
    if (!character.conditionals) character.conditionals = {};
    if (!character.conditionals.flags) character.conditionals.flags = {};
    Object.entries(delta.flags).forEach(([name, val]) => {
      if (val) character.conditionals.flags[name] = true;
    });
  }

  // Build aggregated "when" map for conditionals for later use
  // This provides totals per condition (e.g., noArmor) for mitigations and key skills
  if (character.conditionals) {
    const categories = ['noArmor','lightArmor','heavyArmor','anyArmor','anyShield','lightShield','heavyShield'];
    const mitigationKeys = ['physical','heat','cold','electric','dark','divine','aether','psychic','toxic','true'];
    const skillKeys = ['deflection','evasion'];

    const when = {};
    for (const cat of categories) {
      const effects = character.conditionals[cat] || [];
      const agg = {
        mitigation: Object.fromEntries(mitigationKeys.map(k => [k, 0])),
        skills: Object.fromEntries(skillKeys.map(k => [k, 0]))
      };
      for (const eff of effects) {
        if (eff.type === 'mitigation' && agg.mitigation.hasOwnProperty(eff.subtype)) {
          agg.mitigation[eff.subtype] += eff.value || 0;
        } else if (eff.type === 'skill' && agg.skills.hasOwnProperty(eff.subtype)) {
          agg.skills[eff.subtype] += eff.value || 0;
        }
      }
      when[cat] = agg;
    }
    character.conditionals.when = when;
  }
}
