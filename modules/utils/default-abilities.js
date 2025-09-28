/**
 * Default Abilities Manager for FoundryVTT Anyventure System
 *
 * This class manages the default actions and reactions that all characters have access to.
 * These abilities are automatically added during character recalculation.
 */

import { logError, logWarning } from './logger.js';

export class DefaultAbilities {
  /**
   * Get all default actions that should be added to characters
   * @returns {Array} Array of action ability objects
   */
  static getDefaultActions() {
    return [
      {
        name: "Sprint",
        type: "action",
        img: "icons/skills/movement/feet-winged-boots-brown.webp",
        system: {
          description: "The character moves up to double their movement speed in a straight line.",
          source: "Default Actions",
          energy: 2,
          daily: false,
          magic: false,
          used: false,
          abilityType: "action",
          anyventure_id: "default_action_sprint"
        }
      },
      {
        name: "Jump",
        type: "action",
        img: "icons/skills/movement/figure-running-gray.webp",
        system: {
          description: "The character specifies how many units they want to jump, up to their movement speed. They then roll a fitness check to determine if they were able to make the full jump or if they fall short. If they took either the sprint action or used 2 units of their movement speed immediately before the jump, their fitness check must be greater than or equal to the units they are attempting to jump - otherwise, they only jump a number of units equal to their fitness check. Without a running start, their fitness check is halved and rounded down to calculate the number of units they traverse.",
          source: "Default Actions",
          energy: 1,
          daily: false,
          magic: false,
          used: false,
          abilityType: "action",
          anyventure_id: "default_action_jump"
        }
      },
      {
        name: "Grab",
        type: "action",
        img: "icons/skills/melee/unarmed-punch-fist.webp",
        system: {
          description: "The character attempt to grab another creature and hold onto them until the start of their next turn. This is done by making a contested fitness check.",
          source: "Default Actions",
          energy: 1,
          daily: false,
          magic: false,
          used: false,
          abilityType: "action",
          anyventure_id: "default_action_grab"
        }
      },
      {
        name: "Defend",
        type: "action",
        img: "icons/skills/melee/shield-block-gray-yellow.webp",
        system: {
          description: "The character preemptively defends themselves, gaining a bonus dice to all defense and contested checks. After using any other reaction, this benefit is lost.",
          source: "Default Actions",
          energy: 0,
          daily: false,
          magic: false,
          used: false,
          abilityType: "action",
          anyventure_id: "default_action_defend"
        }
      },
      {
        name: "Shove",
        type: "action",
        img: "icons/skills/movement/arrow-upward-yellow.webp",
        system: {
          description: "The character attempts to shove another character that is the same size, knocking them prone or pushing them 1 unit away. This is done by making a contested might check against the target's fitness or coordination.",
          source: "Default Actions",
          energy: 1,
          daily: false,
          magic: false,
          used: false,
          abilityType: "action",
          anyventure_id: "default_action_shove"
        }
      },
      {
        name: "Use",
        type: "action",
        img: "icons/containers/bags/pack-leather-brown.webp",
        system: {
          description: "The character uses an item, such as drinking a potion, picking up an object or attempting to unlock a door.",
          source: "Default Actions",
          energy: 0,
          daily: false,
          magic: false,
          used: false,
          abilityType: "action",
          anyventure_id: "default_action_use"
        }
      },
      {
        name: "Rest",
        type: "action",
        img: "icons/skills/social/wave-halt-stop.webp",
        system: {
          description: "The character rests, removing the winded condition. If the character does not have the winded condition, this action instead restores 2 energy.",
          source: "Default Actions",
          energy: 0,
          daily: false,
          magic: false,
          used: false,
          abilityType: "action",
          anyventure_id: "default_action_rest"
        }
      },
      {
        name: "Hide",
        type: "action",
        img: "icons/magic/perception/eye-slit-orange.webp",
        system: {
          description: "The character gains the obscured condition. A character cannot use this action if an enemy can currently see or sense them.",
          source: "Default Actions",
          energy: 0,
          daily: false,
          magic: false,
          used: false,
          abilityType: "action",
          anyventure_id: "default_action_hide"
        }
      }
    ];
  }

