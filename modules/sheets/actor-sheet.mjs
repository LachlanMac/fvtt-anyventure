import { formatRange, formatSpellRange, formatCategory, formatDamageType } from "../utils/formatters.mjs";
import { AnyventureAttackRollDialog } from "./attack-roll-dialog.mjs";
import { AnyventureRecoverResourcesDialog } from "./recover-resources-dialog.mjs";
import { AnyventureTakeDamageDialog } from "./take-damage-dialog.mjs";
import { AnyventureRestDialog } from "./rest-dialog.mjs";
import { AnyventureSpellCastDialog } from "./spell-cast-dialog.mjs";
import { AnyventureAbilityUseDialog } from "./ability-use-dialog.mjs";
import { parseAndApplyCharacterEffects } from "../utils/character-parser.js";

const WEAPON_SLOTS = ['mainhand', 'offhand', 'extra1', 'extra2', 'extra3'];
const EXTRA_WEAPON_SLOTS = ['extra1', 'extra2', 'extra3'];
const TWO_HANDED_WEAPON_SLOTS = ['mainhand', 'extra1', 'extra2', 'extra3'];
const WEAPON_CATEGORY_ALIASES = {
  simpleMelee: 'simpleMeleeWeapons',
  simpleRanged: 'simpleRangedWeapons',
  complexMelee: 'complexMeleeWeapons',
  complexRanged: 'complexRangedWeapons',
  throwingWeapons: 'throwing'
};
const COMPLEX_WEAPON_CATEGORIES = new Set(['complexMeleeWeapons', 'complexRangedWeapons']);
const THROWING_WEAPON_CATEGORY = 'throwing';
const CONSUMABLE_ITEM_TYPES = new Set(['ammunition']);
const TWO_HANDED_FLAG = 'two-handed';

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {foundry.appv1.sheets.ActorSheet}
 */
export class AnyventureActorSheet extends foundry.appv1.sheets.ActorSheet {

