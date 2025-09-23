import { formatRange, formatCategory, formatDamageType } from "../utils/formatters.mjs";
import { AnyventureAttackRollDialog } from "./attack-roll-dialog.mjs";
import { parseAndApplyCharacterEffects } from "../utils/character-parser.js";

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {foundry.appv1.sheets.ActorSheet}
 */
export class AnyventureActorSheet extends foundry.appv1.sheets.ActorSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["anyventure", "sheet", "actor"],
      template: "systems/anyventure/templates/actor/actor-character-sheet.hbs",
      width: 830,
      height: 720,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "skills" }]
    });
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
    }

    // Prepare NPC data and items.
    if (actorData.type == 'npc') {
      this._prepareItems(context);
      this._prepareCharacterData(context); // NPCs use the same skill preparation
    }

    // Add roll data for TinyMCE editors.
    context.rollData = context.actor.getRollData();

    // Prepare active effects
    context.effects = prepareActiveEffectCategories(this.actor.effects);

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

    console.log("PREP CHAR DATA");
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
    console.log('=== SKILL CATEGORIES DEBUG ===');
    console.log('Language skills prepared:', languageSkills);
    console.log('Object.keys(languageSkills):', Object.keys(languageSkills));

    context.skillCategories = {
      basic: context.system.basic || {},
      weapon: context.system.weapon || {},
      magic: context.system.magic || {},
      crafting: context.system.crafting || {},
      language: languageSkills,
      music: context.system.music || {}
    };

    console.log('Final context.skillCategories.language:', context.skillCategories.language);
    console.log('=== END SKILL CATEGORIES DEBUG ===');

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
        else if (itemType === 'cloaks' && !isEquipped) {
          cloaks.push(i);
        }
        else if (itemType === 'equipment' && !isEquipped) {
          // Further categorize equipment by subtype
          if (i.system.equipment_type === 'light_source') {
            light_sources.push(i);
          }
          else if (i.system.equipment_type === 'ammunition') {
            ammunition.push(i);
          }
          else if (i.system.equipment_type === 'instrument') {
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
        spells.push(i);
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
    console.log('=== _prepareLanguagesFromItems DEBUG ===');
    console.log('Total items:', context.items.length);

    const languageSkills = {};

    // Find all language items owned by this character
    const languageItems = context.items.filter(item => item.type === 'language');
    console.log('Language items found:', languageItems.length);
    console.log('Language items:', languageItems.map(item => ({ name: item.name, type: item.type, talent: item.system.talent })));

    for (const item of languageItems) {
      // Convert language name to a key (lowercase, replace spaces with underscores)
      const key = item.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      console.log(`Processing language: ${item.name} -> key: ${key}`);

      languageSkills[key] = {
        name: item.name,
        value: 0, // Languages don't have skill values, just talent
        talent: item.system.talent || 0,
        baseTalent: item.flags?.anyventure?.characterTalent || item.system.talent || 0,
        magic: item.system.magic || 0,
        itemId: item._id // Store the item ID for reference
      };
    }

    console.log('Final languageSkills object:', languageSkills);
    console.log('=== END DEBUG ===');
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
   * Get equipped weapons for the moves section
   * @param {Object} context The actor context
   * @returns {Array} Array of equipped weapons with attack data
   * @private
   */
  _getEquippedWeapons(context) {
    const equippedWeapons = [];
    const equipment = context.system.equipment || {};

    // Check weapon slots for equipped weapons
    const weaponSlots = ['mainhand', 'offhand', 'extra1', 'extra2', 'extra3'];

    for (const slotName of weaponSlots) {
      const slot = equipment[slotName];
      if (slot?.item && slot.item.system.itemType === 'weapon') {
        const weapon = slot.item;
        
        // Process primary attack if it exists
        if (weapon.system.primary) {
          // Calculate dice for this attack based on skill
          const diceInfo = this._calculateAttackDice(weapon, weapon.system.primary);

          const primaryAttack = {
            weaponName: weapon.name,
            weaponIcon: weapon.img || 'icons/weapons/swords/sword-broad-steel.webp',
            weaponCategory: weapon.system.weapon_category, // Store weapon category for skill lookup
            attackType: this._getAttackType(weapon, weapon.system.primary),
            category: formatCategory(weapon.system.primary.category || 'slash'),
            rawCategory: weapon.system.primary.category || 'slash', // Keep raw for skill lookup
            damage: weapon.system.primary.damage || 0,
            damageExtra: weapon.system.primary.damage_extra || 0,
            damageType: formatDamageType(weapon.system.primary.damage_type || 'physical'),
            secondaryDamage: weapon.system.primary.secondary_damage || 0,
            secondaryDamageExtra: weapon.system.primary.secondary_damage_extra || 0,
            secondaryDamageType: formatDamageType(weapon.system.primary.secondary_damage_type || 'none'),
            energy: weapon.system.primary.energy || 0,
            minRange: weapon.system.primary.min_range || 0,
            maxRange: weapon.system.primary.max_range || 1,
            rangeText: formatRange(weapon.system.primary.min_range || 0, weapon.system.primary.max_range || 1),
            attackDice: diceInfo.dice,
            attackDiceType: diceInfo.diceType,
            slotName: slotName
          };
          equippedWeapons.push(primaryAttack);
        }

        // Process secondary attack if it exists
        if (weapon.system.secondary && weapon.system.secondary.damage > 0) {
          // Calculate dice for this attack based on skill
          const diceInfo = this._calculateAttackDice(weapon, weapon.system.secondary);

          const secondaryAttack = {
            weaponName: weapon.name,
            weaponIcon: weapon.img || 'icons/weapons/swords/sword-broad-steel.webp',
            weaponCategory: weapon.system.weapon_category, // Store weapon category for skill lookup
            attackType: this._getAttackType(weapon, weapon.system.secondary),
            category: formatCategory(weapon.system.secondary.category || 'slash'),
            rawCategory: weapon.system.secondary.category || 'slash', // Keep raw for skill lookup
            damage: weapon.system.secondary.damage || 0,
            damageExtra: weapon.system.secondary.damage_extra || 0,
            damageType: formatDamageType(weapon.system.secondary.damage_type || 'physical'),
            secondaryDamage: weapon.system.secondary.secondary_damage || 0,
            secondaryDamageExtra: weapon.system.secondary.secondary_damage_extra || 0,
            secondaryDamageType: formatDamageType(weapon.system.secondary.secondary_damage_type || 'none'),
            energy: weapon.system.secondary.energy || 0,
            minRange: weapon.system.secondary.min_range || 0,
            maxRange: weapon.system.secondary.max_range || 1,
            rangeText: formatRange(weapon.system.secondary.min_range || 0, weapon.system.secondary.max_range || 1),
            attackDice: diceInfo.dice,
            attackDiceType: diceInfo.diceType,
            slotName: slotName
          };
          equippedWeapons.push(secondaryAttack);
        }
      }
    }

    // Always add unarmed attack as a default option
    const unarmedAttackData = {
      damage: 3,
      damage_extra: 3,
      damage_type: 'physical',
      category: 'blunt',
      energy: 0,
      min_range: 1,
      max_range: 1
    };

    // Create fake weapon object for unarmed attack dice calculation
    const unarmedWeapon = {
      system: {
        weapon_category: 'unarmed'
      }
    };

    const unarmedDiceInfo = this._calculateAttackDice(unarmedWeapon, unarmedAttackData);

    const unarmedAttack = {
      weaponName: 'Unarmed Strike',
      weaponIcon: 'icons/skills/melee/unarmed-punch-fist.webp',
      weaponCategory: 'unarmed',
      attackType: this._getAttackType(unarmedWeapon, unarmedAttackData),
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
      attackDice: unarmedDiceInfo.dice,
      attackDiceType: unarmedDiceInfo.diceType,
      slotName: 'unarmed'
    };

    equippedWeapons.push(unarmedAttack);

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
      'black_magic': 'Black Magic',
      'divine_magic': 'Divine Magic',
      'metamagic': 'Meta Magic',
      'mysticism': 'Mysticism'
    };

    if (magicCategories[attackData.category]) {
      return magicCategories[attackData.category];
    }

    // For weapon attacks, use weapon category
    const weaponCategories = {
      'simpleMelee': 'Simple Melee',
      'simpleRanged': 'Simple Ranged',
      'complexMelee': 'Complex Melee',
      'complexRanged': 'Complex Ranged',
      'unarmed': 'Unarmed',
      'throwing': 'Throwing'
    };

    return weaponCategories[weapon.system.weapon_category] || 'Unknown';
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
      'black_magic': 'black',
      'metamagic': 'metamagic',
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
        'simpleMelee': 'simple_melee',
        'simpleRanged': 'simple_ranged',
        'complexMelee': 'complex_melee',
        'complexRanged': 'complex_ranged',
        'unarmed': 'unarmed',
        'throwing': 'throwing'
      };

      skillKey = weaponCategoryMap[weapon.system.weapon_category] || 'unarmed';
    }

    // Get the skill values from the actor
    const skill = this.actor.system[skillCategory]?.[skillKey] || { talent: 0, value: 0 };
    const talent = skill.talent || 0;
    const skillValue = skill.value || 0;

    // Determine dice type based on skill value (0=d4, 1=d6, 2=d8, 3=d10, 4=d12, 5=d16, 6=d20)
    const diceTypes = ['d4', 'd6', 'd8', 'd10', 'd12', 'd16', 'd20'];
    const diceType = diceTypes[Math.min(skillValue, 6)] || 'd4';

    // Base dice = talent value
    const dice = Math.max(talent, 1); // At least 1 die

    return { dice, diceType };
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Render the item sheet for viewing/editing prior to the editable check.
    html.find('.item-edit').click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.sheet.render(true);
    });

    // -------------------------------------------------------------
    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Add Inventory Item
    html.find('.item-create').click(this._onItemCreate.bind(this));
    html.find('.item-add').click(this._onItemCreate.bind(this));

    // Delete Inventory Item
    html.find('.item-delete').click(ev => {
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

    // Language talent setting (right-click to set talent)
    html.find('.skill-roll[data-category="language"]').contextmenu(this._onLanguageTalentSet.bind(this));

    // Weapon attack rolls
    html.find('.weapon-attack-clickable').click(this._onWeaponAttackRoll.bind(this));

    // Resource modification buttons
    html.find('.resource-btn').click(this._onResourceModify.bind(this));

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

    // Moves tab navigation (using inventory tab classes)
    html.find('.moves-container .inventory-tab').click(this._onMovesTabClick.bind(this));

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

    // Handle inventory tab switching
    html.find('.inventory-tab').click(this._onInventoryTabChange.bind(this));

    // Handle main tab switching to restore inventory tabs when Equipment is selected
    html.find('.sheet-tabs .item[data-tab="equipment"]').click((event) => {
      // Add a slight delay to ensure the main tab switch completes first
      setTimeout(() => this._restoreActiveInventoryTab(html), 10);
    });

    // Also restore inventory tab on any render if Equipment tab is active
    if (html.find('.sheet-tabs .item[data-tab="equipment"]').hasClass('active')) {
      this._restoreActiveInventoryTab(html);
    }

    // Enable drag and drop visual feedback for inventory areas
    if (this.actor.isOwner) {
      // Store bound functions to allow proper removal
      if (!this._boundInventoryDragOver) {
        this._boundInventoryDragOver = this._onInventoryDragOver.bind(this);
        this._boundInventoryDragLeave = this._onInventoryDragLeave.bind(this);
      }

      html.find('.inventory-tab-content, .unequipped-items-section').each((i, area) => {
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

    // Remove active class from all inventory tabs and content
    html.find('.inventory-tab').removeClass('active');
    html.find('.inventory-tab-content').removeClass('active');

    // Add active class to the correct inventory tab and content
    html.find(`[data-tab="${activeTab}"]`).addClass('active');
    html.find(`[data-tab-content="${activeTab}"]`).addClass('active');
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
      return this.actor.rollSkill(category, skill);
    }
  }

  /**
   * Handle language talent setting (right-click context menu)
   * @param {Event} event   The originating right-click event
   * @private
   */
  async _onLanguageTalentSet(event) {
    event.preventDefault();
    const dataset = event.currentTarget.dataset;
    const itemId = dataset.itemId;

    if (!itemId) {
      ui.notifications.warn("Language item not found");
      return;
    }

    const languageItem = this.actor.items.get(itemId);
    if (!languageItem || languageItem.type !== 'language') {
      ui.notifications.warn("Language item not found");
      return;
    }

    // Create a dialog to set talent level
    const currentTalent = languageItem.system.talent || 0;

    const content = `
      <form>
        <div class="form-group">
          <label>Set talent level for <strong>${languageItem.name}</strong>:</label>
          <div style="display: flex; gap: 10px; margin-top: 10px;">
            ${[0, 1, 2, 3, 4].map(level =>
              `<button type="button" class="talent-btn" data-talent="${level}"
                      style="padding: 8px 12px; ${level === currentTalent ? 'background: #b8860b; color: #1a1525;' : 'background: #2a2a2a; color: #e8e3f0;'} border: 1px solid #666; border-radius: 4px; cursor: pointer;">
                ${level === 0 ? 'None' : '★'.repeat(level)}
              </button>`
            ).join('')}
          </div>
        </div>
      </form>
    `;

    new Dialog({
      title: `Set Language Talent: ${languageItem.name}`,
      content: content,
      buttons: {
        cancel: {
          label: "Cancel"
        }
      },
      render: (html) => {
        html.find('.talent-btn').click(async (e) => {
          const talent = parseInt(e.currentTarget.dataset.talent);
          await languageItem.update({ 'system.talent': talent });
          ui.notifications.info(`Set ${languageItem.name} talent to ${talent === 0 ? 'None' : talent + ' stars'}`);
          // Close the dialog
          html.closest('.dialog').find('.dialog-button.cancel').click();
        });
      }
    }).render(true);
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
      'black_magic': 'black',
      'metamagic': 'metamagic',
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
        'simpleMelee': 'simple_melee',
        'simpleRanged': 'simple_ranged',
        'complexMelee': 'complex_melee',
        'complexRanged': 'complex_ranged',
        'unarmed': 'unarmed',
        'throwing': 'throwing'
      };

      skillKey = weaponCategoryMap[attackData.weaponCategory] || 'unarmed';
    }

    // Get the skill values from the actor
    const skill = this.actor.system[skillCategory]?.[skillKey] || { talent: 0, value: 0 };
    const talent = skill.talent || 0;
    const skillValue = skill.value || 0;

    // Determine dice type based on skill value (0=d4, 1=d6, 2=d8, 3=d10, 4=d12, 5=d16, 6=d20)
    const diceTypes = ['d4', 'd6', 'd8', 'd10', 'd12', 'd16', 'd20'];
    const diceType = diceTypes[Math.min(skillValue, 6)] || 'd4';

    // Base dice = talent value
    const baseDice = Math.max(talent, 1); // At least 1 die

    // Show the attack roll dialog
    AnyventureAttackRollDialog.show({
      title: `${attackData.weaponName} Attack`,
      weaponName: `${attackData.weaponName} (${attackData.attackType})`,
      baseDice: baseDice,
      diceType: diceType,
      attackData: attackData,
      actor: this.actor,
      rollCallback: (roll, data) => {
        console.log("Attack roll completed:", roll.total, data);
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
    
    const currentValue = this.actor.system.resources[resource].value;
    const maxValue = this.actor.system.resources[resource].max;
    
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
    const itemType = item.system.itemType; // Use itemType for items
    const equipment = this.actor.system.equipment || {};

    // Map item types to slot preferences (with weapon logic handled separately)
    const slotMappings = {
      'armor': ['body'],
      'headwear': ['head'],
      'cloaks': ['back'],
      'gloves': ['hand'],
      'boots': ['boots'],
      'ring': ['accessory1', 'accessory2'],
      'equipment': ['accessory1', 'accessory2'] // General equipment goes to accessory slots
    };

    // Handle weapons, instruments, and ammunition with special rules
    if (itemType === 'weapon' || itemType === 'instrument' || itemType === 'ammunition' || (itemType === 'equipment' && item.system.equipment_type === 'instrument')) {
      // Instruments and ammunition default to one-handed unless specified otherwise
      const isInstrument = itemType === 'instrument' || (itemType === 'equipment' && item.system.equipment_type === 'instrument');
      const isAmmunition = itemType === 'ammunition';
      const isOneHanded = item.system.hands === 1 || !item.system.hands || isInstrument || isAmmunition; // Default to 1-handed if not specified
      const isTwoHanded = item.system.hands === 2 && !isInstrument && !isAmmunition; // Instruments and ammunition are never two-handed unless explicitly set

      if (isOneHanded) {
        // 1-handed weapons: mainhand, offhand, extra1, extra2, extra3
        const weaponSlots = ['mainhand', 'offhand', 'extra1', 'extra2', 'extra3'];
        for (const slotName of weaponSlots) {
          if (!equipment[slotName]?.item) {
            return slotName;
          }
        }
      } else if (isTwoHanded) {
        // 2-handed weapons: mainhand, extra1, extra2, extra3 only
        const twoHandedSlots = ['mainhand', 'extra1', 'extra2', 'extra3'];
        for (const slotName of twoHandedSlots) {
          if (!equipment[slotName]?.item) {
            return slotName;
          }
        }
      }
      return null;
    }

    // Handle shields
    if (itemType === 'shield') {
      return !equipment['offhand']?.item ? 'offhand' : null;
    }

    // Handle other item types
    const possibleSlots = slotMappings[itemType] || ['accessory1', 'accessory2'];

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

    // Strict slot validation for non-weapons
    const slotRestrictions = {
      'armor': ['body'],
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
      const isOneHanded = item.system.hands === 1 || !item.system.hands || isInstrument || isAmmunition;
      const isTwoHanded = item.system.hands === 2 && !isInstrument && !isAmmunition;

      if (isOneHanded) {
        return ['mainhand', 'offhand', 'extra1', 'extra2', 'extra3'].includes(slotName);
      } else if (isTwoHanded) {
        return ['mainhand', 'extra1', 'extra2', 'extra3'].includes(slotName);
      }
      return false;
    }

    // Handle shields
    if (itemType === 'shield') {
      return slotName === 'offhand';
    }

    // Check other item types
    const allowedSlots = slotRestrictions[itemType];
    if (allowedSlots) {
      return allowedSlots.includes(slotName);
    }

    // Default to accessory slots for unknown types
    return ['accessory1', 'accessory2'].includes(slotName);
  }

  /**
   * Equip an item to a specific slot
   * @param {Item} item   The item to equip
   * @param {string} slotName   The slot to equip to
   * @private
   */
  async _equipItem(item, slotName) {
    // Validate the item can be equipped to this slot
    if (!this._validateItemSlot(item, slotName)) {
      ui.notifications.warn(`${item.name} cannot be equipped to ${slotName}`);
      return;
    }

    const updateData = {};

    // Special handling for 2-handed weapons
    if (item.system.itemType === 'weapon' && item.system.hands === 2 && slotName === 'mainhand') {
      // Unequip offhand when equipping 2-handed weapon to mainhand
      updateData[`system.equipment.offhand.item`] = null;
      updateData[`system.equipment.offhand.equippedAt`] = null;
      ui.notifications.info(`Unequipped offhand item to make room for 2-handed weapon`);
    }

    // Handle single-item slots - store item reference
    updateData[`system.equipment.${slotName}.item`] = {
      _id: item._id,
      name: item.name,
      img: item.img,
      type: item.type,
      system: item.system
    };
    updateData[`system.equipment.${slotName}.equippedAt`] = new Date().toISOString();

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

    const currentQuantity = item.system.quantity || 1;
    if (currentQuantity > 1) {
      await item.update({ "system.quantity": currentQuantity - 1 });
    } else {
      // If quantity would go to 0, delete the item
      await item.delete();
      ui.notifications.info(`${item.name} removed from inventory`);
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

    const currentQuantity = item.system.quantity || 1;
    await item.update({ "system.quantity": currentQuantity + 1 });
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
   * Handle moves tab clicks
   * @param {Event} event   The originating click event
   * @private
   */
  _onMovesTabClick(event) {
    event.preventDefault();
    const tab = event.currentTarget;
    const tabName = tab.dataset.tab;

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