/**
 * Song Performance Dialog for Anyventure system
 * Allows performing Song or Harmony with bonus/penalty dice, shows full song info
 */

export class AnyventureSongPerformanceDialog extends foundry.applications.api.DialogV2 {

  constructor(options = {}) {
    // Build buttons array
    const buttons = [
      {
        action: 'play-song',
        label: 'Play Song',
        icon: 'fa-solid fa-music',
        callback: (event, button, dialog) => this.handlePerform(event, button, dialog, 'song')
      },
      {
        action: 'play-harmony',
        label: 'Play Harmony',
        icon: 'fa-solid fa-guitar',
        callback: (event, button, dialog) => this.handlePerform(event, button, dialog, 'harmony')
      },
      { action: 'cancel', label: 'Cancel', icon: 'fa-solid fa-times' }
    ];

    super({
      window: {
        title: options.title || 'Perform Song',
        contentClasses: ['anyventure-song-performance-dialog']
      },
      content: `
        <form>
          <div class="song-header">
            <h3>${options.songName || 'Song'}</h3>
            <div class="energy-warning" style="display:none;"></div>
            <div class="song-type">${options.magical ? '<span class="magical-badge">Magical</span>' : ''}</div>
          </div>

          <div class="song-details">
            <div class="details-column">
              <div class="detail-group">
                <h4>Performance</h4>
                <div class="detail-row"><strong>Difficulty:</strong> ${options.difficulty || 'None'}</div>
                <div class="detail-row"><strong>Energy:</strong> ${options.energy || 'None'}</div>
                ${options.magical ? `<div class="detail-row"><strong>Type:</strong> Magical</div>` : ''}
              </div>

            </div>

            <div class="details-column">
              ${options.range ? `
              <div class="detail-group">
                <h4>Range & Duration</h4>
                <div class="detail-row"><strong>Range:</strong> ${options.range}</div>
                ${options.duration ? `<div class="detail-row"><strong>Duration:</strong> ${options.duration}</div>` : ''}
              </div>
              ` : ''}
            </div>
          </div>

          ${options.effect ? `
          <div class="song-text-section">
            <h4>Effect</h4>
            <div class="song-effect">${options.effect}</div>
          </div>
          ` : ''}

          ${options.harmonyEffects ? `
          <div class="song-text-section">
            <h4>Harmony Effects</h4>
            <div class="harmony-effects">${options.harmonyEffects}</div>
          </div>
          ` : ''}

          <div class="performance-options">
            <h4>Performance Options</h4>
            <div class="roll-info">
              <p><strong>Base Roll:</strong> ${options.baseDice}${options.diceType}kh1</p>
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
          </div>
        </form>
      `,
      buttons,
      modal: true,
      ...options
    });

    this.actor = options.actor;
    this.song = options.song;
    this.baseDice = options.baseDice || 1;
    this.diceType = options.diceType || 'd6';
    this.songName = options.songName || 'Song';
    this.energyCost = Number(options.energy) || 0;
    this.difficulty = Number(options.difficulty) || 0;
    this.canPerform = !!options.canPerform;
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

    // Show warning if cannot perform
    if (!this.canPerform) {
      const warnEl = this.element.querySelector('.energy-warning');
      if (warnEl) {
        warnEl.textContent = `Cannot perform this song.`;
        warnEl.style.display = 'block';
        warnEl.setAttribute('role', 'alert');
        warnEl.setAttribute('aria-live', 'polite');
      }
    }

    // Show energy warning if actor lacks energy
    try {
      const currentEnergy = this.actor?.system?.resources?.energy?.value ?? 0;
      if (this.energyCost > 0 && currentEnergy < this.energyCost) {
        const warnEl = this.element.querySelector('.energy-warning');
        if (warnEl) {
          warnEl.textContent = `Not enough energy for this song (requires ${this.energyCost}, you have ${currentEnergy}).`;
          warnEl.style.display = 'block';
          warnEl.setAttribute('role', 'alert');
          warnEl.setAttribute('aria-live', 'polite');
        }
      }
    } catch (_e) {}
  }

