import { logError, logWarning } from "../utils/logger.js";

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

    // Add regen bonuses from actor's resources
    const resources = this.actor.system.resources || {};
    const regenBonus = {
      health: resources.health?.regen || 0,
      resolve: resources.resolve?.regen || 0,
      morale: resources.morale?.regen || 0
    };

    const bonus = { health: num('hbonus'), resolve: num('rbonus'), morale: num('mbonus') };
    const delta = {
      health: base.health + bonus.health + regenBonus.health,
      resolve: base.resolve + bonus.resolve + regenBonus.resolve,
      morale: base.morale + bonus.morale + regenBonus.morale
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
    // Restore mana completely on any rest
    if (res.mana) {
      const cur = res.mana.value || 0; const max = res.mana.max || 0;
      if (cur < max) {
        up['system.resources.mana.value'] = max;
        logs.push(`Mana: fully restored (${cur} → ${max})`);
      }
    }
    // Unfizzle all spells and restore all songs after resting
    let unfizzledSpells = 0;
    let restoredSongs = 0;
    try {
      const fizzledSpells = this.actor.items.filter(item =>
        item.type === 'spell' && item.system?.fizzled === true
      );

      if (fizzledSpells.length > 0) {
        const updates = fizzledSpells.map(spell => ({
          _id: spell.id,
          'system.fizzled': false
        }));

        await this.actor.updateEmbeddedDocuments('Item', updates);
        unfizzledSpells = fizzledSpells.length;
      }
    } catch (e) {
      console.warn('[Anyventure] Failed to unfizzle spells after rest', e);
    }

    try {
      const usedSongs = this.actor.items.filter(item =>
        item.type === 'song' && item.system?.used === true
      );

      if (usedSongs.length > 0) {
        const updates = usedSongs.map(song => ({
          _id: song.id,
          'system.used': false
        }));

        await this.actor.updateEmbeddedDocuments('Item', updates);
        restoredSongs = usedSongs.length;
      }
    } catch (e) {
      console.warn('[Anyventure] Failed to restore songs after rest', e);
    }

    if (Object.keys(up).length) {
      await this.actor.update(up);
      this.actor.sheet?.render(false);

      // Create rest recovery chat card
      await this._createRestRecoveryChatCard(type, delta, up, unfizzledSpells, restoredSongs);
    }

    this._applied = true;
  }

  /**
   * Create a rest recovery chat card instead of UI notification
   */
  async _createRestRecoveryChatCard(restType, delta, updates, unfizzledSpells, restoredSongs) {
    // Build chat card content using the established card styling
    let cardContent = `<div class="anyventure-rest-card">`;

    // Main rest header
    cardContent += `<div class="rest-header">`;
    cardContent += `<div class="character-name"><strong>${this.actor.name}</strong> took a ${restType} rest</div>`;
    cardContent += `</div>`;

    // Recovery breakdown
    cardContent += `<div class="recovery-breakdown">`;

    // Resource recovery
    const resourceRecovery = [];
    if (updates['system.resources.health.value']) {
      const current = this.actor.system.resources?.health?.value || 0;
      const recovered = updates['system.resources.health.value'] - current;
      if (recovered > 0) {
        resourceRecovery.push(`Health: +${recovered}`);
      }
    }

    if (updates['system.resources.resolve.value']) {
      const current = this.actor.system.resources?.resolve?.value || 0;
      const recovered = updates['system.resources.resolve.value'] - current;
      if (recovered > 0) {
        resourceRecovery.push(`Resolve: +${recovered}`);
      }
    }

    if (updates['system.resources.morale.value']) {
      const current = this.actor.system.resources?.morale?.value || 0;
      const change = updates['system.resources.morale.value'] - current;
      if (change !== 0) {
        resourceRecovery.push(`Morale: ${change >= 0 ? '+' : ''}${change}`);
      }
    }

    if (updates['system.resources.mana.value']) {
      const current = this.actor.system.resources?.mana?.value || 0;
      const newValue = updates['system.resources.mana.value'];
      if (newValue > current) {
        resourceRecovery.push(`Mana: fully restored`);
      }
    }

    if (resourceRecovery.length > 0) {
      cardContent += `<div class="recovery-section">`;
      cardContent += `<div class="section-title">Resource Recovery</div>`;
      resourceRecovery.forEach(recovery => {
        cardContent += `<div class="recovery-line">${recovery}</div>`;
      });
      cardContent += `</div>`;
    }

    // Spell and song recovery
    if (unfizzledSpells > 0 || restoredSongs > 0) {
      cardContent += `<div class="spell-section">`;
      cardContent += `<div class="section-title">Ability Recovery</div>`;
      if (unfizzledSpells > 0) {
        cardContent += `<div class="recovery-line">${unfizzledSpells} spell${unfizzledSpells === 1 ? '' : 's'} unfizzled</div>`;
      }
      if (restoredSongs > 0) {
        cardContent += `<div class="recovery-line">${restoredSongs} song${restoredSongs === 1 ? '' : 's'} restored</div>`;
      }
      cardContent += `</div>`;
    }

    cardContent += `</div>`;

    // Show regen bonuses if any were applied
    const regenBonuses = [];
    const resources = this.actor.system.resources || {};
    if (delta.health > (restType === 'favorable' ? 3 : 2)) {
      const bonus = resources.health?.regen || 0;
      if (bonus > 0) regenBonuses.push(`Health Regen: +${bonus}`);
    }
    if (delta.resolve > (restType === 'favorable' ? 1 : 0)) {
      const bonus = resources.resolve?.regen || 0;
      if (bonus > 0) regenBonuses.push(`Resolve Regen: +${bonus}`);
    }
    if (delta.morale > (restType === 'favorable' ? 0 : -2)) {
      const bonus = resources.morale?.regen || 0;
      if (bonus > 0) regenBonuses.push(`Morale Regen: +${bonus}`);
    }

    if (regenBonuses.length > 0) {
      cardContent += `<div class="rest-details">`;
      cardContent += `<div class="detail-line">Regen Bonuses Applied:</div>`;
      regenBonuses.forEach(bonus => {
        cardContent += `<div class="detail-line">${bonus}</div>`;
      });
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

  static async show(options = {}) { const d = new AnyventureRestDialog(options); return d.render({ force: true }); }
}
