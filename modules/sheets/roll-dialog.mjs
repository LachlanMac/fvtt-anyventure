/**
 * Roll Dialog for Anyventure system
 * Handles bonus/penalty dice mechanics
 */
export class AnyventureRollDialog extends foundry.applications.api.DialogV2 {

  constructor(options = {}) {
    // Use penalty values passed from rollSkill
    const initialPenaltyDice = options.initialPenaltyDice || 0;
    const conditionNotes = options.conditionNotes || [];

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
            <input type="number" id="penalty-dice" name="penaltyDice" value="${initialPenaltyDice}" min="0" max="10" />
          </div>
          
          <div class="roll-preview">
            <p><strong>Final Roll:</strong> <span id="final-formula">${options.baseDice}${options.diceType}kh1</span></p>
          </div>

          ${conditionNotes && conditionNotes.length > 0 ? `
          <div class="condition-notes">
            <p><strong>Conditions:</strong></p>
            <ul>
              ${conditionNotes.map(note => `<li>${note}</li>`).join('')}
            </ul>
          </div>
          ` : ''}
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
          action: "roll1d",
          label: "Roll 1d",
          icon: "fa-solid fa-dice-one",
          callback: (event, button, dialog) => this.handleRoll1d(event, button, dialog)
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
  async _onRender(context, options) {
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
    
    // Extract individual die results for display [x, y, z]
    const diceResults = [];
    if (roll.terms[0] && roll.terms[0].results) {
      for (let result of roll.terms[0].results) {
        diceResults.push(result.result);
      }
    }

    // Sort dice results in descending order for easier reading (match attack card)
    diceResults.sort((a, b) => b - a);

    // Calculate total dice first
    let totalDice = this.baseDice + bonusDice - penaltyDice;

    // Build structured flavor text similar to attack card
    let flavorText = `<div class="anyventure-skill-card">`;

    // 1. Skill name/title with prominent result
    const finalResult = roll.total;
    const isDisadvantage = totalDice <= 0;
    flavorText += `<div class="skill-name"><strong>${this.skillName} Check</strong></div>`;
    flavorText += `<div class="skill-result-display"><span class="skill-result ${isDisadvantage ? 'disadvantage' : ''}">${finalResult}</span></div>`;

    // 2. Dice Results
    flavorText += `<div class=\"dice-results\"><strong>Results:</strong> [${diceResults.join(', ')}]</div>`;

    // 3. Formula summary (mirrors attack formatting and ordering)
    let formulaText;
    let formulaClass = "";

    if (totalDice <= 0) {
      // Disadvantage: show actual dice rolled (penalty dice) in red
      formulaText = `${penaltyDice}${this.diceType}`;
      formulaClass = " class=\"disadvantage-formula\"";
    } else {
      formulaText = `${totalDice}${this.diceType}`;
    }

    if (bonusDice > 0 && penaltyDice === 0) {
      formulaText += ` (+${bonusDice} bonus)`;
    } else if (penaltyDice > 0 && bonusDice === 0) {
      if (totalDice >= 1) {
        formulaText += ` (-${penaltyDice} penalty)`;
      } else {
        formulaText += ` (disadvantage)`;
      }
    } else if (bonusDice > 0 && penaltyDice > 0) {
      const net = bonusDice - penaltyDice;
      if (net > 0) {
        formulaText += ` (net +${net})`;
      } else if (net < 0) {
        formulaText += ` (net ${net})`;
        if (totalDice <= 0) {
          formulaClass = " class=\"disadvantage-formula\"";
        }
      }
    }

    flavorText += `<div class=\"formula\"${formulaClass}>Formula: ${formulaText}</div>`;

    flavorText += `</div>`;

    // Send to chat
    const chatMessage = await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: flavorText,
      rollMode: game.settings.get('core', 'rollMode'),
    });

    // Wait for Dice So Nice animation if the module is active
    if (game.modules.get("dice-so-nice")?.active && game.dice3d) {
      await game.dice3d.waitFor3DAnimationByMessageID(chatMessage.id);
    }

    // Call the callback if provided
    if (this.rollCallback) {
      this.rollCallback(roll, { bonusDice, penaltyDice, messageId: chatMessage.id });
    }

    return { roll, bonusDice, penaltyDice };
  }

  /**
   * Handle the roll 1d button click (ignores bonus/penalty dice)
   */
  async handleRoll1d(event, button, dialog) {
    const formula = `1${this.diceType}`;

    // Create the roll
    const roll = new Roll(formula, this.actor?.getRollData() || {});
    await roll.evaluate();

    // Extract individual die results for display [x]
    const diceResults = [];
    if (roll.terms[0] && roll.terms[0].results) {
      for (let result of roll.terms[0].results) {
        diceResults.push(result.result);
      }
    }

    // Build structured flavor text
    let flavorText = `<div class="anyventure-skill-card">`;

    // 1. Skill name/title with prominent result
    const finalResult = roll.total;
    flavorText += `<div class="skill-name"><strong>${this.skillName} Check (Single Die)</strong></div>`;
    flavorText += `<div class="skill-result-display"><span class="skill-result">${finalResult}</span></div>`;

    // 2. Dice Results
    flavorText += `<div class=\"dice-results\"><strong>Result:</strong> ${diceResults[0]}</div>`;

    // 3. Formula summary
    flavorText += `<div class=\"formula\">Formula: 1${this.diceType} (ignoring bonus/penalty)</div>`;

    flavorText += `</div>`;

    // Send to chat
    const chatMessage = await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: flavorText,
      rollMode: game.settings.get('core', 'rollMode'),
    });

    // Wait for Dice So Nice animation if the module is active
    if (game.modules.get("dice-so-nice")?.active && game.dice3d) {
      await game.dice3d.waitFor3DAnimationByMessageID(chatMessage.id);
    }

    // Call the callback if provided
    if (this.rollCallback) {
      this.rollCallback(roll, { bonusDice: 0, penaltyDice: 0, singleDie: true, messageId: chatMessage.id });
    }

    return { roll, bonusDice: 0, penaltyDice: 0, singleDie: true };
  }

  /**
   * Static method to show the roll dialog
   */
  static async show(options = {}) {
    const dialog = new AnyventureRollDialog(options);
    return dialog.render({ force: true });
  }
}
