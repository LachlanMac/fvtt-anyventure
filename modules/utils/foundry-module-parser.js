/**
 * FoundryVTT Module Data Parser
 *
 * This module provides parsing functionality specifically for FoundryVTT module data
 * using the unified data-parser system.
 */

import { parseDataCode, createEmptyDelta, combineDeltas } from './data-parser.js';

/**
 * Parse a single module option and return its delta
 * @param {Object} option - Module option with data field
 * @returns {Object} - Delta object representing the option's effects
 */
export function parseModuleOption(option) {
  if (!option || !option.data) {
    return createEmptyDelta();
  }

  return parseDataCode(option.data);
}

/**
 * Parse multiple selected options from a module
 * @param {Array} selectedOptions - Array of selected option objects with location field
 * @param {Array} moduleOptions - Array of all module options
 * @returns {Object} - Combined delta from all selected options
 */
export function parseSelectedModuleOptions(selectedOptions, moduleOptions) {
  if (!selectedOptions || !moduleOptions) {
    return createEmptyDelta();
  }

  const deltas = [];

  for (const selected of selectedOptions) {
    // Find the actual option data
    const option = moduleOptions.find(opt => opt.location === selected.location);
    if (option) {
      const delta = parseModuleOption(option);
      deltas.push(delta);
    }
  }

  return combineDeltas(deltas);
}

/**
 * Parse an entire character's modules and return combined effects
 * @param {Array} characterModules - Array of character module objects
 * @returns {Object} - Combined delta from all character modules
 */
export function parseCharacterModules(characterModules) {
  if (!characterModules || characterModules.length === 0) {
    return createEmptyDelta();
  }

  const deltas = [];

  for (const moduleItem of characterModules) {
    // Skip if moduleId isn't populated
    if (!moduleItem.moduleId || typeof moduleItem.moduleId === 'string') {
      continue;
    }

    // Get selected options
    const selectedOptions = moduleItem.selectedOptions || [];

    // Skip if no options are selected
    if (selectedOptions.length === 0) {
      continue;
    }

    // Parse this module's contributions
    const module = moduleItem.moduleId;
    const moduleDelta = parseSelectedModuleOptions(selectedOptions, module.options);
    deltas.push(moduleDelta);
  }

  return combineDeltas(deltas);
}

/**
 * Convert a FoundryVTT item with options to character effect data
 * @param {Object} foundryItem - FoundryVTT item object with system.options
 * @returns {Object} - Combined delta from selected options
 */
export function parseFoundryModuleItem(foundryItem) {
  if (!foundryItem || !foundryItem.system || !foundryItem.system.options) {
    return createEmptyDelta();
  }

  const deltas = [];

  // Process each selected option
  for (const option of foundryItem.system.options) {
    if (option.selected) {
      const delta = parseDataCode(option.data || '');
      deltas.push(delta);
    }
  }

  return combineDeltas(deltas);
}

/**
 * Get a human-readable summary of a delta's effects
 * @param {Object} delta - Delta object to summarize
 * @returns {Object} - Summary object with categories and effects
 */
