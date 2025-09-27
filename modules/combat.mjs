/**
 * Anyventure combat UI hooks with phase-based turn system
 *
 * Elite monsters (elite/legend/mythic) act in ALL phases (Early, Middle, Late)
 * Other combatants act only in their initiative-determined phase:
 *   * < 4: Late phase
 *   * 4-7: Middle phase
 *   * 8-10: Early phase
 *   * > 10: Early phase + Preparation (round 1 only)
 * Within each phase: Characters go first, then NPCs
 */


const PHASE_KEYS = ['preparation', 'early', 'middle', 'late'];
const ELITE_TIERS = new Set(['elite', 'legend', 'mythic']);
const GRUNT_TIERS = new Set(['minion', 'grunt', 'foe']);
const PHASE_LABELS = {
  preparation: 'Preparation Phase',
  early: 'Early Phase',
  middle: 'Middle Phase',
  late: 'Late Phase'
};
function getTier(entry) {
  return String(entry?.actor?.system?.creatureTier ?? entry?.actor?.system?.npcType ?? '').toLowerCase();
}

function isGruntTier(tier) {
  return GRUNT_TIERS.has(String(tier).toLowerCase());
}

function byInitDesc(a, b) {
  return (Number(b.initiative ?? -Infinity) - Number(a.initiative ?? -Infinity)) || a.name.localeCompare(b.name);
}

function byCoordDesc(a, b) {
  const ca = Number(a.actor?.system?.attributes?.coordination?.value ?? 0);
  const cb = Number(b.actor?.system?.attributes?.coordination?.value ?? 0);
  return (cb - ca) || a.name.localeCompare(b.name);
}

function sortPhase(list, key) {
  const items = Array.from(list);
  const chars = items.filter(x => x.actor?.type === 'character').sort(byInitDesc);
  const npcs = items.filter(x => x.actor?.type !== 'character');
  if (key === 'late') {
    const grunt = npcs.filter(x => isGruntTier(getTier(x))).sort(byCoordDesc);
    const others = npcs.filter(x => !isGruntTier(getTier(x))).sort(byInitDesc);
    return [...chars, ...others, ...grunt];
  }
  npcs.sort(byInitDesc);
  return [...chars, ...npcs];
}

function computePhaseData(combat, round = 1) {
  const buckets = {
    preparation: [],
    early: [],
    middle: [],
    late: []
  };

  const combatants = combat?.combatants?.contents || [];

  for (const combatant of combatants) {
    if (!combatant?.actor) continue;

    const init = Number(combatant.initiative ?? -Infinity);
    let basePhase = 'middle';
    if (isFinite(init)) {
      if (init < 4) basePhase = 'late';
      else if (init <= 7) basePhase = 'middle';
      else basePhase = 'early';
    }
    const assigned = new Set([basePhase]);
    const tier = getTier(combatant);

    if (ELITE_TIERS.has(tier)) {
      assigned.add('early');
      assigned.add('middle');
      assigned.add('late');
    }

    for (const phase of assigned) buckets[phase].push(combatant);
    if (round === 1 && isFinite(init) && init > 10) {
      buckets.preparation.push(combatant);
    }
  }

  const turnIndexMap = new Map();
  (combat?.turns || []).forEach((t, idx) => turnIndexMap.set(t.id, idx));

  const sortedBuckets = {};
  const sequence = [];
  const occurrenceMap = new Map();

  for (const key of PHASE_KEYS) {
    if (key === 'preparation' && round !== 1) {
      sortedBuckets[key] = [];
      continue;
    }
    const arr = buckets[key];
    if (!arr.length) {
      sortedBuckets[key] = [];
      
      continue;
    }
    const sorted = sortPhase(arr, key);
    const entries = [];
    
    for (const combatant of sorted) {
      const count = (occurrenceMap.get(combatant.id) ?? 0) + 1;
      occurrenceMap.set(combatant.id, count);
      const entry = {
        combatant,
        phase: key,
        instanceId: `${combatant.id}:${count}:${key}`,
        turnIndex: turnIndexMap.get(combatant.id) ?? combat.turns.findIndex(t => t.id === combatant.id)
      };
      entries.push(entry);
      sequence.push(entry);
      
    }
    sortedBuckets[key] = entries;
  }

  
  return { buckets: sortedBuckets, sequence };
}

