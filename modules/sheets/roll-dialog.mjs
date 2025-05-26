/**
 * Roll Dialog for Anyventure system
 * Handles bonus/penalty dice mechanics
 */
export class AnyventureRollDialog extends foundry.applications.api.DialogV2 {
  
  constructor(options = {}) {
    super({
      window: {
        title: options.title || "Roll Check",
        contentClasses: ["anyventure-roll-dialog"]
      },
      content: `
        <form>
          <div class="roll-info">
            <h3>${options.skillName || "Skill"} Check</h3>
            <p><strong>Base Roll:</strong> ${options.baseDice}${options.diceType}</p>
          </div>
          
          <div class="form-group">
            <label for="bonus-dice">Bonus Dice:</label>
            <input type="number" id="bonus-dice" name="bonusDice" value="0" min="0" max="10" />
          </div>
          
          <div class="form-group">
            <label for="penalty-dice">Penalty Dice:</label>
            <input type="number" id="penalty-dice" name="penaltyDice" value="0" min="0" max="10" />
          </div>
          
          <div class="roll-preview">
            <p><strong>Final Roll:</strong> <span id="final-formula">${options.baseDice}${options.diceType}kh1</span></p>
          </div>
        </form>
      `,
      buttons: [
        {
          action: "roll",
          label: "Roll",
          icon: "fa-solid fa-dice",
          callback: (event, button, dialog) => this.handleRoll(event, button, dialog)
        },
        {
          action: "cancel",
          label: "Cancel",
          icon: "fa-solid fa-times"
        }
      ],
      modal: true,
      ...options
    });
    
    this.baseDice = options.baseDice || 1;
    this.diceType = options.diceType || "d6";
    this.skillName = options.skillName || "Skill";
    this.actor = options.actor;
    this.rollCallback = options.rollCallback;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    
    // Add event listeners for real-time formula updates
    const bonusInput = this.element.querySelector('#bonus-dice');
    const penaltyInput = this.element.querySelector('#penalty-dice');
    const formulaDisplay = this.element.querySelector('#final-formula');
    
    const updateFormula = () => {
      const bonus = parseInt(bonusInput.value) || 0;
      const penalty = parseInt(penaltyInput.value) || 0;
      const formula = this.calculateFormula(this.baseDice, bonus, penalty);
      formulaDisplay.textContent = formula;
    };
    
    bonusInput.addEventListener('input', updateFormula);
    penaltyInput.addEventListener('input', updateFormula);
  }

  /**
   * Calculate the final dice formula based on bonus/penalty dice
   */
  calculateFormula(baseDice, bonusDice, penaltyDice) {
    let netDice = baseDice + bonusDice - penaltyDice;
    
    // Case 1: Normal roll (net dice > 0)
    if (netDice > 0) {
      return `${netDice}${this.diceType}kh1`;
    }
    
    // Case 2: Penalties equal or exceed base + bonus
    // Roll the penalty dice and keep lowest
    if (penaltyDice > 0) {
      return `${penaltyDice}${this.diceType}kl1`;
    }
    
    // Fallback (shouldn't happen, but just in case)
    return `1${this.diceType}`;
  }

  /**
   * Handle the roll button click
   */
  async handleRoll(event, button, dialog) {
    const formData = new FormData(dialog.element.querySelector('form'));
    const bonusDice = parseInt(formData.get('bonusDice')) || 0;
    const penaltyDice = parseInt(formData.get('penaltyDice')) || 0;
    
    const formula = this.calculateFormula(this.baseDice, bonusDice, penaltyDice);
    
    // Create the roll
    const roll = new Roll(formula, this.actor?.getRollData() || {});
    await roll.evaluate();
    
    // Determine flavor text based on roll type
    let flavorText = `${this.skillName} Check`;
    let totalDice = this.baseDice + bonusDice - penaltyDice;
    
    if (bonusDice > 0 && penaltyDice === 0) {
      flavorText += ` (${bonusDice} bonus dice)`;
    } else if (penaltyDice > 0 && bonusDice === 0) {
      if (totalDice >= 1) {
        flavorText += ` (${penaltyDice} penalty dice)`;
      } else {
        flavorText += ` (disadvantage - keep lowest)`;
      }
    } else if (bonusDice > 0 && penaltyDice > 0) {
      const net = bonusDice - penaltyDice;
      if (net > 0) {
        flavorText += ` (net +${net} dice)`;
      } else if (net < 0) {
        flavorText += ` (net ${net} dice)`;
      }
    }
    
    // Send to chat
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: flavorText,
      rollMode: game.settings.get('core', 'rollMode'),
    });
    
    // Call the callback if provided
    if (this.rollCallback) {
      this.rollCallback(roll, { bonusDice, penaltyDice });
    }
    
    return { roll, bonusDice, penaltyDice };
  }

  /**
   * Static method to show the roll dialog
   */
  static async show(options = {}) {
    const dialog = new AnyventureRollDialog(options);
    return dialog.render({ force: true });
  }
}