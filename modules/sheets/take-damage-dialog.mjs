import { logError, logWarning } from "../utils/logger.js";

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
      // Damage is greater than mitigation but less than or equal to resistance: take half damage
      finalDmg = Math.round((totalDamage * 0.5) * postFactor);
    } else {
      // Damage is greater than resistance: take full damage
      finalDmg = Math.round(totalDamage * postFactor);
    }

    finalDmg = Math.max(0, finalDmg);

    const up = {};
    if (dtype === 'resolve') {
      const cur = this.actor.system.resources?.resolve?.value || 0;
      up['system.resources.resolve.value'] = Math.max(0, cur - finalDmg);
    } else if (dtype === 'energy') {
      const cur = this.actor.system.resources?.energy?.value || 0;
      up['system.resources.energy.value'] = Math.max(0, cur - finalDmg);
    } else {
      const cur = this.actor.system.resources?.health?.value || 0;
      up['system.resources.health.value'] = Math.max(0, cur - finalDmg);
    }

    if (Object.keys(up).length) {
      await this.actor.update(up);
      this.actor.sheet?.render(false);
      ui.notifications?.warn?.(`Damage: -${finalDmg} to ${dtype === 'resolve' ? 'Resolve' : dtype === 'energy' ? 'Energy' : 'Health'}`);
    }
    this._applied = true;
  }

  static async show(options = {}) { const d = new AnyventureTakeDamageDialog(options); return d.render({ force: true }); }
}
