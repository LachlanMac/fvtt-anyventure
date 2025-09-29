/**
 * Anyventure System for Foundry VTT
 * A classless TTRPG system with modular character progression
 */

// Import system components
import { AnyventureActor } from './documents/actor.mjs';
import { AnyventureItem } from './documents/item.mjs';
import { AnyventureActorSheet } from './sheets/actor-sheet.mjs';
import { AnyventureItemSheet } from './sheets/item-sheet.mjs';
import { logError, logWarning } from './utils/logger.js';
import { AnyventureRollDialog } from './sheets/roll-dialog.mjs';
import { registerCombatUIHooks } from './combat.mjs';
import { formatSpellRange } from './utils/formatters.mjs';
import { initializeConditions } from './conditions.mjs';

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

Hooks.once('init', async function() {

  // Set up initiative configuration FIRST to prevent undefined errors
  CONFIG.Combat.initiative = {
    formula: "1d20",  // Default fallback
    decimals: 0
  };


  // Hook to intercept initiative rolls and use our custom formulas
  Hooks.on("preUpdateCombat", async (combat, update, options, userId) => {
  });

  // Override Combat.rollInitiative to delegate to Actor.rollInitiative for proper skill check formatting
  const originalRollInitiative = Combat.prototype.rollInitiative;
  Combat.prototype.rollInitiative = async function(ids, options = {}) {

    // Get the combatant(s)
    const combatants = this.combatants.filter(c => ids.includes(c.id));

    for (const combatant of combatants) {
      if (combatant.actor?.rollInitiative) {
        // Let the Actor handle the initiative roll with proper skill check formatting
        await combatant.actor.rollInitiative(options);
      } else {
        // Fallback to original method for this combatant
        await originalRollInitiative.call(this, [combatant.id], options);
      }
    }

    return this;
  };

  // Assign custom classes and constants here
  game.anyventure = {
    AnyventureActor,
    AnyventureItem,
    AnyventureRollDialog,
    rollItemMacro
  };

  // Define custom Document classes
  CONFIG.Actor.documentClass = AnyventureActor;
  CONFIG.Item.documentClass = AnyventureItem;

  // Register sheet application classes
  foundry.documents.collections.Actors.unregisterSheet("core", foundry.applications.sheets.ActorSheet);
  foundry.documents.collections.Actors.registerSheet("anyventure", AnyventureActorSheet, {
    types: ["character", "npc"],
    makeDefault: true
  });

  foundry.documents.collections.Items.unregisterSheet("core", foundry.applications.sheets.ItemSheet);
  foundry.documents.collections.Items.registerSheet("anyventure", AnyventureItemSheet, {
    makeDefault: true
  });

  // Core Handlebars helpers needed by preloaded templates
  Handlebars.registerHelper('sum', function(a, b) {
    const numA = Number(a) || 0;
    const numB = Number(b) || 0;
    return numA + numB;
  });

  Handlebars.registerHelper('add', function(a, b) {
    const numA = Number(a) || 0;
    const numB = Number(b) || 0;
    return numA + numB;
  });

  Handlebars.registerHelper('range', function(start, end, step = 1) {
    const result = [];
    let s = Number(start);
    let e = Number(end);
    let delta = Number(step);

    if (!Number.isFinite(s)) s = 0;
    if (!Number.isFinite(e)) e = 0;
    if (!Number.isFinite(delta) || delta === 0) delta = 1;

    if (delta > 0) {
      for (let i = s; i < e; i += delta) result.push(i);
    } else {
      for (let i = s; i > e; i += delta) result.push(i);
    }

    return result;
  });

  Handlebars.registerHelper('subtract', function(a, b) {
    const numA = Number(a) || 0;
    const numB = Number(b) || 0;
    return numA - numB;
  });

  Handlebars.registerHelper('eq', function(a, b) {
    return a === b;
  });

  Handlebars.registerHelper('lt', function(a, b) {
    return Number(a) < Number(b);
  });

  Handlebars.registerHelper('times', function(n, block) {
    let accum = '';
    for (let i = 0; i < n; i++) {
      const data = Handlebars.createFrame(block.data || {});
      data.index = i;
      accum += block.fn(i, { data });
    }
    return accum;
  });

  Handlebars.registerHelper('starFilled', function(index, talent) {
    return Number(index) < Number(talent);
  });

  // Preload Handlebars templates
  return preloadHandlebarsTemplates();
});

