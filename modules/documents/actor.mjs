import { parseCharacter } from '../utils/character-parser.js';
import { applyDeltaToCharacter, createEmptyDelta } from '../utils/data-parser.js';

/**
 * Extend the base Actor document to implement the Anyventure system
 * @extends {Actor}
 */
export class AnyventureActor extends Actor {

  /** @override */
  prepareData() {
    // Prepare data for the actor. Calling the super version of this executes
    // the following, in order: data reset (to account for updates), prepareBaseData(),
    // prepareEmbeddedDocuments() (including active effects), prepareDerivedData().
    super.prepareData();
  }

  /** @override */
  prepareBaseData() {
    // Data modifications in this step occur before processing embedded
    // documents or derived data.

    if (this.type === 'character') {
      this._prepareCharacterBaseData();
    }
  }

  /**
   * Prepare base character data - reset and rebuild core stats
   * This runs before embedded documents and active effects
   */
  _prepareCharacterBaseData() {
    // Don't process if character isn't fully created yet
    if (!this.system.created) {
      return;
    }

    // Reset all calculated values to base defaults
    this._resetToBaseValues();

    // Parse and apply character effects (size, traits, ancestry, modules)
    this._parseCharacterEffectsInPlace();
  }

  /**
   * Reset all calculated values to base defaults
   * Following the pattern from your old system
   */
  _resetToBaseValues() {
    const systemData = this.system;

    // Reset movement to base value
    if (systemData.movement) {
      systemData.movement = typeof systemData.movement === 'number' ? 6 : systemData.movement;
      if (typeof systemData.movement === 'object') {
        systemData.movement.current = 6;
        systemData.movement.standard = 6;
      }
    }

    // Reset health max to base (will be recalculated)
    if (systemData.resources?.health) {
      systemData.resources.health.max = 0;
    }

    // Reset all skills to zero
    this._clearSkills();

    // Reset weapon/magic/crafting skills to zero
    this._clearCombatSkills();

    // Reset mitigations to zero
    if (systemData.mitigation) {
      Object.keys(systemData.mitigation).forEach(key => {
        systemData.mitigation[key] = 0;
      });
    }

    // Reset immunities, conditions, etc.
    if (systemData.immunities) {
      systemData.immunities.length = 0;
    }

    if (systemData.conditionals) {
      Object.keys(systemData.conditionals).forEach(key => {
        if (Array.isArray(systemData.conditionals[key])) {
          systemData.conditionals[key].length = 0;
        }
      });
    }
  }

  /**
   * Parse character effects in place (no actor.update calls)
   */
  _parseCharacterEffectsInPlace() {
    // Create delta and parse all effects
    const delta = createEmptyDelta();
    parseCharacter(this, delta);

    // Convert to character structure and apply
    const character = {
      attributes: this.system.attributes || {},
      skills: this.system.skills || {},
      weaponSkills: this.system.weaponSkills || {},
      magicSkills: this.system.magicSkills || {},
      craftingSkills: this.system.craftingSkills || {},
      mitigation: this.system.mitigation || {},
      resources: this.system.resources || {},
      movement: this.system.movement || 0,
      immunities: this.system.immunities || [],
      conditionals: this.system.conditionals || {}
    };

    // Apply delta directly to character data
    applyDeltaToCharacter(character, delta);

    // Update system data directly (no update call)
    this.system.attributes = character.attributes;
    this.system.skills = character.skills;
    this.system.weaponSkills = character.weaponSkills;
    this.system.magicSkills = character.magicSkills;
    this.system.craftingSkills = character.craftingSkills;
    this.system.mitigation = character.mitigation;
    this.system.resources = character.resources;
    this.system.movement = character.movement;
    this.system.immunities = character.immunities;
    this.system.conditionals = character.conditionals;
  }

  /**
   * Clear all basic skills to zero
   */
  _clearSkills() {
    if (!this.system.skills) return;

    Object.keys(this.system.skills).forEach(skillKey => {
      if (this.system.skills[skillKey] && typeof this.system.skills[skillKey] === 'object') {
        this.system.skills[skillKey].value = 0;
        this.system.skills[skillKey].diceTierModifier = 0;
      }
    });
  }

