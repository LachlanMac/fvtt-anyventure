/**
 * Spell Cast Dialog for Anyventure system
 * Allows Channel or Charge with bonus/penalty dice, shows full spell info
 */
import { formatDamageType } from '../utils/formatters.mjs';

export class AnyventureSpellCastDialog extends foundry.applications.api.DialogV2 {

  constructor(options = {}) {
    // Build buttons array dynamically to optionally insert Unfizzle
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
          <div class="roll-info">
            <h3>${options.spellName || 'Spell'}</h3>
            <div class="energy-warning" style="display:none;"></div>
            <p><strong>Base Roll:</strong> ${options.baseDice}${options.diceType}kh1</p>
          </div>

          <div class="spell-summary">
            <div class="summary-row"><strong>Energy:</strong> ${renderEnergy(options.energy)}</div>
            ${options.concentration ? `<div class="summary-row"><strong>Concentration:</strong> Yes</div>` : ''}
            ${options.ritualDuration ? `<div class="summary-row"><strong>Ritual:</strong> ${options.ritualDuration}</div>` : ''}
            ${options.duration ? `<div class="summary-row"><strong>Duration:</strong> ${options.duration}</div>` : ''}
            ${renderDamage(options.damage, options.damageType)}
          </div>

          ${options.description ? `<div class="spell-description">${options.description}</div>` : ''}
          ${options.charge ? `<div class="spell-charge"><strong>Charge Effect:</strong><br>${options.charge}</div>` : ''}

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

    // Show channel warning if cannot channel
    if (!this.canChannel) {
      const warnEl = this.element.querySelector('.energy-warning');
      if (warnEl) {
        warnEl.textContent = `Can’t Channel: insufficient talent or value for required check (${this.checkToCast}).`;
        warnEl.style.display = 'block';
        warnEl.setAttribute('role', 'alert');
        warnEl.setAttribute('aria-live', 'polite');
      }
    }

    // Spell slots are display-only now; no gating warning here

    // Show energy warning immediately if actor lacks energy for this spell
    try {
      const currentEnergy = this.actor?.system?.resources?.energy?.value ?? 0;
      if (this.energyCost > 0 && currentEnergy < this.energyCost) {
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
    ui.notifications?.info?.(`[Anyventure] ${this.spellName}: ${mode} clicked`);
    // Energy check
    const currentEnergy = this.actor?.system?.resources?.energy?.value ?? 0;
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

    // Build chat card content using ability card styling
    let flavorText = `<div class="anyventure-ability-card">`;
    const chargedClass = mode === 'charge' ? ' charged' : '';
    flavorText += `<div class="ability-name${chargedClass}"><strong>${this.spellName}</strong></div>`;
    // Energy line
    flavorText += `<div class="energy-cost">Energy: ${renderEnergy(this.energyCost)}</div>`;

    // Results and formula
    flavorText += `<div class="dice-results"><strong>Results:</strong> [${diceResults.join(', ')}]</div>`;
    flavorText += `<div class="formula">Formula: ${describeSkillFormula(this.baseDice, this.diceType, bonusDice, penaltyDice)}</div>`;

    // Show Check and Required lines (Channel or Charge). Charge increases required by +2
    if (this.checkToCast > 0) {
      const highest = diceResults[0] || 0;
      const required = this.checkToCast + (mode === 'charge' ? 2 : 0);
      const ok = highest >= required;
      flavorText += `<div class="formula" style="margin-top:4px;"><strong>Check:</strong> ${highest}</div>`;
      flavorText += `<div class="formula"><strong>Required:</strong> ${required} ${ok ? '<span style="color:#4ade80;">(SUCCESS)</span>' : '<span style="color:#f87171;">(FAIL)</span>'}</div>`;
      // On failure, set fizzle flag on the spell
      if (!ok && this.spell?.update) {
        try {
          await this.spell.update({ 'system.fizzle': true });
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

    // Description and Charge effect
    if (this.spell?.system?.description) {
      flavorText += `<div class="ability-description">${this.spell.system.description}</div>`;
    }
    if (mode === 'charge' && this.spell?.system?.charge) {
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

    // Deduct energy
    if (this.energyCost > 0 && this.actor) {
      const newEnergy = Math.max(0, currentEnergy - this.energyCost);
      await this.actor.update({ 'system.resources.energy.value': newEnergy });
      console.log('[Anyventure] Deducted energy for spell', { cost: this.energyCost, newEnergy });
    }

    // No spell slot deductions — display only

    return { roll, bonusDice, penaltyDice, mode, diceResults };
  }

  async handleUnfizzle(event, button, dialog) {
    try {
      if (this.spell?.update) {
        await this.spell.update({ 'system.fizzle': false });
        ui.notifications?.info?.('Spell unfizzled.');
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
  if (netDice > 0) return `${netDice}${diceType}kh1`;
  if ((penaltyDice || 0) > 0) return `${penaltyDice}${diceType}kl1`;
  return `1${diceType}`;
}

function describeSkillFormula(base, diceType, bonus, penalty) {
  const total = (base || 1) + (bonus || 0) - (penalty || 0);
  let s = `${total}${diceType}`;
  if ((bonus || 0) > 0 && (penalty || 0) === 0) s += ` (+${bonus} bonus)`;
  else if ((penalty || 0) > 0 && (bonus || 0) === 0) s += total >= 1 ? ` (-${penalty} penalty)` : ` (disadvantage)`;
  else if ((bonus || 0) > 0 && (penalty || 0) > 0) {
    const net = (bonus || 0) - (penalty || 0);
    if (net > 0) s += ` (net +${net})`;
    else if (net < 0) s += ` (net ${net})`;
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