/* -------------------------------------------- */
/*  Handlebars Helpers                          */
/* -------------------------------------------- */


Hooks.once('ready', async function() {

  // Override the turn marker to remove the spinning Foundry symbol
  try {
    await game.settings.set("core", "combatTrackerConfig", {
      ...game.settings.get("core", "combatTrackerConfig"),
      turnMarker: {
        src: "systems/anyventure/artwork/icons/ui/turn-marker.png"
      }
    });
    console.log('[Anyventure] Turn marker disabled successfully');
  } catch (e) {
    console.warn('[Anyventure] Failed to override turn marker setting', e);
  }

  // Register combat UI hooks (phase tracker)
  try { registerCombatUIHooks(); } catch (e) { console.warn('[Anyventure] Failed to register combat UI hooks', e); }

  // Initialize conditions system
  try { initializeConditions(); } catch (e) { console.warn('[Anyventure] Failed to initialize conditions system', e); }

CONFIG.statusEffects = [
  // 🧠 MENTAL CONDITIONS
  {
    id: "afraid",
    label: "Afraid",
    img: "systems/anyventure/images/conditions/afraid.svg",
  },
  {
    id: "alert",
    label: "Alert",
    img: "systems/anyventure/images/conditions/alert.svg",
  },
  {
    id: "broken",
    label: "Broken",
    img: "systems/anyventure/images/conditions/broken.svg",
  },
  {
    id: "charmed",
    label: "Charmed",
    img: "systems/anyventure/images/conditions/charmed.svg",
  },
  {
    id: "confused",
    label: "Confused",
    img: "systems/anyventure/images/conditions/confused.svg",
  },
  {
    id: "dazed",
    label: "Dazed",
    img: "systems/anyventure/images/conditions/dazed.svg",
  },
  {
    id: "maddened",
    label: "Maddened",
    img: "systems/anyventure/images/conditions/maddened.svg",
  },
  {
    id: "numbed",
    label: "Numbed",
    img: "systems/anyventure/images/conditions/numbed.svg",
  },
  {
    id: "stunned",
    label: "Stunned",
    img: "systems/anyventure/images/conditions/stunned.svg",
  },
  {
    id: "bleeding",
    label: "Bleeding",
    img: "systems/anyventure/images/conditions/bleeding.svg",
  },
  {
    id: "blind",
    label: "Blinded",
    img: "systems/anyventure/images/conditions/blind.svg",
  },
  {
    id: "deafened",
    label: "Deafened",
    img: "systems/anyventure/images/conditions/deafened.svg",
  },
  {
    id: "ignited",
    label: "Ignited",
    img: "systems/anyventure/images/conditions/ignited.svg",
  },
  {
    id: "impaired",
    label: "Impaired",
    img: "systems/anyventure/images/conditions/grappled.svg",
  },
  {
    id: "incapacitated",
    label: "Incapacitated",
    img: "systems/anyventure/images/conditions/paralyzed.svg",
  },
  {
    id: "muted",
    label: "Muted",
    img: "systems/anyventure/images/conditions/muted.svg",
  },
  {
    id: "poisoned",
    label: "Poisoned",
    img: "systems/anyventure/images/conditions/poisoned.svg",
  },
  {
    id: "prone",
    label: "Prone",
    img: "systems/anyventure/images/conditions/prone.svg",
  },
  {
    id: "stasis",
    label: "Stasis",
    img: "systems/anyventure/images/conditions/stasis.svg",
  },
  {
    id: "unconscious",
    label: "Unconscious",
    img: "systems/anyventure/images/conditions/unconscious.svg",
  },
  {
    id: "winded",
    label: "Winded",
    img: "systems/anyventure/images/conditions/exhaustT1.svg",
  },

  {
    id: "dead",
    label: "Dead",
    img: "systems/anyventure/images/conditions/dead.svg",
  },
  {
    id: "sleeping",
    label: "Sleeping",
    img: "systems/anyventure/images/conditions/sleeping.svg",
  },
  {
    id: "invisible",
    label: "Invisible",
    img: "systems/anyventure/images/conditions/invisible.svg",
  },
  {
    id: "hidden",
    label: "Hidden",
    img: "systems/anyventure/images/conditions/hidden.svg",
  },
  {
    id: "partialcover",
    label: "Partial Cover",
    img: "systems/anyventure/images/conditions/partialcover.svg",
  },
  {
    id: "fullcover",
    label: "Full Cover",
    img: "systems/anyventure/images/conditions/fullcover.svg",
  },
  {
    id: "concentrating",
    label: "Concentrating",
    img: "systems/anyventure/images/conditions/focus.svg",
  },
  {
    id: "lightsource",
    label: "Light Source",
    img: "systems/anyventure/images/conditions/light.svg",
  },
];


  Handlebars.registerHelper('concat', function() {
    var outStr = '';
    for (var arg in arguments) {
      if (typeof arguments[arg] != 'object') {
        outStr += arguments[arg];
      }
    }
    return outStr;
  });

  Handlebars.registerHelper('toLowerCase', function(str) {
    return str.toLowerCase();
  });

  // Helper to capitalize first letter of a string
  Handlebars.registerHelper('capitalize', function(str) {
    if (typeof str !== 'string') return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  });

  // Helper to get localized skill name
  Handlebars.registerHelper('localizeSkill', function(skillKey) {
    // For camelCase keys like "simpleMeleeWeapons", we need to capitalize properly
    // Convert first letter to uppercase: simpleMeleeWeapons -> SimpleMeleeWeapons
    const capitalizedKey = skillKey.charAt(0).toUpperCase() + skillKey.slice(1);
    const localizationPath = `ANYVENTURE.Skills.${capitalizedKey}`;
    
    // Try to get the localized string
    const localized = game.i18n.localize(localizationPath);
    
    // If localization fails (returns the path), fall back to readable format
    if (localized === localizationPath) {
      // Convert camelCase to readable format: simpleMeleeWeapons -> Simple Melee Weapons
      return skillKey
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();
    }
    
    return localized;
  });

  // Helper for skill dice conversion (0=d4, 1=d6, 2=d8, 3=d10, 4=d12, 5=d16, 6=d20)
  Handlebars.registerHelper('skillDie', function(level) {
    const dice = ['d4', 'd6', 'd8', 'd10', 'd12', 'd16', 'd20'];
    return dice[Math.min(level, 6)] || 'd4';
  });

  // Helper for skill dice with upgrade/downgrade support (using tier modifiers)
  Handlebars.registerHelper('skillDieWithUpgrade', function(level, tier) {
    // Dice progression table: [downgraded, base, upgraded]
    const diceTable = [
      ['d2', 'd4', 'd6'],   // Level 0
      ['d4', 'd6', 'd8'],   // Level 1
      ['d6', 'd8', 'd10'],  // Level 2
      ['d8', 'd10', 'd12'], // Level 3
      ['d10', 'd12', 'd16'], // Level 4
      ['d12', 'd16', 'd20'], // Level 5
      ['d16', 'd20', 'd24']  // Level 6
      ['d20', 'd24', 'd30']  // Level 7
    ];

    const nlevel = Number(level);
    const skillLevel = Math.min(Math.max(isNaN(nlevel) ? 0 : nlevel, 0), 6);
    const tierModifier = Number.isFinite(Number(tier)) ? Number(tier) : 0;
    const upgradeLevel = Math.min(Math.max(tierModifier + 1, 0), 2); // Convert -1,0,1 to 0,1,2

    const row = diceTable[skillLevel];
    if (!row) return 'd4';
    return row[upgradeLevel] || 'd4';
  });

  // Helper for skill upgrade CSS class (using tier modifiers)
  Handlebars.registerHelper('skillUpgradeClass', function(tier) {
    const tierModifier = Number.isFinite(Number(tier)) ? Number(tier) : 0;
    if (tierModifier > 0) return 'skill-upgraded';
    if (tierModifier < 0) return 'skill-downgraded';
    return '';
  });

  // Helper to remove action/reaction prefix from ability names
  Handlebars.registerHelper('removeActionPrefix', function(name) {
    if (!name) return '';
    // If the name contains a colon, return everything after it (trimmed)
    if (name.includes(':')) {
      return name.split(':').slice(1).join(':').trim();
    }
    // Otherwise return the full name
    return name;
  });

  // Helper for checking if module option is selected
  Handlebars.registerHelper('isSelected', function(option) {
    return option.selected === true;
  });

  // Helper for checking equality (useful for conditionals)
  Handlebars.registerHelper('eq', function(a, b) {
    return a === b;
  });

  // Helper for checking if array includes value
  Handlebars.registerHelper('includes', function(array, value) {
    if (!Array.isArray(array)) return false;
    return array.includes(value);
  });

  // Helper for multiplication
  Handlebars.registerHelper('multiply', function(a, b) {
    const numA = Number(a) || 0;
    const numB = Number(b) || 0;
    return numA * numB;
  });

  // Helper for resistance calculation (mitigation * 2, but only if positive)
  Handlebars.registerHelper('resistance', function(mitigation) {
    const num = Number(mitigation) || 0;
    return num > 0 ? num * 2 : '';
  });

  // Helper for formatting spell ranges
  Handlebars.registerHelper('formatSpellRange', function(rangeValue) {
    if (typeof rangeValue === 'number' || (typeof rangeValue === 'string' && !isNaN(parseInt(rangeValue)))) {
      const rangeKey = parseInt(rangeValue);
      return formatSpellRange(rangeKey);
    }
    return rangeValue; // Return as-is if already formatted
  });

  // Helper for subtraction
  Handlebars.registerHelper('subtract', function(a, b) {
    return a - b;
  });

  // Helper for addition
  Handlebars.registerHelper('sum', function(a, b) {
    const numA = Number(a) || 0;
    const numB = Number(b) || 0;
    return numA + numB;
  });

  // Helper for calculating percentage
  if (!Handlebars.helpers.percentage) {
    Handlebars.registerHelper('percentage', function(value, max) {
      if (!max || max === 0) return 0;
      const val = parseFloat(value) || 0;
      const maxVal = parseFloat(max) || 1;
      return Math.max(0, Math.min(100, Math.round((val / maxVal) * 100)));
    });
  }

  // Helper for iterating a specific number of times
  // Provides an @index inside the block (0..n-1)
  Handlebars.registerHelper('times', function(n, block) {
    let accum = '';
    for (let i = 0; i < n; i++) {
      const data = Handlebars.createFrame(block.data || {});
      data.index = i;
      accum += block.fn(i, { data });
    }
    return accum;
  });

  // Comparison helper: less-than
  Handlebars.registerHelper('lt', function(a, b) {
    return Number(a) < Number(b);
  });

  // Helper: is star filled given index and talent
  Handlebars.registerHelper('starFilled', function(index, talent) {
    return Number(index) < Number(talent);
  });

  // Helper to check if any skill in a category has talent > 0
  Handlebars.registerHelper('hasAnyTalent', function(skills) {
    if (!skills) return false;
    for (let key in skills) {
      if (skills[key].talent && skills[key].talent > 0) {
        return true;
      }
    }
    return false;
  });

  // Helper to group module options by tier
  Handlebars.registerHelper('groupByTier', function(options) {
    if (!Array.isArray(options)) return {};

    const grouped = {};
    options.forEach(option => {
      // Safety check: ensure option and location exist
      if (!option || !option.location || typeof option.location !== 'string') {
        logWarning('Invalid option found in groupByTier:', option);
        return;
      }

      const tierMatch = option.location.match(/^(\d+)/);
      if (tierMatch) {
        const tier = tierMatch[1];
        if (!grouped[tier]) grouped[tier] = [];
        grouped[tier].push(option);
      }
    });

    return grouped;
  });

  // Helper to check if tier number is odd
  Handlebars.registerHelper('isOddTier', function(tier) {
    return parseInt(tier) % 2 === 1;
  });

  // Helper to check if module option can be selected (kept for compatibility)
  Handlebars.registerHelper('canSelectOption', function(item, location) {
    return true; // Logic moved to JavaScript for better reliability
  });

});