  /**
   * Clear all weapon/magic/crafting skills to zero
   */
  _clearCombatSkills() {
    // Clear weapon skills
    if (this.system.weaponSkills) {
      Object.keys(this.system.weaponSkills).forEach(skillKey => {
        if (this.system.weaponSkills[skillKey] && typeof this.system.weaponSkills[skillKey] === 'object') {
          this.system.weaponSkills[skillKey].value = 0;
          this.system.weaponSkills[skillKey].talent = 0;
          this.system.weaponSkills[skillKey].diceTierModifier = 0;
        }
      });
    }

    // Clear magic skills
    if (this.system.magicSkills) {
      Object.keys(this.system.magicSkills).forEach(skillKey => {
        if (this.system.magicSkills[skillKey] && typeof this.system.magicSkills[skillKey] === 'object') {
          this.system.magicSkills[skillKey].value = 0;
          this.system.magicSkills[skillKey].talent = 0;
          this.system.magicSkills[skillKey].diceTierModifier = 0;
        }
      });
    }

    // Clear crafting skills
    if (this.system.craftingSkills) {
      Object.keys(this.system.craftingSkills).forEach(skillKey => {
        if (this.system.craftingSkills[skillKey] && typeof this.system.craftingSkills[skillKey] === 'object') {
          this.system.craftingSkills[skillKey].value = 0;
          this.system.craftingSkills[skillKey].talent = 0;
          this.system.craftingSkills[skillKey].diceTierModifier = 0;
        }
      });
    }
  }

  /**
   * @override
   * Augment the basic actor data with additional dynamic data. Typically,
   * you'll want to handle most of your calculated/derived data in this step.
   * Data calculated in this step should generally not exist in template.json
   * (such as ability modifiers rather than ability scores) and should be
   * available both inside and outside of character sheets (such as if an actor
   * is queried and has a roll executed directly from it).
   */
  prepareDerivedData() {
    const actorData = this;
    const systemData = actorData.system;
    const flags = actorData.flags.anyventure || {};

    // Make separate methods for each Actor type (character, npc, etc.) to keep
    // things organized.

    this._prepareCharacterData(actorData);
    this._prepareNpcData(actorData);
  }

  /**
   * Prepare Character type specific data - derived calculations
   * This runs after base data and embedded documents
   */
  _prepareCharacterData(actorData) {
    if (actorData.type !== 'character') return;

    const systemData = actorData.system;

    // Calculate skill talents based on attributes
    this._calculateSkillTalents(systemData);

    // Apply equipment bonuses (weapons, armor, etc.)
    this._applyEquipmentBonuses(systemData);

    // Apply conditions and temporary effects
    this._applyConditions(systemData);

    // Final movement calculations
    this._calculateMovement(systemData);

    // Final resource calculations with all bonuses applied
    this._calculateResources(systemData);
  }

  /**
   * Apply equipment bonuses (weapons, armor, etc.)
   * This runs in prepareDerivedData after module effects are applied
   */
  _applyEquipmentBonuses(systemData) {
    // TODO: Implement equipment parsing
    // This would handle:
    // - Weapon bonuses/penalties
    // - Armor effects
    // - Equipment-based skill modifiers
  }

  /**
   * Apply conditions and temporary effects
   * This runs in prepareDerivedData after everything else
   */
  _applyConditions(systemData) {
    // TODO: Implement condition parsing
    // This would handle:
    // - Status effects
    // - Temporary bonuses/penalties
    // - Conditional modifiers
  }

  /**
   * Prepare NPC type specific data.
   */
  _prepareNpcData(actorData) {
    if (actorData.type !== 'npc') return;

    const systemData = actorData.system;

    // Calculate skill talents based on attributes
    this._calculateSkillTalents(systemData);
    
    // Calculate resources
    this._calculateResources(systemData);
    
    // Apply any module effects (NPCs can have modules too)
    this._applyModuleEffects(systemData);
  }

  /**
   * Calculate skill talents based on attributes
   */
  _calculateSkillTalents(systemData) {
    // Basic skills get their talent from attributes (skills are directly on system)
    if (systemData.basic) {
      for (let [key, skill] of Object.entries(systemData.basic)) {
        if (skill.attribute && systemData.attributes[skill.attribute]) {
          skill.talent = systemData.attributes[skill.attribute].value;
        }
      }
    }
  }

