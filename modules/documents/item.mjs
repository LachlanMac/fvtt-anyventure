/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export class AnyventureItem extends Item {
  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData() {
    // As with the actor class, items are documents that can have their data
    // preparation methods overridden (such as prepareBaseData()).
    super.prepareData();
  }

  /**
   * Prepare a data object which is passed to any Roll formulas which are created related to this Item
   * @private
   */
  getRollData() {
    // If present, return the actor's roll data.
    if ( !this.actor ) return null;
    const rollData = this.actor.getRollData();
    // Grab the item's system data as well.
    rollData.item = foundry.utils.deepClone(this.system);

    return rollData;
  }

  async _preUpdate(changed, options, user) {
    
    const stackLimitRaw = Number(this.system?.stack_limit);
    const stackLimit = Number.isFinite(stackLimitRaw) ? stackLimitRaw : 0;

    if (stackLimit > 0 && foundry.utils.hasProperty(changed, 'system.quantity')) {
      const desiredRaw = Number(foundry.utils.getProperty(changed, 'system.quantity'));
      if (Number.isFinite(desiredRaw)) {
        const clamped = Math.max(Math.min(Math.floor(desiredRaw), stackLimit), 0);
        if (clamped !== desiredRaw) {
          foundry.utils.setProperty(changed, 'system.quantity', clamped);
          if (user === game.userId) {
            ui.notifications?.warn(`${this.name} quantity adjusted to stack limit (${stackLimit}).`);
          }
        }
      }
    }

    return super._preUpdate(changed, options, user);
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  async roll() {
    const item = this;

    // Initialize chat data.
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const rollMode = game.settings.get('core', 'rollMode');
    const label = `[${item.type}] ${item.name}`;

    // If there's no roll data, send a chat message.
    if (!this.system.formula) {
      ChatMessage.create({
        speaker: speaker,
        rollMode: rollMode,
        flavor: label,
        content: item.system.description ?? ''
      });
    }
    // Otherwise, create a roll and send a chat message from it.
    else {
      // Retrieve roll data.
      const rollData = this.getRollData();

      // Invoke the roll and submit it to chat.
      const roll = new Roll(rollData.item.formula, rollData);
      // If you need to store the value first, uncomment the next line.
      // let result = await roll.roll({async: true});
      roll.toMessage({
        speaker: speaker,
        rollMode: rollMode,
        flavor: label,
      });
      return roll;
    }
  }
}