export function getDeltaSummary(delta) {
  const summary = {
    attributes: [],
    skills: [],
    weaponSkills: [],
    magicSkills: [],
    craftingSkills: [],
    mitigation: [],
    resources: [],
    movement: [],
    immunities: [],
    abilities: [],
    conditionals: []
  };

  // Summarize attributes
  Object.entries(delta.attributes).forEach(([attr, value]) => {
    if (value !== 0) {
      summary.attributes.push(`${attr.charAt(0).toUpperCase() + attr.slice(1)}: ${value > 0 ? '+' : ''}${value}`);
    }
  });

  // Summarize skills
  Object.entries(delta.skills).forEach(([skill, value]) => {
    if (value !== 0) {
      const skillName = skill.charAt(0).toUpperCase() + skill.slice(1);
      summary.skills.push(`${skillName}: ${value > 0 ? '+' : ''}${value}`);
    }
  });

  // Summarize dice tier modifiers
  Object.entries(delta.skillDiceTierModifiers).forEach(([skill, modifier]) => {
    if (modifier !== 0) {
      const skillName = skill.charAt(0).toUpperCase() + skill.slice(1);
      const modText = modifier > 0 ? 'upgrade' : 'downgrade';
      summary.skills.push(`${skillName}: dice ${modText}`);
    }
  });

  // Summarize weapon skills
  Object.entries(delta.weaponSkills).forEach(([weapon, data]) => {
    if (data.skill !== 0 || data.talent !== 0 || data.diceTierModifier !== 0) {
      const weaponName = weapon.replace(/([A-Z])/g, ' $1').trim();
      const parts = [];
      if (data.skill !== 0) parts.push(`skill ${data.skill > 0 ? '+' : ''}${data.skill}`);
      if (data.talent !== 0) parts.push(`talent ${data.talent > 0 ? '+' : ''}${data.talent}`);
      if (data.diceTierModifier !== 0) parts.push(`dice ${data.diceTierModifier > 0 ? 'upgrade' : 'downgrade'}`);
      summary.weaponSkills.push(`${weaponName}: ${parts.join(', ')}`);
    }
  });

  // Summarize magic skills
  Object.entries(delta.magicSkills).forEach(([magic, data]) => {
    if (data.skill !== 0 || data.talent !== 0 || data.diceTierModifier !== 0) {
      const magicName = magic.charAt(0).toUpperCase() + magic.slice(1);
      const parts = [];
      if (data.skill !== 0) parts.push(`skill ${data.skill > 0 ? '+' : ''}${data.skill}`);
      if (data.talent !== 0) parts.push(`talent ${data.talent > 0 ? '+' : ''}${data.talent}`);
      if (data.diceTierModifier !== 0) parts.push(`dice ${data.diceTierModifier > 0 ? 'upgrade' : 'downgrade'}`);
      summary.magicSkills.push(`${magicName}: ${parts.join(', ')}`);
    }
  });

  // Summarize crafting skills
  Object.entries(delta.craftingSkills).forEach(([craft, data]) => {
    if (data.skill !== 0 || data.talent !== 0 || data.diceTierModifier !== 0) {
      const craftName = craft.charAt(0).toUpperCase() + craft.slice(1);
      const parts = [];
      if (data.skill !== 0) parts.push(`skill ${data.skill > 0 ? '+' : ''}${data.skill}`);
      if (data.talent !== 0) parts.push(`talent ${data.talent > 0 ? '+' : ''}${data.talent}`);
      if (data.diceTierModifier !== 0) parts.push(`dice ${data.diceTierModifier > 0 ? 'upgrade' : 'downgrade'}`);
      summary.craftingSkills.push(`${craftName}: ${parts.join(', ')}`);
    }
  });

  // Summarize mitigation
  Object.entries(delta.mitigation).forEach(([type, value]) => {
    if (value !== 0) {
      const typeName = type.charAt(0).toUpperCase() + type.slice(1);
      summary.mitigation.push(`${typeName}: ${value > 0 ? '+' : ''}${value}`);
    }
  });

  // Summarize resources
  Object.entries(delta.resources).forEach(([resource, value]) => {
    if (value !== 0) {
      const resourceName = resource.charAt(0).toUpperCase() + resource.slice(1);
      summary.resources.push(`${resourceName}: ${value > 0 ? '+' : ''}${value}`);
    }
  });

  // Summarize movement
  Object.entries(delta.movement).forEach(([type, value]) => {
    if (value !== 0) {
      const typeName = type.charAt(0).toUpperCase() + type.slice(1);
      summary.movement.push(`${typeName}: ${value > 0 ? '+' : ''}${value}`);
    }
  });

  // Summarize immunities
  if (delta.immunities.length > 0) {
    summary.immunities = delta.immunities.map(immunity =>
      immunity.charAt(0).toUpperCase() + immunity.slice(1)
    );
  }

  // Summarize abilities
  summary.abilities = delta.abilities.map(ability =>
    `${ability.type} (${ability.frequency}, ${ability.magical}, ${ability.energy} energy)`
  );

  // Summarize conditionals
  Object.entries(delta.conditionals).forEach(([condition, effects]) => {
    if (effects.length > 0) {
      const conditionName = condition.replace(/([A-Z])/g, ' $1').trim();
      summary.conditionals.push(`${conditionName}: ${effects.length} effect(s)`);
    }
  });

  return summary;
}

/**
 * Validate that a data code string is properly formatted
 * @param {string} dataCode - Data code to validate
 * @returns {Object} - Validation result with isValid and errors
 */
export function validateDataCode(dataCode) {
  if (!dataCode || typeof dataCode !== 'string') {
    return { isValid: true, errors: [] }; // Empty is valid
  }

  const errors = [];
  const effects = dataCode.split(':').map(e => e.trim()).filter(e => e);

  for (const effect of effects) {
    // Check for valid patterns
    const patterns = [
      /^S[ST][A-T0-9]=(-?\d+|[XY])$/, // Skills
      /^W[ST][1-6]=(-?\d+|[XY])$/, // Weapons
      /^Y[ST][1-5]=(-?\d+|[XY])$/, // Magic
      /^C[ST][1-6]=(-?\d+|[XY])$/, // Crafting
      /^M[1-9A]=(-?\d+)$/, // Mitigation
      /^A[1-9A-HMZ]=(-?\d+)$/, // Auto/Resources
      /^K[1-4]=(-?\d+)$/, // Movement
      /^V[1-8]=(-?\d+)$/, // Senses
      /^I[A-Z]=1$/, // Immunities
      /^T[GAPC]$/, // Traits
      /^[XZDY][IDC][NM]E=\d+$/, // Abilities
      /^C[A-G]\[[^\]]+\]$/ // Conditionals
    ];

    const isValid = patterns.some(pattern => pattern.test(effect));
    if (!isValid) {
      errors.push(`Invalid effect: ${effect}`);
    }
  }

  return { isValid: errors.length === 0, errors };
}