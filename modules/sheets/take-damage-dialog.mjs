import { logError, logWarning } from "../utils/logger.js";
import { formatDamageType } from "../utils/formatters.mjs";

export class AnyventureTakeDamageDialog extends foundry.applications.api.DialogV2 {
  constructor(options = {}) {
    const typeOptions = [
      'physical','heat','cold','electric','dark','divine','aether','psychic','toxic','true','resolve','energy'
    ].map(t => `<option value="${t}">${t.charAt(0).toUpperCase()+t.slice(1)}</option>`).join('');
    super({
      window: { title: options.title || 'Take Damage', contentClasses: ['anyventure-damage-dialog'] },
      content: `
        <form class="damage-form">
          <div style="display:grid;grid-template-columns:160px 1fr;gap:6px;align-items:center;">
            <label>Damage</label><input type="number" name="damage" value="0" min="0" />
            <label>Damage Type</label><select name="dtype">${typeOptions}</select>
            <label>Extra Mitigation</label><input type="number" name="extra" value="0" min="0" />
            <label>Condition</label>
              <select name="cond">
                <option value="none">None</option>
                <option value="double">Double Damage</option>
                <option value="half">Half Damage</option>
              </select>
            <label>Apply</label>
              <select name="phase">
                <option value="before">Before Mitigation</option>
                <option value="after">After Mitigation</option>
              </select>
          </div>
        </form>
      `,
      buttons: [
        { action: 'ok', label: 'Apply Damage', icon: 'fa-solid fa-burst', callback: (event, button, dialog) => this._apply(button) },
        { action: 'cancel', label: 'Cancel', icon: 'fa-solid fa-times' }
      ],
      modal: true,
      ...options
    });
    this.actor = options.actor;
    this._applied = false;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    const condSel = this.element.querySelector('select[name="cond"]');
    const phaseSel = this.element.querySelector('select[name="phase"]');
    const phaseLabel = phaseSel?.previousElementSibling;

    const updateApplyVisibility = () => {
      const hide = (condSel?.value || 'none') === 'none';
      if (phaseSel) phaseSel.style.display = hide ? 'none' : '';
      if (phaseLabel) phaseLabel.style.display = hide ? 'none' : '';
    };

    condSel?.addEventListener('change', updateApplyVisibility);
    updateApplyVisibility();
  }

  async _apply(button) {
    if (this._applied) return;

    const num = (name) => Number(button.form.elements[name]?.value || 0) || 0;
    const str = (name) => String(button.form.elements[name]?.value || '');
    const base = num('damage');
    const dtype = str('dtype');
    const extra = num('extra');
    const cond = str('cond');
    const phase = str('phase');

    let preFactor = 1, postFactor = 1;
    if (cond === 'double') (phase === 'before') ? preFactor = 2 : postFactor = 2;
    if (cond === 'half') (phase === 'before') ? preFactor = 0.5 : postFactor = 0.5;

    const mitigations = this.actor.system.mitigation || {};
    const key = dtype;
    const mval = (key === 'resolve' || key === 'energy' || key === 'true') ? 0 : Number(mitigations[key] || 0);

    // Calculate total damage after pre-mitigation modifiers
    const totalDamage = base * preFactor;

    // Calculate mitigation and resistance thresholds
    const mitigation = mval + extra;
    const resistance = mitigation > 0 ? mitigation * 2 : mitigation; // Resistance is mitigation * 2, but if mitigation is negative, resistance equals mitigation

    let finalDmg;
    if (mitigation < 0) {
      // Negative mitigation: take full damage PLUS extra damage equal to the absolute value of mitigation
      finalDmg = Math.round((totalDamage + Math.abs(mitigation)) * postFactor);
    } else if (totalDamage <= mitigation) {
      // Damage is equal to or less than mitigation: take 0 damage
      finalDmg = 0;
    } else if (totalDamage <= resistance) {
      // Damage is greater than mitigation but less than or equal to resistance: take half damage (rounded down)
      finalDmg = Math.floor((totalDamage * 0.5) * postFactor);
    } else {
      // Damage is greater than resistance: take full damage
      finalDmg = Math.round(totalDamage * postFactor);
    }

    finalDmg = Math.max(0, finalDmg);

    // Determine mitigation result for display
    let mitigationResult = 'none';
    if (finalDmg === 0 && totalDamage > 0) {
      mitigationResult = 'fully_mitigated';
    } else if (totalDamage > mitigation && totalDamage <= resistance && finalDmg < totalDamage) {
      mitigationResult = 'resisted';
    }

    // Apply damage using new routing rules
    const damageResults = await this._applyDamageToResources(finalDmg, dtype);

    if (Object.keys(damageResults.updates).length) {
      await this.actor.update(damageResults.updates);
      this.actor.sheet?.render(false);

      // Create damage chat card with enhanced information
      await this._createDamageChatCard(finalDmg, dtype, base, extra, cond, phase, mitigation, mitigationResult, damageResults);
    }
    this._applied = true;
  }

