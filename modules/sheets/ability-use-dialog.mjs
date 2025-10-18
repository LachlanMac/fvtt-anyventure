/**
 * Ability Use Dialog for Anyventure system
 * Handles action and reaction ability usage with proper styling
 */
export class AnyventureAbilityUseDialog extends foundry.applications.api.DialogV2 {

  constructor(options = {}) {
    // Helper function to render energy cost
    const renderEnergy = (energy) => {
      if (!energy || energy === 0) return 'None';
      let stars = '';
      for (let i = 0; i < energy; i++) {
        stars += '<i class="fas fa-star filled"></i>';
      }
      return stars;
    };

    super({
      window: {
        title: options.title || `Use ${options.abilityType === 'reaction' ? 'Reaction' : 'Action'}`,
        contentClasses: ['anyventure-ability-use-dialog']
      },
      content: `
        <form>
          <div class="ability-header">
            <h3>${options.abilityName || 'Ability'}</h3>
            <div class="ability-type-badge ${options.abilityType}">
              ${options.abilityType === 'reaction' ? 'Reaction' : 'Action'}
            </div>
          </div>

          <div class="ability-energy-cost">
            <strong>Energy Cost:</strong>
            <span class="energy-cost">${renderEnergy(options.energyCost)}</span>
          </div>

          ${options.description ? `
          <div class="ability-text-section">
            <h4>Description</h4>
            <div class="ability-description">${options.description}</div>
          </div>
          ` : ''}

          ${options.energyCost > options.currentEnergy ? `
          <div class="energy-warning">
            <i class="fas fa-exclamation-triangle"></i>
            <strong>Insufficient Energy!</strong> You need ${options.energyCost} energy but only have ${options.currentEnergy}.
          </div>
          ` : ''}
        </form>
      `,
      buttons: [
        {
          action: 'use',
          label: options.abilityType === 'reaction' ? 'Use Reaction' : 'Use Action',
          icon: options.abilityType === 'reaction' ? 'fa-solid fa-shield-halved' : 'fa-solid fa-fist-raised',
          disabled: options.energyCost > options.currentEnergy,
          callback: (event, button, dialog) => this.handleUse(event, button, dialog)
        },
        {
          action: 'cancel',
          label: 'Cancel',
          icon: 'fa-solid fa-times'
        }
      ],
      modal: true,
      ...options
    });

    this.actor = options.actor;
    this.item = options.item;
    this.abilityName = options.abilityName;
    this.abilityType = options.abilityType;
    this.energyCost = options.energyCost || 0;
    this.description = options.description;
    this.currentEnergy = options.currentEnergy;
  }

  /**
   * Handle the use button click
   */
  async handleUse(event, button, dialog) {
    // Deduct energy if there's a cost
    if (this.energyCost > 0 && this.actor) {
      const newEnergy = this.currentEnergy - this.energyCost;
      await this.actor.update({ 'system.resources.energy.value': newEnergy });
    }

    // Mark daily abilities as used if applicable
    if (this.item?.system?.daily) {
      await this.item.update({ 'system.used': true });
    }

    // Get targeted tokens
    const targets = Array.from(game.user.targets);
    let targetInfo = '';

    if (targets.length > 0) {
      const targetNames = targets.map(t => t.document.name).join(', ');
      targetInfo = `
        <div class="ability-targets" style="text-align: center;">
          <strong>Target${targets.length > 1 ? 's' : ''}:</strong> ${targetNames}
        </div>
      `;
    }

    // Build formatted chat message with styling
    let chatContent = `
      <div class="anyventure-ability-card ${this.abilityType}-card">
        <div class="ability-header">
          <div class="ability-name">
            <strong>${this.abilityName}</strong>
          </div>
          <div class="ability-type-badge ${this.abilityType}">
            ${this.abilityType === 'reaction' ? 'Reaction' : 'Action'}
          </div>
        </div>

        ${targetInfo}

        ${this.energyCost > 0 ? `
        <div class="ability-cost">
          <strong>Energy Cost:</strong> ${this._renderEnergyForChat(this.energyCost)}
        </div>
        ` : ''}

        ${this.description ? `
        <div class="ability-description">
          ${this.description}
        </div>
        ` : ''}
      </div>
    `;

    // Post to chat
    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: chatContent,
      style: CONST.CHAT_MESSAGE_STYLES.OTHER
    });

    // Return success
    return true;
  }

  /**
   * Render energy cost for chat display
   */
  _renderEnergyForChat(energy) {
    if (!energy || energy === 0) return 'None';
    let stars = '';
    for (let i = 0; i < energy; i++) {
      stars += '<i class="fas fa-star filled"></i> ';
    }
    return stars.trim();
  }

  /**
   * Static method to show the ability use dialog
   */
  static async show(options = {}) {
    const dialog = new AnyventureAbilityUseDialog(options);
    const result = await dialog.render({ force: true });
    return result;
  }
}