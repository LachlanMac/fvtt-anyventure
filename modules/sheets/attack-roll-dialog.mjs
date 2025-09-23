/**
 * Attack Roll Dialog for Anyventure system
 * Handles attack rolls with bonus/penalty dice and optional defense check
 */
export class AnyventureAttackRollDialog extends foundry.applications.api.DialogV2 {

  constructor(options = {}) {
    super({
      window: {
        title: options.title || "Attack Roll",
        contentClasses: ["anyventure-attack-roll-dialog"]
      },
      content: `
        <form>
          <div class="roll-info">
            <h3>${options.weaponName || "Weapon"} Attack</h3>
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

          <div class="form-group">
            <label for="defense-check">Defense Check (optional):</label>
            <input type="number" id="defense-check" name="defenseCheck" value="" placeholder="Enter target's defense roll" min="1" max="50" />
          </div>

          <div class="roll-preview">
            <p><strong>Final Roll:</strong> <span id="final-formula">${options.baseDice}${options.diceType}</span></p>
          </div>
        </form>
      `,
      buttons: [
        {
          action: "roll",
          label: "Attack",
          icon: "fa-solid fa-sword",
          callback: (event, button, dialog) => this.handleAttackRoll(event, button, dialog)
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
    this.weaponName = options.weaponName || "Weapon";
    this.attackData = options.attackData || {};
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

    // For attacks, we roll all dice without keep highest/lowest
    if (netDice > 0) {
      return `${netDice}${this.diceType}`;
    } else if (netDice <= 0) {
      // If penalties exceed base + bonus, roll 1 die
      return `1${this.diceType}`;
    }

    // Fallback
    return `1${this.diceType}`;
  }

  /**
   * Handle the attack roll button click
   */
  async handleAttackRoll(event, button, dialog) {
    const formData = new FormData(dialog.element.querySelector('form'));
    const bonusDice = parseInt(formData.get('bonusDice')) || 0;
    const penaltyDice = parseInt(formData.get('penaltyDice')) || 0;
    const defenseCheck = parseInt(formData.get('defenseCheck')) || null;

    const formula = this.calculateFormula(this.baseDice, bonusDice, penaltyDice);

    // Create the roll
    const roll = new Roll(formula, this.actor?.getRollData() || {});
    await roll.evaluate();

    // Extract individual die results
    const diceResults = [];
    if (roll.terms[0] && roll.terms[0].results) {
      for (let result of roll.terms[0].results) {
        diceResults.push(result.result);
      }
    }

    // Sort dice results in descending order for easier reading
    diceResults.sort((a, b) => b - a);

    // Determine flavor text based on roll type
    let flavorText = `${this.weaponName} Attack`;
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

    // Show individual dice results
    flavorText += `<br><strong>Dice Results:</strong> [${diceResults.join(', ')}]`;

    // Add attack data to flavor text
    if (this.attackData.damage !== undefined) {
      flavorText += `<br><strong>Damage:</strong> [${this.attackData.damage}/${this.attackData.damageExtra}] ${this.attackData.damageType}`;
      if (this.attackData.secondaryDamage > 0) {
        flavorText += `<br><strong>Secondary:</strong> [${this.attackData.secondaryDamage}/${this.attackData.secondaryDamageExtra}] ${this.attackData.secondaryDamageType}`;
      }
    }

    if (this.attackData.energy !== undefined && this.attackData.energy > 0) {
      flavorText += `<br><strong>Energy Cost:</strong> ${this.attackData.energy}`;
    }

    // Handle defense check comparison using highest die result
    let hitResult = "";
    if (defenseCheck !== null) {
      const highestDie = diceResults.length > 0 ? diceResults[0] : 0;
      if (highestDie > defenseCheck) {
        hitResult = `<br><br><strong style="color: #4ade80;">HIT!</strong> Highest Die: ${highestDie} vs Defense: ${defenseCheck}`;
      } else {
        hitResult = `<br><br><strong style="color: #f87171;">MISS!</strong> Highest Die: ${highestDie} vs Defense: ${defenseCheck}`;
      }
    }

    // Send to chat
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: flavorText + hitResult,
      rollMode: game.settings.get('core', 'rollMode'),
    });

    // Call the callback if provided
    if (this.rollCallback) {
      const highestDie = diceResults.length > 0 ? diceResults[0] : 0;
      this.rollCallback(roll, {
        bonusDice,
        penaltyDice,
        defenseCheck,
        diceResults,
        highestDie,
        hit: defenseCheck ? highestDie > defenseCheck : null
      });
    }

    return { roll, bonusDice, penaltyDice, defenseCheck, diceResults };
  }

  /**
   * Static method to show the attack roll dialog
   */
  static async show(options = {}) {
    const dialog = new AnyventureAttackRollDialog(options);
    return dialog.render({ force: true });
  }
}