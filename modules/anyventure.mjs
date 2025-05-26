/**
 * Anyventure System for Foundry VTT
 * A classless TTRPG system with modular character progression
 */

// Import system components
import { AnyventureActor } from './documents/actor.mjs';
import { AnyventureItem } from './documents/item.mjs';
import { AnyventureActorSheet } from './sheets/actor-sheet.mjs';
import { AnyventureItemSheet } from './sheets/item-sheet.mjs';

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

Hooks.once('init', async function() {
  console.log('Anyventure | Initializing Anyventure System');

  // Assign custom classes and constants here
  game.anyventure = {
    AnyventureActor,
    AnyventureItem,
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

  // Preload Handlebars templates
  return preloadHandlebarsTemplates();
});

/* -------------------------------------------- */
/*  Handlebars Helpers                          */
/* -------------------------------------------- */

Hooks.once('ready', async function() {
  // Register custom Handlebars helpers
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

  // Helper for skill dice conversion (0=d4, 1=d6, 2=d8, 3=d10, 4=d12, 5=d16, 6=d20)
  Handlebars.registerHelper('skillDie', function(level) {
    const dice = ['d4', 'd6', 'd8', 'd10', 'd12', 'd16', 'd20'];
    return dice[Math.min(level, 6)] || 'd4';
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

  console.log('Anyventure | System Ready');
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
    "systems/anyventure/templates/item/item-weapon-sheet.hbs",
    "systems/anyventure/templates/item/item-armor-sheet.hbs",
    "systems/anyventure/templates/item/item-equipment-sheet.hbs",
    
    // Partial templates
    "systems/anyventure/templates/partials/skills.hbs"
  ]);
}