/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
async function createItemMacro(data, slot) {
  if (data.type !== "Item") return;
  if (!("data" in data)) return ui.notifications.warn("You can only create macro buttons for owned Items");
  
  const item = data.data;
  
  // Create the macro command
  const command = `game.anyventure.rollItemMacro("${item.name}");`;
  let macro = game.macros.entities.find(m => (m.name === item.name) && (m.command === command));
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: "script",
      img: item.img,
      command: command,
      flags: { "anyventure.itemMacro": true }
    });
  }
  game.user.assignHotbarMacro(macro, slot);
  return false;
}

/**
 * Create a Macro from an Item drop.
 * @param {string} itemName
 * @return {Promise}
 */
function rollItemMacro(itemName) {
  const speaker = ChatMessage.getSpeaker();
  let actor;
  if (speaker.token) actor = game.actors.tokens[speaker.token];
  if (!actor) actor = game.actors.get(speaker.actor);
  
  // Get matching items
  const item = actor ? actor.items.find(i => i.name === itemName) : null;
  if (!item) return ui.notifications.warn(`Your controlled Actor does not have an item named ${itemName}`);

  // Trigger the item roll
  return item.roll();
}

/* -------------------------------------------- */
/*  Handlebars Template Loader                  */
/* -------------------------------------------- */