function getPhaseState(combat) {
  const state = combat?.getFlag('anyventure', 'phaseState');
  if (state && typeof state.index === 'number') return { ...state };
  return {
    index: -1,
    round: Math.max(combat?.round || 1, 1)
  };
}

async function clearPhaseState(combat) {
  try {
    await combat?.unsetFlag('anyventure', 'phaseState');
  } catch (e) {
    // Flag may not exist; ignore
  }
}

async function advancePhase(combat, direction = 1) {
  if (!combat) return;
  const currentState = getPhaseState(combat);
  let { index, round } = currentState;
  if (!round || round < 1) round = Math.max(combat.round || 1, 1);

  let phaseData = computePhaseData(combat, round);
  if (!phaseData.sequence.length) return;

  // Debug logging

  const oldIndex = index;
  index += direction;
  if (index >= phaseData.sequence.length) {
    round += 1;
    phaseData = computePhaseData(combat, round);
    index = 0;

  } else if (index < 0) {
    round = Math.max(1, round - 1);
    phaseData = computePhaseData(combat, round);
    index = phaseData.sequence.length - 1;

  }

  const entry = phaseData.sequence[index];
  if (!entry) {
    return;
  }

  let turnIndex = entry.turnIndex ?? combat.turns.findIndex(t => t.id === entry.combatant.id);
  if (turnIndex < 0) {
    await combat.setupTurns?.();
    turnIndex = combat.turns.findIndex(t => t.id === entry.combatant.id);
  }
  if (turnIndex < 0) {
    return;
  }

  const newPhaseState = {
    index,
    round,
    entryId: entry.instanceId,
    phase: entry.phase,
    combatantId: entry.combatant.id
  };

  await combat.update({
    turn: turnIndex,
    round,
    ['flags.anyventure.phaseState']: newPhaseState
  }, { anyventurePhase: true }); // Add flag to prevent recursive updates

  // Verify the update worked
  const verifyState = getPhaseState(combat);

}

function highlightCurrentPhase(tracker, combat, phaseData) {
  if (!tracker) return;
  const state = getPhaseState(combat);
  let targetEntryId = state.entryId;

  // If we have a phase state, use it directly
  if (!targetEntryId && state.index >= 0 && phaseData.sequence[state.index]) {
    targetEntryId = phaseData.sequence[state.index].instanceId;
  }

  // Fallback to current combatant
  if (!targetEntryId) {
    const activeId = combat?.combatant?.id;
    if (activeId) {
      const fallback = phaseData.sequence.find(e => e.combatant.id === activeId);
      if (fallback) targetEntryId = fallback.instanceId;
    }
  }

  if (!targetEntryId) return;

  const allRows = tracker.querySelectorAll('li.combatant, li[data-phase-entry]');
  allRows.forEach(node => {
    node.classList.remove('phase-current');
    node.classList.remove('active');
  });

  const el = tracker.querySelector(`[data-phase-entry="${targetEntryId}"]`);
  if (el) {
    el.classList.add('phase-current');
    el.classList.add('active');

  }
}

function wirePhaseControls(app, html) {
  const combat = app.combat ?? game.combat;
  if (!combat) return;

  const $html = html?.jquery ? html : $(html ?? []);

  // Removed debug logging to reduce spam

  const bindControl = (selector, handler) => {
    const control = $html.find(selector);
    if (!control.length) {
      return;
    }

    control.off('click.anyventure-phase');
    control.off('.anyventure-phase');
    control.off('click');
    control.on('click.anyventure-phase', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      await handler();
    });
  };

  // Only bind controls if combat has started
  if (combat.started) {
    // The buttons exist when combat is active - bind them directly
    bindControl('[data-action="nextTurn"]', async () => {

      await advancePhase(combat, +1);
    });

    bindControl('[data-action="previousTurn"]', async () => {

      await advancePhase(combat, -1);
    });
  }
}