  constructor(...args) {
    super(...args);
    // Store active sub-tabs per actor
    this._activeSubTabs = {
      moves: 'attacks',  // Default to attacks tab
      character: 'traits'  // Default to traits tab (traits, modules, conditions, injuries)
    };
  }

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["anyventure", "sheet", "actor"],
      template: "systems/anyventure/templates/actor/actor-character-sheet.hbs",
      width: 830,
      height: 832,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "skills" }]
    });
  }

  /**
   * Calculate energy cost with trait adjustments
   */
  _calculateEnergyWithTraits(baseEnergy, weaponCategory) {
    // Only apply to character actors, not NPCs
    if (this.actor.type !== 'character') {
      return baseEnergy;
    }

    let adjustedEnergy = baseEnergy;

    // EFFICIENT_WEAPONRY: Reduce energy cost by 1 for complex weapons
    if (this.actor.system.conditionals?.flags?.EFFICIENT_WEAPONRY === true) {
      const isComplexWeapon = weaponCategory === 'complexMeleeWeapons' || weaponCategory === 'complexRangedWeapons';
      if (isComplexWeapon) {
        adjustedEnergy = Math.max(0, adjustedEnergy - 1);
      }
    }

    return adjustedEnergy;
  }

  /**
   * Calculate modified weapon ranges with range modifiers
   */
  _calculateModifiedRanges(baseMinRange, baseMaxRange, weaponCategory, attackCategory) {
    // Only apply to character actors, not NPCs
    if (this.actor.type !== 'character') {
      return { minRange: baseMinRange, maxRange: baseMaxRange };
    }

    const weaponMods = this.actor.system.weaponModifications || {};
    let minRange = baseMinRange;
    let maxRange = baseMaxRange;

    // Determine the weapon type for range modifications
    let rangeType = null;

    // Handle special case: gunblades and other weapons with ranged attacks
    if (attackCategory === 'ranged' && weaponCategory !== 'simpleRangedWeapons' && weaponCategory !== 'complexRangedWeapons') {
      // Assume complex ranged for non-categorized ranged attacks
      rangeType = 'complex';
    } else if (weaponCategory === 'simpleRangedWeapons') {
      rangeType = 'simple';
    } else if (weaponCategory === 'complexRangedWeapons') {
      rangeType = 'complex';
    } else if (weaponCategory === 'throwing') {
      rangeType = 'throwing';
    }

    // Apply range modifications based on weapon type
    if (rangeType === 'simple') {
      minRange += (weaponMods.simpleRangedMinRange || 0);
      maxRange += (weaponMods.simpleRangedMaxRange || 0);
    } else if (rangeType === 'complex') {
      minRange += (weaponMods.complexRangedMinRange || 0);
      maxRange += (weaponMods.complexRangedMaxRange || 0);
    } else if (rangeType === 'throwing') {
      minRange += (weaponMods.throwingMinRange || 0);
      maxRange += (weaponMods.throwingMaxRange || 0);
    }

    // Clamp ranges to valid bounds
    minRange = Math.max(1, minRange); // Minimum 1 (0 is "Self")
    maxRange = Math.min(8, Math.max(minRange, maxRange)); // Maximum 8 ("Distant"), and ensure max >= min

    return { minRange, maxRange };
  }

  /** @override */
  get template() {
    return `systems/anyventure/templates/actor/actor-${this.actor.type}-sheet.hbs`;
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    // Retrieve the data structure from the base sheet. You can inspect or log
    // the context variable to see the structure, but some key properties for
    // sheets are the actor object, the data object, whether or not the sheet
    // is editable, the items array, and the effects array.
    const context = super.getData();

    // Use a safe clone of the actor data for further operations.
    const actorData = this.actor.toObject(false);

    // Add the actor's data to context.data for easier access, as well as flags.
    context.system = actorData.system;
    context.flags = actorData.flags;

    // Prepare character data and items.
    if (actorData.type == 'character') {
      this._prepareItems(context);
      this._prepareCharacterData(context);
      this._prepareTraits(context);
      this._prepareAbilities(context);
    }

    // Prepare NPC data and items.
    if (actorData.type == 'npc') {
      this._prepareItems(context);
      this._prepareCharacterData(context); // NPCs use the same skill preparation
      this._prepareAbilities(context); // NPCs also need abilities prepared
    }

    // Add roll data for TinyMCE editors.
    context.rollData = context.actor.getRollData();

    // Prepare active effects
    context.effects = prepareActiveEffectCategories(this.actor.effects);

    // Prepare conditions for display
    try {
      context.conditionCards = this._prepareConditions();
      console.log("DEBUG: conditionCards in context:", context.conditionCards);
    } catch (error) {
      console.warn("Error preparing conditions:", error);
      context.conditionCards = [];
    }

    return context;
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} context The context to prepare.
   *
   * @return {undefined}
   */
  _prepareCharacterData(context) {

    // Update talent values for basic skills based on attributes
    if (context.system.basic) {
      for (let [key, skill] of Object.entries(context.system.basic)) {
        if (skill.attribute && context.system.attributes[skill.attribute]) {
          skill.talent = context.system.attributes[skill.attribute].value;
        }
      }
    }

    // Handle skill categories - they're directly on system, not under system.skills
    const languageSkills = this._prepareLanguagesFromItems(context) || {};
    context.skillCategories = {
      basic: context.system.basic || {},
      weapon: context.system.weapon || {},
      magic: context.system.magic || {},
      crafting: context.system.crafting || {},
      language: languageSkills,
      music: context.system.music || {}
    };
    // Calculate available module points
    if (context.system.modulePoints && typeof context.system.modulePoints === 'object') {
      // New structure: { total: X, spent: Y }
      context.availableModulePoints = (context.system.modulePoints.total || 0) - (context.system.modulePoints.spent || 0);
    } else {
      // Legacy structure: just a number
      context.availableModulePoints = context.system.modulePoints || 0;
    }
    
    // Calculate available attribute points (for character creation)
    context.availableAttributePoints = context.system.characterCreation?.attributePointsRemaining || 0;
  }

  /**
   * Prepare trait data for display in the traits section
   * Collects TA (ancestry), TG (general), TC (crafting), TP (cultural), and personality traits from various sources
   * @param {Object} context The context to prepare
   * @private
   */
  _prepareTraits(context) {
    // Trait collections with their corresponding codes and default names
    const traitTypes = {
      TA: { collection: [], name: 'ancestryTraits', defaultName: 'Ancestry Trait' },
      TG: { collection: [], name: 'generalTraits', defaultName: 'General Trait' },
      TC: { collection: [], name: 'craftingTraits', defaultName: 'Crafting Trait' },
      TP: { collection: [], name: 'personalityTraits', defaultName: 'Personality Trait' },
      TX: { collection: [], name: 'culturalTraits', defaultName: 'Cultural Trait' }
    };

    // Helper function to process options for trait codes
    const processOptions = (options, sourceName, allSelected = false) => {
      const optionsToProcess = allSelected ? options : options.filter(opt => opt.selected);

      for (const option of optionsToProcess) {
        if (!option.data || typeof option.data !== 'string') continue;

        // Split by colon to handle multiple data codes in one string
        const dataParts = option.data.split(':').map(part => part.trim());

        for (const dataPart of dataParts) {
          // Check each trait type
          for (const [code, typeInfo] of Object.entries(traitTypes)) {
            const match = dataPart.match(new RegExp(`^${code}(?:=(.+))?$`, 'i'));
            if (match) {
              const traitName = match[1] ? match[1].trim() : option.name || typeInfo.defaultName;
              if (traitName && !typeInfo.collection.some(t => t.name === traitName)) {
                typeInfo.collection.push({
                  name: traitName,
                  description: option.description || '',
                  source: sourceName
                });
              }
            }
          }
        }
      }
    };

    // Define item processing rules
    const itemTypes = [
      { filter: i => i.type === 'module' && i.system.mtype !== 'personality', process: false },
      { filter: i => i.type === 'ancestry', process: false },
      { filter: i => i.type === 'trait', process: false },
      { filter: i => i.type === 'culture', process: false },
      { filter: i => i.type === 'module' && i.system.mtype === 'personality', process: false }
    ];

    // Process all item types
    for (const { filter } of itemTypes) {
      const items = context.items.filter(filter);
      for (const item of items) {
        if (item.system.options) {
          processOptions(item.system.options, item.name, false);
        }
      }
    }

    // Add the trait arrays to context for template use
    context.ancestryTraits = traitTypes.TA.collection;
    context.generalTraits = traitTypes.TG.collection;
    context.craftingTraits = traitTypes.TC.collection;
    context.culturalTraits = traitTypes.TX.collection;
    context.personalityTraits = traitTypes.TP.collection;
  }

  /**
   * Prepare action and reaction abilities for display in the Moves tab
   * @param {Object} context The context to prepare
   * @private
   */
  _prepareAbilities(context) {
    // Filter items to get actions and reactions
    const allActions = context.items.filter(i => i.type === 'action');
    const reactions = context.items.filter(i => i.type === 'reaction');

    // Separate attack actions from regular actions
    const attackActions = allActions.filter(i => i.system.abilityType === 'attack');
    const regularActions = allActions.filter(i => i.system.abilityType !== 'attack');

    // Sort by name for better organization
    const sortByName = (a, b) => a.name.localeCompare(b.name);
    attackActions.sort(sortByName);
    regularActions.sort(sortByName);
    reactions.sort(sortByName);

    // Add to context for template use
    context.actionItems = regularActions;
    context.reactionItems = reactions;
    context.attackActions = attackActions;
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} context The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareItems(context) {
    // Initialize containers.
    const gear = [];
    const modules = [];
    const spells = [];
    const weapons = [];
    const armors = [];
    const shields = [];
    const gloves = [];
    const headwear = [];
    const boots = [];
    const rings = [];
    const cloaks = [];
    const equipments = [];
    const light_sources = [];
    const ammunition = [];
    const instruments = [];
    const goods = [];
    const adventure = [];
    const consumables = [];
    const tools = [];
    const runes = [];
    const injuries = [];

    // Get list of equipped item IDs to filter out from inventory
    const equippedItemIds = this._getEquippedItemIds(context);

    // Iterate through items, allocating to containers
    for (let i of context.items) {
      i.img = i.img || foundry.CONST.DEFAULT_TOKEN;

      // Skip equipped items for inventory display
      const isEquipped = equippedItemIds.has(i._id);

      // Categorize by type
      if (i.type === 'item') {
        // All physical items have type 'item', check itemType for specific categorization
        const itemType = i.system.itemType;
        const slotType = this._resolveItemSlotType(i);

        if (itemType === 'weapon' && !isEquipped) {
          weapons.push(i);
        }
        else if ((itemType === 'armor' || itemType === 'body') && !isEquipped) {
          armors.push(i);
        }
        else if (itemType === 'shield' && !isEquipped) {
          shields.push(i);
        }
        else if (itemType === 'gloves' && !isEquipped) {
          gloves.push(i);
        }
        else if (itemType === 'headwear' && !isEquipped) {
          headwear.push(i);
        }
        else if (itemType === 'boots' && !isEquipped) {
          boots.push(i);
        }
        else if (itemType === 'ring' && !isEquipped) {
          rings.push(i);
        }
        else if (slotType === 'cloaks' && !isEquipped) {
          cloaks.push(i);
        }
        else if (itemType === 'equipment' && !isEquipped) {
          // Further categorize equipment by subtype
          const eqType = (i.system.equipment_type || '').toLowerCase();
          if (eqType === 'cloak' || eqType === 'cloaks' || eqType === 'back') {
            cloaks.push(i);
          }
          else if (eqType === 'light_source') {
            light_sources.push(i);
          }
          else if (eqType === 'ammunition') {
            ammunition.push(i);
          }
          else if (eqType === 'instrument') {
            instruments.push(i);
          }
          else {
            equipments.push(i);
          }
        }
        else if (itemType === 'goods' && !isEquipped) {
          goods.push(i);
        }
        else if (itemType === 'adventure' && !isEquipped) {
          adventure.push(i);
        }
        else if (itemType === 'consumable' && !isEquipped) {
          consumables.push(i);
        }
        else if (itemType === 'tool' && !isEquipped) {
          tools.push(i);
        }
        else if (itemType === 'runes' && !isEquipped) {
          runes.push(i);
        }
        else if (itemType === 'instrument' && !isEquipped) {
          instruments.push(i);
        }
        else if (itemType === 'ammunition' && !isEquipped) {
          ammunition.push(i);
        }
        else if (!isEquipped) {
          // Fallback to general gear for unknown item types
          gear.push(i);
        }
      }
      else if (i.type === 'module') {
        // Only add non-personality modules to the modules list
        // Personality modules are handled separately in character essentials
        if (i.system.mtype !== 'personality') {
          modules.push(i);
        }
      }
      else if (i.type === 'spell') {
        // Enhance spell data with casting information
        const enhancedSpell = this._enhanceSpellData(i, context);
        spells.push(enhancedSpell);
      }
      else if (i.type === 'injury') {
        // Injuries are always included regardless of equipped status - they represent temporary conditions
        injuries.push(i);
      }
      else {
        // Fallback to general gear for unknown types
        gear.push(i);
      }
    }



    // Find character essentials
    const ancestry = context.items.find(i => i.type === 'ancestry');
    const culture = context.items.find(i => i.type === 'culture');
    const personality = context.items.find(i => i.type === 'module' && i.system.mtype === 'personality');
    const trait = context.items.find(i => i.type === 'trait');

    // Assign to context
    context.gear = gear;
    context.modules = modules;
    context.spells = spells;
    context.ancestry = ancestry;
    context.culture = culture;
    context.personality = personality;
    context.trait = trait;
    context.weapons = weapons;
    context.armors = armors;
    context.shields = shields;
    context.gloves = gloves;
    context.headwear = headwear;
    context.boots = boots;
    context.rings = rings;
    context.cloaks = cloaks;
    context.equipments = equipments;
    context.light_sources = light_sources;
    context.ammunition = ammunition;
    context.instruments = instruments;
    context.goods = goods;
    context.adventure = adventure;
    context.consumables = consumables;
    context.tools = tools;
    context.runes = runes;
    context.injuries = injuries;
    // Collect equipped weapons for moves section
    context.equippedWeapons = this._getEquippedWeapons(context);
    return context;
  }

  /**
   * Prepare language skills from language items
   * @param {Object} context The actor context
   * @returns {Object} Object with language skills formatted like other skill categories
   * @private
   */
  _prepareLanguagesFromItems(context) {
    const languageSkills = {};
    // Find all language items owned by this character
    const languageItems = context.items.filter(item => item.type === 'language');

    for (const item of languageItems) {
      // Convert language name to a key (lowercase, replace spaces with underscores)
      const key = item.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

      languageSkills[key] = {
        name: item.name,
        value: 0, // Languages don't have skill values, just talent
        talent: item.system.talent || 0,
        baseTalent: item.flags?.anyventure?.characterTalent || item.system.talent || 0,
        magic: item.system.magic || 0,
        img: item.img || 'icons/svg/book.svg',
        itemId: item._id // Store the item ID for reference
      };
    }
    return languageSkills;
  }

  /**
   * Get a set of equipped item IDs to filter from inventory
   * @param {Object} context The actor context
   * @returns {Set} Set of equipped item IDs
   * @private
   */
  _getEquippedItemIds(context) {
    const equippedIds = new Set();
    const equipment = context.system.equipment || {};

    // Check all equipment slots for equipped items
    const slotNames = ['head', 'body', 'back', 'hand', 'boots', 'accessory1', 'accessory2', 'mainhand', 'offhand', 'extra1', 'extra2', 'extra3'];

    for (const slotName of slotNames) {
      const slot = equipment[slotName];
      if (slot?.item?._id) {
        equippedIds.add(slot.item._id);
      }
    }

    return equippedIds;
  }

  /**
   * Prepare conditions data for display in the conditions tab
   * @returns {Array} Array of condition card data
   * @private
   */
  _prepareConditions() {
    const conditions = [];

    // Safety check for actor effects
    if (!this.actor?.effects) {
      console.log("DEBUG: No actor effects found");
      return conditions;
    }

    console.log("DEBUG: Actor effects:", this.actor.effects);
    console.log("DEBUG: Number of effects:", this.actor.effects.size);

    // Get condition descriptions lookup
    const conditionDescriptions = {
      maddened: "Cannot identify friend from foe. Unaffected by other mind-altering conditions like charmed, confused, or afraid.",
      blind: "Cannot see. Suffers penalty dice to all attacks and defense checks. Fails all vision-based Senses checks.",
      prone: "On the ground. Movement is halved. Melee attackers gain bonus dice.",
      stunned: "Cannot take Actions or Reactions.",
      confused: "Each turn: (1) attack random target, (2) move randomly, (3) lose Action, (4) act normally.",
      afraid: "Cannot take Reactions. Must make Resilience check to use Actions.",
      charmed: "Under another creature's influence. Cannot target them with hostile actions.",
      paralyzed: "Cannot move or take Actions/Reactions. Automatically fail physical defense checks.",
      unconscious: "Cannot take Actions, Reactions, or Movement. Automatically fail physical defense checks.",
      bleeding: "Take damage at the end of each turn.",
      poisoned: "Suffer from toxin effects.",
      ignited: "On fire, taking damage each turn.",
      frozen: "Movement and actions severely limited by cold.",
      deafened: "Cannot hear. May fail sound-based Senses checks.",
      invisible: "Cannot be seen by normal vision.",
      hidden: "Undetected by normal senses."
    };

    for (const effect of this.actor.effects) {
      try {
        console.log("DEBUG: Processing effect:", effect);
        console.log("DEBUG: Effect statuses:", effect.statuses);
        console.log("DEBUG: Effect flags:", effect.flags);

        if (!effect || !effect.statuses || effect.statuses.size === 0) {
          console.log("DEBUG: Skipping effect - no statuses");
          continue; // Skip effects without status
        }

        const statusId = effect.statuses.first();
        const flags = (effect.flags && effect.flags.anyventure) || {};

        console.log("DEBUG: Status ID:", statusId);
        console.log("DEBUG: Anyventure flags:", flags);

        // Use status ID for name if available, otherwise use effect label
        const conditionName = statusId ? statusId.charAt(0).toUpperCase() + statusId.slice(1) : (effect.label || "Unknown Condition");

        const conditionData = {
          id: effect.id || "",
          name: conditionName,
          statusId: statusId,
          icon: effect.img || "icons/svg/aura.svg",
          description: conditionDescriptions[statusId] || effect.description || "",
          checkType: flags.checkType || null,
          currentCheck: flags.currentCheck || null,
          startingCheck: flags.startingCheck || null,
          turnsActive: flags.turnsActive || 0,
          canRoll: !!flags.checkType,
          isEditable: true
        };

        console.log("DEBUG: Created condition data:", conditionData);
        conditions.push(conditionData);
      } catch (error) {
        console.warn("Error processing condition effect:", effect, error);
        continue;
      }
    }

    console.log("DEBUG: Final conditions array:", conditions);
    return conditions;
  }

  /**
   * Get equipped weapons for the moves section
   * @param {Object} context The actor context
   * @returns {Array} Array of equipped weapons with attack data
   * @private
   */
  _getEquippedWeapons(context) {
    const equippedWeapons = [];
    const equipment = context.system.equipment || {};

    // Check weapon slots for equipped weapons
    for (const slotName of WEAPON_SLOTS) {
      const slot = equipment[slotName];
      if (slot?.item && slot.item.system.itemType === 'weapon') {
        const weapon = slot.item;

        // Normalize weapon data sources (support old and new schemas)
        const wsys = weapon.system || {};
        const wdata = wsys.weapon_data || {};
        const weaponCategory = (wsys.weapon_category || wdata.category || 'brawling');

        // Helper to build an attack entry from provided attack data
        const buildAttack = (attackData) => {
          if (!attackData) return null;
          const diceInfo = this._calculateAttackDice({ system: { weapon_category: weaponCategory, weapon_data: wdata } }, attackData);

          // Calculate modified ranges with modifiers
          const baseMinRange = Number(attackData.min_range ?? 0);
          const baseMaxRange = Number(attackData.max_range ?? 1);
          const { minRange, maxRange } = this._calculateModifiedRanges(baseMinRange, baseMaxRange, weaponCategory, attackData.category);

          return {
            weaponName: weapon.name,
            weaponIcon: weapon.img || 'icons/weapons/swords/sword-broad-steel.webp',
            weaponCategory,
            attackType: this._getAttackType({ system: { weapon_category: weaponCategory, weapon_data: wdata } }, attackData),
            category: formatCategory(attackData.category || 'slash'),
            rawCategory: attackData.category || 'slash',
            damage: Number(attackData.damage ?? 0),
            damageExtra: Number(attackData.damage_extra ?? 0),
            damageType: formatDamageType(attackData.damage_type || 'physical'),
            secondaryDamage: Number(attackData.secondary_damage ?? 0),
            secondaryDamageExtra: Number(attackData.secondary_damage_extra ?? 0),
            secondaryDamageType: formatDamageType(attackData.secondary_damage_type || 'none'),
            energy: this._calculateEnergyWithTraits(Number(attackData.energy ?? 0), weaponCategory),
            minRange,
            maxRange,
            rangeText: formatRange(minRange, maxRange),
            attackDice: diceInfo.dice,
            attackDiceType: diceInfo.diceType,
            attackKeepLowest: diceInfo.keepLowest,
            baseDice: diceInfo.baseDice,
            inherentPenalty: diceInfo.inherentPenalty,
            slotName
          };
        };

        // Process primary and secondary from either schema
        const primary = wsys.primary || wdata.primary;
        const secondary = wsys.secondary || wdata.secondary;

        const p = buildAttack(primary);
        if (p) equippedWeapons.push(p);
        const s = buildAttack(secondary);
        if (s && s.damage > 0) equippedWeapons.push(s);
      }
    }

    // Check hand (gloves) and boots for weapon properties
    const wearableSlots = ['hand', 'boots'];
    for (const slotName of wearableSlots) {
      const slot = equipment[slotName];
      if (slot?.item && slot.item.system.weapon_category && slot.item.system.primary) {
        const item = slot.item;
        const wsys = item.system || {};

        // Only process items with a weapon_category and primary attack (indicating they have weapon properties)
        const weaponCategory = wsys.weapon_category;

        // Helper to build an attack entry from provided attack data
        const buildWearableAttack = (attackData) => {
          if (!attackData) return null;
          const diceInfo = this._calculateAttackDice({ system: { weapon_category: weaponCategory, weapon_data: {} } }, attackData);

          // Calculate modified ranges with modifiers
          const baseMinRange = Number(attackData.min_range ?? 0);
          const baseMaxRange = Number(attackData.max_range ?? 1);
          const { minRange, maxRange } = this._calculateModifiedRanges(baseMinRange, baseMaxRange, weaponCategory, attackData.category);

          return {
            weaponName: item.name,
            weaponIcon: item.img || 'icons/equipment/hand/gauntlet-armored-steel.webp',
            weaponCategory,
            attackType: this._getAttackType({ system: { weapon_category: weaponCategory, weapon_data: {} } }, attackData),
            category: formatCategory(attackData.category || 'blunt'),
            rawCategory: attackData.category || 'blunt',
            damage: Number(attackData.damage ?? 0),
            damageExtra: Number(attackData.damage_extra ?? 0),
            damageType: formatDamageType(attackData.damage_type || 'physical'),
            secondaryDamage: Number(attackData.secondary_damage ?? 0),
            secondaryDamageExtra: Number(attackData.secondary_damage_extra ?? 0),
            secondaryDamageType: formatDamageType(attackData.secondary_damage_type || 'none'),
            energy: this._calculateEnergyWithTraits(Number(attackData.energy ?? 0), weaponCategory),
            minRange,
            maxRange,
            rangeText: formatRange(minRange, maxRange),
            attackDice: diceInfo.dice,
            attackDiceType: diceInfo.diceType,
            attackKeepLowest: diceInfo.keepLowest,
            baseDice: diceInfo.baseDice,
            inherentPenalty: diceInfo.inherentPenalty,
            slotName
          };
        };

        // Process primary and secondary attack data
        const primary = wsys.primary;
        const secondary = wsys.secondary;

        const p = buildWearableAttack(primary);
        if (p) equippedWeapons.push(p);
        const s = buildWearableAttack(secondary);
        if (s && s.damage > 0) equippedWeapons.push(s);
      }
    }

    // Always add brawling attack as a default option
    const brawlingAttackData = {
      damage: 3,
      damage_extra: 3,
      damage_type: 'physical',
      category: 'blunt',
      energy: 0,
      min_range: 1,
      max_range: 1
    };

    // Create fake weapon object for brawling attack dice calculation
    const brawlingWeapon = { system: { weapon_category: 'brawling', weapon_data: { category: 'brawling' } } };

    const brawlingDiceInfo = this._calculateAttackDice(brawlingWeapon, brawlingAttackData);

    const brawlingAttack = {
      weaponName: 'Brawling Strike',
      weaponIcon: 'icons/skills/melee/unarmed-punch-fist.webp',
      weaponCategory: 'brawling',
      attackType: this._getAttackType(brawlingWeapon, brawlingAttackData),
      category: formatCategory('blunt'),
      rawCategory: 'blunt',
      damage: 3,
      damageExtra: 3,
      damageType: formatDamageType('physical'),
      secondaryDamage: 0,
      secondaryDamageExtra: 0,
      secondaryDamageType: formatDamageType('none'),
      energy: 0,
      minRange: 1,
      maxRange: 1,
      rangeText: formatRange(1, 1),
      attackDice: brawlingDiceInfo.dice,
      attackDiceType: brawlingDiceInfo.diceType,
      attackKeepLowest: brawlingDiceInfo.keepLowest,
      baseDice: brawlingDiceInfo.baseDice,
      inherentPenalty: brawlingDiceInfo.inherentPenalty,
      slotName: 'brawling'
    };

    if (this.actor?.type === 'character') {
      equippedWeapons.push(brawlingAttack);
    }

    return equippedWeapons;
  }

  /**
   * Get the attack type display name based on weapon category and attack category
   * @param {Object} weapon - The weapon item
   * @param {Object} attackData - The attack data (primary or secondary)
   * @returns {string} - Display name for attack type
   * @private
   */
  _getAttackType(weapon, attackData) {
    // Check if the attack category is a magic type
    const magicCategories = {
      'primal_magic': 'Primal Magic',
      'primal': 'Primal Magic',
      'black_magic': 'Black Magic',
      'black': 'Black Magic',
      'divine_magic': 'Divine Magic',
      'divine': 'Divine Magic',
      'metamagic': 'Meta Magic',
      'mysticism': 'Mysticism'
    };

    if (magicCategories[attackData.category]) {
      return magicCategories[attackData.category];
    }

    // For weapon attacks, use weapon category
    const raw = weapon.system.weapon_category || weapon.system.weapon_data?.category || 'brawling';
    const normalized = ({
      simpleMelee: 'simpleMeleeWeapons',
      simpleRanged: 'simpleRangedWeapons',
      complexMelee: 'complexMeleeWeapons',
      complexRanged: 'complexRangedWeapons'
    })[raw] || raw;

    const weaponCategories = {
      'simpleMeleeWeapons': 'Simple Melee',
      'simpleRangedWeapons': 'Simple Ranged',
      'complexMeleeWeapons': 'Complex Melee',
      'complexRangedWeapons': 'Complex Ranged',
      'brawling': 'Brawling',
      'throwing': 'Throwing'
    };

    return weaponCategories[normalized] || 'Unknown';
  }

  /**
   * Calculate attack dice for a specific weapon attack
   * @param {Object} weapon - The weapon item
   * @param {Object} attackData - The attack data (primary or secondary)
   * @returns {Object} - Object with dice count and dice type
   * @private
   */
  _calculateAttackDice(weapon, attackData) {
    // Determine which skill to use based on weapon category and attack category
    let skillCategory = 'weapon';
    let skillKey = '';

    // Check if the attack category is a magic type (overrides weapon skill)
    const magicCategories = {
      'primal_magic': 'primal',
      'primal': 'primal',
      'black_magic': 'black',
      'black': 'black',
      'metamagic': 'metamagic',
      'divine_magic': 'divine',
      'divine': 'divine',
      'mysticism': 'mysticism'
    };

    if (magicCategories[attackData.category]) {
      // Magic attack - use magic skill
      skillCategory = 'magic';
      skillKey = magicCategories[attackData.category];
    } else {
      // Physical weapon attack - use weapon skill based on weapon category
      const weaponCategoryMap = {
        // Normalize legacy keys to schema keys
        'simpleMelee': 'simpleMeleeWeapons',
        'simpleRanged': 'simpleRangedWeapons',
        'complexMelee': 'complexMeleeWeapons',
        'complexRanged': 'complexRangedWeapons',
        'brawling': 'brawling',
        'throwingWeapons': 'throwing'
      };
      const rawCat = weapon.system.weapon_category || weapon.system.weapon_data?.category || 'brawling';
      skillKey = weaponCategoryMap[rawCat] || rawCat;
    }

    // Get the skill values from the actor
    const skill = this.actor.system[skillCategory]?.[skillKey] || { talent: 0, value: 0 };
    const talent = Number(skill.talent) || 0;
    const skillValue = skill.value || 0;

    // Determine dice type based on skill value (0=d4, 1=d6, 2=d8, 3=d10, 4=d12, 5=d16, 6=d20)
    const diceTypes = ['d4', 'd6', 'd8', 'd10', 'd12', 'd16', 'd20'];
    const diceType = diceTypes[Math.min(skillValue, 6)] || 'd4';

    const baseDice = Math.max(talent, 1);
    const inherentPenalty = talent <= 0 ? 1 : 0;
    const penaltyResult = this._applyPenaltyRules(baseDice, inherentPenalty);

    return {
      baseDice,
      diceType,
      inherentPenalty,
      dice: penaltyResult.diceCount,
      keepLowest: penaltyResult.keepLowest
    };
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Restore sub-tab states after render
    this._restoreSubTabStates(html);

    // Always bind UI-only tab interactions (work in readonly too)
    // Moves sub-tabs
    html.find('.moves-container .inventory-tab').off('click').on('click', this._onMovesTabClick.bind(this));

    // Equipment bottom inventory tabs (scope to equipment section only)
    html.find('.unequipped-items-section .inventory-tab').off('click').on('click', this._onInventoryTabChange.bind(this));

    // Restore inventory sub-tab when switching back to Equipment
    html.find('.sheet-tabs .item[data-tab="equipment"]').off('click').on('click', (event) => {
      setTimeout(() => this._restoreActiveInventoryTab(html), 10);
    });
    if (html.find('.sheet-tabs .item[data-tab="equipment"]').hasClass('active')) {
      this._restoreActiveInventoryTab(html);
    }

    // Secondary character tabs (Traits/Modules) manual init to ensure reliability
    html.find("nav.sheet-tabs[data-group='character-secondary'] a.item").off('click').on('click', ev => {
      ev.preventDefault();
      const $target = $(ev.currentTarget);
      const tab = $target.data('tab');
      const $section = $target.closest('.traits-modules-section');

      // Store the active tab
      this._activeSubTabs.character = tab;

      // Toggle active on nav items
      $target.siblings('a.item').removeClass('active');
      $target.addClass('active');

      // Toggle active on content panes
      $section.find(".tab[data-group='character-secondary']").removeClass('active');
      $section.find(`.tab[data-group='character-secondary'][data-tab='${tab}']`).addClass('active');
    });

    // Render the item sheet for viewing/editing prior to the editable check.
    html.find('.item-edit').click(ev => {
      ev.stopPropagation(); // Prevent triggering parent clickable elements
      const li = $(ev.currentTarget).closest(".item, .inventory-row");
      const itemId = li.data("itemId") || li.data("item-id");
      const item = this.actor.items.get(itemId);
      if (item) {
        item.sheet.render(true);
      } else {
        ui.notifications.error(`Item not found`);
      }
    });

    // Spell casting clicks (available even in readonly mode)
    html.find('.anyventure-spell-card').click(this._onSpellRoll.bind(this));

    // Wonder and Woe token clicks (available even in readonly mode)
    html.find('[data-action="toggle-wonder"]').click(this._onToggleWonder.bind(this));
    html.find('[data-action="toggle-woe"]').click(this._onToggleWoe.bind(this));

    // -------------------------------------------------------------
    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Add Inventory Item
    html.find('.item-create').click(this._onItemCreate.bind(this));
    html.find('.item-add').click(this._onItemCreate.bind(this));

    // Delete Inventory Item
    html.find('.item-delete').click(ev => {
      ev.stopPropagation(); // Prevent triggering parent clickable elements
      const button = ev.currentTarget;
      let itemId;

      // Check if it's a character essential (has data-item-id directly on button)
      if (button.dataset.itemId) {
        itemId = button.dataset.itemId;
      } else {
        // Standard inventory items (find in parent)
        const li = $(ev.currentTarget).parents(".item, .inventory-row");
        itemId = li.data("itemId") || li.attr("data-item-id");
      }

      const item = this.actor.items.get(itemId);
      if (item) {
        // Handle module point refunds for non-personality modules
        if (item.type === 'module' && item.system.mtype !== 'personality') {
          // Count selected options to refund points
          const selectedCount = item.system.options?.filter(opt => opt.selected).length || 0;
          if (selectedCount > 0) {
            if (this.actor.system.modulePoints && typeof this.actor.system.modulePoints === 'object') {
              // New structure: decrease spent by selectedCount
              const currentSpent = this.actor.system.modulePoints.spent || 0;
              const newSpent = Math.max(0, currentSpent - selectedCount);
              this.actor.update({ 'system.modulePoints.spent': newSpent });
            } else {
              // Legacy structure: increase total by selectedCount
              const currentPoints = this.actor.system.modulePoints || 0;
              this.actor.update({ 'system.modulePoints': currentPoints + selectedCount });
            }
            ui.notifications.info(`Refunded ${selectedCount} module point(s) for ${item.name}`);
          }
        }

        item.delete();
        // Don't re-render immediately - let the item deletion trigger the automatic re-render
        // This preserves the active inventory tab state
        const parent = $(ev.currentTarget).parents(".item, .inventory-row, .character-essential-section");
        if (parent.length) {
          parent.slideUp(200);
        }
      }
    });

    // Active Effect management
    html.find(".effect-control").click(ev => onManageActiveEffect(ev, this.actor));

    // Rollable abilities.
    html.find('.rollable').click(this._onRoll.bind(this));

    // Attribute modification
    html.find('.attribute-roll').click(this._onAttributeRoll.bind(this));
    
    // Skill rolls
    html.find('.skill-roll').click(this._onSkillRoll.bind(this));

    // Language star clicking
    html.find('.language-star').click(this._onLanguageStarClick.bind(this));

    // Music star clicking
    html.find('.music-star').click(this._onMusicStarClick.bind(this));

    // Language delete
    html.find('.language-delete').click(this._onLanguageDelete.bind(this));

    // Weapon attack rolls
    html.find('.weapon-attack-clickable').click(this._onWeaponAttackRoll.bind(this));

    // Ability usage (actions and reactions)
    html.find('.ability-clickable').click(this._onAbilityUse.bind(this));

    // Condition management
    html.find('.condition-roll-btn').click(this._onConditionRoll.bind(this));
    html.find('.condition-remove-btn').click(this._onConditionRemove.bind(this));
    html.find('.condition-edit-btn').click(this._onConditionEdit.bind(this));
    html.find('.editable-field').change(this._onConditionFieldChange.bind(this));

    // Resource quick actions
    html.find('.quick-action-btn').off('click').on('click', this._onQuickAction.bind(this));

    // Resource modification buttons (only +/- controls)
    html.find('.resource-btn.minus, .resource-btn.plus').off('click').on('click', this._onResourceModify.bind(this));

    // Drag events for macros.
    if (this.actor.isOwner) {
      let handler = ev => this._onDragStart(ev);
      html.find('li.item').each((i, li) => {
        if (li.classList.contains("inventory-header")) return;
        li.setAttribute("draggable", true);
        li.addEventListener("dragstart", handler, false);
      });
    }

    // Moves tab controls
    html.find('.move-control').click(this._onMoveControl.bind(this));

    // Character essentials drag and drop
    if (this.actor.isOwner) {
      html.find('.essential-drop-zone').each((i, zone) => {
        zone.addEventListener('dragover', this._onEssentialDragOver.bind(this));
        zone.addEventListener('drop', this._onEssentialDrop.bind(this));
        zone.addEventListener('dragleave', this._onEssentialDragLeave.bind(this));
      });
    }

    // Equipment slot functionality
    html.find('.item-equip').click(this._onItemEquip.bind(this));
    html.find('.unequip-btn').click(this._onItemUnequip.bind(this));

    // Quantity controls
    html.find('.quantity-minus').click(this._onQuantityDecrease.bind(this));
    html.find('.quantity-plus').click(this._onQuantityIncrease.bind(this));

    // Drag and drop for equipment slots
    if (this.actor.isOwner) {
      html.find('.slot-container-small').each((i, slot) => {
        slot.addEventListener('dragover', this._onDragOver.bind(this));
        slot.addEventListener('drop', this._onDrop.bind(this));
        slot.addEventListener('dragleave', this._onDragLeave.bind(this));
      });
    }

    // Make inventory items draggable
    if (this.actor.isOwner) {
      html.find('.inventory-row').each((i, row) => {
        row.setAttribute("draggable", true);
        row.addEventListener("dragstart", this._onInventoryDragStart.bind(this), false);
      });
    }

    // (Inventory sub-tab handlers for Equipment are bound above to work in readonly)

    // Enable drag and drop visual feedback for inventory areas
    if (this.actor.isOwner) {
      // Store bound functions to allow proper removal
      if (!this._boundInventoryDragOver) {
        this._boundInventoryDragOver = this._onInventoryDragOver.bind(this);
        this._boundInventoryDragLeave = this._onInventoryDragLeave.bind(this);
      }

      html.find('.unequipped-items-section .inventory-tab-content, .unequipped-items-section').each((i, area) => {
        // Remove existing listeners to prevent duplicates
        area.removeEventListener('dragover', this._boundInventoryDragOver);
        area.removeEventListener('dragleave', this._boundInventoryDragLeave);

        // Add new listeners
        area.addEventListener('dragover', this._boundInventoryDragOver);
        area.addEventListener('dragleave', this._boundInventoryDragLeave);
      });
    }

    // Recalculate character stats button
    html.find('.recalculate-character').click(this._onRecalculateCharacter.bind(this));
  }

  /**
   * Handle inventory tab changes
   * @param {Event} event   The originating click event
   * @private
   */
  _onInventoryTabChange(event) {
    event.preventDefault();
    const clickedTab = event.currentTarget;
    const tabName = clickedTab.dataset.tab;

    // Save the active tab state
    this._activeInventoryTab = tabName;

    // Remove active class from all tabs and content
    const html = $(clickedTab).closest('.unequipped-items-section');
    html.find('.inventory-tab').removeClass('active');
    html.find('.inventory-tab-content').removeClass('active');

    // Add active class to clicked tab and corresponding content
    clickedTab.classList.add('active');
    html.find(`[data-tab-content="${tabName}"]`).addClass('active');
  }

  /**
   * Restore the active inventory tab when Equipment tab is selected
   * @param {jQuery} html   The jQuery object for the rendered HTML
   * @private
   */
  _restoreActiveInventoryTab(html) {
    const activeTab = this._activeInventoryTab || 'equipment'; // Default to equipment tab

    // Limit operations to the equipment section to avoid interfering with Moves
    const container = html.find('.unequipped-items-section');
    container.find('.inventory-tab').removeClass('active');
    container.find('.inventory-tab-content').removeClass('active');

    // Add active class to the correct inventory tab and content
    container.find(`[data-tab="${activeTab}"]`).addClass('active');
    container.find(`[data-tab-content="${activeTab}"]`).addClass('active');
  }

  /**
   * Handle resource quick-action buttons (no-op for now)
   * @param {Event} event
   * @private
   */
  _onQuickAction(event) {
    
    event.preventDefault();
    const btn = event.currentTarget;
    const action = btn.dataset.action;
     console.log('🔥 Quick action button clicked!', action);
    switch (action) {
      case 'recover':
        return AnyventureRecoverResourcesDialog.show({ actor: this.actor });
      case 'damage':
        return AnyventureTakeDamageDialog.show({ actor: this.actor });
      case 'start-turn':
        return this._onStartTurn();
      case 'rest':
        return AnyventureRestDialog.show({ actor: this.actor });
      case 'fall-unconscious':
        return this._onFallUnconscious();
    }
  }

  /**
   * Recover Resources dialog and handler
   */
  _showRecoverDialog() {
    const content = `
      <div class="anyventure recover-dialog">
        <div style="display:grid;grid-template-columns:120px 1fr;gap:6px;align-items:center;">
          <label>Health</label><input type="number" name="health" value="0" min="0" />
          <label>Resolve</label><input type="number" name="resolve" value="0" min="0" />
          <label>Morale</label><input type="number" name="morale" value="0" min="0" />
          <label>Energy</label><input type="number" name="energy" value="0" min="0" />
        </div>
      </div>`;

    new Dialog({
      title: 'Recover Resources',
      content,
      buttons: {
        ok: {
          label: 'Recover',
          callback: html => {
            const get = n => Number(html.find(`input[name="${n}"]`).val() || 0) || 0;
            const delta = {
              health: get('health'),
              resolve: get('resolve'),
              morale: get('morale'),
              energy: get('energy')
            };
            const up = {};
            const res = this.actor.system.resources || {};
            if (res.health) up['system.resources.health.value'] = Math.min((res.health.value || 0) + delta.health, res.health.max || 0);
            if (res.resolve) up['system.resources.resolve.value'] = Math.min((res.resolve.value || 0) + delta.resolve, res.resolve.max || 0);
            if (res.morale) up['system.resources.morale.value'] = Math.min((res.morale.value || 0) + delta.morale, res.morale.max || 0);
            if (res.energy) up['system.resources.energy.value'] = Math.min((res.energy.value || 0) + delta.energy, res.energy.max || 0);
            if (Object.keys(up).length) this.actor.update(up);
          }
        },
        cancel: { label: 'Cancel' }
      },
      default: 'ok'
    }).render(true);
  }

  /**
   * Take Damage dialog and handler
   */
  _showDamageDialog() {
    const typeOptions = [
      'physical','heat','cold','electric','dark','divine','aether','psychic','toxic','true','resolve','energy'
    ].map(t => `<option value="${t}">${t.charAt(0).toUpperCase()+t.slice(1)}</option>`).join('');
    const content = `
      <div class="anyventure damage-dialog">
        <div style="display:grid;grid-template-columns:160px 1fr;gap:6px;align-items:center;">
          <label>Damage</label><input type="number" name="damage" value="0" min="0" />
          <label>Damage Type</label><select name="dtype">${typeOptions}</select>
          <label>Extra Mitigation</label><input type="number" name="extra" value="0" min="0" />
          <label>Condition</label>
            <select name="cond">
              <option value="none">None</option>
              <option value="double">Double Damage</option>
              <option value="half">Half Damage</option>
            </select>
          <label>Apply</label>
            <select name="condPhase">
              <option value="before">Before Mitigation</option>
              <option value="after">After Mitigation</option>
            </select>
        </div>
      </div>`;

    new Dialog({
      title: 'Take Damage',
      content,
      buttons: {
        ok: {
          label: 'Apply Damage',
          callback: html => {
            const num = n => Number(html.find(`[name="${n}"]`).val() || 0) || 0;
            const str = n => String(html.find(`[name="${n}"]`).val() || '');
            const base = num('damage');
            const dtype = str('dtype');
            const extra = num('extra');
            const cond = str('cond');
            const phase = str('condPhase');

            let preFactor = 1, postFactor = 1;
            if (cond === 'double') (phase === 'before') ? preFactor = 2 : postFactor = 2;
            if (cond === 'half') (phase === 'before') ? preFactor = 0.5 : postFactor = 0.5;

            const mitigations = this.actor.system.mitigation || {};
            const key = dtype;
            const mval = (key === 'resolve' || key === 'energy' || key === 'true') ? 0 : Number(mitigations[key] || 0);

            const mitigated = Math.max(0, (base * preFactor) - (mval + extra));
            const finalDmg = Math.max(0, Math.round(mitigated * postFactor));

            const up = {};
            if (dtype === 'resolve') {
              const cur = this.actor.system.resources?.resolve?.value || 0;
              up['system.resources.resolve.value'] = Math.max(0, cur - finalDmg);
            } else if (dtype === 'energy') {
              const cur = this.actor.system.resources?.energy?.value || 0;
              up['system.resources.energy.value'] = Math.max(0, cur - finalDmg);
            } else {
              const cur = this.actor.system.resources?.health?.value || 0;
              up['system.resources.health.value'] = Math.max(0, cur - finalDmg);
            }
            if (Object.keys(up).length) this.actor.update(up);
          }
        },
        cancel: { label: 'Cancel' }
      },
      default: 'ok'
    }).render(true);
  }

  /**
   * Start Turn - restore energy based on regen
   */
  async _onStartTurn() {
    const resources = this.actor.system.resources || {};
    const energyRegen = (resources.energy?.regen || 0) + 2; // Base 2 + regen bonus

    if (resources.energy && energyRegen > 0) {
      const current = resources.energy.value || 0;
      const max = resources.energy.max || 0;
      const newValue = Math.min(current + energyRegen, max);

      if (newValue > current) {
        await this.actor.update({ 'system.resources.energy.value': newValue });
        this.render(false);

        // Create energy restoration chat card
        await this._createEnergyRestorationChatCard(newValue - current, current, newValue, energyRegen);
      }
    }
  }

  /**
   * Create an energy restoration chat card for start turn
   */
  async _createEnergyRestorationChatCard(energyRestored, previousValue, newValue, totalRegen) {
    const baseRegen = 2;
    const bonusRegen = totalRegen - baseRegen;

    // Build chat card content using established card styling
    let cardContent = `<div class="anyventure-energy-card">`;

    // Main header
    cardContent += `<div class="energy-header">`;
    cardContent += `<div class="character-name"><strong>${this.actor.name}</strong> starts turn</div>`;
    cardContent += `<div class="energy-amount">`;
    cardContent += `<span class="energy-restored">+${energyRestored} Energy</span>`;
    cardContent += ` (${previousValue} → ${newValue})`;
    cardContent += `</div>`;
    cardContent += `</div>`;

    // Details section - show breakdown if there are bonuses
    if (bonusRegen > 0) {
      cardContent += `<div class="energy-details">`;
      cardContent += `<div class="detail-line">Base Regeneration: ${baseRegen}</div>`;
      cardContent += `<div class="detail-line">Bonus Regeneration: ${bonusRegen}</div>`;
      cardContent += `</div>`;
    }

    cardContent += `</div>`;

    // Create and send the chat message
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: cardContent,
      type: CONST.CHAT_MESSAGE_TYPES.OTHER,
      rollMode: game.settings.get('core', 'rollMode'),
    });
  }

  /**
   * Fall Unconscious placeholder
   */
  _onFallUnconscious() {
    // Future: set conditions, drop to 0 health, etc.
  }

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    // Get the type of item to create.
    const type = header.dataset.type;
    // Grab any data associated with this control.
    const data = foundry.utils.duplicate(header.dataset);
    // Initialize a default name.
    const name = `New ${type.capitalize()}`;
    // Prepare the item object.
    const itemData = {
      name: name,
      type: type,
      system: data
    };
    // Remove the type from the dataset since it's in the itemData.type prop.
    delete itemData.system["type"];

    // Finally, create the item!
    return await Item.create(itemData, {parent: this.actor});
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  _onRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;

    // Handle item rolls.
    if (dataset.rollType) {
      if (dataset.rollType == 'item') {
        const itemId = element.closest('.item').dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (item) return item.roll();
      }
    }

    // Handle rolls that supply the formula directly.
    if (dataset.roll) {
      let label = dataset.label ? `[ability] ${dataset.label}` : '';
      let roll = new Roll(dataset.roll, this.actor.getRollData());
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: label,
        rollMode: game.settings.get('core', 'rollMode'),
      });
      return roll;
    }
  }

  /**
   * Handle attribute rolls
   * @param {Event} event   The originating click event  
   * @private
   */
  _onAttributeRoll(event) {
    event.preventDefault();
    const attribute = event.currentTarget.dataset.attribute;
    const value = this.actor.system.attributes[attribute]?.value || 1;
    
    const roll = new Roll(`${value}d6`, this.actor.getRollData());
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `${attribute.charAt(0).toUpperCase() + attribute.slice(1)} Check`,
      rollMode: game.settings.get('core', 'rollMode'),
    });
    return roll;
  }

  /**
   * Handle skill rolls
   * @param {Event} event   The originating click event
   * @private
   */
  _onSkillRoll(event) {
    event.preventDefault();
    const dataset = event.currentTarget.dataset;
    const category = dataset.category;
    const skill = dataset.skill;

    if (category && skill) {
      // For NPCs, prevent rolling skills with value < 0 (can't use skill)
      if (this.actor.type === 'npc') {
        const skillData = this.actor.system[category]?.[skill];
        if (skillData && skillData.value < 0) {
          ui.notifications.warn(`This creature cannot use ${skill} (skill value is ${skillData.value})`);
          return;
        }
      }

      return this.actor.rollSkill(category, skill);
    }
  }

  /**
   * Handle language star clicking
   * @param {Event} event   The originating click event
   * @private
   */
  async _onLanguageStarClick(event) {
    event.preventDefault();
    event.stopPropagation();

    const star = event.currentTarget;
    const starLevel = parseInt(star.dataset.starLevel);
    const starsContainer = star.closest('.language-stars');
    const itemId = starsContainer.dataset.itemId;

    if (!itemId) {
      ui.notifications.warn("Language item not found");
      return;
    }

    const languageItem = this.actor.items.get(itemId);
    if (!languageItem || languageItem.type !== 'language') {
      ui.notifications.warn("Language item not found");
      return;
    }

    const currentTalent = languageItem.system.talent || 0;
    const newTalent = (currentTalent === starLevel) ? 0 : starLevel;
    // Set talent to the new level
    await languageItem.update({ 'system.talent': newTalent });

    // Force re-render of the sheet to update star display
    this.render(false);

    // Optional notification
    const starText = newTalent === 0 ? 'None' : `${newTalent} star${newTalent > 1 ? 's' : ''}`;
    ui.notifications.info(`Set ${languageItem.name} talent to ${starText}`);
  }

  /**
   * Handle music star clicking
   * @param {Event} event   The originating click event
   * @private
   */
  async _onMusicStarClick(event) {
    event.preventDefault();
    event.stopPropagation();

    const star = event.currentTarget;
    const starLevel = parseInt(star.dataset.starLevel);
    const starsContainer = star.closest('.music-stars');
    const musicKey = starsContainer?.dataset?.musicKey;

    if (!musicKey) {
      ui.notifications.warn('Music skill not found');
      return;
    }

    const currentTalent = this.actor.system.music?.[musicKey]?.talent || 0;
    const newTalent = (currentTalent === starLevel) ? 0 : starLevel;

    await this.actor.update({ [`system.music.${musicKey}.talent`]: newTalent });
    this.render(false);

    const starText = newTalent === 0 ? 'None' : `${newTalent} star${newTalent > 1 ? 's' : ''}`;
    ui.notifications.info(`Set ${musicKey} talent to ${starText}`);
  }

  /**
   * Remove a language item from the actor
   * @param {Event} event
   * @private
   */
  async _onLanguageDelete(event) {
    event.preventDefault();
    event.stopPropagation();

    const button = event.currentTarget;
    const itemId = button.dataset.itemId || button.closest('.specialized-skill')?.dataset?.itemId;
    if (!itemId) return;

    const item = this.actor.items.get(itemId);
    if (!item) return;

    await item.delete();
    // Re-render to reflect removal
    this.render(false);
  }

  /**
   * Handle weapon attack rolls
   * @param {Event} event   The originating click event
   * @private
   */
  async _onWeaponAttackRoll(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const attackIndex = parseInt(button.dataset.attackIndex);

    // Get the equipped weapons data from context
    const context = this.getData();
    await context; // Wait for async getData if needed
    const equippedWeapons = this._getEquippedWeapons(context);

    if (!equippedWeapons || attackIndex >= equippedWeapons.length) {
      ui.notifications.warn("Attack data not found");
      return;
    }

    const attackData = equippedWeapons[attackIndex];

    // Determine which skill to use based on weapon category and attack category
    let skillCategory = 'weapon';
    let skillKey = '';

    // Check if the attack category is a magic type (overrides weapon skill)
    const magicCategories = {
      'primal_magic': 'primal',
      'primal': 'primal',
      'black_magic': 'black',
      'black': 'black',
      'metamagic': 'metamagic',
      'divine_magic': 'divine',
      'divine': 'divine',
      'mysticism': 'mysticism'
    };

    if (magicCategories[attackData.rawCategory]) {
      // Magic attack - use magic skill
      skillCategory = 'magic';
      skillKey = magicCategories[attackData.rawCategory];
    } else {
      // Physical weapon attack - use weapon skill based on weapon category
      const weaponCategoryMap = {
        'simpleMelee': 'simpleMeleeWeapons',
        'simpleRanged': 'simpleRangedWeapons',
        'complexMelee': 'complexMeleeWeapons',
        'complexRanged': 'complexRangedWeapons'
      };

      const rawCat = attackData.weaponCategory || 'brawling';
      skillKey = weaponCategoryMap[rawCat] || rawCat;
    }

    // Get the skill values from the actor
    const skill = this.actor.system[skillCategory]?.[skillKey] || { talent: 0, value: 0 };
    const talent = Number(skill.talent) || 0;
    const skillValue = skill.value || 0;

    // Determine dice type based on skill value (0=d4, 1=d6, 2=d8, 3=d10, 4=d12, 5=d16, 6=d20)
    const diceTypes = ['d4', 'd6', 'd8', 'd10', 'd12', 'd16', 'd20'];
    const diceType = diceTypes[Math.min(skillValue, 6)] || 'd4';

    const baseDice = Number(attackData.baseDice) || Math.max(talent, 1);
    const inherentPenalty = Number(attackData.inherentPenalty) || (talent <= 0 ? 1 : 0);
    const previewPenaltyConfig = this._applyPenaltyRules(baseDice, inherentPenalty);
    const keepLowest = previewPenaltyConfig.keepLowest || Boolean(attackData.attackKeepLowest);

    // Show the attack roll dialog
    AnyventureAttackRollDialog.show({
      title: `${attackData.weaponName} Attack`,
      weaponName: `${attackData.weaponName} (${attackData.attackType})`,
      baseDice,
      diceType,
      attackData: attackData,
      actor: this.actor,
      keepLowest,
      inherentPenalty,
      rollCallback: async (roll, data) => {
        await this._consumeEquippedConsumableWeapon(attackData);
      }
    });
  }

  /**
   * Handle resource modification via +/- buttons
   * @param {Event} event   The originating click event
   * @private
   */
  _onResourceModify(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const resource = button.dataset.resource;
    const action = button.dataset.action;
    
    const resObj = this.actor.system.resources?.[resource];
    if (!resObj) return;
    const currentValue = resObj.value ?? 0;
    const maxValue = resObj.max ?? 0;
    
    let newValue = currentValue;
    if (action === 'increase' && currentValue < maxValue) {
      newValue = currentValue + 1;
    } else if (action === 'decrease' && currentValue > 0) {
      newValue = currentValue - 1;
    }
    
    if (newValue !== currentValue) {
      const updateData = {};
      updateData[`system.resources.${resource}.value`] = newValue;
      return this.actor.update(updateData);
    }
  }

  /**
   * Handle ability usage (actions and reactions)
   * @param {Event} event   The originating click event
   * @private
   */
  async _onAbilityUse(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const itemId = element.dataset.itemId;
    const abilityType = element.dataset.abilityType;
    const energyCost = parseInt(element.dataset.energyCost) || 0;

    console.debug('[Anyventure|AbilityUse] Click detected', {
      itemId,
      abilityType,
      energyCost,
      dataset: { ...element.dataset }
    });

    // Get the ability item
    const item = this.actor.items.get(itemId);
    if (!item) {
      ui.notifications.warn("Ability not found");
      return;
    }

    // Check if actor has enough energy
    const currentEnergy = this.actor.system.resources?.energy?.value || 0;
    if (energyCost > currentEnergy) {
      ui.notifications.warn("Not enough energy to use this ability");
      return;
    }

    // If this ability has attack data, route through the attack dialog workflow
    if (abilityType === 'attack') {
      console.debug('[Anyventure|AbilityUse] Attack ability detected', {
        itemId,
        abilityType,
        attackData: item.system?.attackData,
        legacyAttackFields: {
          roll: item.system?.roll,
          damage: item.system?.damage,
          damage_extra: item.system?.damage_extra,
          damage_type: item.system?.damage_type
        }
      });

      const attackDialogOptions = this._buildAbilityAttackRollOptions(item, abilityType);
      if (attackDialogOptions) {
        console.debug('[Anyventure|AbilityUse] Launching attack dialog', attackDialogOptions);
        await AnyventureAttackRollDialog.show(attackDialogOptions);
        return;
      }
      console.warn('[Anyventure|AbilityUse] Ability marked as attack but no valid attack options produced.', {
        itemId,
        abilityType,
        parsedAttackData: item.system?.attackData
      });
    }

    // Show the styled ability use dialog
    const dialogResult = await AnyventureAbilityUseDialog.show({
      actor: this.actor,
      item: item,
      abilityName: item.name,
      abilityType: abilityType,
      energyCost: energyCost,
      currentEnergy: currentEnergy,
      description: item.system.description || "No description available",
      daily: item.system.daily || false,
      magic: item.system.magic || false,
      source: item.system.source || null
    });

    // The dialog handles energy deduction and chat posting internally
    // No need for additional code here since it's all handled in the dialog
  }

  /**
   * Prepare attack roll dialog options for an ability that includes attack data
   * @param {Item} item - The ability item
   * @param {string} abilityType - The ability type string from the dataset
   * @returns {Object|null} Options for AnyventureAttackRollDialog or null if roll data is invalid
   * @private
   */
  _buildAbilityAttackRollOptions(item, abilityType) {
    let rawAttack = item.system?.attackData;

    // Support legacy flat placement of attack fields before the attackData template was enforced
    const legacyRoll = item.system?.roll;
    if (!rawAttack && typeof legacyRoll === 'string') {
      console.debug('[Anyventure|AbilityUse] Promoting legacy attack fields to attackData', {
        itemId: item.id,
        legacy: {
          roll: item.system?.roll,
          damage: item.system?.damage,
          damage_extra: item.system?.damage_extra,
          damage_type: item.system?.damage_type,
          secondary_damage: item.system?.secondary_damage,
          secondary_damage_extra: item.system?.secondary_damage_extra,
          secondary_damage_type: item.system?.secondary_damage_type,
          category: item.system?.category,
          min_range: item.system?.min_range,
          max_range: item.system?.max_range
        }
      });

      rawAttack = {
        roll: item.system?.roll ?? '1d6',
        damage: item.system?.damage ?? '0',
        damage_extra: item.system?.damage_extra ?? '0',
        damage_type: item.system?.damage_type ?? 'physical',
        secondary_damage: item.system?.secondary_damage ?? '0',
        secondary_damage_extra: item.system?.secondary_damage_extra ?? '0',
        secondary_damage_type: item.system?.secondary_damage_type ?? 'none',
        category: item.system?.category ?? 'slash',
        min_range: item.system?.min_range ?? 0,
        max_range: item.system?.max_range ?? 1
      };

      item.update({ 'system.attackData': rawAttack }, { render: false }).catch(() => {});
    }

    if (!rawAttack || typeof rawAttack.roll !== 'string' || !rawAttack.roll.trim()) {
      console.debug('[Anyventure|AbilityUse] No structured attack data present for ability', {
        itemId: item.id,
        abilityType,
        rawAttack
      });
      return null;
    }

    const attackData = foundry.utils?.duplicate
      ? foundry.utils.duplicate(rawAttack)
      : JSON.parse(JSON.stringify(rawAttack));

    const parsedRoll = this._parseAbilityAttackRoll(attackData.roll);
    if (!parsedRoll) return null;

    const energyCost = Number(item.system.energy ?? 0);

    // Calculate modified ranges with modifiers
    const baseMinRange = Number(attackData.min_range ?? 0);
    const baseMaxRange = Number(attackData.max_range ?? baseMinRange);
    // For abilities, assume throwing for simplicity, or use category-based logic
    const abilityWeaponCategory = attackData.category === 'ranged' ? 'complexRangedWeapons' : 'throwing';
    const { minRange, maxRange } = this._calculateModifiedRanges(baseMinRange, baseMaxRange, abilityWeaponCategory, attackData.category);

    const abilityAttack = {
      weaponName: item.name,
      attackType: formatCategory(attackData.category || 'slash'),
      rawCategory: attackData.category || 'slash',
      damage: Number(attackData.damage ?? 0),
      damageExtra: Number(attackData.damage_extra ?? 0),
      damageType: formatDamageType(attackData.damage_type || 'physical'),
      secondaryDamage: Number(attackData.secondary_damage ?? 0),
      secondaryDamageExtra: Number(attackData.secondary_damage_extra ?? 0),
      secondaryDamageType: formatDamageType(attackData.secondary_damage_type || 'none'),
      energy: energyCost,
      minRange,
      maxRange,
      rangeText: formatRange(minRange, maxRange),
      abilityId: item.id,
      abilityType,
      roll: attackData.roll
    };

    return {
      title: `${item.name} Attack`,
      weaponName: item.name,
      baseDice: parsedRoll.baseDice,
      diceType: parsedRoll.diceType,
      inherentPenalty: parsedRoll.inherentPenalty,
      attackData: abilityAttack,
      actor: this.actor
    };
  }

  /**
   * Parse an ability attack roll string into dialog parameters
   * @param {string} rollStr - Roll string from the ability attack data
   * @returns {Object|null} Parsed data containing baseDice, diceType, inherentPenalty
   * @private
   */
  _parseAbilityAttackRoll(rollStr) {
    if (!rollStr || typeof rollStr !== 'string') return null;
    const trimmed = rollStr.trim();
    if (!trimmed.length) return null;

    const simpleMatch = trimmed.match(/^([0-9]+)d([0-9]+)(kh[0-9]+|kl[0-9]+)?$/i);
    if (simpleMatch) {
      const baseDice = Math.max(parseInt(simpleMatch[1], 10) || 1, 1);
      const faces = Math.max(parseInt(simpleMatch[2], 10) || 6, 2);
      return { baseDice, diceType: `d${faces}`, inherentPenalty: 0 };
    }

    try {
      const roll = new Roll(trimmed);
      const DieTerm = foundry?.dice?.terms?.Die;
      const dieTerm = DieTerm ? roll.terms.find(term => term instanceof DieTerm) : null;
      if (dieTerm) {
        const baseDice = Math.max(Number(dieTerm.number) || 1, 1);
        const faces = Math.max(Number(dieTerm.faces) || 6, 2);
        return { baseDice, diceType: `d${faces}`, inherentPenalty: 0 };
      }
    } catch (err) {
      console.warn(`[Anyventure] Unable to parse ability attack roll "${rollStr}"`, err);
    }

    return null;
  }

  /**
   * Handle move controls (create/delete moves)
   * @param {Event} event   The originating click event
   * @private
   */
  async _onMoveControl(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const action = button.dataset.action;
    const moveType = button.dataset.moveType || button.closest('.move-item')?.dataset.moveType;
    
    if (action === 'create' && moveType) {
      // Generate a unique ID for the new move
      const moveId = foundry.utils.randomID();
      const updateData = {};
      updateData[`system.moves.${moveType}.${moveId}`] = {
        name: '',
        energyCost: 0
      };
      return this.actor.update(updateData);
    }
    
    else if (action === 'delete') {
      const moveItem = button.closest('.move-item');
      const moveId = moveItem.dataset.moveId;
      const updateData = {};
      updateData[`system.moves.${moveType}.-=${moveId}`] = null;
      return this.actor.update(updateData);
    }
  }

  /**
   * Handle equipping an item from inventory to a slot
   * @param {Event} event   The originating click event
   * @private
   */
  async _onItemEquip(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const itemId = button.dataset.itemId;
    const item = this.actor.items.get(itemId);

    if (!item) return;

    // Determine appropriate slot based on item type
    const slotName = this._getAvailableSlotForItem(item);
    if (!slotName) {
      ui.notifications.warn(`No available slot for ${item.name}`);
      return;
    }

    // Equip the item
    return this._equipItem(item, slotName);
  }

  /**
   * Handle unequipping an item from a slot
   * @param {Event} event   The originating click event
   * @private
   */
  async _onItemUnequip(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const slotName = button.dataset.slot;
    const index = button.dataset.index; // For multi-slot items like extra weapons

    return this._unequipItem(slotName, index);
  }

  /**
   * Handle drag start for inventory items
   * @param {Event} event   The originating drag event
   * @private
   */
  _onInventoryDragStart(event) {
    const itemId = event.currentTarget.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item) return;

    // Set drag data
    const dragData = item.toDragData();
    event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
  }

  /**
   * Handle drag over events for equipment slots
   * @param {Event} event   The originating drag event
   * @private
   */
  _onDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('drag-over');
  }

  /**
   * Handle drag leave events for equipment slots
   * @param {Event} event   The originating drag event
   * @private
   */
  _onDragLeave(event) {
    event.currentTarget.classList.remove('drag-over');
  }

  /**
   * Handle dragover events for inventory areas
   * @param {Event} event   The originating dragover event
   * @private
   */
  _onInventoryDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    event.currentTarget.classList.add('inventory-drag-over');
  }

  /**
   * Handle dragleave events for inventory areas
   * @param {Event} event   The originating dragleave event
   * @private
   */
  _onInventoryDragLeave(event) {
    event.currentTarget.classList.remove('inventory-drag-over');
  }

  /**
   * Handle drop events for the entire actor sheet
   * @param {Event} event   The originating drop event
   * @private
   */
  async _onDrop(event) {
    // Prevent multiple simultaneous drops
    if (this._isDropInProgress) {
      console.warn('Drop already in progress, ignoring duplicate drop event');
      return;
    }

    this._isDropInProgress = true;

    try {
      const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
      if (data.type !== 'Item') return super._onDrop(event);

      const item = await Item.implementation.fromDropData(data);
      if (!item) return;

      // Handle dropping on equipment slots
      if (event.currentTarget && event.currentTarget.classList.contains('slot-container-small')) {
        return await this._onEquipmentSlotDrop(event, item);
      }

      // Handle dropping from compendium or other sources
      if (item.parent !== this.actor) {
        return await this._onExternalItemDrop(event, item);
      }

      // Default handling for existing actor items
      return super._onDrop(event);
    } finally {
      // Always reset the drop flag
      this._isDropInProgress = false;
    }
  }

  /**
   * Handle drop events specifically for equipment slots
   * @param {Event} event   The originating drop event
   * @param {Item} item     The item being dropped
   * @private
   */
  async _onEquipmentSlotDrop(event, item) {
    event.preventDefault();

    // Check if currentTarget exists and remove drag-over class
    if (event.currentTarget) {
      event.currentTarget.classList.remove('drag-over');
    }

    // If item is not owned by this actor, add it first
    if (item.parent !== this.actor) {
      const itemData = item.toObject();
      const newItems = await this.actor.createEmbeddedDocuments('Item', [itemData]);
      const newItem = newItems[0];

      const slotName = event.currentTarget?.dataset?.slot;
      if (slotName) {
        return this._equipItem(newItem, slotName);
      }
    }

    const slotName = event.currentTarget?.dataset?.slot;
    if (slotName) {
      return this._equipItem(item, slotName);
    }
  }

  /**
   * Handle dropping items from external sources (like compendium)
   * @param {Event} event   The originating drop event
   * @param {Item} item     The item being dropped
   * @private
   */
  async _onExternalItemDrop(event, item) {
    event.preventDefault();

    // Check if the exact same item (by UUID or source ID) is already on the character
    const existingByUuid = this.actor.items.find(i =>
      (item.uuid && i.uuid === item.uuid) ||
      (item._source && i._source && i._source._id === item._source._id) ||
      (item._id && i.flags?.core?.sourceId === item._id)
    );

    if (existingByUuid) {
      ui.notifications.warn(`${item.name} is already on this character.`);
      return;
    }

    // Check for duplicate essentials
    if (item.type === 'ancestry') {
      const existing = this.actor.items.find(i => i.type === 'ancestry');
      if (existing) {
        ui.notifications.error(`Character already has an ancestry (${existing.name}). Remove it first or use the specific drop zone.`);
        return;
      }
    }

    if (item.type === 'culture') {
      const existing = this.actor.items.find(i => i.type === 'culture');
      if (existing) {
        ui.notifications.error(`Character already has a culture (${existing.name}). Remove it first or use the specific drop zone.`);
        return;
      }
    }

    if (item.type === 'module' && item.system.mtype === 'personality') {
      const existing = this.actor.items.find(i => i.type === 'module' && i.system.mtype === 'personality');
      if (existing) {
        ui.notifications.error(`Character already has a personality (${existing.name}). Remove it first or use the specific drop zone.`);
        return;
      }
    }

    if (item.type === 'trait') {
      const existing = this.actor.items.find(i => i.type === 'trait');
      if (existing) {
        ui.notifications.error(`Character already has a trait (${existing.name}). Remove it first or use the specific drop zone.`);
        return;
      }
    }

    // Check module points for non-personality modules
    if (item.type === 'module' && item.system.mtype !== 'personality') {
      let availablePoints = 0;
      if (this.actor.system.modulePoints && typeof this.actor.system.modulePoints === 'object') {
        // New structure: { total: X, spent: Y }
        availablePoints = (this.actor.system.modulePoints.total || 0) - (this.actor.system.modulePoints.spent || 0);
      } else {
        // Legacy structure: just a number
        availablePoints = this.actor.system.modulePoints || 0;
      }

      if (availablePoints <= 0) {
        ui.notifications.error(`Not enough module points to add ${item.name}. Available: ${availablePoints}`);
        return;
      }
    }

    // Create the item in the actor's inventory
    const itemData = item.toObject();

    // Set default quantity if not present (but not for essentials)
    if (!itemData.system.quantity && item.type !== 'ancestry' && item.type !== 'culture' && item.type !== 'trait' && !(item.type === 'module' && item.system.mtype === 'personality')) {
      itemData.system.quantity = 1;
    }

    const newItems = await this.actor.createEmbeddedDocuments('Item', [itemData]);
    const newItem = newItems[0];

    // Handle module-specific logic for non-personality modules
    if (item.type === 'module' && item.system.mtype !== 'personality') {
      // Consume 1 module point
      if (this.actor.system.modulePoints && typeof this.actor.system.modulePoints === 'object') {
        // New structure: increase spent by 1
        const currentSpent = this.actor.system.modulePoints.spent || 0;
        await this.actor.update({ 'system.modulePoints.spent': currentSpent + 1 });
      } else {
        // Legacy structure: decrease total by 1
        const currentPoints = this.actor.system.modulePoints || 0;
        await this.actor.update({ 'system.modulePoints': currentPoints - 1 });
      }

      // Auto-select tier 1 option (location "1")
      const tier1Option = newItem.system.options?.find(opt => opt.location === "1");
      if (tier1Option) {
        const updatedOptions = newItem.system.options.map(opt => ({
          ...opt,
          selected: opt.location === "1"
        }));
        await newItem.update({ 'system.options': updatedOptions });
      }
    }

    ui.notifications.info(`${newItem.name} added to character`);
    return newItem;
  }

  /**
   * Get an available slot for an item based on its type
   * @param {Item} item   The item to find a slot for
   * @returns {string|null} The slot name or null if no slot available
   * @private
   */
  _getAvailableSlotForItem(item) {
    const itemType = item.system.itemType; // Use original itemType for specialized logic
    const slotType = this._resolveItemSlotType(item);
    const equipment = this.actor.system.equipment || {};
    const hasWeaponCollector = this._hasWeaponCollectorTrait();
    const isComplexWeapon = this._isComplexWeapon(item);
    const canUseExtraWeaponSlots = hasWeaponCollector || !isComplexWeapon;

    // Map item types to slot preferences (with weapon logic handled separately)
    const slotMappings = {
      'armor': ['body'],
      'body': ['body'],
      'headwear': ['head'],
      'gloves': ['hand'],
      'boots': ['boots'],
      'ring': ['accessory1', 'accessory2'],
      'cloak': ['back'],
      'back': ['back'],
      'cloaks': ['back'],
      'equipment': ['accessory1', 'accessory2'] // General equipment goes to accessory slots
    };

    // Handle weapons, instruments, and ammunition with special rules
    if (itemType === 'weapon' || itemType === 'instrument' || itemType === 'ammunition' || (itemType === 'equipment' && item.system.equipment_type === 'instrument')) {
      // Instruments and ammunition default to one-handed unless specified otherwise
      const isInstrument = itemType === 'instrument' || (itemType === 'equipment' && item.system.equipment_type === 'instrument');
      const isAmmunition = itemType === 'ammunition';
      const isTwoHanded = this._isTwoHandedWeapon(item) && !isInstrument && !isAmmunition;
      const isOneHanded = !isTwoHanded;

      if (isOneHanded) {
        // 1-handed weapons: mainhand, offhand, extra1, extra2, extra3
        for (const slotName of WEAPON_SLOTS) {
          if (!canUseExtraWeaponSlots && EXTRA_WEAPON_SLOTS.includes(slotName)) continue;
          if (!equipment[slotName]?.item) {
            return slotName;
          }
        }
      } else if (isTwoHanded) {
        // 2-handed weapons: mainhand, extra1, extra2, extra3 only
        for (const slotName of TWO_HANDED_WEAPON_SLOTS) {
          if (!canUseExtraWeaponSlots && EXTRA_WEAPON_SLOTS.includes(slotName)) continue;
          if (!equipment[slotName]?.item) {
            return slotName;
          }
        }
      }
      return null;
    }

    // Handle shields
    if (slotType === 'shield') {
      return !equipment['offhand']?.item ? 'offhand' : null;
    }

    // Handle other item types
    const possibleSlots = slotMappings[slotType] || ['accessory1', 'accessory2'];

    // Find first available slot
    for (const slotName of possibleSlots) {
      if (!equipment[slotName]?.item) {
        return slotName;
      }
    }

    return null;
  }

  /**
   * Validate if an item can be equipped to a specific slot
   * @param {Item} item   The item to validate
   * @param {string} slotName   The target slot
   * @returns {boolean} Whether the item can be equipped to this slot
   * @private
   */
  _validateItemSlot(item, slotName) {
    const itemType = item.system.itemType;
    const slotType = this._resolveItemSlotType(item);

    // Strict slot validation for non-weapons
    const slotRestrictions = {
      'armor': ['body'],
      'body': ['body'],
      'headwear': ['head'],
      'cloaks': ['back'],
      'gloves': ['hand'],
      'boots': ['boots'],
      'ring': ['accessory1', 'accessory2'],
      'equipment': ['accessory1', 'accessory2']
    };

    // Handle weapons, instruments, and ammunition with hand requirements
    if (itemType === 'weapon' || itemType === 'instrument' || itemType === 'ammunition' || (itemType === 'equipment' && item.system.equipment_type === 'instrument')) {
      const isInstrument = itemType === 'instrument' || (itemType === 'equipment' && item.system.equipment_type === 'instrument');
      const isAmmunition = itemType === 'ammunition';
      const isTwoHanded = this._isTwoHandedWeapon(item) && !isInstrument && !isAmmunition;
      const isOneHanded = !isTwoHanded;
      const canUseExtraWeaponSlots = this._hasWeaponCollectorTrait() || !this._isComplexWeapon(item);

      if (isOneHanded) {
        if (!canUseExtraWeaponSlots && this._isExtraWeaponSlot(slotName)) return false;
        return WEAPON_SLOTS.includes(slotName);
      } else if (isTwoHanded) {
        if (!canUseExtraWeaponSlots && this._isExtraWeaponSlot(slotName)) return false;
        return TWO_HANDED_WEAPON_SLOTS.includes(slotName);
      }
      return false;
    }

    // Handle shields
    if (slotType === 'shield') {
      return slotName === 'offhand';
    }

    // Check other item types
    const allowedSlots = slotRestrictions[slotType];
    if (allowedSlots) {
      return allowedSlots.includes(slotName);
    }

    // Default to accessory slots for unknown types
    return ['accessory1', 'accessory2'].includes(slotName);
  }

  _hasWeaponCollectorTrait() {
    return Boolean(this.actor.system?.conditionals?.flags?.WEAPON_COLLECTOR);
  }

  _isExtraWeaponSlot(slotName) {
    return EXTRA_WEAPON_SLOTS.includes(slotName);
  }

  _resolveItemSlotType(item) {
    const baseTypeRaw = item?.system?.itemType;
    const baseType = typeof baseTypeRaw === 'string' ? baseTypeRaw : '';
    const normalizedBase = baseType.toLowerCase();
    const equipmentTypeRaw = item?.system?.equipment_type;
    const equipmentType = typeof equipmentTypeRaw === 'string' ? equipmentTypeRaw.toLowerCase() : '';

    if (normalizedBase === 'cloak' || normalizedBase === 'cloaks' || normalizedBase === 'back') {
      return 'cloaks';
    }

    if (normalizedBase === 'equipment') {
      if (equipmentType === 'cloak' || equipmentType === 'cloaks' || equipmentType === 'back') {
        return 'cloaks';
      }
    }

    return baseType || '';
  }

  _normalizeWeaponCategoryValue(rawCategory) {
    if (!rawCategory) return '';
    const key = typeof rawCategory === 'string' ? rawCategory : String(rawCategory);
    return WEAPON_CATEGORY_ALIASES[key] || key;
  }

  _getNormalizedWeaponCategory(item) {
    const category = item?.system?.weapon_category
      ?? item?.system?.weapon_data?.category
      ?? item?.system?.weapon?.category
      ?? '';
    return this._normalizeWeaponCategoryValue(category);
  }

  _isComplexWeapon(item) {
    if (!item?.system || item.system.itemType !== 'weapon') return false;
    const category = this._getNormalizedWeaponCategory(item);
    return COMPLEX_WEAPON_CATEGORIES.has(category);
  }

  _isTwoHandedWeapon(item) {
    if (!item?.system || item.system.itemType !== 'weapon') return false;

    const handsValue = Number(item.system.hands);
    if (Number.isFinite(handsValue) && handsValue >= 2) return true;

    const flagSources = [
      item.system.weapon_data?.flags,
      item.system.weapon?.flags
    ];
    const targetFlag = TWO_HANDED_FLAG.toLowerCase();

    for (const source of flagSources) {
      if (!Array.isArray(source)) continue;
      const hasFlag = source.some(flag => {
        if (!flag) return false;
        if (typeof flag === 'string') return flag.toLowerCase() === targetFlag;
        if (typeof flag === 'object') {
          const value = flag.value ?? flag.label ?? '';
          return String(value).toLowerCase() === targetFlag;
        }
        return false;
      });
      if (hasFlag) return true;
    }

    return false;
  }

  _applyPenaltyRules(baseDice, penaltyDice) {
    let dice = Math.max(Number(baseDice) || 0, 0);
    if (dice <= 0) dice = 1;
    let penalties = Math.max(Number(penaltyDice) || 0, 0);
    let keepLowest = false;

    while (penalties > 0) {
      if (dice > 1 && !keepLowest) {
        dice -= 1;
      } else {
        keepLowest = true;
        dice += 1;
      }
      penalties -= 1;
    }

    return { diceCount: dice, keepLowest };
  }

  _determineEquippedQuantity(item, { allowZero = true } = {}) {
    if (!item?.system) return 1;
    const stackLimitRaw = Number(item.system.stack_limit);
    const stackLimit = Number.isFinite(stackLimitRaw) ? stackLimitRaw : 0;
    const quantityRaw = Number(item.system.quantity);
    const quantity = Number.isFinite(quantityRaw) ? Math.max(Math.floor(quantityRaw), 0) : 0;

    if (stackLimit > 0) {
      if (quantity <= 0) return allowZero ? 0 : 1;
      return Math.min(quantity, stackLimit);
    }

    if (quantity <= 0) return allowZero ? 0 : 1;
    return 1;
  }

  async _syncEquippedQuantitiesForItem(item) {
    if (!item?._id) return;
    const equipment = this.actor.system?.equipment || {};
    const updates = {};
    const normalizedQuantity = this._determineEquippedQuantity(item);

    for (const [slotName, slot] of Object.entries(equipment)) {
      if (slot?.item?._id !== item._id) continue;

      if (normalizedQuantity <= 0) {
        updates[`system.equipment.${slotName}.item`] = null;
        updates[`system.equipment.${slotName}.equippedAt`] = null;
        updates[`system.equipment.${slotName}.quantity`] = 1;
      } else {
        const updatedSlotItem = foundry.utils.deepClone(slot.item) || {};
        if (!updatedSlotItem.system) updatedSlotItem.system = {};
        updatedSlotItem.system.quantity = normalizedQuantity;
        updates[`system.equipment.${slotName}.item`] = updatedSlotItem;
        updates[`system.equipment.${slotName}.quantity`] = normalizedQuantity;
      }
    }

    if (Object.keys(updates).length > 0) {
      await this.actor.update(updates);
      this.render(false);
    }
  }

  async _clearEquipmentSlotsForItemId(itemId) {
    if (!itemId) return;
    const equipment = this.actor.system?.equipment || {};
    const updates = {};

    for (const [slotName, slot] of Object.entries(equipment)) {
      if (slot?.item?._id !== itemId) continue;
      updates[`system.equipment.${slotName}.item`] = null;
      updates[`system.equipment.${slotName}.equippedAt`] = null;
      updates[`system.equipment.${slotName}.quantity`] = 1;
    }

    if (Object.keys(updates).length > 0) {
      await this.actor.update(updates);
      this.render(false);
    }
  }

  _isConsumableWeapon(item, attackData) {
    if (!item?.system) return false;
    const stackLimitRaw = Number(item.system.stack_limit);
    const stackLimit = Number.isFinite(stackLimitRaw) ? stackLimitRaw : 0;
    if (stackLimit <= 0) return false;

    if (CONSUMABLE_ITEM_TYPES.has(item.system.itemType)) return true;

    const normalizedItemCategory = this._getNormalizedWeaponCategory(item);
    if (normalizedItemCategory === THROWING_WEAPON_CATEGORY) return true;

    const attackCategory = this._normalizeWeaponCategoryValue(attackData?.weaponCategory || attackData?.rawCategory);
    if (attackCategory === THROWING_WEAPON_CATEGORY) return true;

    return false;
  }

  async _consumeEquippedConsumableWeapon(attackData) {
    if (!attackData?.slotName) return;
    const equipment = this.actor.system?.equipment || {};
    const slot = equipment[attackData.slotName];
    if (!slot?.item?._id) return;

    const item = this.actor.items.get(slot.item._id);
    if (!item) return;
    if (!this._isConsumableWeapon(item, attackData)) return;

    const itemName = item.name;

    const slotQuantityRaw = Number(slot.quantity);
    let slotQuantity = Number.isFinite(slotQuantityRaw) ? Math.max(Math.floor(slotQuantityRaw), 0) : this._determineEquippedQuantity(item);
    if (slotQuantity <= 0) slotQuantity = this._determineEquippedQuantity(item);

    const newSlotQuantity = Math.max(slotQuantity - 1, 0);
    const updates = {};

    if (newSlotQuantity > 0) {
      const updatedSlotItem = foundry.utils.deepClone(slot.item) || {};
      if (!updatedSlotItem.system) updatedSlotItem.system = {};
      updatedSlotItem.system.quantity = newSlotQuantity;
      updates[`system.equipment.${attackData.slotName}.item`] = updatedSlotItem;
      updates[`system.equipment.${attackData.slotName}.quantity`] = newSlotQuantity;
    } else {
      updates[`system.equipment.${attackData.slotName}.item`] = null;
      updates[`system.equipment.${attackData.slotName}.equippedAt`] = null;
      updates[`system.equipment.${attackData.slotName}.quantity`] = 1;
    }

    if (Object.keys(updates).length > 0) {
      await this.actor.update(updates);
    }

    const currentItemQuantityRaw = Number(item.system.quantity);
    const currentItemQuantity = Number.isFinite(currentItemQuantityRaw) ? Math.max(Math.floor(currentItemQuantityRaw), 0) : 0;
    const newItemQuantity = Math.max(currentItemQuantity - 1, 0);

    if (newItemQuantity !== currentItemQuantity) {
      await item.update({ 'system.quantity': newItemQuantity });
    }

    if (newSlotQuantity <= 0) {
      ui.notifications.info(`${itemName} stack is depleted and has been unequipped.`);
    }

    this.render(false);
  }

  /**
   * Equip an item to a specific slot
   * @param {Item} item   The item to equip
   * @param {string} slotName   The slot to equip to
   * @private
   */
  async _equipItem(item, slotName) {
    if (this._isExtraWeaponSlot(slotName) && this._isComplexWeapon(item) && !this._hasWeaponCollectorTrait()) {
      ui.notifications.warn(`${item.name} requires the Weapon Collector trait to equip in extra weapon slots.`);
      return;
    }

    // Validate the item can be equipped to this slot
    if (!this._validateItemSlot(item, slotName)) {
      ui.notifications.warn(`${item.name} cannot be equipped to ${slotName}`);
      return;
    }

    const updateData = {};

    // Special handling for 2-handed weapons
    if (slotName === 'mainhand' && this._isTwoHandedWeapon(item)) {
      // Unequip offhand when equipping 2-handed weapon to mainhand
      updateData[`system.equipment.offhand.item`] = null;
      updateData[`system.equipment.offhand.equippedAt`] = null;
      updateData[`system.equipment.offhand.quantity`] = 1;
      ui.notifications.info(`Unequipped offhand item to make room for 2-handed weapon`);
    }

    const equippedQuantity = this._determineEquippedQuantity(item, { allowZero: false });
    const storedItem = {
      _id: item._id,
      name: item.name,
      img: item.img,
      type: item.type,
      system: foundry.utils.deepClone(item.system)
    };
    if (!storedItem.system) storedItem.system = {};
    storedItem.system.quantity = equippedQuantity;

    // Handle single-item slots - store item reference
    updateData[`system.equipment.${slotName}.item`] = storedItem;
    updateData[`system.equipment.${slotName}.equippedAt`] = new Date().toISOString();
    updateData[`system.equipment.${slotName}.quantity`] = equippedQuantity;

    await this.actor.update(updateData);
    ui.notifications.info(`${item.name} equipped to ${slotName}`);

    // Trigger a sheet refresh to update inventory display
    this.render(false);
  }

  /**
   * Unequip an item from a specific slot
   * @param {string} slotName   The slot to unequip from
   * @param {string|null} index   The index for multi-slot items
   * @private
   */
  async _unequipItem(slotName, index = null) {
    const updateData = {};

    // Handle single-item slots
    updateData[`system.equipment.${slotName}.item`] = null;
    updateData[`system.equipment.${slotName}.equippedAt`] = null;
    updateData[`system.equipment.${slotName}.quantity`] = 1;

    await this.actor.update(updateData);
    ui.notifications.info(`Item unequipped from ${slotName}`);

    // Trigger a sheet refresh to update inventory display
    this.render(false);
  }

  /**
   * Handle decreasing item quantity
   * @param {Event} event   The originating click event
   * @private
   */
  async _onQuantityDecrease(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const itemId = button.dataset.itemId;
    const item = this.actor.items.get(itemId);

    if (!item) return;

    const currentQuantityRaw = Number(item.system.quantity);
    const currentQuantity = Number.isFinite(currentQuantityRaw) ? Math.max(Math.floor(currentQuantityRaw), 0) : 0;

    const newQuantity = Math.max(currentQuantity - 1, 0);
    if (newQuantity === currentQuantity) return;

    await item.update({ "system.quantity": newQuantity });
    await this._syncEquippedQuantitiesForItem(item);

    if (newQuantity === 0) {
      ui.notifications.info(`${item.name} stack is now empty.`);
    }
  }

  /**
   * Handle increasing item quantity
   * @param {Event} event   The originating click event
   * @private
   */
  async _onQuantityIncrease(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const itemId = button.dataset.itemId;
    const item = this.actor.items.get(itemId);

    if (!item) return;

    const currentQuantityRaw = Number(item.system.quantity);
    const currentQuantity = Number.isFinite(currentQuantityRaw) ? currentQuantityRaw : 1;
    const stackLimitRaw = Number(item.system.stack_limit);
    const stackLimit = Number.isFinite(stackLimitRaw) ? stackLimitRaw : 0;

    if (stackLimit > 0) {
      if (currentQuantity >= stackLimit) {
        ui.notifications.warn(`${item.name} is already at its stack limit (${stackLimit}).`);
        return;
      }
      const newQuantity = Math.min(currentQuantity + 1, stackLimit);
      await item.update({ "system.quantity": Math.max(newQuantity, 1) });
      await this._syncEquippedQuantitiesForItem(item);
      return;
    }

    const newQuantity = Math.max(currentQuantity + 1, 1);
    await item.update({ "system.quantity": newQuantity });
    await this._syncEquippedQuantitiesForItem(item);
  }

  /**
   * Handle dragover events for character essentials drop zones
   * @param {Event} event   The originating dragover event
   * @private
   */
  _onEssentialDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    event.currentTarget.classList.add('drag-over');
  }

  /**
   * Handle dragleave events for character essentials drop zones
   * @param {Event} event   The originating dragleave event
   * @private
   */
  _onEssentialDragLeave(event) {
    event.currentTarget.classList.remove('drag-over');
  }

  /**
   * Handle drop events for character essentials drop zones
   * @param {Event} event   The originating drop event
   * @private
   */
  async _onEssentialDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');

    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    if (data.type !== 'Item') return;

    const item = await Item.implementation.fromDropData(data);
    if (!item) return;

    const essentialType = event.currentTarget.dataset.essentialType;

    // Check if item type matches the drop zone
    if (essentialType === 'ancestry' && item.type !== 'ancestry') {
      ui.notifications.error(`Only ancestry items can be dropped here`);
      return;
    }
    if (essentialType === 'culture' && item.type !== 'culture') {
      ui.notifications.error(`Only culture items can be dropped here`);
      return;
    }
    if (essentialType === 'personality' && (item.type !== 'module' || item.system.mtype !== 'personality')) {
      ui.notifications.error(`Only personality modules can be dropped here`);
      return;
    }

    // Check for existing items and prevent duplicates
    const existingItem = this._getExistingEssential(essentialType);
    if (existingItem) {
      ui.notifications.error(`Character already has a ${essentialType}. Remove the existing ${essentialType} first.`);
      return;
    }

    // Add the item to the character
    return this._addEssentialItem(item);
  }

  /**
   * Get existing essential item of specified type
   * @param {string} essentialType - The type of essential (ancestry, culture, personality)
   * @returns {Item|null} - The existing item or null
   * @private
   */
  _getExistingEssential(essentialType) {
    if (essentialType === 'ancestry') {
      return this.actor.items.find(i => i.type === 'ancestry');
    }
    if (essentialType === 'culture') {
      return this.actor.items.find(i => i.type === 'culture');
    }
    if (essentialType === 'personality') {
      return this.actor.items.find(i => i.type === 'module' && i.system.mtype === 'personality');
    }
    return null;
  }

  /**
   * Add essential item to character
   * @param {Item} item - The item to add
   * @returns {Item} - The created item
   * @private
   */
  async _addEssentialItem(item) {
    const itemData = item.toObject();

    // Don't need quantity for essentials
    delete itemData.system.quantity;

    const newItems = await this.actor.createEmbeddedDocuments('Item', [itemData]);
    const newItem = newItems[0];

    ui.notifications.info(`${newItem.name} added to character`);
    return newItem;
  }

  /**
   * Restore sub-tab states after sheet render
   * @param {jQuery} html - The rendered HTML
   * @private
   */
  _restoreSubTabStates(html) {
    // Restore moves sub-tab if we're on the moves tab
    if (html.find('.sheet-tabs .item[data-tab="moves"]').hasClass('active')) {
      const movesActiveTab = this._activeSubTabs.moves || 'attacks';
      const movesContainer = html.find('.moves-container');

      // Remove default active classes
      movesContainer.find('.inventory-tab').removeClass('active');
      movesContainer.find('.inventory-tab-content').removeClass('active');

      // Set the saved active tab
      movesContainer.find(`.inventory-tab[data-tab="${movesActiveTab}"]`).addClass('active');
      movesContainer.find(`.inventory-tab-content[data-tab-content="${movesActiveTab}"]`).addClass('active');
    }

    // Restore character sub-tab if we're on the character tab
    if (html.find('.sheet-tabs .item[data-tab="character"]').hasClass('active')) {
      const characterActiveTab = this._activeSubTabs.character || 'traits';
      const characterSection = html.find('.traits-modules-section');

      // Remove default active classes
      characterSection.find("nav.sheet-tabs[data-group='character-secondary'] a.item").removeClass('active');
      characterSection.find(".tab[data-group='character-secondary']").removeClass('active');

      // Set the saved active tab
      characterSection.find(`nav.sheet-tabs[data-group='character-secondary'] a.item[data-tab='${characterActiveTab}']`).addClass('active');
      characterSection.find(`.tab[data-group='character-secondary'][data-tab='${characterActiveTab}']`).addClass('active');
    }
  }

  /**
   * Handle moves tab clicks
   * @param {Event} event   The originating click event
   * @private
   */
  _onMovesTabClick(event) {
    event.preventDefault();
    const tab = event.currentTarget;
    const tabName = tab.dataset.tab;

    // Store the active tab
    this._activeSubTabs.moves = tabName;

    // Remove active class from all tabs and contents
    const container = tab.closest('.moves-container');
    const allTabs = container.querySelectorAll('.inventory-tab');
    const allContents = container.querySelectorAll('.inventory-tab-content');

    allTabs.forEach(t => t.classList.remove('active'));
    allContents.forEach(c => c.classList.remove('active'));

    // Add active class to clicked tab and corresponding content
    tab.classList.add('active');
    const content = container.querySelector(`[data-tab-content="${tabName}"]`);
    if (content) content.classList.add('active');
  }

  /**
   * Handle recalculate character stats button
   * @param {Event} event   The originating click event
   * @private
   */
  async _onRecalculateCharacter(event) {
    event.preventDefault();

    try {
      // Show notification that recalculation is starting
      ui.notifications.info("Recalculating character stats...");

      // Call the character parsing function (this will reset and rebuild everything)
      await parseAndApplyCharacterEffects(this.actor);

      // Show success notification
      ui.notifications.info("Character stats recalculated successfully!");

      // Re-render the sheet to show updated values
      this.render(false);

    } catch (error) {
      console.error("Error recalculating character:", error);
      ui.notifications.error("Failed to recalculate character stats. See console for details.");
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle spell casting
   * @param {Event} event   The triggering click event
   * @private
   */
  async _onSpellRoll(event) {
    event.preventDefault();

    // Prevent edit/delete buttons from triggering spell roll
    if ($(event.target).closest('.spell-controls').length > 0) {
      return;
    }

    const spellCard = $(event.currentTarget);
    const itemId = spellCard.data("itemId");
    const spell = this.actor.items.get(itemId);

    if (!spell || spell.type !== 'spell') return;

    // Get magic school skill
    const magicSkill = this.actor.system.magic?.[spell.system.school];
    if (!magicSkill) {
      ui.notifications.warn(`No skill found for ${spell.system.school} magic school`);
      return;
    }

    const baseDice = magicSkill.talent || 1;
    const diceType = this._getDiceTypeForLevel(magicSkill.value || 0);

    // Format spell range if it's a number
    let formattedRange = spell.system.range;
    if (typeof spell.system.range === 'number' || (typeof spell.system.range === 'string' && !isNaN(parseInt(spell.system.range)))) {
      // Convert to number and use spell-specific range formatting
      const rangeValue = parseInt(spell.system.range);
      formattedRange = formatSpellRange(rangeValue);
      console.log(`[Spell Cast] Formatted spell range ${spell.system.range} (${typeof spell.system.range}) -> ${formattedRange}`);
    } else {
      console.log(`[Spell Cast] Range not formatted: ${spell.system.range} (${typeof spell.system.range})`);
    }

    // Create spell cast dialog
    const dialog = new AnyventureSpellCastDialog({
      title: `Cast ${spell.name}`,
      spellName: spell.name,
      baseDice: baseDice,
      diceType: diceType,
      energy: spell.system.energy || 0,
      concentration: spell.system.concentration,
      checkToCast: spell.system.checkToCast || 0,
      isFizzled: spell.system.fizzled || false,
      spell: spell,
      actor: this.actor,
      // Pass all spell data for display
      description: spell.system.description,
      charge: spell.system.charge,
      components: spell.system.components,
      damage: spell.system.damage,
      damageType: spell.system.damageType,
      range: formattedRange,
      duration: spell.system.duration,
      ritualDuration: spell.system.ritualDuration,
      school: spell.system.school,
      subschool: spell.system.subschool,
      reaction: spell.system.reaction
    });

    dialog.render(true);
  }

  /* -------------------------------------------- */

  /**
   * Handle toggling wonder token state
   * @param {Event} event   The triggering click event
   * @private
   */
  async _onToggleWonder(event) {
    event.preventDefault();
    if (this.actor.type !== 'character') return;

    const currentState = this.actor.system.wonder || false;
    await this.actor.update({
      'system.wonder': !currentState
    });

    // Visual feedback
    ui.notifications.info(`Wonder token ${!currentState ? 'activated' : 'deactivated'}`);
  }

  /* -------------------------------------------- */

  /**
   * Handle toggling woe token state
   * @param {Event} event   The triggering click event
   * @private
   */
  async _onToggleWoe(event) {
    event.preventDefault();
    if (this.actor.type !== 'character') return;

    const currentState = this.actor.system.woe || false;
    await this.actor.update({
      'system.woe': !currentState
    });

    // Visual feedback
    ui.notifications.info(`Woe token ${!currentState ? 'activated' : 'deactivated'}`);
  }

  /* -------------------------------------------- */

  /**
   * Helper method to convert skill level to dice type
   * @param {number} level - The skill level (0-6)
   * @returns {string} - The dice type (d4-d20)
   * @private
   */
  _getDiceTypeForLevel(level) {
    const diceTypes = ['d4', 'd6', 'd8', 'd10', 'd12', 'd16', 'd20'];
    return diceTypes[Math.min(Math.max(level, 0), 6)] || 'd4';
  }

  /* -------------------------------------------- */

  /**
   * Handle clicking on the edit item button
   * @param {Event} event   The originating click event
   * @private
   */
  async _onItemEdit(event) {
    event.preventDefault();
    const li = event.currentTarget.closest('.inventory-row');
    const itemId = li?.dataset?.itemId;

    console.log('Edit item clicked:', { li, itemId, actorItems: this.actor.items });

    if (!itemId) {
      ui.notifications.error('Could not find item ID');
      return;
    }

    const item = this.actor.items.get(itemId);
    console.log('Found item:', item);

    if (item) {
      item.sheet.render(true);
    } else {
      ui.notifications.error(`Item with ID ${itemId} not found`);
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle clicking on the delete item button
   * @param {Event} event   The originating click event
   * @private
   */
  async _onItemDelete(event) {
    event.preventDefault();
    const li = event.currentTarget.closest('.inventory-row');
    const itemId = li.dataset.itemId;
    const item = this.actor.items.get(itemId);

    if (item) {
      const confirmed = await Dialog.confirm({
        title: `Delete ${item.name}?`,
        content: `<p>Are you sure you want to delete <strong>${item.name}</strong>?</p><p>This action cannot be undone.</p>`,
        yes: () => true,
        no: () => false,
        defaultYes: false
      });

      if (confirmed) {
        await item.delete();
        ui.notifications.info(`Deleted ${item.name}`);
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Enhance spell data with casting information
   * @param {Object} spell - The spell item
   * @param {Object} context - The actor context with system data
   * @returns {Object} - Enhanced spell with casting data
   * @private
   */
  _enhanceSpellData(spell, context) {
    const enhancedSpell = foundry.utils.deepClone(spell);

    // Get magic school skill
    const magicSkill = context.system.magic?.[spell.system.school];

    if (magicSkill) {
      const talent = magicSkill.talent || 1;
      const skillLevel = magicSkill.value || 0;
      const diceType = this._getDiceTypeForLevel(skillLevel);
      const maxRoll = parseInt(diceType.substring(1)); // Extract number from "d20" -> 20

      enhancedSpell.system.castingFormula = `${talent}${diceType}`;
      enhancedSpell.system.maxPossibleRoll = maxRoll;
      enhancedSpell.system.cantChannel = maxRoll < spell.system.checkToCast;
    } else {
      enhancedSpell.system.castingFormula = "No Skill";
      enhancedSpell.system.cantChannel = true;
    }

    return enhancedSpell;
  }

  /* -------------------------------------------- */

  /**
   * Helper method to render energy as stars
   * @param {number} energy - The energy amount
   * @returns {string} - HTML string with stars or "None"
   * @private
   */
  _renderEnergy(energy) {
    const e = Number(energy) || 0;
    if (e === 0) return 'None';
    return Array.from({ length: e }).map(() => '<i class="fas fa-star"></i>').join('');
  }

  /* -------------------------------------------- */
  /*  Condition Event Handlers                   */
  /* -------------------------------------------- */

  /**
   * Handle rolling a recovery check for a condition
   * @param {Event} event The triggering click event
   * @private
   */
  async _onConditionRoll(event) {
    event.preventDefault();
    event.stopPropagation();

    const button = event.currentTarget;
    const checkType = button.dataset.checkType;
    const dc = parseInt(button.dataset.dc);
    const conditionId = button.dataset.conditionId;

    if (!checkType || !dc || !conditionId) {
      ui.notifications.warn("Missing condition data for recovery check.");
      return;
    }

    // Map check types to their skill categories
    const skillCategoryMap = {
      'resilience': 'basic',
      'concentration': 'basic',
      'endurance': 'basic',
      'fitness': 'basic',
      'logic': 'basic',
      'senses': 'basic'
      // Add more mappings as needed for other conditions
    };

    const skillCategory = skillCategoryMap[checkType] || 'basic';
    const skillName = checkType.charAt(0).toUpperCase() + checkType.slice(1);

    // Get the skill and prepare roll data
    const skill = this.actor.system[skillCategory]?.[checkType];
    if (!skill) {
      ui.notifications.warn(`Skill ${checkType} not found in ${skillCategory} category.`);
      return;
    }

    // Import and use the roll dialog directly with a promise wrapper
    const { AnyventureRollDialog } = await import('./roll-dialog.mjs');

    // Create a promise that resolves when the dialog completes
    const result = await new Promise((resolve) => {
      const dialog = new AnyventureRollDialog({
        title: `${skillName} Recovery Check`,
        skillName: skillName,
        baseDice: skill.talent || 1,
        diceType: this._getDiceTypeForLevel(skill.value || 0),
        actor: this.actor,
        rollCallback: (roll, data) => {
          // Resolve with the roll result (animation wait is handled in roll dialog)
          resolve({ total: roll.total, roll: roll });
        }
      });

      dialog.render({ force: true });

      // Also handle cancel case
      dialog.addEventListener('close', () => {
        resolve(null); // Resolve with null if dialog is closed without rolling
      });
    });

    if (!result) {
      // Dialog was cancelled
      return;
    }

    if (result.total >= dc) {
      // Success! Remove the condition
      const effect = this.actor.effects.get(conditionId);
      if (effect) {
        await effect.delete();
        ui.notifications.info(`${this.actor.name} recovers from ${effect.label || checkType}!`);
      }
    } else {
      // Failed - potentially reduce DC if it's a progressive condition
      const effect = this.actor.effects.get(conditionId);
      if (effect && effect.flags.anyventure?.reduceBy) {
        const currentDC = effect.flags.anyventure.currentCheck;
        const newDC = Math.max(1, currentDC - (effect.flags.anyventure.reduceBy || 1));

        await effect.update({
          'flags.anyventure.currentCheck': newDC,
          'flags.anyventure.turnsActive': (effect.flags.anyventure.turnsActive || 0) + 1
        });

        ui.notifications.info(`Recovery failed. DC reduced to ${newDC} for next attempt.`);
        this.render(false); // Refresh to show updated DC
      }
    }
  }

  /**
   * Handle removing a condition
   * @param {Event} event The triggering click event
   * @private
   */
  async _onConditionRemove(event) {
    event.preventDefault();
    event.stopPropagation();

    const conditionId = event.currentTarget.dataset.conditionId;

    if (!conditionId) {
      ui.notifications.warn("Missing condition ID for removal.");
      return;
    }

    const effect = this.actor.effects.get(conditionId);
    if (!effect) {
      ui.notifications.warn("Condition not found.");
      return;
    }

    const confirmed = await Dialog.confirm({
      title: "Remove Condition",
      content: `<p>Remove <strong>${effect.label || "this condition"}</strong>?</p>`,
      defaultYes: false
    });

    if (confirmed) {
      await effect.delete();
      ui.notifications.info(`Removed ${effect.label || "condition"}.`);
    }
  }

  /**
   * Handle editing condition details
   * @param {Event} event The triggering click event
   * @private
   */
  async _onConditionEdit(event) {
    event.preventDefault();
    event.stopPropagation();

    const conditionId = event.currentTarget.dataset.conditionId;

    if (!conditionId) {
      ui.notifications.warn("Missing condition ID for editing.");
      return;
    }

    const effect = this.actor.effects.get(conditionId);
    if (!effect) {
      ui.notifications.warn("Condition not found.");
      return;
    }

    // Import and show the custom condition edit dialog
    const { AnyventureConditionEditDialog } = await import('./condition-edit-dialog.mjs');
    AnyventureConditionEditDialog.show(effect);
  }

  /**
   * Handle changing editable condition fields
   * @param {Event} event The triggering change event
   * @private
   */
  async _onConditionFieldChange(event) {
    event.preventDefault();

    const input = event.currentTarget;
    const field = input.dataset.field;
    const conditionId = input.dataset.conditionId;
    const value = parseInt(input.value);

    if (isNaN(value)) return;

    const effect = this.actor.effects.get(effectId);
    if (effect) {
      await effect.update({
        [`flags.anyventure.${field}`]: value
      });
    }
  }
}

/**
 * Manage Active Effect instances through the Actor Sheet via effect control buttons.
 * @param {MouseEvent} event      The left-click event on the effect control
 * @param {Actor|Item} owner      The owning entity which manages this effect
 */
function onManageActiveEffect(event, owner) {
  event.preventDefault();
  const a = event.currentTarget;
  const li = a.closest("li");
  const effect = li.dataset.effectId ? owner.effects.get(li.dataset.effectId) : null;
  switch ( a.dataset.action ) {
    case "create":
      return owner.createEmbeddedDocuments("ActiveEffect", [{
        label: "New Effect",
        icon: "icons/svg/aura.svg",
        origin: owner.uuid,
        "duration.rounds": li.dataset.effectType === "temporary" ? 1 : undefined,
        disabled: li.dataset.effectType === "inactive"
      }]);
    case "edit":
      return effect.sheet.render(true);
    case "delete":
      return effect.delete();
    case "toggle":
      return effect.update({disabled: !effect.disabled});
  }
}

/**
 * Prepare the data structure for Active Effects which are currently applied to an Actor or Item.
 * @param {ActiveEffect[]} effects    The array of Active Effect instances to prepare sheet data for
 * @return {object}                   Data for rendering
 */
function prepareActiveEffectCategories(effects) {
  // Define effect header categories
  const categories = {
    temporary: {
      type: "temporary",
      label: "Temporary Effects",
      effects: []
    },
    passive: {
      type: "passive", 
      label: "Passive Effects",
      effects: []
    },
    inactive: {
      type: "inactive",
      label: "Inactive Effects",
      effects: []
    }
  };

  // Iterate over active effects, classifying them into categories
  for ( let e of effects ) {
    if ( e._getSourceName ) e._getSourceName(); // Trigger a lookup for the source name if method exists
    if ( e.disabled ) categories.inactive.effects.push(e);
    else if ( e.isTemporary ) categories.temporary.effects.push(e);
    else categories.passive.effects.push(e);
  }
  return categories;
}
