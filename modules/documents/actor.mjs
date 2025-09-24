// Baseline and overlays approach: parsing happens during Recalculate only.

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
    // Skeleton: iterate equipped items and log their slot + name.
    // Skip ephemeral overlays while building the baseline during Recalculate
    if (this._blockOverlays) return;
    console.log("HERE");
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
        weapon: {},
        magic: {},
        craft: {},
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
          console.log(`[Anyventure] === Processing Equipment: ${name} (type: ${type}) in slot: ${slot} ===`);
          console.log(`[Anyventure] Item system data:`, equipped.system);

          // Encumbrance penalty
          const pen = Number(equipped.system?.encumbrance_penalty || 0);
          console.log(`[Anyventure] Encumbrance penalty: ${equipped.system?.encumbrance_penalty} -> ${pen} (isNaN: ${Number.isNaN(pen)})`);
          if (!Number.isNaN(pen)) encumbrancePenalty += pen;

          // Parse item bonuses
          const itemSystem = equipped.system || {};

          // Health bonuses
          if (itemSystem.health) {
            const healthMax = Number(itemSystem.health.max || 0);
            const healthRecovery = Number(itemSystem.health.recovery || 0);
            console.log(`[Anyventure] Health bonuses: max=${itemSystem.health.max} -> ${healthMax}, recovery=${itemSystem.health.recovery} -> ${healthRecovery}`);
            equipmentBonuses.resources.health.max += healthMax;
            equipmentBonuses.resources.health.recovery += healthRecovery;
          }

          // Energy bonuses
          if (itemSystem.energy) {
            const energyMax = Number(itemSystem.energy.max || 0);
            const energyRecovery = Number(itemSystem.energy.recovery || 0);
            console.log(`[Anyventure] Energy bonuses: max=${itemSystem.energy.max} -> ${energyMax}, recovery=${itemSystem.energy.recovery} -> ${energyRecovery}`);
            equipmentBonuses.resources.energy.max += energyMax;
            equipmentBonuses.resources.energy.recovery += energyRecovery;
          }

          // Resolve bonuses
          if (itemSystem.resolve) {
            const resolveMax = Number(itemSystem.resolve.max || 0);
            const resolveRecovery = Number(itemSystem.resolve.recovery || 0);
            console.log(`[Anyventure] Resolve bonuses: max=${itemSystem.resolve.max} -> ${resolveMax}, recovery=${itemSystem.resolve.recovery} -> ${resolveRecovery}`);
            equipmentBonuses.resources.resolve.max += resolveMax;
            equipmentBonuses.resources.resolve.recovery += resolveRecovery;
          }

          // Movement bonus
          if (itemSystem.movement) {
            const movementBonus = Number(itemSystem.movement || 0);
            console.log(`[Anyventure] Movement bonus: ${itemSystem.movement} -> ${movementBonus}`);
            equipmentBonuses.movement += movementBonus;
          }

          // Attribute bonuses (nested objects with add_talent/set_talent)
          if (itemSystem.attributes && typeof itemSystem.attributes === 'object') {
            console.log(`[Anyventure] Processing attributes:`, itemSystem.attributes);
            for (const [attr, attrData] of Object.entries(itemSystem.attributes)) {
              if (attrData && typeof attrData === 'object') {
                const addTalent = Number(attrData.add_talent || 0);
                const setTalent = Number(attrData.set_talent || 0);
                console.log(`[Anyventure] Attribute ${attr}: add_talent=${attrData.add_talent} -> ${addTalent}, set_talent=${attrData.set_talent} -> ${setTalent}`);
                // For now, just use add_talent (we can implement set_talent logic later)
                if (addTalent !== 0) {
                  equipmentBonuses.attributes[attr] = (equipmentBonuses.attributes[attr] || 0) + addTalent;
                }
              }
            }
          }

          // Basic skill bonuses (nested objects with add_bonus/set_bonus)
          if (itemSystem.basic && typeof itemSystem.basic === 'object') {
            console.log(`[Anyventure] Processing basic skills:`, itemSystem.basic);
            for (const [skill, skillData] of Object.entries(itemSystem.basic)) {
              if (skillData && typeof skillData === 'object') {
                const addBonus = Number(skillData.add_bonus || 0);
                const setBonus = Number(skillData.set_bonus || 0);
                console.log(`[Anyventure] Basic skill ${skill}: add_bonus=${skillData.add_bonus} -> ${addBonus}, set_bonus=${skillData.set_bonus} -> ${setBonus}`);
                // For now, just use add_bonus (we can implement set_bonus logic later)
                if (addBonus !== 0) {
                  equipmentBonuses.basic[skill] = (equipmentBonuses.basic[skill] || 0) + addBonus;
                }
              }
            }
          }

          // Weapon skill bonuses (nested objects with add_bonus/set_bonus/add_talent/set_talent)
          if (itemSystem.weapon && typeof itemSystem.weapon === 'object') {
            console.log(`[Anyventure] Processing weapon skills:`, itemSystem.weapon);
            for (const [skill, skillData] of Object.entries(itemSystem.weapon)) {
              if (skillData && typeof skillData === 'object') {
                const addBonus = Number(skillData.add_bonus || 0);
                const addTalent = Number(skillData.add_talent || 0);
                console.log(`[Anyventure] Weapon skill ${skill}: add_bonus=${skillData.add_bonus} -> ${addBonus}, add_talent=${skillData.add_talent} -> ${addTalent}`);
                // For now, just use add_bonus for skill values (talents would need different handling)
                if (addBonus !== 0) {
                  equipmentBonuses.weapon[skill] = (equipmentBonuses.weapon[skill] || 0) + addBonus;
                }
              }
            }
          }

          // Magic skill bonuses (nested objects with add_bonus/set_bonus/add_talent/set_talent)
          if (itemSystem.magic && typeof itemSystem.magic === 'object') {
            console.log(`[Anyventure] Processing magic skills:`, itemSystem.magic);
            for (const [skill, skillData] of Object.entries(itemSystem.magic)) {
              if (skillData && typeof skillData === 'object') {
                const addBonus = Number(skillData.add_bonus || 0);
                const addTalent = Number(skillData.add_talent || 0);
                console.log(`[Anyventure] Magic skill ${skill}: add_bonus=${skillData.add_bonus} -> ${addBonus}, add_talent=${skillData.add_talent} -> ${addTalent}`);
                // For now, just use add_bonus for skill values
                if (addBonus !== 0) {
                  equipmentBonuses.magic[skill] = (equipmentBonuses.magic[skill] || 0) + addBonus;
                }
              }
            }
          }

          // Craft skill bonuses (nested objects with add_bonus/set_bonus/add_talent/set_talent)
          if (itemSystem.craft && typeof itemSystem.craft === 'object') {
            console.log(`[Anyventure] Processing craft skills:`, itemSystem.craft);
            for (const [skill, skillData] of Object.entries(itemSystem.craft)) {
              if (skillData && typeof skillData === 'object') {
                const addBonus = Number(skillData.add_bonus || 0);
                const addTalent = Number(skillData.add_talent || 0);
                console.log(`[Anyventure] Craft skill ${skill}: add_bonus=${skillData.add_bonus} -> ${addBonus}, add_talent=${skillData.add_talent} -> ${addTalent}`);
                // For now, just use add_bonus for skill values
                if (addBonus !== 0) {
                  equipmentBonuses.craft[skill] = (equipmentBonuses.craft[skill] || 0) + addBonus;
                }
              }
            }
          }

          // Mitigation bonuses (flat numeric values)
          if (itemSystem.mitigation && typeof itemSystem.mitigation === 'object') {
            console.log(`[Anyventure] Processing mitigation:`, itemSystem.mitigation);
            for (const [type, value] of Object.entries(itemSystem.mitigation)) {
              if (value != null && value !== '') {
                const bonus = Number(value);
                console.log(`[Anyventure] Mitigation ${type}: ${value} -> ${bonus} (isNaN: ${Number.isNaN(bonus)})`);
                if (!Number.isNaN(bonus) && bonus !== 0) {
                  equipmentBonuses.mitigation[type] = (equipmentBonuses.mitigation[type] || 0) + bonus;
                }
              }
            }
          }

          // Detection bonuses (flat numeric values)
          if (itemSystem.detections && typeof itemSystem.detections === 'object') {
            console.log(`[Anyventure] Processing detections:`, itemSystem.detections);
            for (const [detection, value] of Object.entries(itemSystem.detections)) {
              if (value != null && value !== '') {
                const bonus = Number(value);
                console.log(`[Anyventure] Detection ${detection}: ${value} -> ${bonus} (isNaN: ${Number.isNaN(bonus)})`);
                if (!Number.isNaN(bonus) && bonus !== 0) {
                  equipmentBonuses.detections[detection] = (equipmentBonuses.detections[detection] || 0) + bonus;
                }
              }
            }
          }

          // Immunities (object with boolean values, not array)
          if (itemSystem.immunities && typeof itemSystem.immunities === 'object') {
            console.log(`[Anyventure] Processing immunities:`, itemSystem.immunities);
            for (const [immunity, enabled] of Object.entries(itemSystem.immunities)) {
              if (enabled === true) {
                console.log(`[Anyventure] Adding immunity: ${immunity}`);
                if (!equipmentBonuses.immunities.includes(immunity)) {
                  equipmentBonuses.immunities.push(immunity);
                }
              }
            }
          }

          // Effects (arrays - should work as before)
          if (itemSystem.effects && Array.isArray(itemSystem.effects)) {
            console.log(`[Anyventure] Processing effects:`, itemSystem.effects);
            for (const effect of itemSystem.effects) {
              if (effect && effect !== null && effect !== '') {
                console.log(`[Anyventure] Adding effect:`, effect);
                equipmentBonuses.effects.push(effect);
              }
            }
          }

          console.log(`[Anyventure] === Finished processing ${name} ===`);
        }
      }

      console.log(`[Anyventure] === APPLYING EQUIPMENT BONUSES ===`);
      console.log(`[Anyventure] Base resources:`, systemData._base.resources);
      console.log(`[Anyventure] Equipment bonuses:`, equipmentBonuses);

      // Apply equipment bonuses to character stats (idempotent overlay from base)
      // Resources
      const baseHealthMax = systemData._base.resources.health.max;
      const healthBonus = equipmentBonuses.resources.health.max;
      systemData.resources.health.max = baseHealthMax + healthBonus;
      console.log(`[Anyventure] Health max: ${baseHealthMax} + ${healthBonus} = ${systemData.resources.health.max}`);

      const baseEnergyMax = systemData._base.resources.energy.max;
      const energyBonus = equipmentBonuses.resources.energy.max;
      systemData.resources.energy.max = baseEnergyMax + energyBonus;
      console.log(`[Anyventure] Energy max: ${baseEnergyMax} + ${energyBonus} = ${systemData.resources.energy.max}`);

      const baseResolveMax = systemData._base.resources.resolve.max;
      const resolveBonus = equipmentBonuses.resources.resolve.max;
      systemData.resources.resolve.max = baseResolveMax + resolveBonus;
      console.log(`[Anyventure] Resolve max: ${baseResolveMax} + ${resolveBonus} = ${systemData.resources.resolve.max}`);

      // Movement (apply to walk speed as base)
      if (systemData.movement?.walk !== undefined) {
        const baseWalk = systemData._base.movement?.walk || 5;
        const walkBonus = equipmentBonuses.movement;
        systemData.movement.walk = baseWalk + walkBonus;
        console.log(`[Anyventure] Walk speed: ${baseWalk} + ${walkBonus} = ${systemData.movement.walk}`);
      }

      // Attributes
      console.log(`[Anyventure] Applying attribute bonuses:`, equipmentBonuses.attributes);
      for (const [attr, bonus] of Object.entries(equipmentBonuses.attributes)) {
        if (systemData.attributes?.[attr] !== undefined && systemData._base.attributes?.[attr] !== undefined) {
          const baseValue = systemData._base.attributes[attr].value;
          const newValue = baseValue + bonus;
          systemData.attributes[attr].value = newValue;
          console.log(`[Anyventure] Attribute ${attr}: ${baseValue} + ${bonus} = ${newValue}`);
        } else {
          console.log(`[Anyventure] Attribute ${attr} not found in systemData or _base`);
        }
      }

      // Skills - Basic
      console.log(`[Anyventure] Applying basic skill bonuses:`, equipmentBonuses.basic);
      for (const [skill, bonus] of Object.entries(equipmentBonuses.basic)) {
        if (systemData.basic?.[skill] !== undefined && systemData._base.basic?.[skill] !== undefined) {
          const baseValue = systemData._base.basic[skill].value;
          const newValue = baseValue + bonus;
          systemData.basic[skill].value = newValue;
          console.log(`[Anyventure] Basic skill ${skill}: ${baseValue} + ${bonus} = ${newValue}`);
        } else {
          console.log(`[Anyventure] Basic skill ${skill} not found in systemData or _base`);
        }
      }

      // Skills - Weapon
      console.log(`[Anyventure] Applying weapon skill bonuses:`, equipmentBonuses.weapon);
      for (const [skill, bonus] of Object.entries(equipmentBonuses.weapon)) {
        if (systemData.weapon?.[skill] !== undefined && systemData._base.weapon?.[skill] !== undefined) {
          const baseValue = systemData._base.weapon[skill].value;
          const newValue = baseValue + bonus;
          systemData.weapon[skill].value = newValue;
          console.log(`[Anyventure] Weapon skill ${skill}: ${baseValue} + ${bonus} = ${newValue}`);
        } else {
          console.log(`[Anyventure] Weapon skill ${skill} not found in systemData or _base`);
        }
      }

      // Skills - Magic
      console.log(`[Anyventure] Applying magic skill bonuses:`, equipmentBonuses.magic);
      for (const [skill, bonus] of Object.entries(equipmentBonuses.magic)) {
        if (systemData.magic?.[skill] !== undefined && systemData._base.magic?.[skill] !== undefined) {
          const baseValue = systemData._base.magic[skill].value;
          const newValue = baseValue + bonus;
          systemData.magic[skill].value = newValue;
          console.log(`[Anyventure] Magic skill ${skill}: ${baseValue} + ${bonus} = ${newValue}`);
        } else {
          console.log(`[Anyventure] Magic skill ${skill} not found in systemData or _base`);
        }
      }

      // Skills - Craft
      console.log(`[Anyventure] Applying craft skill bonuses:`, equipmentBonuses.craft);
      for (const [skill, bonus] of Object.entries(equipmentBonuses.craft)) {
        if (systemData.craft?.[skill] !== undefined && systemData._base.craft?.[skill] !== undefined) {
          const baseValue = systemData._base.craft[skill].value;
          const newValue = baseValue + bonus;
          systemData.craft[skill].value = newValue;
          console.log(`[Anyventure] Craft skill ${skill}: ${baseValue} + ${bonus} = ${newValue}`);
        } else {
          console.log(`[Anyventure] Craft skill ${skill} not found in systemData or _base`);
        }
      }

      // Mitigation
      console.log(`[Anyventure] Applying mitigation bonuses:`, equipmentBonuses.mitigation);
      for (const [type, bonus] of Object.entries(equipmentBonuses.mitigation)) {
        if (systemData.mitigation?.[type] !== undefined && systemData._base.mitigation?.[type] !== undefined) {
          const baseValue = systemData._base.mitigation[type];
          const newValue = baseValue + bonus;
          systemData.mitigation[type] = newValue;
          console.log(`[Anyventure] Mitigation ${type}: ${baseValue} + ${bonus} = ${newValue}`);
        } else {
          console.log(`[Anyventure] Mitigation ${type} not found in systemData or _base`);
        }
      }

      // Store equipment bonuses for reference
      systemData._equipmentBonuses = equipmentBonuses;
      systemData.encumbrance_penalty = encumbrancePenalty;

      console.log('[Anyventure] Equipment bonuses applied:', equipmentBonuses);


    } catch (err) {
      console.warn('Equipment parsing (skeleton) encountered an error:', err);
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
        energy: systemData.resources?.energy?.value
      };
      const res = clone(base.resources);
      ['health','resolve','morale','energy'].forEach((k) => {
        if (!res[k]) res[k] = {};
        if (current[k] !== undefined) res[k].value = current[k];
      });
      systemData.resources = res;
    }
    if (base.movement) systemData.movement = clone(base.movement);
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
