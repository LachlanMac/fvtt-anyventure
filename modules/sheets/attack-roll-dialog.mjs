function computePenaltyDiceConfig(baseDice, penaltyDice) {
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

/**
 * Attack Roll Dialog for Anyventure system
 * Handles attack rolls with bonus/penalty dice and optional defense check
 */
export class AnyventureAttackRollDialog extends foundry.applications.api.DialogV2 {

  constructor(options = {}) {
    const baseDice = Math.max(Number(options.baseDice) || 1, 1);
    const diceType = options.diceType || "d6";
    const inherentPenalty = Math.max(Number(options.inherentPenalty) || 0, 0);
    const baseConfig = computePenaltyDiceConfig(baseDice, inherentPenalty);
    const baseRollFormula = `${baseConfig.diceCount}${diceType}${baseConfig.keepLowest ? 'kl1' : ''}`;
    const penaltyNote = inherentPenalty > 0
      ? `<p class="penalty-note"><strong>Base Penalty Dice:</strong> ${inherentPenalty}</p>`
      : '';

    super({
      classes: ["anyventure", "anyventure-attack-roll-window"],
      position: { width: 512 },
      window: {
        title: options.title || "Attack Roll",
        contentClasses: ["anyventure-attack-roll-dialog"]
      },
      content: `
        <form>
          <div class="roll-info">
            <h3>${options.weaponName || "Weapon"} Attack</h3>
            <div class="energy-warning" style="display:none;"></div>
            <p><strong>Base Roll:</strong> ${baseRollFormula}</p>
            ${penaltyNote}
          </div>

          <div class="form-group">
            <label for="bonus-dice">Bonus Dice:</label>
            <input type="number" id="bonus-dice" name="bonusDice" value="0" min="0" max="10" />
          </div>

          <div class="form-group">
            <label for="penalty-dice">Penalty Dice (additional):</label>
            <input type="number" id="penalty-dice" name="penaltyDice" value="0" min="0" max="10" />
          </div>

          <div class="form-group">
            <label for="defense-check">Defense Check (optional):</label>
            <input type="number" id="defense-check" name="defenseCheck" value="" placeholder="Enter target's defense roll" min="1" max="50" />
          </div>

          <div class="roll-preview">
            <p><strong>Final Roll:</strong> <span id="final-formula">${baseRollFormula}</span></p>
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

    this.baseDice = baseDice;
    this.diceType = diceType;
    this.weaponName = options.weaponName || "Weapon";
    this.attackData = options.attackData || {};
    this.actor = options.actor;
    this.inherentPenalty = inherentPenalty;
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

    updateFormula();

    // Show energy warning immediately if insufficient
    try {
      const energyCost = Number(this.attackData?.energy) || 0;
      const currentEnergy = this.actor?.system?.resources?.energy?.value ?? 0;
      const warnEl = this.element.querySelector('.energy-warning');
      if (warnEl && energyCost > 0 && currentEnergy < energyCost) {
        warnEl.textContent = `Not enough energy for this attack (requires ${energyCost}, you have ${currentEnergy}).`;
        warnEl.style.display = 'block';
        warnEl.setAttribute('role', 'alert');
        warnEl.setAttribute('aria-live', 'polite');
      }
    } catch (_e) {
      // no-op
    }
  }

  /**
   * Calculate the final dice formula based on bonus/penalty dice
   */
  calculateFormula(baseDice, bonusDice, penaltyDice) {
    const totalPenalty = this.inherentPenalty + penaltyDice;
    const baseWithBonus = Math.max(baseDice + bonusDice, 1);
    const config = computePenaltyDiceConfig(baseWithBonus, totalPenalty);
    const suffix = config.keepLowest ? 'kl1' : '';
    return `${config.diceCount}${this.diceType}${suffix}`;
  }

  /**
   * Handle the attack roll button click
   */
  async handleAttackRoll(event, button, dialog) {
    const formData = new FormData(dialog.element.querySelector('form'));
    const bonusDice = parseInt(formData.get('bonusDice')) || 0;
    const penaltyDice = parseInt(formData.get('penaltyDice')) || 0;
    const defenseCheck = parseInt(formData.get('defenseCheck')) || null;

    // Energy availability check before rolling
    const energyCost = Number(this.attackData?.energy) || 0;
    const currentEnergy = this.actor?.system?.resources?.energy?.value ?? 0;
    if (energyCost > 0 && currentEnergy < energyCost) {
      // Show an inline warning at the top of the dialog (after press)
      try {
        // Prefer using the current dialog instance element
        const root = this.element || dialog.element;
        let warning = root.querySelector('.energy-warning');
        if (!warning) {
          warning = document.createElement('div');
          warning.className = 'energy-warning';
          const container = root.querySelector('form') || root;
          const anchor = root.querySelector('.roll-info');
          if (container && anchor) container.insertBefore(warning, anchor);
          else container.appendChild(warning);
        }
        warning.textContent = `Not enough energy for this attack (requires ${energyCost}, you have ${currentEnergy}).`;
        warning.style.display = 'block';
        warning.setAttribute('role', 'alert');
        warning.setAttribute('aria-live', 'polite');
      } catch (_e) {
        // As a fallback, also notify
        ui.notifications?.warn?.('Not enough energy for this attack.');
      }
      return; // Abort roll
    }

    const totalPenalty = this.inherentPenalty + penaltyDice;
    const baseWithBonus = Math.max(this.baseDice + bonusDice, 1);
    const rollConfig = computePenaltyDiceConfig(baseWithBonus, totalPenalty);
    const suffix = rollConfig.keepLowest ? 'kl1' : '';
    const formula = `${rollConfig.diceCount}${this.diceType}${suffix}`;

    // Create the roll
    const roll = new Roll(formula, this.actor?.getRollData() || {});
    await roll.evaluate();

    // Extract individual die results, preserving discarded state
    const dieTerm = roll.dice?.[0] || roll.terms.find(t => Array.isArray(t?.results));
    const detailedResults = Array.isArray(dieTerm?.results)
      ? dieTerm.results.map(r => ({ result: r.result, discarded: Boolean(r.discarded) }))
      : [];

    const keptResults = detailedResults.filter(r => !r.discarded).map(r => r.result);
    const discardedResults = detailedResults.filter(r => r.discarded).map(r => r.result);

    const diceResultsDisplay = detailedResults.length > 0
      ? detailedResults.map(r => {
          const style = r.discarded ? ' style="color:#f87171;"' : '';
          return `<span${style}>${r.result}</span>`;
        }).join(', ')
      : roll.result;

    const keptResultsSorted = [...keptResults].sort((a, b) => b - a);

    // Build structured flavor text with proper hierarchy
    let flavorText = `<div class="anyventure-attack-card">`;

    // 1. Weapon name (most important - bold and larger)
    flavorText += `<div class="weapon-name"><strong>${this.weaponName}</strong></div>`;

    // 2. Energy cost line (below name, above results)
    if (this.attackData.energy !== undefined) {
      const e = Number(this.attackData.energy) || 0;
      flavorText += `<div class="energy-cost">Energy: `;
      if (e === 0) {
        flavorText += `None`;
      } else {
        for (let i = 0; i < e; i++) flavorText += `<i class="fas fa-star filled"></i>`;
      }
      flavorText += `</div>`;
    }

    // 3. Dice Results
    flavorText += `<div class="dice-results"><strong>Results:</strong> [${diceResultsDisplay}]</div>`;

    // 4. Formula (smaller, less prominent)
    const formulaString = `${rollConfig.diceCount}${this.diceType}${suffix}`;

    const net = bonusDice - totalPenalty;
    let netNote = '';
    if (net < 0) {
      const penaltyCount = Math.abs(net);
      netNote = ` (${penaltyCount} penalty die${penaltyCount === 1 ? '' : 's'})`;
    } else if (net > 0) {
      netNote = ` (+${net} bonus die${net === 1 ? '' : 's'})`;
    }

    flavorText += `<div class="formula">Formula: ${formulaString}${netNote}</div>`;

    // 5. Damage with CSS color classes
    if (this.attackData.damage !== undefined) {
      const damageType = this.attackData.damageType?.text || this.attackData.damageType || 'physical';
      const damageTypeLower = damageType.toLowerCase();
      const damageClass = `damage-type-${damageTypeLower}`;

      flavorText += `<div class="damage-info">`;
      flavorText += `<span class="damage-type ${damageClass}">[${this.attackData.damage}/${this.attackData.damageExtra}] ${damageType}</span>`;

      if (this.attackData.secondaryDamage > 0) {
        const secondaryType = this.attackData.secondaryDamageType?.text || this.attackData.secondaryDamageType || 'physical';
        const secondaryTypeLower = secondaryType.toLowerCase();
        const secondaryClass = `damage-type-${secondaryTypeLower}`;
        flavorText += `<span class="damage-type ${secondaryClass}">[${this.attackData.secondaryDamage}/${this.attackData.secondaryDamageExtra}] ${secondaryType}</span>`;
      }
      flavorText += `</div>`;
    }

    flavorText += `</div>`;

    // Handle defense check comparison using proper dice highlighting
    let hitResult = "";
    if (defenseCheck !== null) {
      // Sort all dice results from highest to lowest for display
      const allResultsSorted = keptResults.slice().sort((a, b) => b - a);

      // Determine crits based on die type
      const getCritThreshold = (diceType) => {
        switch(diceType) {
          case 'd12': return 12;
          case 'd16': return 15;
          case 'd20': return 18;
          case 'd30': return 25;
          default: return null;
        }
      };

      const critThreshold = getCritThreshold(this.diceType);

      // Create colored dice display
      const coloredDice = allResultsSorted.map(result => {
        let color = '#f87171'; // red for failures
        let style = '';

        if (result > defenseCheck) {
          color = '#4ade80'; // green for successes
        }

        if (critThreshold && result >= critThreshold) {
          color = '#87ceeb'; // light blue for crits
          style = 'font-weight: bold;';
        }

        return `<span style="color: ${color}; ${style}">${result}</span>`;
      }).join(', ');

      // Calculate damage if we have damage data
      let damageOutput = '';
      if (this.attackData.damage !== undefined && this.attackData.damageExtra !== undefined) {
        const mainDamage = Number(this.attackData.damage) || 0;
        const extraDamage = Number(this.attackData.damageExtra) || 0;

        // Count hits and crits
        const hits = allResultsSorted.filter(result => result > defenseCheck);
        const crits = allResultsSorted.filter(result => critThreshold && result >= critThreshold);

        if (hits.length > 0) {
          // First hit does main damage, others do extra damage
          let totalDamage = mainDamage;
          if (hits.length > 1) {
            totalDamage += (hits.length - 1) * extraDamage;
          }

          // Add extra damage for crits
          totalDamage += crits.length * extraDamage;

          // Get damage type and CSS class
          const damageType = this.attackData.damageType?.text || this.attackData.damageType || 'physical';
          const damageTypeLower = damageType.toLowerCase();
          const damageClass = `damage-type-${damageTypeLower}`;

          damageOutput = `<br><span class="damage-type ${damageClass}">${totalDamage} ${damageType}</span>`;
        }
      }

      hitResult = `<div style="text-align: center; margin-top: 8px;"><strong>Contested Check:</strong> ${defenseCheck}<br>Results: [${coloredDice}]${damageOutput}</div>`;
    }

    // Send to chat
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: flavorText + hitResult,
      rollMode: game.settings.get('core', 'rollMode'),
    });

    // Deduct energy on successful attack
    if (energyCost > 0 && this.actor) {
      const newEnergy = Math.max(0, currentEnergy - energyCost);
      await this.actor.update({ 'system.resources.energy.value': newEnergy });
    }

    // Call the callback if provided
    if (this.rollCallback) {
      const highestDie = keptResultsSorted.length > 0 ? keptResultsSorted[0] : 0;
      await this.rollCallback(roll, {
        bonusDice,
        penaltyDice,
        defenseCheck,
        diceResults: keptResults,
        discardedResults,
        detailedResults,
        highestDie,
        inherentPenalty: this.inherentPenalty,
        totalPenalty,
        keepLowest: rollConfig.keepLowest,
        hit: defenseCheck ? highestDie > defenseCheck : null
      });
    }

    return { roll, bonusDice, penaltyDice, inherentPenalty: this.inherentPenalty, totalPenalty, defenseCheck, diceResults: keptResults, discardedResults };
  }

  /**
   * Static method to show the attack roll dialog
   */
  static async show(options = {}) {
    const dialog = new AnyventureAttackRollDialog(options);
    return dialog.render({ force: true });
  }
}