/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
async function preloadHandlebarsTemplates() {
 return foundry.applications.handlebars.loadTemplates([
    // Actor templates
    "systems/anyventure/templates/actor/actor-character-sheet.hbs",
    "systems/anyventure/templates/actor/actor-npc-sheet.hbs",

    // Item templates
    "systems/anyventure/templates/item/item-module-sheet.hbs",
    "systems/anyventure/templates/item/item-spell-sheet.hbs",
    "systems/anyventure/templates/item/item-song-sheet.hbs",
    "systems/anyventure/templates/item/item-weapon-sheet.hbs",
    "systems/anyventure/templates/item/item-armor-sheet.hbs",
    "systems/anyventure/templates/item/item-equipment-sheet.hbs",

    // Application templates
    
    // Actor Partial templates
    "systems/anyventure/templates/partials/skills.hbs",
    "systems/anyventure/templates/partials/biography.hbs",
    "systems/anyventure/templates/partials/equipment.hbs",
    "systems/anyventure/templates/partials/moves.hbs",
    "systems/anyventure/templates/partials/spells.hbs",
    "systems/anyventure/templates/partials/modules.hbs",
    "systems/anyventure/templates/partials/mitigations.hbs",
    "systems/anyventure/templates/partials/movement.hbs",
    "systems/anyventure/templates/partials/abilities-attacks.hbs",
    "systems/anyventure/templates/partials/abilities-list.hbs",
    "systems/anyventure/templates/partials/npc-abilities.hbs",

    // Item Partial templates
    "systems/anyventure/templates/partials/items/item-header.hbs",
    "systems/anyventure/templates/partials/items/basic-info.hbs",
    "systems/anyventure/templates/partials/items/resource-bonuses.hbs",
    "systems/anyventure/templates/partials/items/weapon-full.hbs",
    "systems/anyventure/templates/partials/items/skill-bonuses.hbs",
    "systems/anyventure/templates/partials/items/mitigation.hbs",
    "systems/anyventure/templates/partials/items/special-properties.hbs",
    "systems/anyventure/templates/partials/items/description.hbs",
    "systems/anyventure/templates/partials/items/armor-properties.hbs",
    "systems/anyventure/templates/partials/items/weapon-damage.hbs",
    "systems/anyventure/templates/partials/items/weapon-properties.hbs",
    "systems/anyventure/templates/partials/items/module-properties.hbs",
    "systems/anyventure/templates/partials/items/spell-properties.hbs",
    "systems/anyventure/templates/partials/items/song-properties.hbs",

    // UI templates
    "systems/anyventure/templates/partials/npc-skills.hbs",
  ]);
}
