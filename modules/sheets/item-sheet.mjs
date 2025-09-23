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
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "basic" }]
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
    context.item = itemData;

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
      case 'ancestry':
        this._prepareAncestryData(context);
        break;
      case 'culture':
        this._prepareCultureData(context);
        break;
      case 'trait':
        this._prepareTraitData(context);
        break;
      case 'item':
        this._prepareItemData(context);
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
      'physical', 'heat', 'cold', 'electric', 'dark', 
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
      'physical', 'heat', 'cold', 'electric', 'dark', 
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
      'core', 'secondary', 'planar', 'personality'
    ];

    // Keep options as array for dynamic template
    // Handlebars helpers are registered globally
  }


  /**
   * Prepare equipment-specific data
   */
  _prepareEquipmentData(context) {
    // Equipment doesn't need special preparation currently
  }

  /**
   * Prepare ancestry-specific data
   */
  _prepareAncestryData(context) {
    context.sizeOptions = [
      { value: 'tiny', label: 'Tiny' },
      { value: 'small', label: 'Small' },
      { value: 'medium', label: 'Medium' },
      { value: 'large', label: 'Large' },
      { value: 'huge', label: 'Huge' }
    ];
  }

  /**
   * Prepare culture-specific data
   */
  _prepareCultureData(context) {
    context.restrictionTypes = [
      { value: 'social', label: 'Social' },
      { value: 'behavioral', label: 'Behavioral' },
      { value: 'magical', label: 'Magical' },
      { value: 'equipment', label: 'Equipment' },
      { value: 'other', label: 'Other' }
    ];

    context.restrictionSeverities = [
      { value: 'minor', label: 'Minor' },
      { value: 'moderate', label: 'Moderate' },
      { value: 'major', label: 'Major' },
      { value: 'absolute', label: 'Absolute' }
    ];
  }

  /**
   * Prepare trait-specific data
   */
  _prepareTraitData(context) {
    context.traitTypes = [
      { value: 'supernatural', label: 'Supernatural' },
      { value: 'physical', label: 'Physical' },
      { value: 'mental', label: 'Mental' },
      { value: 'social', label: 'Social' },
      { value: 'magical', label: 'Magical' },
      { value: 'curse', label: 'Curse' },
      { value: 'blessing', label: 'Blessing' },
      { value: 'flaw', label: 'Flaw' }
    ];

    context.rarityOptions = [
      { value: 'common', label: 'Common' },
      { value: 'uncommon', label: 'Uncommon' },
      { value: 'rare', label: 'Rare' },
      { value: 'legendary', label: 'Legendary' },
      { value: 'mythic', label: 'Mythic' }
    ];
  }

  /**
   * Prepare general item-specific data
   */
  _prepareItemData(context) {
    context.itemTypes = [
      { value: 'tool', label: 'Tool' },
      { value: 'consumable', label: 'Consumable' },
      { value: 'crafting', label: 'Crafting Material' },
      { value: 'treasure', label: 'Treasure' },
      { value: 'misc', label: 'Miscellaneous' }
    ];

    context.consumableCategories = [
      { value: 'potion', label: 'Potion' },
      { value: 'food', label: 'Food' },
      { value: 'poison', label: 'Poison' },
      { value: 'scroll', label: 'Scroll' },
      { value: 'bomb', label: 'Bomb' },
      { value: 'other', label: 'Other' }
    ];

    context.rarityOptions = [
      { value: 'common', label: 'Common' },
      { value: 'uncommon', label: 'Uncommon' },
      { value: 'rare', label: 'Rare' },
      { value: 'legendary', label: 'Legendary' }
    ];

    context.damageTypes = [
      'physical', 'heat', 'cold', 'electric', 'dark',
      'divine', 'aether', 'psychic', 'toxic'
    ];
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

    // Handle module tier selections (legacy)
    html.find('input[name="tier2"], input[name="tier4"], input[name="tier6"]').change(this._onModuleTierChange.bind(this));

    // Handle module option button clicks (new dynamic style)
    html.find('.module-option').click(this._onModuleOptionClick.bind(this));

    // Update option selectability on render
    this._updateOptionSelectability(html);

    // Handle add/delete buttons for new item types
    html.find('.add-trait, .trait-delete').click(this._onTraitManagement.bind(this));
    html.find('.add-benefit, .benefit-delete').click(this._onBenefitManagement.bind(this));
    html.find('.add-option, .option-delete').click(this._onOptionManagement.bind(this));
    html.find('.add-restriction, .restriction-delete').click(this._onRestrictionManagement.bind(this));
    html.find('.add-effect, .effect-delete').click(this._onEffectManagement.bind(this));
    html.find('.add-subchoice, .subchoice-delete').click(this._onSubchoiceManagement.bind(this));
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

  /**
   * Handle module tier radio button changes
   * @param {Event} event   The originating change event
   * @private
   */
  async _onModuleTierChange(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const tierName = element.name; // tier2, tier4, or tier6
    const selectedOption = element.value; // option_2a, option_2b, etc.
    
    // Update the selected state for this tier
    const updateData = {};
    
    if (tierName === 'tier2') {
      updateData['system.options.option_2a.selected'] = selectedOption === 'option_2a';
      updateData['system.options.option_2b.selected'] = selectedOption === 'option_2b';
    } else if (tierName === 'tier4') {
      updateData['system.options.option_4a.selected'] = selectedOption === 'option_4a';
      updateData['system.options.option_4b.selected'] = selectedOption === 'option_4b';
    } else if (tierName === 'tier6') {
      updateData['system.options.option_6a.selected'] = selectedOption === 'option_6a';
      updateData['system.options.option_6b.selected'] = selectedOption === 'option_6b';
    }
    
    await this.item.update(updateData);
  }

  /**
   * Handle module option click (new dynamic style)
   * @param {Event} event   The originating click event
   * @private
   */
  async _onModuleOptionClick(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const location = String(element.dataset.location || '');

    if (!location) return;

    // Check if this option can be selected
    if (!this._canSelectOption(location)) {
      ui.notifications.warn(`Cannot select ${location} - prerequisites not met`);
      return;
    }

    // Get the current options array
    const options = [...(this.item.system.options || [])];

    // Find the option to toggle
    const targetIndex = options.findIndex(opt => opt.location === location);
    if (targetIndex === -1) return;

    const currentState = options[targetIndex].selected || false;
    const tierMatch = location.match(/^(\d+)/);

    if (!tierMatch) return;
    const tier = parseInt(tierMatch[1]);

    // Track which options changed for point calculation
    const originalStates = options.map(opt => opt.selected || false);

    // Handle tier restrictions - match webserver logic exactly
    if (tier % 2 === 0) {
      // Even tier (2, 4, 6) - can only select one option per tier
      options.forEach(opt => {
        if (opt.location.startsWith(tier.toString())) {
          opt.selected = opt.location === location ? !currentState : false;
        }
      });
    } else {
      // Odd tier (1, 3, 5, 7) - single option, just toggle
      options[targetIndex].selected = !currentState;
    }

    await this.item.update({ 'system.options': options });

    // Update module points if this item is owned by an actor and is not a personality module
    if (this.item.actor && this.item.system.mtype !== 'personality') {
      await this._updateActorModulePointsForChanges(options, originalStates);
    }
  }

  /**
   * Check if option can be selected based on prerequisites
   * @param {string} location The option location to check
   * @returns {boolean} Whether the option can be selected
   */
  _canSelectOption(location) {
    if (!location) return false;

    // Ensure location is a string
    const locationStr = String(location);

    if (locationStr === '1') return true;

    const tierMatch = locationStr.match(/^(\d+)/);
    if (!tierMatch) return false;

    const tier = parseInt(tierMatch[1]);
    const options = this.item.system.options || [];

    // Check if another option from same tier is already selected
    const sameOrDifferentOptionInTier = options.find(opt =>
      opt.location && opt.location.startsWith(tier.toString()) && opt.location !== locationStr && opt.selected
    );
    if (sameOrDifferentOptionInTier) return false;

    // Check if prerequisite tier is selected
    if (tier === 2) {
      return options.some(opt => opt.location === '1' && opt.selected);
    } else {
      const previousTier = (tier - 1).toString();
      return options.some(opt => opt.location && opt.location.startsWith(previousTier) && opt.selected);
    }
  }

  /**
   * Update option selectability styling
   * @param {jQuery} html The rendered HTML
   */
  _updateOptionSelectability(html) {
    if (this.item.type !== 'module') return;

    html.find('.module-option').each((i, element) => {
      const $element = $(element);
      const location = $element.data('location');
      const canSelect = this._canSelectOption(location);

      $element.attr('data-can-select', canSelect);
      if (!canSelect) {
        $element.addClass('disabled');
      } else {
        $element.removeClass('disabled');
      }
    });
  }

  /**
   * Update actor module points when options are selected/deselected
   * @param {Array} newOptions The updated options array
   * @param {Array} originalStates Array of original selected states
   */
  async _updateActorModulePointsForChanges(newOptions, originalStates) {
    const actor = this.item.actor;
    if (!actor) return;

    // Calculate net change in selected options
    let pointChange = 0;
    newOptions.forEach((option, index) => {
      const wasSelected = originalStates[index];
      const isSelected = option.selected || false;

      if (!wasSelected && isSelected) {
        pointChange += 1; // Option was selected
      } else if (wasSelected && !isSelected) {
        pointChange -= 1; // Option was deselected
      }
    });

    if (pointChange === 0) return;

    // Update actor's module points
    if (actor.system.modulePoints && typeof actor.system.modulePoints === 'object') {
      // New structure: { total: X, spent: Y }
      const currentSpent = actor.system.modulePoints.spent || 0;
      const newSpent = Math.max(0, currentSpent + pointChange);
      await actor.update({ 'system.modulePoints.spent': newSpent });

      const action = pointChange > 0 ? 'spent' : 'refunded';
      const absChange = Math.abs(pointChange);
      ui.notifications.info(`Module points: ${action} ${absChange} point${absChange !== 1 ? 's' : ''}`);
    } else {
      // Legacy structure: just a number
      const currentPoints = actor.system.modulePoints || 0;
      const newPoints = Math.max(0, currentPoints - pointChange);
      await actor.update({ 'system.modulePoints': newPoints });

      const action = pointChange > 0 ? 'spent' : 'refunded';
      const absChange = Math.abs(pointChange);
      ui.notifications.info(`Module points: ${action} ${absChange} point${absChange !== 1 ? 's' : ''}`);
    }
  }

  /**
   * Handle ancestry trait management
   * @param {Event} event   The originating click event
   * @private
   */
  async _onTraitManagement(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const action = element.dataset.action;

    if (action === 'add-ancestry-trait') {
      const options = this.item.system.options || [];
      const newTrait = {
        name: '',
        description: '',
        data: '',
        requiresChoice: false,
        choiceType: '',
        subchoices: []
      };
      options.push(newTrait);
      await this.item.update({ 'system.options': options });
    } else if (element.classList.contains('trait-delete')) {
      const index = parseInt(element.closest('.trait-option').dataset.index);
      const options = this.item.system.options || [];
      options.splice(index, 1);
      await this.item.update({ 'system.options': options });
    }
  }

  /**
   * Handle culture benefit management
   * @param {Event} event   The originating click event
   * @private
   */
  async _onBenefitManagement(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const action = element.dataset.action;

    if (action === 'add-culture-benefit') {
      const benefits = this.item.system.benefits || [];
      const newBenefit = {
        name: '',
        description: '',
        effect: ''
      };
      benefits.push(newBenefit);
      await this.item.update({ 'system.benefits': benefits });
    } else if (element.classList.contains('benefit-delete')) {
      const index = parseInt(element.closest('.benefit-item').dataset.index);
      const benefits = this.item.system.benefits || [];
      benefits.splice(index, 1);
      await this.item.update({ 'system.benefits': benefits });
    }
  }

  /**
   * Handle option management (culture/trait options)
   * @param {Event} event   The originating click event
   * @private
   */
  async _onOptionManagement(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const action = element.dataset.action;

    if (action === 'add-culture-option' || action === 'add-trait-option') {
      const options = this.item.system.options || [];
      const newOption = {
        name: '',
        description: '',
        data: '',
        selected: false,
        requiresChoice: false,
        choiceType: ''
      };
      options.push(newOption);
      await this.item.update({ 'system.options': options });
    } else if (element.classList.contains('option-delete')) {
      const index = parseInt(element.closest('.option-item, .trait-option').dataset.index);
      const options = this.item.system.options || [];
      options.splice(index, 1);
      await this.item.update({ 'system.options': options });
    }
  }

  /**
   * Handle restriction management
   * @param {Event} event   The originating click event
   * @private
   */
  async _onRestrictionManagement(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const action = element.dataset.action;

    if (action === 'add-culture-restriction') {
      const restrictions = this.item.system.culturalRestrictions || [];
      const newRestriction = {
        name: '',
        description: '',
        type: 'social',
        severity: 'minor'
      };
      restrictions.push(newRestriction);
      await this.item.update({ 'system.culturalRestrictions': restrictions });
    } else if (element.classList.contains('restriction-delete')) {
      const index = parseInt(element.closest('.restriction-item').dataset.index);
      const restrictions = this.item.system.culturalRestrictions || [];
      restrictions.splice(index, 1);
      await this.item.update({ 'system.culturalRestrictions': restrictions });
    }
  }

  /**
   * Handle effect management
   * @param {Event} event   The originating click event
   * @private
   */
  async _onEffectManagement(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const action = element.dataset.action;

    if (action === 'add-item-effect') {
      const effects = this.item.system.effects || [];
      const newEffect = {
        name: '',
        type: 'passive',
        duration: '',
        description: '',
        data: ''
      };
      effects.push(newEffect);
      await this.item.update({ 'system.effects': effects });
    } else if (element.classList.contains('effect-delete')) {
      const index = parseInt(element.closest('.effect-item').dataset.index);
      const effects = this.item.system.effects || [];
      effects.splice(index, 1);
      await this.item.update({ 'system.effects': effects });
    }
  }

  /**
   * Handle subchoice management
   * @param {Event} event   The originating click event
   * @private
   */
  async _onSubchoiceManagement(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const action = element.dataset.action;

    if (action === 'add-trait-subchoice') {
      const optionIndex = parseInt(element.dataset.optionIndex);
      const options = this.item.system.options || [];

      if (!options[optionIndex].subchoices) {
        options[optionIndex].subchoices = [];
      }

      const newSubchoice = {
        id: '',
        name: '',
        description: '',
        data: ''
      };

      options[optionIndex].subchoices.push(newSubchoice);
      await this.item.update({ 'system.options': options });
    } else if (element.classList.contains('subchoice-delete')) {
      const subchoiceItem = element.closest('.subchoice-item');
      const optionItem = subchoiceItem.closest('.trait-option');
      const optionIndex = parseInt(optionItem.dataset.index);
      const subchoiceIndex = Array.from(optionItem.querySelectorAll('.subchoice-item')).indexOf(subchoiceItem);

      const options = this.item.system.options || [];
      options[optionIndex].subchoices.splice(subchoiceIndex, 1);
      await this.item.update({ 'system.options': options });
    }
  }
}