  /**
   * Calculate derived resources
   * Following your old system pattern
   */
  _calculateResources(systemData) {
    // Add level-based health (like your old system: level * 5 + 10)
    if (systemData.resources?.health && systemData.level?.value) {
      const levelHealth = systemData.level.value * 5 + 10;
      systemData.resources.health.max += levelHealth;
    }

    // Base resources for other values
    const baseResolve = 20;
    const baseMorale = 10;
    const baseEnergy = 5;

    // Set base values if not already set
    if (systemData.resources?.resolve && !systemData.resources.resolve.max) {
      systemData.resources.resolve.max = baseResolve;
    }
    if (systemData.resources?.morale && !systemData.resources.morale.max) {
      systemData.resources.morale.max = baseMorale;
    }
    if (systemData.resources?.energy && !systemData.resources.energy.max) {
      systemData.resources.energy.max = baseEnergy;
    }

    // Ensure current values don't exceed max
    if (systemData.resources?.health) {
      systemData.resources.health.value = Math.min(
        systemData.resources.health.value || systemData.resources.health.max,
        systemData.resources.health.max
      );
    }

    if (systemData.resources?.resolve) {
      systemData.resources.resolve.value = Math.min(
        systemData.resources.resolve.value || systemData.resources.resolve.max,
        systemData.resources.resolve.max
      );
    }

    if (systemData.resources?.morale) {
      systemData.resources.morale.value = Math.min(
        systemData.resources.morale.value || systemData.resources.morale.max,
        systemData.resources.morale.max
      );
    }

    if (systemData.resources?.energy) {
      systemData.resources.energy.value = Math.min(
        systemData.resources.energy.value || systemData.resources.energy.max,
        systemData.resources.energy.max
      );
    }
  }


  /**
   * Calculate movement values
   */
  _calculateMovement(systemData) {
    // Handle both old (number) and new (object) movement formats
    if (typeof systemData.movement === 'number') {
      // Convert old number format to new object format matching website structure
      const movementValue = systemData.movement;
      systemData.movement = {
        walk: movementValue,
        swim: 0,
        climb: 0,
        fly: 0
      };
    } else if (systemData.movement && typeof systemData.movement === 'object') {
      // Ensure walk movement is set if not already set
      if (systemData.movement.walk === undefined) {
        systemData.movement.walk = 5;
      }
      // Handle old "standard/current" format conversion
      if (systemData.movement.standard !== undefined) {
        systemData.movement.walk = systemData.movement.standard;
        delete systemData.movement.standard;
        delete systemData.movement.current;
      }
    } else {
      // Create default movement object if movement is undefined
      systemData.movement = {
        walk: 5,
        swim: 0,
        climb: 0,
        fly: 0
      };
    }
  }

  /**
   * Override getRollData() that's supplied to rolls.
   */
  getRollData() {
    const data = super.getRollData();

    // Prepare character roll data.
    this._getCharacterRollData(data);
    this._getNpcRollData(data);

    return data;
  }

  /**
   * Prepare character roll data.
   */
  _getCharacterRollData(data) {
    if (this.type !== 'character') return;

    // Copy the skill scores to the top level, so that rolls can use
    // formulas like `@basic.fitness.value + @basic.fitness.talent`.
    // Since skills are directly on system, we reference them directly
    if (data.basic) {
      for (let [key, skill] of Object.entries(data.basic)) {
        data[`basic.${key}`] = skill;
      }
    }
    if (data.weapon) {
      for (let [key, skill] of Object.entries(data.weapon)) {
        data[`weapon.${key}`] = skill;
      }
    }
    if (data.magic) {
      for (let [key, skill] of Object.entries(data.magic)) {
        data[`magic.${key}`] = skill;
      }
    }
    if (data.crafting) {
      for (let [key, skill] of Object.entries(data.crafting)) {
        data[`crafting.${key}`] = skill;
      }
    }
  }

  /**
   * Prepare NPC roll data.
   */
  _getNpcRollData(data) {
    if (this.type !== 'npc') return;

    // Process NPC data here - same as character
    this._getCharacterRollData(data);
  }

  /**
   * Roll a skill check with dialog for bonus/penalty dice
   * @param {string} category - The skill category (basic, weapon, magic, crafting)
   * @param {string} skillName - The name of the skill
   * @param {Object} options - Additional options for the roll
   */
  async rollSkill(category, skillName, options = {}) {
    // Skills are directly on system now
    const skill = this.system[category]?.[skillName];
    if (!skill) {
      ui.notifications.warn(`Skill ${category}.${skillName} not found`);
      return null;
    }

    // Get the dice type based on skill value (0=d4, 1=d6, 2=d8, etc.)
    const diceTypes = ['d4', 'd6', 'd8', 'd10', 'd12', 'd16', 'd20'];
    const diceType = diceTypes[Math.min(skill.value, 6)] || 'd4';
    const baseDice = skill.talent || 1;

    // Import the roll dialog
    const { AnyventureRollDialog } = await import('../sheets/roll-dialog.mjs');
    
    // Show the roll dialog
    return AnyventureRollDialog.show({
      title: `${skillName.charAt(0).toUpperCase() + skillName.slice(1)} Check`,
      skillName: skillName.charAt(0).toUpperCase() + skillName.slice(1),
      baseDice: baseDice,
      diceType: diceType,
      actor: this,
      rollCallback: (roll, data) => {
        // Optional callback for additional processing
      }
    });
  }
}