  /**
   * Apply damage to character resources using new routing rules
   */
  async _applyDamageToResources(finalDamage, damageType) {
    const resources = this.actor.system.resources || {};
    const updates = {};
    const damageBreakdown = {
      moraleDamage: 0,
      healthDamage: 0,
      resolveDamage: 0,
      energyDamage: 0
    };

    let remainingDamage = finalDamage;

    // Psychic damage goes directly to Resolve
    if (damageType === 'psychic') {
      const currentResolve = resources.resolve?.value || 0;
      const resolveDeduction = Math.min(remainingDamage, currentResolve);
      damageBreakdown.resolveDamage = resolveDeduction;
      updates['system.resources.resolve.value'] = Math.max(0, currentResolve - resolveDeduction);
      remainingDamage -= resolveDeduction;
    }
    // Resolve and True damage go directly to their targets (no morale priority)
    else if (damageType === 'resolve') {
      const currentResolve = resources.resolve?.value || 0;
      const resolveDeduction = Math.min(remainingDamage, currentResolve);
      damageBreakdown.resolveDamage = resolveDeduction;
      updates['system.resources.resolve.value'] = Math.max(0, currentResolve - resolveDeduction);
      remainingDamage -= resolveDeduction;
    }
    else if (damageType === 'energy') {
      const currentEnergy = resources.energy?.value || 0;
      const energyDeduction = Math.min(remainingDamage, currentEnergy);
      damageBreakdown.energyDamage = energyDeduction;
      updates['system.resources.energy.value'] = Math.max(0, currentEnergy - energyDeduction);
      remainingDamage -= energyDeduction;
    }
    // All other damage types (including true) go through morale first, then health
    else {
      // First, apply to morale (if available and > 0)
      const currentMorale = resources.morale?.value || 0;
      if (currentMorale > 0) {
        const moraleDeduction = Math.min(remainingDamage, currentMorale);
        damageBreakdown.moraleDamage = moraleDeduction;
        updates['system.resources.morale.value'] = Math.max(0, currentMorale - moraleDeduction);
        remainingDamage -= moraleDeduction;
      }

      // Then, apply remaining damage to health
      if (remainingDamage > 0) {
        const currentHealth = resources.health?.value || 0;
        const healthDeduction = Math.min(remainingDamage, currentHealth);
        damageBreakdown.healthDamage = healthDeduction;
        updates['system.resources.health.value'] = Math.max(0, currentHealth - healthDeduction);
        remainingDamage -= healthDeduction;
      }
    }

    return { updates, damageBreakdown, remainingDamage };
  }

  /**
   * Create a damage chat card instead of UI notification
   */
  async _createDamageChatCard(finalDamage, damageType, rawDamage, extraMitigation, condition, phase, mitigation, mitigationResult, damageResults) {
    const damageTypeFormatted = formatDamageType(damageType);

    // Build chat card content using the established card styling
    let cardContent = `<div class="anyventure-damage-card">`;

    // Main damage header
    cardContent += `<div class="damage-header">`;
    cardContent += `<div class="character-name"><strong>${this.actor.name}</strong> has taken damage</div>`;
    cardContent += `<div class="damage-amount">`;
    cardContent += `<span class="damage-type ${damageTypeFormatted.cssClass}">${finalDamage} ${damageTypeFormatted.text}</span>`;
    cardContent += `</div>`;

    // Show resource breakdown
    cardContent += `<div class="resource-breakdown">`;
    if (damageResults.damageBreakdown.moraleDamage > 0) {
      cardContent += `<div class="resource-line">Morale: -${damageResults.damageBreakdown.moraleDamage}</div>`;
    }
    if (damageResults.damageBreakdown.healthDamage > 0) {
      cardContent += `<div class="resource-line">Health: -${damageResults.damageBreakdown.healthDamage}</div>`;
    }
    if (damageResults.damageBreakdown.resolveDamage > 0) {
      cardContent += `<div class="resource-line">Resolve: -${damageResults.damageBreakdown.resolveDamage}</div>`;
    }
    if (damageResults.damageBreakdown.energyDamage > 0) {
      cardContent += `<div class="resource-line">Energy: -${damageResults.damageBreakdown.energyDamage}</div>`;
    }
    cardContent += `</div>`;
    cardContent += `</div>`;

    // Details section - show mitigation and other details
    const hasDetails = rawDamage !== finalDamage || extraMitigation > 0 || condition !== 'none' || mitigation > 0 || mitigationResult !== 'none';
    if (hasDetails) {
      cardContent += `<div class="damage-details">`;

      // Mitigation information (always show if there's any mitigation)
      if (mitigation > 0) {
        cardContent += `<div class="detail-line">Mitigation: ${mitigation}`;
        if (mitigationResult === 'fully_mitigated') {
          cardContent += ` <span class="mitigation-result fully-mitigated">(Fully Mitigated)</span>`;
        } else if (mitigationResult === 'resisted') {
          cardContent += ` <span class="mitigation-result resisted">(Resisted - Half Damage)</span>`;
        }
        cardContent += `</div>`;
      }

      // Raw damage (only if different from final)
      if (rawDamage !== finalDamage) {
        cardContent += `<div class="detail-line">Raw Damage: ${rawDamage}</div>`;
      }

      // Extra mitigation (only if > 0)
      if (extraMitigation > 0) {
        cardContent += `<div class="detail-line">Extra Mitigation: ${extraMitigation}</div>`;
      }

      // Condition (only if not 'none')
      if (condition !== 'none') {
        const conditionText = condition === 'double' ? 'Double Damage' : 'Half Damage';
        const phaseText = phase === 'before' ? 'Before Mitigation' : 'After Mitigation';
        cardContent += `<div class="detail-line">Condition: ${conditionText} (${phaseText})</div>`;
      }

      cardContent += `</div>`;
    }

    cardContent += `</div>`;

    // Create and send the chat message
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: cardContent,
      type: CONST.CHAT_MESSAGE_TYPES.OTHER,
      rollMode: game.settings.get('core', 'rollMode'),
    });
  }

  static async show(options = {}) { const d = new AnyventureTakeDamageDialog(options); return d.render({ force: true }); }
}
