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
   * Prepare Character type specific data
   */
  _prepareCharacterData(actorData) {
    if (actorData.type !== 'character') return;

    const systemData = actorData.system;

    // Calculate skill talents based on attributes
    this._calculateSkillTalents(systemData);
    
    // Calculate resources (Health, Resolve, Energy)
    this._calculateResources(systemData);
    
    // Apply module effects
    this._applyModuleEffects(systemData);
    
    // Calculate movement
    this._calculateMovement(systemData);
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
   */
  _calculateResources(systemData) {
    // Base resources calculation
    const baseHealth = 5;
    const baseResolve = 5;
    const baseEnergy = 5;

    // Set max values (will be modified by modules later)
    systemData.resources.health.max = baseHealth;
    systemData.resources.resolve.max = baseResolve;
    systemData.resources.energy.max = baseEnergy;

    // Ensure current values don't exceed max
    systemData.resources.health.value = Math.min(
      systemData.resources.health.value || systemData.resources.health.max,
      systemData.resources.health.max
    );
    
    systemData.resources.resolve.value = Math.min(
      systemData.resources.resolve.value || systemData.resources.resolve.max,
      systemData.resources.resolve.max
    );
    
    systemData.resources.energy.value = Math.min(
      systemData.resources.energy.value || systemData.resources.energy.max,
      systemData.resources.energy.max
    );
  }

  /**
   * Apply effects from selected modules
   */
  _applyModuleEffects(systemData) {
    // This is where we'll parse module effects and apply them
    // For now, just a placeholder that we'll expand later
    if (!systemData.modules || systemData.modules.length === 0) return;

    // TODO: Implement module parsing logic
    // This will iterate through selected modules and apply their effects
    console.log('Anyventure | Module effects not yet implemented');
  }

  /**
   * Calculate movement values
   */
  _calculateMovement(systemData) {
    // Set current movement to standard if not already set
    if (!systemData.movement.current) {
      systemData.movement.current = systemData.movement.standard;
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
        console.log(`${skillName} roll completed:`, roll.total, data);
      }
    });
  }
}