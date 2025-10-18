/**
 * Spell Cast Dialog for Anyventure system
 * Allows Channel or Charge with bonus/penalty dice, shows full spell info
 */
import { formatDamageType } from '../utils/formatters.mjs';

export class AnyventureSpellCastDialog extends foundry.applications.api.DialogV2 {

  constructor(options = {}) {
    // Get initial penalty dice and condition notes
    const initialPenaltyDice = options.initialPenaltyDice || 0;
    const conditionNotes = options.conditionNotes || [];

    // Check if actor has mana available
    const hasMana = options.actor?.system?.resources?.mana?.value > 0;

    // Build buttons array dynamically to optionally insert Mana Channel
    const buttons = [
      {
        action: 'channel',
        label: 'Channel',
        icon: 'fa-solid fa-hat-wizard',
        callback: (event, button, dialog) => this.handleCast(event, button, dialog, 'channel')
      },
      {
        action: 'charge',
        label: 'Charge',
        icon: 'fa-solid fa-bolt',
        callback: (event, button, dialog) => this.handleCast(event, button, dialog, 'charge')
      }
    ];

    // Add mana channeling option if actor has mana
    if (hasMana) {
      buttons.splice(1, 0, { // Insert after Channel but before Charge
        action: 'mana-channel',
        label: 'Channel (Mana)',
        icon: 'fa-solid fa-sparkles',
        callback: (event, button, dialog) => this.handleCast(event, button, dialog, 'mana-channel')
      });
    }
    if (options.isFizzled) {
      buttons.push({
        action: 'unfizzle',
        label: 'Unfizzle',
        icon: 'fa-solid fa-undo',
        callback: (event, button, dialog) => this.handleUnfizzle(event, button, dialog)
      });
    }
    buttons.push({ action: 'cancel', label: 'Cancel', icon: 'fa-solid fa-times' });

    super({
      window: {
        title: options.title || 'Cast Spell',
        contentClasses: ['anyventure-spell-cast-dialog']
      },
      content: `
        <form>
          <div class="spell-header">
            <h3>${options.spellName || 'Spell'}</h3>
            <div class="energy-warning" style="display:none;"></div>
            ${options.school ? `<div class="spell-school"><strong>School:</strong> ${options.school}${options.subschool ? ` (${options.subschool})` : ''}</div>` : ''}
          </div>

          <div class="spell-details">
            <div class="details-column">
              <div class="detail-group">
                <h4>Casting</h4>
                <div class="detail-row"><strong>Energy:</strong> ${renderEnergy(options.energy)}</div>
                <div class="detail-row"><strong>Check to Cast:</strong> ${options.checkToCast || 'None'}</div>
                ${options.concentration ? `<div class="detail-row"><strong>Concentration:</strong> Yes</div>` : ''}
                ${options.reaction ? `<div class="detail-row"><strong>Reaction:</strong> ${options.reaction}</div>` : ''}
              </div>

              ${(options.range || options.duration || options.ritualDuration) ? `
              <div class="detail-group">
                <h4>Range & Duration</h4>
                ${options.range ? `<div class="detail-row"><strong>Range:</strong> ${options.range}</div>` : ''}
                ${options.duration ? `<div class="detail-row"><strong>Duration:</strong> ${options.duration}</div>` : ''}
                ${options.ritualDuration ? `<div class="detail-row"><strong>Ritual Duration:</strong> ${options.ritualDuration}</div>` : ''}
              </div>
              ` : ''}
            </div>

            <div class="details-column">
              ${(options.damage && options.damageType) ? `
              <div class="detail-group">
                <h4>Damage</h4>
                ${renderDamage(options.damage, options.damageType)}
              </div>
              ` : ''}

              ${(options.components && Array.isArray(options.components) && options.components.length > 0) ? `
              <div class="detail-group">
                <h4>Components</h4>
                <div class="detail-row">${options.components.filter(Boolean).join(', ')}</div>
              </div>
              ` : ''}
            </div>
          </div>

          ${options.description ? `
          <div class="spell-text-section">
            <h4>Description</h4>
            <div class="spell-description">${options.description}</div>
          </div>
          ` : ''}

          ${options.charge ? `
          <div class="spell-text-section">
            <h4>Charge Effect</h4>
            <div class="spell-charge">${options.charge}</div>
          </div>
          ` : ''}

          <div class="casting-options">
            <h4>Casting Options</h4>
            <div class="roll-info">
              <p><strong>Base Roll:</strong> ${options.baseDice}${options.diceType}kh1</p>
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
          </div>
        </form>
      `,
      buttons,
      modal: true,
      ...options
    });

    this.actor = options.actor;
    this.spell = options.spell;
    this.baseDice = options.baseDice || 1;
    this.diceType = options.diceType || 'd6';
    this.spellName = options.spellName || 'Spell';
    this.energyCost = Number(options.energy) || 0;
    this.checkToCast = Number(options.checkToCast) || 0;
    this.canChannel = !!options.canChannel;
    this.isFizzled = !!options.isFizzled;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    // Update formula live
    const bonusInput = this.element.querySelector('#bonus-dice');
    const penaltyInput = this.element.querySelector('#penalty-dice');
    const formulaDisplay = this.element.querySelector('#final-formula');
    const updateFormula = () => {
      const bonus = parseInt(bonusInput.value) || 0;
      const penalty = parseInt(penaltyInput.value) || 0;
      const formula = calculateSkillFormula(this.baseDice, bonus, penalty, this.diceType);
      formulaDisplay.textContent = formula;
    };
    bonusInput.addEventListener('input', updateFormula);
    penaltyInput.addEventListener('input', updateFormula);

    // Show channel warning if cannot channel (only if check is very high relative to max possible roll)
    const maxPossibleRoll = this.diceType.substring(1); // Remove 'd' prefix
    const reasonableSuccess = this.checkToCast <= Math.floor(maxPossibleRoll * 0.6); // 60% of max die value
    if (this.checkToCast > 0 && !reasonableSuccess) {
      const warnEl = this.element.querySelector('.energy-warning');
      if (warnEl) {
        warnEl.textContent = `Difficult Channel: check of ${this.checkToCast} required with max die value of ${maxPossibleRoll}.`;
        warnEl.style.display = 'block';
        warnEl.setAttribute('role', 'alert');
        warnEl.setAttribute('aria-live', 'polite');
      }
    }

    // Spell slots are display-only now; no gating warning here

    // Show energy warning immediately if actor lacks energy for this spell
    // but only if they also don't have mana available as an alternative
    try {
      const currentEnergy = this.actor?.system?.resources?.energy?.value ?? 0;
      const currentMana = this.actor?.system?.resources?.mana?.value ?? 0;
      const hasManaAlternative = currentMana > 0;

      if (this.energyCost > 0 && currentEnergy < this.energyCost && !hasManaAlternative) {
        const warnEl = this.element.querySelector('.energy-warning');
        if (warnEl) {
          warnEl.textContent = `Not enough energy for this spell (requires ${this.energyCost}, you have ${currentEnergy}).`;
          warnEl.style.display = 'block';
          warnEl.setAttribute('role', 'alert');
          warnEl.setAttribute('aria-live', 'polite');
        }
      }
    } catch (_e) {}
  }

