// Baseline and overlays approach: parsing happens during Recalculate only.

import { logError, logWarning, logInfo } from '../utils/logger.js';
import { parseDataCode } from '../utils/data-parser.js';

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
    // With baseline snapshots, avoid zeroing during normal prepares.
    if (!this.system.created) return;
  }

  // Removed legacy in-place parsing and zeroing helpers; baseline + overlays handle derived state now.

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

    // Set the initiative formula for this actor (only if we have the method)
    if (this.getInitiativeFormula) {
      const formula = this.getInitiativeFormula();

      // Try multiple places Foundry might look for the formula
      this.system.initiative = {
        formula: formula
      };
      this.system.attributes = this.system.attributes || {};
      this.system.attributes.init = {
        formula: formula
      };
      this.data = this.data || {};
      this.data.initiative = formula;

    } else {
      // Fallback initiative formula
      this.system.initiative = {
        formula: '1d20'
      };
    }
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

    // During Recalculate baseline rebuild, skip overlays/derived entirely.
    // A clean prepareData() runs after Recalculate completes.
    if (this._blockOverlays) return;

    const systemData = actorData.system;

    // Restore working values from the persisted base snapshot (if present)
    this._restoreFromBase(systemData);
    // Ensure skills expose standardized tier data
    this._normalizeSkillTiers(systemData);
    // Calculate skill talents based on attributes
    this._calculateSkillTalents(systemData);
    // Apply training skill bonuses from training items
    this._calculateTrainingSkills(systemData);
    // Apply equipment bonuses (weapons, armor, etc.)
    this._applyEquipmentBonuses(systemData);
    // Apply injury effects
    this._applyInjuries(systemData);
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
    // Skeleton: iterate equipped items and log their slot + name.
    // Skip ephemeral overlays while building the baseline during Recalculate
    if (this._blockOverlays) return;
    try {
      const equipment = systemData.equipment || {};
      const slotNames = [
        'head', 'body', 'back', 'hand', 'boots',
        'accessory1', 'accessory2',
        'mainhand', 'offhand', 'extra1', 'extra2', 'extra3'
      ];

      // Initialize equipment bonuses
      let encumbrancePenalty = 0;
      const equipmentBonuses = {
        resources: {
          health: { max: 0, recovery: 0 },
          energy: { max: 0, recovery: 0 },
          resolve: { max: 0, recovery: 0 }
        },
        movement: 0,
        attributes: {},
        basic: {},
        weapon: { bonuses: {}, talents: {} },
        magic: { bonuses: {}, talents: {} },
        craft: { bonuses: {}, talents: {} },
        mitigation: {},
        detections: {},
        immunities: [],
        effects: []
      };

      // Parse equipped items
      for (const slot of slotNames) {
        const slotData = equipment[slot];
        const equipped = slotData?.item;
        if (equipped) {
          const name = equipped.name || '(unnamed)';
          const type = equipped.system?.itemType || equipped.type || 'unknown';

          // Encumbrance penalty
          const pen = Number(equipped.system?.encumbrance_penalty || 0);
          if (!Number.isNaN(pen)) encumbrancePenalty += pen;

          // Parse item bonuses
          const itemSystem = equipped.system || {};

          // Health bonuses
          if (itemSystem.health) {
            const healthMax = Number(itemSystem.health.max || 0);
            const healthRecovery = Number(itemSystem.health.recovery || 0);
            equipmentBonuses.resources.health.max += healthMax;
            equipmentBonuses.resources.health.recovery += healthRecovery;
          }

          // Energy bonuses
          if (itemSystem.energy) {
            const energyMax = Number(itemSystem.energy.max || 0);
            const energyRecovery = Number(itemSystem.energy.recovery || 0);
            equipmentBonuses.resources.energy.max += energyMax;
            equipmentBonuses.resources.energy.recovery += energyRecovery;
          }

          // Resolve bonuses
          if (itemSystem.resolve) {
            const resolveMax = Number(itemSystem.resolve.max || 0);
            const resolveRecovery = Number(itemSystem.resolve.recovery || 0);
            equipmentBonuses.resources.resolve.max += resolveMax;
            equipmentBonuses.resources.resolve.recovery += resolveRecovery;
          }

          // Movement bonus
          if (itemSystem.movement) {
            const movementBonus = Number(itemSystem.movement || 0);
            equipmentBonuses.movement += movementBonus;
          }

          // Attribute bonuses (nested objects with add_talent/set_talent)
          if (itemSystem.attributes && typeof itemSystem.attributes === 'object') {
            for (const [attr, attrData] of Object.entries(itemSystem.attributes)) {
              if (attrData && typeof attrData === 'object') {
                const addTalent = Number(attrData.add_talent || 0);
                const setTalent = Number(attrData.set_talent || 0);
                // For now, just use add_talent (we can implement set_talent logic later)
                if (addTalent !== 0) {
                  equipmentBonuses.attributes[attr] = (equipmentBonuses.attributes[attr] || 0) + addTalent;
                }
              }
            }
          }

          // Helper function to process basic skill bonuses (only have bonuses, no talents)
          const processBasicSkillBonuses = (skillData, bonusCategory) => {
            if (skillData && typeof skillData === 'object') {
              for (const [skill, data] of Object.entries(skillData)) {
                if (data && typeof data === 'object') {
                  const addBonus = Number(data.add_bonus || 0);
                  if (addBonus !== 0) {
                    bonusCategory[skill] = (bonusCategory[skill] || 0) + addBonus;
                  }
                }
              }
            }
          };

          // Helper function to process weapon/magic/craft skill bonuses (have both bonuses and talents)
          const processAdvancedSkillBonuses = (skillData, bonusCategory) => {
            if (skillData && typeof skillData === 'object') {
              for (const [skill, data] of Object.entries(skillData)) {
                if (data && typeof data === 'object') {
                  const addBonus = Number(data.add_bonus || 0);
                  const addTalent = Number(data.add_talent || 0);

                  if (addBonus !== 0) {
                    bonusCategory.bonuses[skill] = (bonusCategory.bonuses[skill] || 0) + addBonus;
                  }
                  if (addTalent !== 0) {
                    bonusCategory.talents[skill] = (bonusCategory.talents[skill] || 0) + addTalent;
                  }
                }
              }
            }
          };

          // Process all skill categories
          processBasicSkillBonuses(itemSystem.basic, equipmentBonuses.basic);
          processAdvancedSkillBonuses(itemSystem.weapon, equipmentBonuses.weapon);
          processAdvancedSkillBonuses(itemSystem.magic, equipmentBonuses.magic);
          processAdvancedSkillBonuses(itemSystem.craft, equipmentBonuses.craft);

          // Mitigation bonuses (flat numeric values)
          if (itemSystem.mitigation && typeof itemSystem.mitigation === 'object') {
            for (const [type, value] of Object.entries(itemSystem.mitigation)) {
              if (value != null && value !== '') {
                const bonus = Number(value);
                if (!Number.isNaN(bonus) && bonus !== 0) {
                  equipmentBonuses.mitigation[type] = (equipmentBonuses.mitigation[type] || 0) + bonus;
                }
              }
            }
          }

          // Detection bonuses (flat numeric values)
          if (itemSystem.detections && typeof itemSystem.detections === 'object') {
            for (const [detection, value] of Object.entries(itemSystem.detections)) {
              if (value != null && value !== '') {
                const bonus = Number(value);
                if (!Number.isNaN(bonus) && bonus !== 0) {
                  equipmentBonuses.detections[detection] = (equipmentBonuses.detections[detection] || 0) + bonus;
                }
              }
            }
          }

          // Immunities (object with boolean values, not array)
          if (itemSystem.immunities && typeof itemSystem.immunities === 'object') {
            for (const [immunity, enabled] of Object.entries(itemSystem.immunities)) {
              if (enabled === true) {
                if (!equipmentBonuses.immunities.includes(immunity)) {
                  equipmentBonuses.immunities.push(immunity);
                }
              }
            }
          }

          // Effects (arrays - should work as before)
          if (itemSystem.effects && Array.isArray(itemSystem.effects)) {
            for (const effect of itemSystem.effects) {
              if (effect && effect !== null && effect !== '') {
                equipmentBonuses.effects.push(effect);
              }
            }
          }

        }
      }


      // Ensure _base exists - if not, create a backup of current values
      if (!systemData._base) {
        systemData._base = foundry.utils?.duplicate ? foundry.utils.duplicate(systemData) : JSON.parse(JSON.stringify(systemData));
      }

      // Ensure mana resource exists (for legacy characters that don't have it)
      if (!systemData.resources.mana || typeof systemData.resources.mana !== 'object' || systemData.resources.mana.max === undefined) {
        systemData.resources.mana = { value: 0, max: 0, temp: 0 };
      }
      if (!systemData._base.resources.mana || typeof systemData._base.resources.mana !== 'object' || systemData._base.resources.mana.max === undefined) {
        systemData._base.resources.mana = { value: 0, max: 0, temp: 0 };
      }

      // Ensure weaponModifications exist (for legacy characters that don't have it)
      if (!systemData.weaponModifications) {
        systemData.weaponModifications = {
          simpleRangedMinRange: 0, simpleRangedMaxRange: 0,
          complexRangedMinRange: 0, complexRangedMaxRange: 0,
          throwingMinRange: 0, throwingMaxRange: 0
        };
      }
      if (!systemData._base.weaponModifications) {
        systemData._base.weaponModifications = {
          simpleRangedMinRange: 0, simpleRangedMaxRange: 0,
          complexRangedMinRange: 0, complexRangedMaxRange: 0,
          throwingMinRange: 0, throwingMaxRange: 0
        };
      }


      // Apply equipment bonuses to character stats (idempotent overlay from base)
      // Resources
      const baseHealthMax = systemData._base.resources.health.max;
      const healthBonus = equipmentBonuses.resources.health.max;
      systemData.resources.health.max = baseHealthMax + healthBonus;

      const baseEnergyMax = systemData._base.resources.energy.max;
      const energyBonus = equipmentBonuses.resources.energy.max;
      systemData.resources.energy.max = baseEnergyMax + energyBonus;

      const baseResolveMax = systemData._base.resources.resolve.max;
      const resolveBonus = equipmentBonuses.resources.resolve.max;
      systemData.resources.resolve.max = baseResolveMax + resolveBonus;

      // Movement (apply to walk speed as base)
      if (systemData.movement?.walk !== undefined) {
        const baseWalk = systemData._base.movement?.walk || 5;
        const walkBonus = equipmentBonuses.movement;
        systemData.movement.walk = baseWalk + walkBonus;
      }

      // Helper function to apply bonuses to skill categories
      const applyBonuses = (bonusCategory, systemCategory, baseCategory, categoryName, valueProperty = 'value') => {
        for (const [key, bonus] of Object.entries(bonusCategory)) {
          if (systemCategory?.[key] !== undefined && baseCategory?.[key] !== undefined) {
            const baseValue = baseCategory[key][valueProperty];
            const newValue = baseValue + bonus;
            systemCategory[key][valueProperty] = newValue;
          } else {
            logWarning(`${categoryName} ${key} not found in systemData or _base`);
          }
        }
      };

      // Apply bonuses to all categories
      applyBonuses(equipmentBonuses.attributes, systemData.attributes, systemData._base.attributes, 'Attribute');
      applyBonuses(equipmentBonuses.basic, systemData.basic, systemData._base.basic, 'Basic skill');

      // Apply weapon/magic/craft bonuses (both skill bonuses and talent bonuses)
      applyBonuses(equipmentBonuses.weapon.bonuses, systemData.weapon, systemData._base.weapon, 'Weapon skill', 'value');
      applyBonuses(equipmentBonuses.weapon.talents, systemData.weapon, systemData._base.weapon, 'Weapon skill', 'talent');
      applyBonuses(equipmentBonuses.magic.bonuses, systemData.magic, systemData._base.magic, 'Magic skill', 'value');
      applyBonuses(equipmentBonuses.magic.talents, systemData.magic, systemData._base.magic, 'Magic skill', 'talent');
      applyBonuses(equipmentBonuses.craft.bonuses, systemData.crafting, systemData._base.crafting, 'Craft skill', 'value');
      applyBonuses(equipmentBonuses.craft.talents, systemData.crafting, systemData._base.crafting, 'Craft skill', 'talent');

      // Mitigation
      for (const [type, bonus] of Object.entries(equipmentBonuses.mitigation)) {
        if (systemData.mitigation?.[type] !== undefined && systemData._base.mitigation?.[type] !== undefined) {
          const baseValue = systemData._base.mitigation[type];
          const newValue = baseValue + bonus;
          systemData.mitigation[type] = newValue;
        } else {
          logWarning(`Mitigation ${type} not found in systemData or _base`);
        }
      }

      // Apply conditional bonuses based on equipped gear
      this._applyConditionalBonuses(systemData, equipment);

      // Store equipment bonuses for reference
      systemData._equipmentBonuses = equipmentBonuses;
      systemData.encumbrance_penalty = encumbrancePenalty;

    } catch (err) {
      logWarning('Equipment parsing encountered an error:', err);
    }
  }

  /**
   * Apply conditional bonuses from modules based on equipped gear
   * @param {Object} systemData - The actor's system data
   * @param {Object} equipment - The equipment slots
   * @private
   */
  _applyConditionalBonuses(systemData, equipment) {
    if (!systemData.conditionals) {
      return;
    }

    // Check for shields (any type)
    const hasShield = ['offhand', 'mainhand'].some(slot => {
      const item = equipment[slot]?.item;
      return item?.system?.itemType === 'shield';
    });

    // Check for light shield specifically
    const hasLightShield = ['offhand', 'mainhand'].some(slot => {
      const item = equipment[slot]?.item;
      return item?.system?.itemType === 'shield' && item?.system?.shieldType === 'light';
    });

    // Check for heavy shield specifically
    const hasHeavyShield = ['offhand', 'mainhand'].some(slot => {
      const item = equipment[slot]?.item;
      return item?.system?.itemType === 'shield' && item?.system?.shieldType === 'heavy';
    });

    // Apply shield-based conditional bonuses
    const conditionalGroups = [
      { condition: hasShield, key: 'anyShield' },
      { condition: hasLightShield, key: 'lightShield' },
      { condition: hasHeavyShield, key: 'heavyShield' }
    ];

    for (const { condition, key } of conditionalGroups) {
      if (condition && Array.isArray(systemData.conditionals[key])) {
        for (const effect of systemData.conditionals[key]) {
          this._applyConditionalEffect(effect, systemData);
        }
      }
    }

    // TODO: Add armor-based conditionals (noArmor, lightArmor, heavyArmor, anyArmor)
  }

  /**
   * Apply a single conditional effect to the actor
   * @param {Object} effect - The conditional effect object {type, subtype, value}
   * @param {Object} systemData - The actor's system data
   * @private
   */
  _applyConditionalEffect(effect, systemData) {
    if (!effect || !effect.type) return;

    const { type, subtype, value } = effect;

    switch (type) {
      case 'skill':
        // Apply skill bonus (basic skills like deflection)
        // NOTE: Use CURRENT value, not base, because equipment bonuses were already applied
        if (systemData.basic?.[subtype] !== undefined) {
          const currentValue = systemData.basic[subtype].value;
          const newValue = currentValue + value;
          systemData.basic[subtype].value = newValue;
        }
        break;

      case 'mitigation':
        // Apply mitigation bonus
        // NOTE: Use CURRENT value, not base, because equipment bonuses were already applied
        if (systemData.mitigation?.[subtype] !== undefined) {
          const currentValue = systemData.mitigation[subtype];
          const newValue = currentValue + value;
          systemData.mitigation[subtype] = newValue;
        }
        break;

      // Add more cases as needed for other effect types
    }
  }

  /**
   * Apply injury effects
   * This runs in prepareDerivedData before conditions
   */
  _applyInjuries(systemData) {
    try {
      // Get all injury items on the character
      const injuries = this.items.filter(item => item.type === 'injury');

      // Count cosmetic injuries and calculate total pain/stress
      let cosmeticInjuryCount = 0;
      let totalPain = 0;
      let totalStress = 0;

      // Loop through all injuries
      for (const injury of injuries) {
        const injuryType = injury.system?.injuryType;

        // Count cosmetic injuries
        if (injuryType === 'cosmetic_injury') {
          cosmeticInjuryCount++;
        }

        // Add pain from this injury
        const painValue = Number(injury.system?.pain || 0);
        if (!Number.isNaN(painValue)) {
          totalPain += painValue;
        }

        // Add stress from this injury
        const stressValue = Number(injury.system?.stress || 0);
        if (!Number.isNaN(stressValue)) {
          totalStress += stressValue;
        }
      }

      // Update pain resource value
      if (systemData.resources?.pain) {
        // Set pain value from injuries
        systemData.resources.pain.value = totalPain;

        // Add pain from health thresholds
        let healthPainBonus = 0;
        const currentHealth = systemData.resources.health?.value || 0;
        const maxHealth = systemData.resources.health?.max || 1;

        if (currentHealth < 5) {
          healthPainBonus = 4; // Below 5 health: +4 pain
        } else if (currentHealth < (maxHealth / 2)) {
          healthPainBonus = 2; // Below half health: +2 pain
        }

        // Get the pain modifier (for testing/manual adjustment)
        const painModifier = Number(systemData.resources.pain.modifier) || 0;

        // Calculate final pain = value (from injuries) + health threshold bonus + modifier
        const calculatedPain = totalPain + healthPainBonus + painModifier;
        systemData.resources.pain.calculated = Math.max(0, calculatedPain); // Don't go negative

        // Don't create active effects for now - just display the value
        // this._updatePainCondition(calculatedPain, systemData.resources.pain.threshold_modifier || 0);
      }

      // Update stress resource value (similar to pain)
      if (systemData.resources?.stress) {
        // Set stress value from injuries
        systemData.resources.stress.value = totalStress;

        // Add stress from resolve thresholds
        let resolveStressBonus = 0;
        const currentResolve = systemData.resources.resolve?.value || 0;
        const maxResolve = systemData.resources.resolve?.max || 1;

        if (currentResolve < 3) {
          resolveStressBonus = 4; // Below 3 resolve: +4 stress
        } else if (currentResolve < (maxResolve / 2)) {
          resolveStressBonus = 2; // Below half resolve: +2 stress
        }

        // Get the stress modifier (for testing/manual adjustment)
        const stressModifier = Number(systemData.resources.stress.modifier) || 0;

        // Calculate final stress = value (from sources) + resolve threshold bonus + modifier
        const calculatedStress = totalStress + resolveStressBonus + stressModifier;
        systemData.resources.stress.calculated = Math.max(0, calculatedStress); // Don't go negative

        // Don't create active effects for now - just display the value
        // this._updateStressCondition(calculatedStress, systemData.resources.stress.threshold_modifier || 0);
      }

      // Check for Badge of Honor trait and apply morale bonus
      if (this.system.conditionals?.flags?.BADGE_OF_HONOR === true && cosmeticInjuryCount > 0) {

        // Get base max morale (before any bonuses)
        const baseMorale = systemData._base?.resources?.morale?.max || systemData.resources.morale.max;

        // Apply the bonus: max morale = base max morale + cosmetic injury count
        systemData.resources.morale.max = baseMorale + cosmeticInjuryCount;
      }


      // Debugging: Print the entire cultural item
      const cultureItem = this.items.find(item => item.type === 'culture');

    } catch (err) {
      logWarning('Injury parsing encountered an error:', err);
    }
  }

  /**
   * Calculate penalty dice from pain
   * Pain Thresholds (adjusted by threshold_modifier):
   * - 0: No effect
   * - 1-5: Mild Pain (no effect)
   * - 6-10: Moderate Pain (+1 penalty die)
   * - 11-15: Severe Pain (+2 penalty dice)
   * - 16+: Critical Pain (+2 penalty dice)
   * @returns {number} Number of penalty dice to apply
   */
  calculatePainPenaltyDice() {
    const painValue = this.system.resources?.pain?.calculated || 0;
    const thresholdModifier = Number(this.system.resources?.pain?.threshold_modifier) || 0;

    // Apply threshold modifier to each tier's minimum value
    const moderateThreshold = 6 + thresholdModifier;
    const severeThreshold = 11 + thresholdModifier;
    const criticalThreshold = 16 + thresholdModifier;

    if (painValue >= criticalThreshold) return 2; // Critical Pain
    if (painValue >= severeThreshold) return 2; // Severe Pain
    if (painValue >= moderateThreshold) return 1;  // Moderate Pain
    return 0; // Mild or no pain
  }

  /**
   * Calculate penalty dice from stress
   * Stress Thresholds (adjusted by threshold_modifier):
   * - 0: No effect
   * - 1-5: Mild Stress (no effect)
   * - 6-10: Moderate Stress (+1 penalty die)
   * - 11-15: Severe Stress (+2 penalty dice)
   * - 16+: Critical Stress (+2 penalty dice)
   * @returns {number} Number of penalty dice to apply
   */
  calculateStressPenaltyDice() {
    const stressValue = this.system.resources?.stress?.calculated || 0;
    const thresholdModifier = Number(this.system.resources?.stress?.threshold_modifier) || 0;

    // Apply threshold modifier to each tier's minimum value
    const moderateThreshold = 6 + thresholdModifier;
    const severeThreshold = 11 + thresholdModifier;
    const criticalThreshold = 16 + thresholdModifier;

    if (stressValue >= criticalThreshold) return 2; // Critical Stress
    if (stressValue >= severeThreshold) return 2; // Severe Stress
    if (stressValue >= moderateThreshold) return 1;  // Moderate Stress
    return 0; // Mild or no stress
  }

  /**
   * Calculate pain tier and apply appropriate pain condition
   * @param {number} totalPain - Total pain value from all injuries
   * @param {number} thresholdModifier - Threshold modifier from character
   * @private
   */
  async _updatePainCondition(totalPain, thresholdModifier = 0) {
    try {
      // Pain tier thresholds (adjusted by threshold_modifier)
      const modifier = Number(thresholdModifier) || 0;

      // Base thresholds: 1-2 Minor, 3-4 Moderate, 5-7 Severe, 8+ Extreme
      // Threshold modifier shifts these ranges up
      const minorMin = 1 + modifier;
      const minorMax = 2 + modifier;
      const moderateMin = 3 + modifier;
      const moderateMax = 4 + modifier;
      const severeMin = 5 + modifier;
      const severeMax = 7 + modifier;
      const extremeMin = 8 + modifier;

      // Determine which pain tier we're in
      let targetPainCondition = null;
      if (totalPain >= extremeMin) {
        targetPainCondition = 'pain_4'; // Extreme Pain
      } else if (totalPain >= severeMin && totalPain <= severeMax) {
        targetPainCondition = 'pain_3'; // Severe Pain
      } else if (totalPain >= moderateMin && totalPain <= moderateMax) {
        targetPainCondition = 'pain_2'; // Moderate Pain
      } else if (totalPain >= minorMin && totalPain <= minorMax) {
        targetPainCondition = 'pain_1'; // Minor Pain
      }

      // Get current pain conditions
      const painConditions = ['pain_1', 'pain_2', 'pain_3', 'pain_4'];
      const currentPainEffects = this.effects.filter(e =>
        painConditions.some(condition => e.statuses?.has(condition))
      );

      // Remove all pain conditions if no pain or below threshold
      if (!targetPainCondition) {
        for (const effect of currentPainEffects) {
          await effect.delete();
        }
        return;
      }

      // Check if we already have the correct pain condition
      const hasCorrectCondition = currentPainEffects.some(e => e.statuses?.has(targetPainCondition));

      if (!hasCorrectCondition) {
        // Remove all existing pain conditions
        for (const effect of currentPainEffects) {
          await effect.delete();
        }

        // Add the new pain condition
        const painConfig = CONFIG.statusEffects.find(s => s.id === targetPainCondition);
        if (painConfig) {
          await this.createEmbeddedDocuments('ActiveEffect', [{
            label: painConfig.label,
            icon: painConfig.img,
            statuses: [targetPainCondition],
            flags: {
              core: {
                statusId: targetPainCondition
              }
            }
          }]);
        }
      }
    } catch (err) {
      logWarning('Pain condition update encountered an error:', err);
    }
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

    // Skip overlays during baseline rebuild; final prepare runs after Recalculate
    if (this._blockOverlays) return;

    const systemData = actorData.system;

    // Restore working values from the persisted base snapshot (if present)
    this._restoreFromBase(systemData);

    // Ensure skills expose standardized tier data
    this._normalizeSkillTiers(systemData);

    // Calculate skill talents based on attributes
    this._calculateSkillTalents(systemData);
    
    // Calculate resources
    this._calculateResources(systemData);

    // NPCs use static stats from the template, no module effects needed
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
   * Calculate training skill bonuses from training items
   * Runs after _calculateSkillTalents to apply training bonuses on top of base values
   * @param {Object} systemData - The actor's system data
   * @private
   */
  _calculateTrainingSkills(systemData) {
    try {
      // Get all training items on the character
      const trainingItems = this.items.filter(item => item.type === 'training');

      if (trainingItems.length === 0) {
        return; // No training items to process
      }

      // Process each training item
      for (const trainingItem of trainingItems) {
        const dataString = trainingItem.system?.data;

        if (!dataString || typeof dataString !== 'string' || dataString.trim() === '') {
          continue; // Skip empty data strings
        }

        // Parse the data string into a delta
        const delta = parseDataCode(dataString);

        // Apply basic skill bonuses
        Object.entries(delta.skills || {}).forEach(([skill, value]) => {
          if (value !== 0 && systemData.basic?.[skill] !== undefined) {
            systemData.basic[skill].value += value;
          }
        });

        // Apply basic skill tier modifiers
        Object.entries(delta.skillTierModifiers || {}).forEach(([skill, modifier]) => {
          if (modifier !== 0 && systemData.basic?.[skill] !== undefined) {
            if (!systemData.basic[skill].tier) {
              systemData.basic[skill].tier = 0;
            }
            systemData.basic[skill].tier += modifier;
          }
        });

        // Apply weapon skill bonuses
        Object.entries(delta.weaponSkills || {}).forEach(([weaponSkill, data]) => {
          if (systemData.weapon?.[weaponSkill] !== undefined) {
            if (data.skill !== 0) {
              systemData.weapon[weaponSkill].value += data.skill;
            }
            if (data.talent !== 0) {
              systemData.weapon[weaponSkill].talent += data.talent;
            }
            if (data.tier !== 0) {
              if (!systemData.weapon[weaponSkill].tier) {
                systemData.weapon[weaponSkill].tier = 0;
              }
              systemData.weapon[weaponSkill].tier += data.tier;
            }
          }
        });

        // Apply magic skill bonuses
        Object.entries(delta.magicSkills || {}).forEach(([magicSkill, data]) => {
          if (systemData.magic?.[magicSkill] !== undefined) {
            if (data.skill !== 0) {
              systemData.magic[magicSkill].value += data.skill;
            }
            if (data.talent !== 0) {
              systemData.magic[magicSkill].talent += data.talent;
            }
            if (data.tier !== 0) {
              if (!systemData.magic[magicSkill].tier) {
                systemData.magic[magicSkill].tier = 0;
              }
              systemData.magic[magicSkill].tier += data.tier;
            }
          }
        });

        // Apply crafting skill bonuses
        Object.entries(delta.craftingSkills || {}).forEach(([craftSkill, data]) => {
          if (systemData.crafting?.[craftSkill] !== undefined) {
            if (data.skill !== 0) {
              systemData.crafting[craftSkill].value += data.skill;
            }
            if (data.talent !== 0) {
              systemData.crafting[craftSkill].talent += data.talent;
            }
            if (data.tier !== 0) {
              if (!systemData.crafting[craftSkill].tier) {
                systemData.crafting[craftSkill].tier = 0;
              }
              systemData.crafting[craftSkill].tier += data.tier;
            }
          }
        });
      }

    } catch (err) {
      logWarning('Training skills parsing encountered an error:', err);
    }
  }

  /**
   * Calculate derived resources
   * Following your old system pattern
   */
  _calculateResources(systemData) {
    // Ensure current values don't exceed max; do not increase current
    if (systemData.resources?.health) {
      const cur = systemData.resources.health.value;
      const max = systemData.resources.health.max;
      if (typeof cur === 'number' && typeof max === 'number' && cur > max) {
        systemData.resources.health.value = max;
      }
    }

    if (systemData.resources?.resolve) {
      const cur = systemData.resources.resolve.value;
      const max = systemData.resources.resolve.max;
      if (typeof cur === 'number' && typeof max === 'number' && cur > max) {
        systemData.resources.resolve.value = max;
      }
    }

    if (systemData.resources?.morale) {
      const cur = systemData.resources.morale.value;
      const max = systemData.resources.morale.max;
      if (typeof cur === 'number' && typeof max === 'number' && cur > max) {
        systemData.resources.morale.value = max;
      }
    }

    if (systemData.resources?.energy) {
      const cur = systemData.resources.energy.value;
      const max = systemData.resources.energy.max;
      if (typeof cur === 'number' && typeof max === 'number' && cur > max) {
        systemData.resources.energy.value = max;
      }
    }

    if (systemData.resources?.mana) {
      const cur = systemData.resources.mana.value;
      const max = systemData.resources.mana.max;
      if (typeof cur === 'number' && typeof max === 'number' && cur > max) {
        systemData.resources.mana.value = max;
      }
    }
  }


  /**
   * Calculate movement values
   */
  _calculateMovement(systemData) {
    // Light normalization only; baseline carries canonical values
    if (!systemData.movement || typeof systemData.movement !== 'object') {
      systemData.movement = { walk: 5, swim: 0, climb: 0, fly: 0 };
      return;
    }
    if (systemData.movement.standard !== undefined) {
      systemData.movement.walk = systemData.movement.standard;
      delete systemData.movement.standard;
      delete systemData.movement.current;
    }
    if (systemData.movement.walk === undefined) systemData.movement.walk = 5;
    if (systemData.movement.swim === undefined) systemData.movement.swim = 0;
    if (systemData.movement.climb === undefined) systemData.movement.climb = 0;
    if (systemData.movement.fly === undefined) systemData.movement.fly = 0;

    // Apply condition-based movement overrides at the end
    if (this.effects) {
      // Conditions that set walk speed to 0
      const immobilizingConditions = ['stasis', 'incapacitated', 'impaired', 'stunned', 'paralyzed', 'unconscious', 'frozen'];
      const hasImmobilizingCondition = immobilizingConditions.some(condition =>
        this.effects.find(e => e.statuses?.has(condition))
      );

      // Prone condition: walk speed becomes 2 (but only if not immobilized)
      const proneEffect = this.effects.find(e => e.statuses?.has('prone'));

      if (hasImmobilizingCondition) {
        systemData.movement.walk = 0;
      } else if (proneEffect) {
        systemData.movement.walk = 2;
      }
    }
  }

  /**
   * Normalize skill tier data to use the unified `tier` property.
   * @param {Object} systemData
   * @private
   */
  _normalizeSkillTiers(systemData) {
    if (!systemData || typeof systemData !== 'object') return;

    const normalizeGroup = (group) => {
      if (!group || typeof group !== 'object') return;
      for (const skill of Object.values(group)) {
        if (!skill || typeof skill !== 'object') continue;
        if (skill.tier === undefined && Object.prototype.hasOwnProperty.call(skill, 'diceTierModifier')) {
          skill.tier = Number(skill.diceTierModifier) || 0;
          delete skill.diceTierModifier;
        }
        if (skill.tier === undefined) skill.tier = 0;
      }
    };

    normalizeGroup(systemData.basic);
    normalizeGroup(systemData.weapon);
    normalizeGroup(systemData.magic);
    normalizeGroup(systemData.craft);
    normalizeGroup(systemData.crafting);
  }

  /**
   * Restore working system fields from the persisted base snapshot.
   * This avoids cumulative drift by starting each derived pass from a known baseline.
   * @param {Object} systemData
   * @private
  */
  _restoreFromBase(systemData) {
    // Skip restore during baseline rebuild (Recalculate) so zeros and recalculated values hold
    if (this._suspendRestore) return;
    const base = systemData?._base;
    if (!base) return;

    const clone = (v) => (foundry?.utils?.duplicate ? foundry.utils.duplicate(v) : JSON.parse(JSON.stringify(v)));

    // Normalize legacy tier data on the base snapshot before cloning
    this._normalizeSkillTiers(base);

    if (base.attributes) systemData.attributes = clone(base.attributes);
    if (base.basic) systemData.basic = clone(base.basic);
    if (base.weapon) systemData.weapon = clone(base.weapon);
    if (base.magic) systemData.magic = clone(base.magic);
    if (base.crafting) systemData.crafting = clone(base.crafting);
    if (base.mitigation) systemData.mitigation = clone(base.mitigation);
    if (base.resources) {
      const current = {
        health: systemData.resources?.health?.value,
        resolve: systemData.resources?.resolve?.value,
        morale: systemData.resources?.morale?.value,
        energy: systemData.resources?.energy?.value,
        mana: systemData.resources?.mana?.value
      };
      const res = clone(base.resources);
      ['health','resolve','morale','energy','mana'].forEach((k) => {
        if (!res[k]) res[k] = {};
        if (current[k] !== undefined) {
          res[k].value = current[k];
        } else if (k === 'mana' && res[k].max > 0) {
          // Initialize mana current value to 0 when character first gains mana
          res[k].value = 0;
        }
      });
      systemData.resources = res;
    }
    if (base.movement) systemData.movement = clone(base.movement);
    if (base.weaponModifications) systemData.weaponModifications = clone(base.weaponModifications);

    // Ensure the working copy also has normalized tier data
    this._normalizeSkillTiers(systemData);
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
    const skillCategories = ['basic', 'weapon', 'magic', 'crafting'];
    for (const category of skillCategories) {
      if (data[category]) {
        for (let [key, skill] of Object.entries(data[category])) {
          data[`${category}.${key}`] = skill;
        }
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

    // Get the dice type based on skill value WITH upgrade/downgrade modifier
    // This matches the skillDieWithUpgrade helper logic
    const diceTable = [
      ['d2', 'd4', 'd6'],   // Level 0
      ['d4', 'd6', 'd8'],   // Level 1
      ['d6', 'd8', 'd10'],  // Level 2
      ['d8', 'd10', 'd12'], // Level 3
      ['d10', 'd12', 'd16'], // Level 4
      ['d12', 'd16', 'd20'], // Level 5
      ['d16', 'd20', 'd24'], // Level 6
      ['d20', 'd24', 'd30']  // Level 7
    ];

    const skillLevel = Math.min(Math.max(skill.value || 0, 0), 7);
    const tierModifier = Number(skill.tier) || 0;
    const upgradeLevel = Math.min(Math.max(tierModifier + 1, 0), 2); // Convert -1,0,1 to 0,1,2
    const diceType = diceTable[skillLevel][upgradeLevel];
    const baseDice = skill.talent || 1;

    // Calculate condition-based penalties
    let initialPenaltyDice = 0;
    let conditionNotes = [];

    // Add pain/stress penalties (applies to ALL rolls)
    const painPenalty = this.calculatePainPenaltyDice();
    const stressPenalty = this.calculateStressPenaltyDice();
    initialPenaltyDice += painPenalty + stressPenalty;

    if (painPenalty > 0) {
      const painLevel = this.system.resources?.pain?.calculated || 0;
      conditionNotes.push(`Pain (${painLevel}): -${painPenalty} ${painPenalty === 1 ? 'die' : 'dice'}`);
    }
    if (stressPenalty > 0) {
      const stressLevel = this.system.resources?.stress?.calculated || 0;
      conditionNotes.push(`Stress (${stressLevel}): -${stressPenalty} ${stressPenalty === 1 ? 'die' : 'dice'}`);
    }

    // Check for conditions affecting defense skills (evasion/deflection)
    if (skillName.toLowerCase() === "evasion" || skillName.toLowerCase() === "deflection") {
      // Check for dazed condition (first defense only)
      const dazedEffect = this.effects.find(e => e.statuses?.has("dazed"));
      if (dazedEffect) {
        const penaltyApplied = dazedEffect.getFlag("anyventure", "penaltyApplied");

        if (!penaltyApplied) {
          initialPenaltyDice += 1;
          conditionNotes.push("Dazed: -1 die (first defense)");

          // Mark the penalty as applied
          await dazedEffect.setFlag("anyventure", "penaltyApplied", true);
        }
      }

      // Check for blinded condition (always applies)
      const blindedEffect = this.effects.find(e => e.statuses?.has("blind"));
      if (blindedEffect) {
        initialPenaltyDice += 1;
        conditionNotes.push("Blinded: -1 die (defense)");
      }

      const impaired = this.effects.find(e => e.statuses?.has("impaired"));
      if (impaired) {
        initialPenaltyDice += 1;
        conditionNotes.push("Impaired: -1 die (defense)");
      }

      const prone = this.effects.find(e => e.statuses?.has("prone"));
      if (prone) {
        initialPenaltyDice += 1;
        conditionNotes.push("Impaired: -1 die (defense)");
      }
    }

    // Check for broken condition on Mind, Knowledge, and Social skills
    const brokenAffectedSkills = [
      // Mind skills
      'resilience', 'concentration', 'senses', 'logic',
      // Knowledge skills
      'wildcraft', 'academics', 'magic', 'medicine',
      // Social skills
      'expression', 'presence', 'insight', 'persuasion'
    ];

    if (brokenAffectedSkills.includes(skillName.toLowerCase())) {
      const brokenEffect = this.effects.find(e => e.statuses?.has("broken"));
      if (brokenEffect) {
        initialPenaltyDice += 1;
        conditionNotes.push("Broken: -1 die (mental checks)");
      }
    }

    // Import the roll dialog
    const { AnyventureRollDialog } = await import('../sheets/roll-dialog.mjs');
    
    // Show the roll dialog
    return AnyventureRollDialog.show({
      title: `${skillName.charAt(0).toUpperCase() + skillName.slice(1)} Check`,
      skillName: skillName.charAt(0).toUpperCase() + skillName.slice(1),
      baseDice: baseDice,
      diceType: diceType,
      actor: this,
      initialPenaltyDice: initialPenaltyDice,
      conditionNotes: conditionNotes,
      rollCallback: (roll, data) => {
        // Optional callback for additional processing
      }
    });
  }

  /**
   * Provide the initiative formula for this actor
   * @returns {string} The initiative roll formula
   */
  getInitiativeFormula() {
    // Get coordination skill and finesse attribute
    const coordination = this.system.basic?.coordination;
    const finesse = this.system.attributes?.finesse;


    if (!coordination || !finesse) {
      return '1d20';
    }

    // Calculate dice based on Anyventure rules
    const diceTable = [
      'd4',   // Level 0
      'd6',   // Level 1
      'd8',   // Level 2
      'd10',  // Level 3
      'd12',  // Level 4
      'd16',  // Level 5
      'd20',  // Level 6
      'd24',  // Level 7
      'd30'   // Level 8
    ];

    const skillLevel = Math.min(Math.max(coordination.value || 0, 0), 8);
    const diceType = diceTable[skillLevel] || 'd4';
    const talent = Math.max(finesse.value || 1, 1);

    // Build the roll formula
    let formula;
    if (talent > 1) {
      formula = `${talent}${diceType}kh1`;
    } else {
      formula = `1${diceType}`;
    }

    return formula;
  }

  /**
   * Get the initiative formula for this Actor - Foundry v11+ method
   * @returns {string} The initiative formula
   */
  get initiativeFormula() {
    return this.getInitiativeFormula();
  }

  /**
   * Get the initiative roll formula - Alternative Foundry method
   * @returns {string} The initiative formula
   */
  getInitiativeRoll() {
    return this.getInitiativeFormula();
  }

  /**
   * Override Foundry's default initiative roll to use coordination skill
   * @override
   */
  async rollInitiative(options = {}) {

    // Get coordination skill and finesse attribute
    // Coordination is under basic, not skills
    const coordination = this.system.basic?.coordination;
    const finesse = this.system.attributes?.finesse;

    if (!coordination || !finesse) {
      ui.notifications.warn('Cannot roll initiative: coordination skill or finesse attribute not found');
      // Fall back to default d20 roll
      const roll = new Roll('1d20');
      await roll.evaluate({async: true});
      return roll;
    }

    // Calculate dice based on Anyventure rules
    const diceTable = [
      'd4',   // Level 0
      'd6',   // Level 1
      'd8',   // Level 2
      'd10',  // Level 3
      'd12',  // Level 4
      'd16',  // Level 5
      'd20',  // Level 6
      'd24',  // Level 7
      'd30'   // Level 8
    ];

    // Handle dice tier modifier if needed (upgrade/downgrade)
    const diceTableWithTiers = [
      ['d2', 'd4', 'd6'],   // Level 0
      ['d4', 'd6', 'd8'],   // Level 1
      ['d6', 'd8', 'd10'],  // Level 2
      ['d8', 'd10', 'd12'], // Level 3
      ['d10', 'd12', 'd16'], // Level 4
      ['d12', 'd16', 'd20'], // Level 5
      ['d16', 'd20', 'd24'], // Level 6
      ['d20', 'd24', 'd30']  // Level 7
    ];

    const skillLevel = Math.min(Math.max(coordination.value || 0, 0), 7);
    const tierModifier = Number(coordination.tier) || 0;

    let diceType;
    if (tierModifier !== 0) {
      const upgradeLevel = Math.min(Math.max(tierModifier + 1, 0), 2);
      diceType = diceTableWithTiers[skillLevel]?.[upgradeLevel] || 'd4';
    } else {
      diceType = diceTable[skillLevel] || 'd4';
    }

    // Finesse value determines number of dice (keep highest)
    const talent = Math.max(finesse.value || 1, 1);

    // Build the roll formula (roll multiple dice, keep highest)
    let formula;
    if (talent > 1) {
      formula = `${talent}${diceType}kh1`;
    } else {
      formula = `1${diceType}`;
    }

    try {
      // Create and evaluate the roll
      const roll = new Roll(formula);
      await roll.evaluate({async: true});

      // Harvest dice results for styled chat output
      const dieTerm = roll.dice?.[0] || roll.terms.find(t => Array.isArray(t?.results));
      const detailedResults = Array.isArray(dieTerm?.results)
        ? dieTerm.results.map(r => ({ result: r.result, discarded: Boolean(r.discarded) }))
        : [];

      const keptResults = detailedResults.filter(r => !r.discarded).map(r => r.result);
      const discardedResults = detailedResults.filter(r => r.discarded).map(r => r.result);
      const keptResultsSorted = [...keptResults].sort((a, b) => b - a);
      const highestDie = keptResultsSorted.length > 0 ? keptResultsSorted[0] : roll.total;

      const diceResultsDisplay = detailedResults.length > 0
        ? detailedResults.map(r => {
            const style = r.discarded ? ' style="color:#f87171;"' : '';
            return `<span${style}>${r.result}</span>`;
          }).join(', ')
        : roll.result;

      const formulaNote = talent > 1 ? ' (keep highest)' : '';
      const tierNote = tierModifier !== 0 ? ` | Tier ${tierModifier > 0 ? '+' : ''}${tierModifier}` : '';
      const metaInfo = `Coordination ${skillLevel}${tierNote} | Finesse Talent ${talent}`;

      // Create flavor text matching skill check format
      let flavorText = `<div class="anyventure-skill-card">`;
      flavorText += `<div class="skill-name"><strong>Coordination Check</strong></div>`;
      flavorText += `<div class="dice-results"><strong>Results:</strong> [${diceResultsDisplay}]</div>`;
      flavorText += `<div class="formula">Formula: ${formula}${formulaNote}</div>`;
      flavorText += `</div>`;

      // Get the combatant for this actor
      const combat = game.combat;
      if (!combat) return roll;

      // Use the combatantId from options if provided, otherwise find by actor ID
      let combatant;
      if (options.combatantId) {
        combatant = combat.combatants.get(options.combatantId);
      } else {
        // Fallback: find by actor ID (may be incorrect for duplicate actors)
        combatant = combat.combatants.find(c => c.actor?.id === this.id);
      }

      if (!combatant) return roll;

      // Update the combatant's initiative
      await combat.updateEmbeddedDocuments('Combatant', [{
        _id: combatant.id,
        initiative: roll.total
      }]);

      // Display the roll to chat
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({actor: this}),
        flavor: flavorText,
        rollMode: game.settings.get('core', 'rollMode')
      });

      return roll;
    } catch (error) {
      console.error('[Anyventure] Error rolling initiative:', error);
      ui.notifications.error('Error rolling initiative. Using default d20.');

      // Fallback to d20
      const roll = new Roll('1d20');
      await roll.evaluate({async: true});
      return roll;
    }
  }
}
