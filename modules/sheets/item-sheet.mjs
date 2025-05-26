/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {foundry.appv1.sheets.ItemSheet}
 */
export class AnyventureItemSheet extends foundry.appv1.sheets.ItemSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["anyventure", "sheet", "item"],
      width: 520,
      height: 480,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }]
    });
  }

  /** @override */
  get template() {
    const path = "systems/anyventure/templates/item";
    // Return a single sheet for all item types.
    // return `${path}/item-sheet.hbs`;

    // Alternatively, you could use the following return statement to do a
    // unique item sheet by type, like `weapon-sheet.hbs`.
    return `${path}/item-${this.item.type}-sheet.hbs`;
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    // Retrieve the data structure from the base sheet. You can inspect or log
    // the context variable to see the structure, but some key properties for
    // sheets are the actor object, the data object, whether or not the sheet
    // is editable, the items array, and the effects array.
    const context = super.getData();

    // Use a safe clone of the item data for further operations.
    const itemData = this.item.toObject(false);

    // Retrieve the roll data for TinyMCE editors.
    context.rollData = this.item.getRollData();

    // Add the actor's data to context.data for easier access, as well as flags.
    context.system = itemData.system;
    context.flags = itemData.flags;

    // Prepare type-specific data
    this._prepareItemTypeData(context);

    return context;
  }

  /**
   * Prepare data specific to different item types
   */
  _prepareItemTypeData(context) {
    const itemType = this.item.type;

    switch (itemType) {
      case 'weapon':
        this._prepareWeaponData(context);
        break;
      case 'armor':
        this._prepareArmorData(context);
        break;
      case 'spell':
        this._prepareSpellData(context);
        break;
      case 'module':
        this._prepareModuleData(context);
        break;
      case 'equipment':
        this._prepareEquipmentData(context);
        break;
    }
  }

  /**
   * Prepare weapon-specific data
   */
  _prepareWeaponData(context) {
    context.weaponCategories = [
      { value: 'unarmed', label: 'Unarmed' },
      { value: 'throwing', label: 'Throwing' },
      { value: 'simpleMeleeWeapons', label: 'Simple Melee' },
      { value: 'simpleRangedWeapons', label: 'Simple Ranged' },
      { value: 'complexMeleeWeapons', label: 'Complex Melee' },
      { value: 'complexRangedWeapons', label: 'Complex Ranged' }
    ];

    context.damageTypes = [
      'physical', 'heat', 'cold', 'lightning', 'dark', 
      'divine', 'aether', 'psychic', 'toxic'
    ];

    context.damageCategories = [
      { value: 'slashing', label: 'Slashing' },
      { value: 'piercing', label: 'Piercing' },
      { value: 'bludgeoning', label: 'Bludgeoning' },
      { value: 'ranged', label: 'Ranged' },
      { value: 'extra', label: 'Extra' }
    ];

    context.weaponFlags = [
      'two-handed', 'light', 'heavy', 'reach', 'thrown', 
      'finesse', 'versatile', 'loading', 'ammunition'
    ];
  }

  /**
   * Prepare armor-specific data
   */
  _prepareArmorData(context) {
    context.armorCategories = [
      { value: 'light', label: 'Light Armor' },
      { value: 'medium', label: 'Medium Armor' },
      { value: 'heavy', label: 'Heavy Armor' },
      { value: 'shield', label: 'Shield' }
    ];
  }

  /**
   * Prepare spell-specific data
   */
  _prepareSpellData(context) {
    context.magicTypes = [
      'black', 'primal', 'metamagic', 'divine', 'mysticism'
    ];

    context.spellSchools = {
      black: ['necromancy', 'witchcraft', 'fiend'],
      primal: ['elemental', 'nature', 'cosmic'],
      metamagic: ['transmutation', 'illusion', 'fey'],
      divine: ['abjuration', 'radiant', 'draconic'],
      mysticism: ['spirit', 'divination', 'astral']
    };

    context.damageTypes = [
      'physical', 'heat', 'cold', 'lightning', 'dark', 
      'divine', 'aether', 'psychic', 'toxic'
    ];

    context.rangeTypes = [
      'adjacent', 'nearby', 'short', 'moderate', 'distant', 'remote'
    ];
  }

  /**
   * Prepare module-specific data
   */
  _prepareModuleData(context) {
    context.moduleTypes = [
      'core', 'secondary', 'racial', 'cultural'
    ];
  }

  /**
   * Prepare equipment-specific data
   */
  _prepareEquipmentData(context) {
    // Equipment doesn't need special preparation currently
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Roll handlers.
    html.find('.rollable').click(this._onRoll.bind(this));

    // Handle weapon flag checkboxes
    html.find('.weapon-flag').change(this._onWeaponFlagChange.bind(this));
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
        const item = this.item;
        if (item) return item.roll();
      }
    }

    // Handle rolls that supply the formula directly.
    if (dataset.roll) {
      let label = dataset.label ? `Rolling ${dataset.label}` : '';
      let roll = new Roll(dataset.roll, this.item.getRollData());
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: label,
        rollMode: game.settings.get('core', 'rollMode'),
      });
      return roll;
    }
  }

  /**
   * Handle weapon flag changes
   * @param {Event} event   The originating change event
   * @private
   */
  async _onWeaponFlagChange(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const flag = element.value;
    const checked = element.checked;
    
    let flags = this.item.system.weapon_data.flags || [];
    
    if (checked && !flags.includes(flag)) {
      flags.push(flag);
    } else if (!checked && flags.includes(flag)) {
      flags = flags.filter(f => f !== flag);
    }
    
    await this.item.update({ 'system.weapon_data.flags': flags });
  }
}