  async handleCast(event, button, dialog, mode) {
    try {
      console.log('[Anyventure] SpellCastDialog.handleCast invoked', {
        mode,
        spell: this.spellName,
        baseDice: this.baseDice,
        diceType: this.diceType,
        energyCost: this.energyCost,
        checkToCast: this.checkToCast,
        canChannel: this.canChannel
      });
    } catch (_e) {}
    // Energy/Mana check
    const currentEnergy = this.actor?.system?.resources?.energy?.value ?? 0;
    const currentMana = this.actor?.system?.resources?.mana?.value ?? 0;

    if (mode === 'mana-channel') {
      // For mana channeling, check mana instead of energy
      if (currentMana < 1) {
        try {
          const warn = dialog.element.querySelector('.energy-warning');
          if (warn) {
            warn.textContent = `Not enough mana for this spell (requires 1, you have ${currentMana}).`;
            warn.style.display = 'block';
          }
        } catch (_e) {
          ui.notifications?.warn?.('Not enough mana to cast.');
        }
        console.warn('[Anyventure] Not enough mana to cast', { required: 1, current: currentMana });
        return;
      }
    } else {
      // For normal channeling, check energy
      if (this.energyCost > 0 && currentEnergy < this.energyCost) {
        try {
          const warn = dialog.element.querySelector('.energy-warning');
          if (warn) {
            warn.textContent = `Not enough energy for this spell (requires ${this.energyCost}, you have ${currentEnergy}).`;
            warn.style.display = 'block';
          }
        } catch (_e) {
          ui.notifications?.warn?.('Not enough energy to cast.');
        }
        console.warn('[Anyventure] Not enough energy to cast', { required: this.energyCost, current: currentEnergy });
        return;
      }
    }

    // No spell slot gating — display only

    // Read inputs and build formula
    const formData = new FormData(dialog.element.querySelector('form'));
    const bonusDice = parseInt(formData.get('bonusDice')) || 0;
    const penaltyDice = parseInt(formData.get('penaltyDice')) || 0;
    const formula = calculateSkillFormula(this.baseDice, bonusDice, penaltyDice, this.diceType);

    // Roll
    console.log('[Anyventure] Rolling spell', { formula });
    const roll = new Roll(formula, this.actor?.getRollData() || {});
    await roll.evaluate();

    // Extract dice results from first dice term
    const diceResults = [];
    const die = roll.dice?.[0];
    if (die?.results) diceResults.push(...die.results.map(r => r.result));
    diceResults.sort((a, b) => b - a);

    // Get targeted tokens
    const targets = Array.from(game.user.targets);
    let targetInfo = '';
    if (targets.length > 0) {
      const targetNames = targets.map(t => t.document.name).join(', ');
      targetInfo = `<div class="spell-targets" style="text-align: center;"><strong>Target${targets.length > 1 ? 's' : ''}:</strong> ${targetNames}</div>`;
    }

    // Build chat card content using ability card styling
    let flavorText = `<div class="anyventure-ability-card">`;
    const chargedClass = mode === 'charge' ? ' charged' : '';
    flavorText += `<div class="ability-name${chargedClass}"><strong>${this.spellName}</strong></div>`;

    // Target info
    flavorText += targetInfo;

    // Energy/Mana line
    if (mode === 'mana-channel') {
      flavorText += `<div class="energy-cost">Mana: 1</div>`;
    } else {
      flavorText += `<div class="energy-cost">Energy: ${renderEnergy(this.energyCost)}</div>`;
    }

    // Results and formula
    flavorText += `<div class="dice-results"><strong>Results:</strong> [${diceResults.join(', ')}]</div>`;
    flavorText += `<div class="formula">Formula: ${describeSkillFormula(this.baseDice, this.diceType, bonusDice, penaltyDice)}</div>`;

    // Show Check and Required lines (Channel or Charge). Charge increases required by +2
    if (this.checkToCast > 0) {
      const highest = diceResults[0] || 0;
      const required = this.checkToCast + (mode === 'charge' ? 2 : 0);
      const ok = highest >= required;
      const requiredDisplay = mode === 'charge' ? `${this.checkToCast} + 2 (Charge) = ${required}` : `${required}`;
      flavorText += `<div class="formula" style="margin-top:4px;"><strong>Check Result:</strong> ${highest} ${ok ? '<span style="color:#4ade80;">(SUCCESS)</span>' : '<span style="color:#f87171;">(FAIL)</span>'}</div>`;
      flavorText += `<div class="formula"><strong>Required Check:</strong> ${requiredDisplay}</div>`;
      // On failure, set fizzle flag on the spell
      if (!ok && this.spell?.update) {
        try {
          await this.spell.update({ 'system.fizzled': true });
        } catch (e) {
          console.warn('[Anyventure] Failed to set fizzle flag', e);
        }
      }
    }

    // Summary rows (concentration, ritual, duration)
    const rows = [];
    if (this.spell?.system?.concentration) rows.push(`<div class="summary-row"><strong>Concentration:</strong> Yes</div>`);
    if (this.spell?.system?.ritualDuration) rows.push(`<div class="summary-row"><strong>Ritual:</strong> ${foundry.utils.escapeHTML(this.spell.system.ritualDuration)}</div>`);
    if (this.spell?.system?.duration) rows.push(`<div class="summary-row"><strong>Duration:</strong> ${foundry.utils.escapeHTML(this.spell.system.duration)}</div>`);
    if (rows.length) flavorText += `<div class="spell-summary">${rows.join('')}</div>`;

    // Damage info (if any)
    const dmg = Number(this.spell?.system?.damage || 0);
    const dmgTypeStr = this.spell?.system?.damageType || '';
    if (dmg > 0 && dmgTypeStr) {
      const f = formatDamageType(dmgTypeStr);
      flavorText += `<div class="damage-info"><span class="damage-type ${f.cssClass}">${dmg} ${f.text}</span></div>`;
    }

    // Description
    if (this.spell?.system?.description) {
      flavorText += `<div class="ability-description">${this.spell.system.description}</div>`;
    }

    // Charge effect (always show if it exists)
    if (this.spell?.system?.charge) {
      flavorText += `<div class="ability-description"><strong>Charge Effect:</strong><br>${this.spell.system.charge}</div>`;
    }

    // Components list (array) under Charge Effect
    const comps = Array.isArray(this.spell?.system?.components) ? this.spell.system.components.filter(Boolean) : [];
    if (comps.length) {
      const list = comps.map(c => foundry.utils.escapeHTML(String(c))).join(', ');
      flavorText += `<div class="ability-description"><strong>Components:</strong> ${list}</div>`;
    }

    flavorText += `</div>`;

    // Send to chat
    console.log('[Anyventure] Posting spell chat card', { mode, diceResults });
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: flavorText,
      rollMode: game.settings.get('core', 'rollMode'),
    });

    // Deduct energy or mana
    if (this.actor) {
      if (mode === 'mana-channel') {
        // Deduct 1 mana
        const newMana = Math.max(0, currentMana - 1);
        await this.actor.update({ 'system.resources.mana.value': newMana });
        console.log('[Anyventure] Deducted mana for spell', { cost: 1, newMana });
      } else if (this.energyCost > 0) {
        // Deduct energy
        const newEnergy = Math.max(0, currentEnergy - this.energyCost);
        await this.actor.update({ 'system.resources.energy.value': newEnergy });
        console.log('[Anyventure] Deducted energy for spell', { cost: this.energyCost, newEnergy });
      }
    }

    // No spell slot deductions — display only

    return { roll, bonusDice, penaltyDice, mode, diceResults };
  }

  async handleUnfizzle(event, button, dialog) {
    try {
      if (this.spell?.update) {
        await this.spell.update({ 'system.fizzled': false });
        this.isFizzled = false;
      }
    } catch (e) {
      console.warn('[Anyventure] Failed to unfizzle spell', e);
    }
  }

  static async show(options = {}) {
    const dialog = new AnyventureSpellCastDialog(options);
    return dialog.render({ force: true });
  }
}