  /**
   * Get all default reactions that should be added to characters
   * @returns {Array} Array of reaction ability objects
   */
  static getDefaultReactions() {
    return [
      {
        name: "Attack of Opportunity",
        type: "reaction",
        img: "icons/weapons/swords/sword-simple-white.webp",
        system: {
          description: "The character makes an attack with a simple weapon or brawling attack against a creature that willfully moves out of their melee range.",
          source: "Default Reactions",
          energy: 0,
          daily: false,
          magic: false,
          used: false,
          abilityType: "reaction",
          anyventure_id: "default_reaction_attack_of_opportunity"
        }
      },
      {
        name: "Cover Eyes",
        type: "reaction",
        img: "icons/creatures/eyes/human-single-brown.webp",
        system: {
          description: "The character attempts to cover their eyes to either protect against a vision based attack or protect their eyes. This gives them the blinded condition until the start of their next turn.",
          source: "Default Reactions",
          energy: 0,
          daily: false,
          magic: false,
          used: false,
          abilityType: "reaction",
          anyventure_id: "default_reaction_cover_eyes"
        }
      },
      {
        name: "Cover Ears",
        type: "reaction",
        img: "icons/magic/sonic/explosion-shock-wave-teal.webp",
        system: {
          description: "The character attempts to cover their ears to either protect against a sound based attack. This gives them the deafened condition until the start of their next turn.",
          source: "Default Reactions",
          energy: 0,
          daily: false,
          magic: false,
          used: false,
          abilityType: "reaction",
          anyventure_id: "default_reaction_cover_ears"
        }
      },
      {
        name: "Fall Prone",
        type: "reaction",
        img: "icons/skills/movement/arrow-down-pink.webp",
        system: {
          description: "The character falls to the ground, willfully giving them the prone condition.",
          source: "Default Reactions",
          energy: 0,
          daily: false,
          magic: false,
          used: false,
          abilityType: "reaction",
          anyventure_id: "default_reaction_fall_prone"
        }
      }
    ];
  }

  /**
   * Get all default abilities (actions + reactions)
   * @returns {Array} Array of all default ability objects
   */
  static getAllDefaultAbilities() {
    return [
      ...this.getDefaultActions(),
      ...this.getDefaultReactions()
    ];
  }

  /**
   * Add default abilities to a character during recalculation
   * @param {Object} actor - The actor to add abilities to
   */
  static async addDefaultAbilitiesToCharacter(actor) {
    // Prevent infinite loops during item creation
    if (actor._isCreatingDefaultAbilities) {
      return;
    }

    actor._isCreatingDefaultAbilities = true;

    try {
      const defaultAbilities = this.getAllDefaultAbilities();

      for (const abilityData of defaultAbilities) {
        await this._processDefaultAbility(actor, abilityData);
      }
    } catch (error) {
      logError('Error adding default abilities to character:', error);
    } finally {
      // Always clear the flag
      actor._isCreatingDefaultAbilities = false;
    }
  }

  /**
   * Process a single default ability and create it if it doesn't exist
   * @param {Object} actor - The actor to process
   * @param {Object} abilityData - The ability data to process
   */
  static async _processDefaultAbility(actor, abilityData) {
    // Check if this ability already exists on the character (by anyventure_id or name)
    const existingAbility = actor.items.find(item =>
      (item.system?.anyventure_id && item.system.anyventure_id === abilityData.system.anyventure_id) ||
      (item.type === abilityData.type && item.name === abilityData.name && item.system?.source === abilityData.system.source)
    );

    if (existingAbility) {
      // Ability already exists, skip creation
      return;
    }

    try {
      await actor.createEmbeddedDocuments('Item', [abilityData]);
      console.log(`[Default Abilities] Added ${abilityData.type}: ${abilityData.name}`);
    } catch (error) {
      logError(`Failed to create default ability "${abilityData.name}":`, error);
    }
  }

  /**
   * Remove all default abilities from a character (useful for cleanup/testing)
   * @param {Object} actor - The actor to remove abilities from
   */
  static async removeDefaultAbilitiesFromCharacter(actor) {
    const defaultAbilityIds = this.getAllDefaultAbilities().map(ability => ability.system.anyventure_id);

    const itemsToDelete = actor.items.filter(item =>
      item.system?.anyventure_id && defaultAbilityIds.includes(item.system.anyventure_id)
    ).map(item => item.id);

    if (itemsToDelete.length > 0) {
      await actor.deleteEmbeddedDocuments('Item', itemsToDelete);
      console.log(`[Default Abilities] Removed ${itemsToDelete.length} default abilities`);
    }
  }
}