  async handlePerform(event, button, dialog, mode) {
    try {
      console.log('[Anyventure] SongPerformanceDialog.handlePerform invoked', {
        mode,
        song: this.songName,
        baseDice: this.baseDice,
        diceType: this.diceType,
        energyCost: this.energyCost,
        difficulty: this.difficulty,
        canPerform: this.canPerform
      });
    } catch (_e) {}

    // Energy check
    const currentEnergy = this.actor?.system?.resources?.energy?.value ?? 0;
    if (this.energyCost > 0 && currentEnergy < this.energyCost) {
      try {
        const warn = dialog.element.querySelector('.energy-warning');
        if (warn) {
          warn.textContent = `Not enough energy for this song (requires ${this.energyCost}, you have ${currentEnergy}).`;
          warn.style.display = 'block';
        }
      } catch (_e) {
        ui.notifications?.warn?.('Not enough energy to perform.');
      }
      console.warn('[Anyventure] Not enough energy to perform', { required: this.energyCost, current: currentEnergy });
      return;
    }

    // Read inputs and build formula
    const formData = new FormData(dialog.element.querySelector('form'));
    const bonusDice = parseInt(formData.get('bonusDice')) || 0;
    const penaltyDice = parseInt(formData.get('penaltyDice')) || 0;
    const formula = calculateSkillFormula(this.baseDice, bonusDice, penaltyDice, this.diceType);

    // Roll
    console.log('[Anyventure] Rolling song performance', { formula });
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
      targetInfo = `<div class="song-targets" style="text-align: center;"><strong>Target${targets.length > 1 ? 's' : ''}:</strong> ${targetNames}</div>`;
    }

    // Build chat card content using ability card styling
    let flavorText = `<div class="anyventure-ability-card">`;
    const harmonyClass = mode === 'harmony' ? ' harmony' : '';
    flavorText += `<div class="ability-name${harmonyClass}"><strong>${this.songName}</strong> ${mode === 'harmony' ? '(Harmony)' : ''}</div>`;

    // Target info
    flavorText += targetInfo;

    // Energy line
    if (this.energyCost > 0) {
      flavorText += `<div class="energy-cost">Energy: ${this.energyCost}</div>`;
    }

    // Results and formula
    flavorText += `<div class="dice-results"><strong>Results:</strong> [${diceResults.join(', ')}]</div>`;
    flavorText += `<div class="formula">Formula: ${describeSkillFormula(this.baseDice, this.diceType, bonusDice, penaltyDice)}</div>`;

    // Show Check and Required lines
    if (this.difficulty > 0) {
      const highest = diceResults[0] || 0;
      const required = this.difficulty;
      const ok = highest >= required;
      flavorText += `<div class="formula" style="margin-top:4px;"><strong>Check Result:</strong> ${highest} ${ok ? '<span style="color:#4ade80;">(SUCCESS)</span>' : '<span style="color:#f87171;">(FAIL)</span>'}</div>`;
      flavorText += `<div class="formula"><strong>Required Check:</strong> ${required}</div>`;

      // On failure, set used flag on the song
      if (!ok && this.song?.update) {
        try {
          await this.song.update({ 'system.used': true });
        } catch (e) {
          console.warn('[Anyventure] Failed to set used flag', e);
        }
      }
    }

    // Song info
    const rows = [];
    if (this.song?.system?.magical) rows.push(`<div class="summary-row"><strong>Type:</strong> Magical</div>`);
    if (this.song?.system?.range) rows.push(`<div class="summary-row"><strong>Range:</strong> ${foundry.utils.escapeHTML(this.song.system.range)}</div>`);
    if (this.song?.system?.duration) rows.push(`<div class="summary-row"><strong>Duration:</strong> ${foundry.utils.escapeHTML(this.song.system.duration)}</div>`);
    if (rows.length) flavorText += `<div class="song-summary">${rows.join('')}</div>`;

    // Effect description
    if (mode === 'song' && this.song?.system?.effect) {
      flavorText += `<div class="ability-description">${this.song.system.effect}</div>`;
    } else if (mode === 'harmony') {
      const harmony1 = this.song?.system?.harmony_1;
      const harmony2 = this.song?.system?.harmony_2;
      if (harmony1?.effect) {
        flavorText += `<div class="ability-description"><strong>${harmony1.instrument} Harmony:</strong><br>${harmony1.effect}</div>`;
      }
      if (harmony2?.effect) {
        flavorText += `<div class="ability-description"><strong>${harmony2.instrument} Harmony:</strong><br>${harmony2.effect}</div>`;
      }
    }

    flavorText += `</div>`;

    // Send to chat
    console.log('[Anyventure] Posting song performance chat card', { mode, diceResults });
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: flavorText,
      rollMode: game.settings.get('core', 'rollMode'),
    });

    // Deduct energy
    if (this.actor && this.energyCost > 0) {
      const newEnergy = Math.max(0, currentEnergy - this.energyCost);
      await this.actor.update({ 'system.resources.energy.value': newEnergy });
      console.log('[Anyventure] Deducted energy for song', { cost: this.energyCost, newEnergy });
    }

    return { roll, bonusDice, penaltyDice, mode, diceResults };
  }

  static async show(options = {}) {
    const dialog = new AnyventureSongPerformanceDialog(options);
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