function calculateSkillFormula(baseDice, bonusDice, penaltyDice, diceType) {
  const netDice = (baseDice || 1) + (bonusDice || 0) - (penaltyDice || 0);

  // Case 1: Net dice > 1 - roll multiple, keep highest
  if (netDice > 1) {
    return `${netDice}${diceType}kh1`;
  }

  // Case 2: Net dice is exactly 1 - roll 1 die
  if (netDice === 1) {
    return `1${diceType}`;
  }

  // Case 3: Net dice is 0 - roll 1 die (can't go below 1)
  if (netDice === 0) {
    return `1${diceType}`;
  }

  // Case 4: Net dice is negative - roll penalty dice, keep lowest
  const penaltiesPastFloor = (penaltyDice || 0) - ((baseDice || 1) + (bonusDice || 0) - 1);
  const diceToRoll = 1 + penaltiesPastFloor;

  if (diceToRoll === 1) {
    return `1${diceType}`;
  }
  return `${diceToRoll}${diceType}kl1`;
}

function describeSkillFormula(base, diceType, bonus, penalty) {
  const netDice = (base || 1) + (bonus || 0) - (penalty || 0);
  let s;

  // Determine what was actually rolled
  if (netDice > 1) {
    // Multiple dice
    s = `${netDice}${diceType}`;
  } else if (netDice >= 0) {
    // Single die (net was 0 or 1)
    s = `1${diceType}`;
  } else {
    // Keep lowest scenario
    const penaltiesPastFloor = (penalty || 0) - ((base || 1) + (bonus || 0) - 1);
    const totalDiceRolled = 1 + penaltiesPastFloor;
    s = `${totalDiceRolled}${diceType} (keep lowest)`;
  }

  // Add bonus/penalty notation
  if ((bonus || 0) > 0 && (penalty || 0) === 0) {
    s += ` | +${bonus} bonus`;
  } else if ((penalty || 0) > 0 && (bonus || 0) === 0) {
    s += ` | -${penalty} penalty`;
  } else if ((bonus || 0) > 0 && (penalty || 0) > 0) {
    s += ` | +${bonus} bonus, -${penalty} penalty`;
  }

  return s;
}

function renderEnergy(energy) {
  const e = Number(energy) || 0;
  if (e === 0) return 'None';
  return Array.from({ length: e }).map(() => '<i class="fas fa-star filled"></i>').join('');
}

function renderDamage(dmg, dmgType) {
  const amount = Number(dmg || 0);
  if (!amount || !dmgType) return '';
  const f = formatDamageType(dmgType);
  return `<div class="summary-row"><strong>Damage:</strong> <span class="damage-type ${f.cssClass}">${amount} ${f.text}</span></div>`;
}