Hooks.on('createCombatant', async (combatant, options, userId) => {
  if (!combatant?.actor) return;

  const tier = getTier(combatant);
  if (isGruntTier(tier)) {
    console.log(`[Anyventure] Setting ${tier} initiative to -1 for:`, combatant.actor.name);
    await combatant.update({ initiative: -1 });
  }
});

Hooks.on('combatStart', async combat => {
  if (!combat) return;

  await clearPhaseState(combat);

  // Check if anyone has rolled initiative
  const hasInitiative = combat.combatants?.contents?.some(c => c.initiative !== null && c.initiative !== undefined);

  if (!hasInitiative) {
    ui.notifications.warn('No combatants have rolled initiative! Combat may not work correctly.');
  }

  // Initialize with index -1 so first advance goes to 0
  await combat.update({
    ['flags.anyventure.phaseState']: {
      index: -1,
      round: 1
    }
  });
  await advancePhase(combat, +1);
});

Hooks.on('combatEnd', async combat => {
  if (!combat) return;
  await clearPhaseState(combat);
});

// REMOVED: This was causing an infinite loop
// We'll handle turn advancement differently

export function registerCombatUIHooks() {
  Hooks.on('renderCombatTracker', async (app, html /*, data*/) => {
    try {
      const combat = app.combat ?? game.combat;
      if (!combat) return;
      const round = Math.max(combat.round || 1, 1);
      const phaseData = computePhaseData(combat, round);

      const container = html instanceof HTMLElement ? html : (html?.[0] instanceof HTMLElement ? html[0] : null);
      const tracker = container?.querySelector?.('[data-application-part="tracker"], ol.combat-tracker');
      if (!tracker) return;

      const existingLis = Array.from(tracker.querySelectorAll('li.combatant'));
      const byId = new Map(existingLis.map(li => [li.dataset.combatantId, li]));

      const frag = document.createDocumentFragment();
      const header = (cls, text) => {
        const li = document.createElement('li');
        li.className = `phase-header ${cls}`;
        li.textContent = text;
        return li;
      };

      const renderedPrimaries = new Set();

      const addPhase = (key) => {
        frag.appendChild(header(key, PHASE_LABELS[key]));
        const entries = phaseData.buckets[key] || [];
        if (entries.length === 0) {
          const empty = document.createElement('li');
          empty.className = 'combatant-row empty';
          empty.textContent = '—';
          frag.appendChild(empty);
          return;
        }

        for (const entry of entries) {
          const combatant = entry.combatant;
          const baseLi = byId.get(combatant.id);
          if (!baseLi) continue;

          const isPrimary = !renderedPrimaries.has(combatant.id);
          const node = isPrimary ? baseLi : baseLi.cloneNode(true);
          node.classList.remove('phase-duplicate', 'phase-current');
          node.classList.remove('active');
          delete node.dataset.phaseEntry;
          delete node.dataset.phaseKey;
          for (const cls of Array.from(node.classList)) {
            if (cls.startsWith('rank-')) node.classList.remove(cls);
          }
          if (!isPrimary) {
            if (node.id) node.id = `${node.id}-${key}`;
            node.classList.add('phase-duplicate');
          } else {
            renderedPrimaries.add(combatant.id);
          }
          node.dataset.phaseEntry = entry.instanceId;
          node.dataset.phaseKey = key;
          const tierClass = getTier(combatant) || (combatant.actor?.type === 'character' ? 'pc' : 'npc');
          if (tierClass) node.classList.add(`rank-${tierClass}`);
          frag.appendChild(node);
        }
      };

      if (round === 1) addPhase('preparation');
      addPhase('early');
      addPhase('middle');
      addPhase('late');

      tracker.classList.add('anyventure-combat-tracker');
      tracker.replaceChildren(frag);

      highlightCurrentPhase(tracker, combat, phaseData);
      setTimeout(() => wirePhaseControls(app, html), 0);
    } catch (e) {
      console.warn('[Anyventure] Combat tracker injection failed', e);
    }
  });
}
