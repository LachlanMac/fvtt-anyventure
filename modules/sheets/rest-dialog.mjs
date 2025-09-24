export class AnyventureRestDialog extends foundry.applications.api.DialogV2 {
  constructor(options = {}) {
    super({
      window: { title: options.title || 'Take Rest', contentClasses: ['anyventure-rest-dialog'] },
      content: `
        <form class="rest-form">
          <div style="display:grid;grid-template-columns:160px 1fr;gap:6px;align-items:center;">
            <label>Rest Type</label>
            <select name="rtype">
              <option value="favorable">Favorable</option>
              <option value="unfavorable">Unfavorable</option>
            </select>
            <label>Health Bonus</label><input type="number" name="hbonus" value="0" min="0" />
            <label>Resolve Bonus</label><input type="number" name="rbonus" value="0" min="0" />
            <label>Morale Bonus</label><input type="number" name="mbonus" value="0" min="0" />
          </div>
        </form>
      `,
      buttons: [
        { action: 'ok', label: 'Take Rest', icon: 'fa-solid fa-bed', callback: (event, button, dialog) => this._apply(button) },
        { action: 'cancel', label: 'Cancel', icon: 'fa-solid fa-times' }
      ],
      modal: true,
      ...options
    });
    this.actor = options.actor;
    this._applied = false;
  }

  async _apply(button) {
    if (this._applied) return;

    const val = (name) => String(button.form.elements[name]?.value || '');
    const num = (name) => Number(button.form.elements[name]?.value || 0) || 0;

    const type = val('rtype');
    const base = type === 'favorable'
      ? { health: 3, resolve: 1, morale: 0 }
      : { health: 2, resolve: 0, morale: -2 };

    const bonus = { health: num('hbonus'), resolve: num('rbonus'), morale: num('mbonus') };
    const delta = {
      health: base.health + bonus.health,
      resolve: base.resolve + bonus.resolve,
      morale: base.morale + bonus.morale
    };

    const res = this.actor.system.resources || {};
    const up = {};
    const logs = [];
    if (res.health) {
      const cur = res.health.value || 0; const max = res.health.max || 0; const nv = Math.min(cur + delta.health, max);
      up['system.resources.health.value'] = nv; logs.push(`Health: ${delta.health >= 0 ? '+' : ''}${delta.health} (${cur} → ${nv})`);
    }
    if (res.resolve) {
      const cur = res.resolve.value || 0; const max = res.resolve.max || 0; const nv = Math.min(cur + delta.resolve, max);
      up['system.resources.resolve.value'] = nv; logs.push(`Resolve: ${delta.resolve >= 0 ? '+' : ''}${delta.resolve} (${cur} → ${nv})`);
    }
    if (res.morale) {
      const cur = res.morale.value || 0; const max = res.morale.max || 0; const nv = Math.max(0, Math.min(cur + delta.morale, max));
      up['system.resources.morale.value'] = nv; logs.push(`Morale: ${delta.morale >= 0 ? '+' : ''}${delta.morale} (${cur} → ${nv})`);
    }
    console.log('[Anyventure] Rest dialog apply:', type, 'Base', base, 'Bonus', bonus, 'Delta', delta, '|', logs.join(' | '));
    if (Object.keys(up).length) {
      await this.actor.update(up);
      this.actor.sheet?.render(false);
      ui.notifications?.info?.(`Rest (${type}): ${logs.join(' | ')}`);
    }
    this._applied = true;
  }

  static async show(options = {}) { const d = new AnyventureRestDialog(options); return d.render({ force: true }); }
}
