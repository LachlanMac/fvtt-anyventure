/**
 * Roll Dialog for Anyventure system
 * Handles bonus/penalty dice mechanics
 */
export class AnyventureRollDialog extends foundry.applications.api.DialogV2 {

  constructor(options = {}) {
    // Use penalty/bonus values passed from rollSkill
    const initialPenaltyDice = options.initialPenaltyDice || 0;
    const initialBonusDice = options.initialBonusDice || 0;
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
            <input type="number" id="bonus-dice" name="bonusDice" value="${initialBonusDice}" min="0" max="10" />
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
   *
   * Anyventure Penalty Dice Rules:
   * - Bonus dice ADD to your pool
   * - Penalty dice SUBTRACT from your pool
   * - You can't go below 1 die, but penalties past that point add "keep lowest" dice
   *
   * The math:
   * - netDice = base + bonus - penalty
   * - If netDice >= 1: Roll netDice, keep highest
   * - If netDice <= 0: Roll (1 - netDice) dice, keep lowest
   *
   * Examples:
   * - 3 talent, +0 penalty: net=3, roll 3d10 kh1
   * - 3 talent, +2 penalty: net=1, roll 1d10
   * - 2 talent, +1 penalty: net=1, roll 1d10
   * - 1 talent, +0 penalty: net=1, roll 1d10
   * - 1 talent, +1 penalty: net=0, roll (1-0)=1 dice... NO! roll 2 kl1!
   *   Actually: when net=0, we're at minimum (1 die) but the penalty still applies
   *   So we need: 1 base die + 1 penalty die = 2 dice kl1
   * - 1 talent, +2 penalty: net=-1, roll (1-(-1))=2... that's 2 dice kl1? Let me think...
   *   base=1, penalty=2, so we subtract 1 die (down to 0, which is minimum 1)
   *   but we still have 1 more penalty left over, so: 1 + 1 = 2 dice kl1 ✓
   * - 3 talent, +4 penalty: net=-1, roll (1-(-1))=2 dice kl1 ✓
   *
   * So the formula when netDice <= 0 is: roll (1 - netDice) dice, keep lowest
   * Because (1 - netDice) = 1 + |netDice| when netDice is negative or zero
   */
  calculateFormula(baseDice, bonusDice, penaltyDice) {
    let netDice = baseDice + bonusDice - penaltyDice;

    // Case 1: Net dice > 1 - roll multiple, keep highest
    if (netDice > 1) {
      return `${netDice}${this.diceType}kh1`;
    }

    // Case 2: Net dice is exactly 1 - roll 1 die
    if (netDice === 1) {
      return `1${this.diceType}`;
    }

    // Case 3: Net dice is 0 or negative - roll penalty dice, keep lowest
    // When you hit the minimum (1 die) but still have penalties, those penalties
    // manifest as additional dice rolled with "keep lowest"
    //
    // The formula: When netDice <= 0, roll (1 + |netDice| + 1) dice, keep lowest
    // Wait no... let me think step by step:
    //
    // 1 talent, 1 penalty: net = 0
    //   - You tried to remove 1 die from 1 die = 0 dice (but minimum is 1)
    //   - You hit the minimum with 0 "extra" penalties? No!
    //   - The penalty that brought you to 0 IS the extra penalty
    //   - So roll 1 (base minimum) + 1 (the penalty) = 2 dice kl1
    //
    // 1 talent, 2 penalty: net = -1
    //   - You tried to remove 2 dice from 1 die = -1 dice
    //   - First penalty brings you to 0 (minimum), second penalty adds to "keep lowest"
    //   - So roll 1 (base minimum) + 2 (both penalties) = 3 dice kl1
    //
    // Formula: 1 + (base + bonus) dice, but that's not quite right either...
    //
    // Actually simpler: roll (1 + number of total penalties that would take you below 1)
    // When netDice = 0: 1 penalty took you to minimum, so roll 1 + 1 = 2 dice
    // When netDice = -1: 2 penalties (1 to minimum, 1 extra), so roll 1 + 2 = 3 dice
    // When netDice = -2: 3 penalties, so roll 1 + 3 = 4 dice
    //
    // So: diceToRoll = 1 + (penalties needed to get to 0) = 1 + (baseDice + bonusDice)
    // But actually that's just: 1 + penaltyDice when netDice <= 0? No...
    //
    // Let me use the formula: when netDice <= 0, we want penalties that push past minimum
    // That's: penaltyDice - (baseDice + bonusDice - 1)
    // = penaltyDice - baseDice - bonusDice + 1
    // = 1 - (baseDice + bonusDice - penaltyDice)
    // = 1 - netDice
    // But when netDice = 0, this gives 1, not 2!
    //
    // OH! The issue is that when netDice = 0, you're AT the minimum with penalties applied.
    // Those penalties need to manifest! So we need: 1 (minimum) + penalties = 1 + penaltyDice
    // But that doesn't account for bonus dice...
    //
    // Final answer: when netDice <= 0, the number of "extra" penalties is:
    // penaltyDice - (baseDice + bonusDice - 1) = excess penalties
    // No wait, let me think about it as: how many penalties push you past the 1-die floor?
    // = penaltyDice - (baseDice + bonusDice - 1)
    // When base=1, bonus=0, penalty=1: 1 - (1 + 0 - 1) = 1 - 0 = 1 penalty past floor
    // So roll 1 + 1 = 2 dice ✓
    //
    // Let me just compute this directly:
    const penaltiesPastFloor = penaltyDice - (baseDice + bonusDice - 1);
    const diceToRoll = 1 + penaltiesPastFloor;

    if (diceToRoll === 1) {
      return `1${this.diceType}`;
    }
    return `${diceToRoll}${this.diceType}kl1`;
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

    // Calculate net dice
    let netDice = this.baseDice + bonusDice - penaltyDice;

    // Build structured flavor text similar to attack card
    let flavorText = `<div class="anyventure-skill-card">`;

    // 1. Skill name/title with prominent result
    const finalResult = roll.total;
    const isKeepLowest = netDice < 0;
    flavorText += `<div class="skill-name"><strong>${this.skillName} Check</strong></div>`;
    flavorText += `<div class="skill-result-display"><span class="skill-result ${isKeepLowest ? 'penalty-extreme' : ''}">${finalResult}</span></div>`;

    // 2. Dice Results
    flavorText += `<div class=\"dice-results\"><strong>Results:</strong> [${diceResults.join(', ')}]</div>`;

    // 3. Formula summary
    let formulaText;
    let formulaClass = "";

    // Determine what was actually rolled
    if (netDice > 1) {
      // Multiple dice
      formulaText = `${netDice}${this.diceType}`;
    } else if (netDice >= 0) {
      // Single die (net was 0 or 1)
      formulaText = `1${this.diceType}`;
    } else {
      // Keep lowest scenario
      const extraPenalties = Math.abs(netDice);
      const totalDiceRolled = 1 + extraPenalties;
      formulaText = `${totalDiceRolled}${this.diceType} (keep lowest)`;
      formulaClass = " class=\"penalty-formula\"";
    }

    // Add bonus/penalty notation
    if (bonusDice > 0 && penaltyDice === 0) {
      formulaText += ` | +${bonusDice} bonus`;
    } else if (penaltyDice > 0 && bonusDice === 0) {
      formulaText += ` | -${penaltyDice} penalty`;
    } else if (bonusDice > 0 && penaltyDice > 0) {
      formulaText += ` | +${bonusDice} bonus, -${penaltyDice} penalty`;
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
