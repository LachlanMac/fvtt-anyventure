import { logError, logWarning } from "../utils/logger.js";

export class AnyventureRecoverResourcesDialog extends foundry.applications.api.DialogV2 {
  constructor(options = {}) {
    super({
      window: { title: options.title || 'Recover Resources', contentClasses: ['anyventure-recover-dialog'] },
      content: `
        <form class="recover-form">
          <div style="display:grid;grid-template-columns:120px 1fr;gap:6px;align-items:center;">
            <label>Health</label><input type="number" name="health" value="0" min="0" />
            <label>Resolve</label><input type="number" name="resolve" value="0" min="0" />
            <label>Morale</label><input type="number" name="morale" value="0" min="0" />
            <label>Energy</label><input type="number" name="energy" value="0" min="0" />
          </div>
        </form>
      `,
      buttons: [
        { action: 'ok', label: 'Recover', icon: 'fa-solid fa-heart', callback: (event, button, dialog) => this._apply(button) },
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

    const get = (name) => Number(button.form.elements[name]?.value || 0) || 0;
    const delta = {
      health: get('health'),
      resolve: get('resolve'),
      morale: get('morale'),
      energy: get('energy')
    };

    const res = this.actor.system.resources || {};
    const up = {};
    const logs = [];

    if (res.health) {
      const cur = res.health.value || 0;
      const max = res.health.max || 0;
      const nv = Math.min(cur + delta.health, max);
      up['system.resources.health.value'] = nv;
      logs.push(`Health: +${delta.health} (${cur} → ${nv}, max ${max})`);
    }
    if (res.resolve) {
      const cur = res.resolve.value || 0;
      const max = res.resolve.max || 0;
      const nv = Math.min(cur + delta.resolve, max);
      up['system.resources.resolve.value'] = nv;
      logs.push(`Resolve: +${delta.resolve} (${cur} → ${nv}, max ${max})`);
    }
    if (res.morale) {
      const cur = res.morale.value || 0;
      const max = res.morale.max || 0;
      const nv = Math.min(cur + delta.morale, max);
      up['system.resources.morale.value'] = nv;
      logs.push(`Morale: +${delta.morale} (${cur} → ${nv}, max ${max})`);
    }
    if (res.energy) {
      const cur = res.energy.value || 0;
      const max = res.energy.max || 0;
      const nv = Math.min(cur + delta.energy, max);
      up['system.resources.energy.value'] = nv;
      logs.push(`Energy: +${delta.energy} (${cur} → ${nv}, max ${max})`);
    }

    if (Object.keys(up).length) {
      await this.actor.update(up);
      this.actor.sheet?.render(false);
      ui.notifications?.info?.(`Recovered: ${logs.join(' | ')}`);
    }
    this._applied = true;
  }

  static async show(options = {}) {
    const d = new AnyventureRecoverResourcesDialog(options);
    return d.render({ force: true });
  }
}
