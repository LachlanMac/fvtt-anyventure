# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## System Overview

Anyventure is a classless TTRPG system for Foundry VTT where characters progress through modular skill trees. The system features unique dice mechanics (d4-d20 based on skill level) and resource management.

## Architecture

### Core Entry Points
- `modules/anyventure.mjs` - Main system initialization, registers document classes and sheets
- `system.json` - System manifest defining compatibility and metadata
- `template.json` - Defines data structures for actors and items

### Document Classes
- `modules/documents/actor.mjs` - Extends Actor class for characters and NPCs
- `modules/documents/item.mjs` - Extends Item class for all item types

### Sheet Classes
- `modules/sheets/actor-sheet.mjs` - UI for character/NPC sheets
- `modules/sheets/item-sheet.mjs` - UI for all item types
- `modules/sheets/roll-dialog.mjs` - Custom roll dialog for skill checks

### Data Model
The system uses these primary data structures:
- **Actors**: Characters and NPCs with attributes (Physique, Finesse, Mind, Knowledge, Social), resources (Health, Resolve, Energy), and skills
- **Items**: Module, Spell, Weapon, Armor, Equipment, Race, Culture

### Dice Mechanics
Skills use different dice based on level:
- Level 0: d4
- Level 1: d6
- Level 2: d8
- Level 3: d10
- Level 4: d12
- Level 5: d16
- Level 6: d20

## Development Commands

### CSS Compilation
The system uses SCSS for styling. To compile:
```bash
# Compile SCSS to CSS (must be run from system directory)
sass styles/anyventure.scss styles/anyventure.css --source-map
```

### Testing in Foundry
1. Ensure Foundry VTT is running
2. Navigate to Game Systems and activate "Anyventure"
3. Create a new world using the Anyventure system
4. Test changes by refreshing the browser (F5)

## Key Development Patterns

### Adding New Item Types
1. Update `template.json` to add the new type structure
2. Update `modules/documents/item.mjs` if special behavior needed
3. Create a new template in `templates/item/item-[type]-sheet.hbs`
4. Add localization strings to `lang/en.json`

### Modifying Character Sheets
- Character sheet logic is in `modules/sheets/actor-sheet.mjs`
- Template files are in `templates/actor/` and `templates/partials/`
- Use `getData()` to prepare data for templates
- Use `activateListeners()` for event handling

### Roll System
The custom roll system is implemented in `modules/sheets/roll-dialog.mjs`. It handles:
- Skill + attribute combinations
- Talent dice additions
- Roll formulas with modifiers


### Game Rules:

Anyventure is a TTRPG where there are no classes. 

Character creation involves the following:

Selecting a race which gives innate bonuses/traits
Selecting a culture which gives some flavor to a character

Spending 6 points on attributes, all of which start at 1.
The attributes are 
Physique, Finesse, Mind, Knowledge, Social

Attributes determine HOW MANY dice you roll when making checks.  This is referred to as "Talents". Talents can only ever be 0-4, with 0 meaning you can't even roll it (not applicable for attributes) and 4 meaning gifted.
You would never make a physique check. Instead, you would roll a skill under physique.
For instance, here are all the skills and the attribute they are attached to:

Physique: Fitness, Deflection, Might, Endurance
Finesse: Evasion, Stealth, Coordination, Thievery
Mind: Resilience, Concentration, Senses, Logic
Knowledge: Wildcraft, Academics, Magic, Medicine
Social: Expression, Presence, Insight, Persuasion

Skills, unlike attributes have a "level" from 0->6
0 = d4, 1 = d6, 2 = d8, 3 = d10, 4 = d12, 5 = d16, 6 = d20
There is no skill above 6, as that is mastery

So, if a player had 4 in Fitness, and 2 talent in physique, they would roll a 2d12 to make that check.
They would take the highest value of the 2d12. So if one dice was a 7 and the other was 3, the check would be a 7.
However, sometimes the other dice are important, so we can't discard them completely.
Examples:
3 talent in knowledge, 3 skill in academics:  3d10 take highest
1 talent in mind, 5 skill in senses: 1d16
2 talent in physique, 1 skill in might: 2d4 take highest

All checks can be affected by bonus or penalty dice. Bonus dice means you add more dice.
So with our previous examples:
1 talent in mind, 5 skill in senses, +2 bonus dice = 3d16
2 talent in physique, 1 skill in might, +1 penalty dice = 1d4
If the dice is at 1, and there is more penalty dice, we start rolling more dice but taking the lowest.
3 talent in knowledge, 3 skill in academics, +4 penalty dice = 3d10 take lowest
3 talent in knowledge, 3 skill in academics, +3 penalty dice = 2d10 take lowest
3 talent in knowledge, 3 skill in academics, +2 penalty dice = 1d10

Combat works similarly except the talent and skills are attached to each other. Talents are only chosen at character creation barring some options to modify a character in game. Skills are obtained through modules.

Weapon Skill Types: Brawling, Throwing, Simple Melee Weapons, Simple Ranged Weapons, Complex Melee Weapons, Complex Ranged Weapons

Brawling, throwing, and the simple weapons start with +1 talent..The others are +0.
Skills are likewise obtained through modules.  So even if you had extreme talent (+4) in Throwing, if you had no skill, your max throw would only ever be a 4, but you'd be very likely to get a 4 every time rolling 4 dice.

Instead of rolling damage for weapons, the damage done is resolved by the weapon check.

For example

I am going to attack a bandit with a long sword, a complex weapon.  I have 3 talent in complex weapons and +3 skills for a roll of 3d10.
The defender rolls an evasion or deflection check..Lets just say their talents and skills equal an evasion of 2d6.  
I roll a 6, 8 and 1, They roll a 5

That means I hit them, because 2 dice are higher.
A long sword has the following damage:  3 damage, 2 extra.
The first dice that hits (the highest) deals 3 damage, and then every extra dice deals 2.  Because only 1 extra dice hit, i deal a total of 3+2 damage

However, the enemy may have mitigation to the damage types:
Damage Types: Physical, Heat, Cold, Lightning, Dark, Divine, Arcane, Psychic, Toxic

A sword deals physical damage.  If the enemy had +4 mitigation, that means any damage equal to 4 or lower is completely mitigated to 0. In this example, the sword did 5 damage, so the enemy takes ALL the damage.
If the attack roll was changed to 6,1,1 - this would mean that the player only hit "1" dice for 3 damage which means, they deal nothing to an enemy who has 3 or more mitigation to physical damage.|

RULE CHANGE:  If the damage is over half but less than full, you take half damage. 

Also, evasion either completely dodges or gets hit completely
deflection will only reduce the damage by half, unless the character has a shield.

There are 2 types of shields:
Light and Heavy
Heavy will be more cumbersome and light will be less.

Light shield can only completely mitigate single target weapon/ranged attacks
Heavy can completely mitigate anything if successful.

Ranged weapons and spells will have an optimal range. 
Descriptor	Units	Notes
Adjacent	0	Literally touching
Nearby	1	Just out of arm’s reach
Very Short 2-5  Close AF
Short	6–10	Easily reached with effort
Moderate	11–20	Noticeable gap; needs focus
Far	21–40	Clearly far; limited detail
Very Far	41–60	Clearly far; limited detail
Distant	61–100	Hard to perceive clearly

A longbow may have a Distant range, giving a penalty for anything outside of it. 
Spells work in a similar way.  here are the types of magic:
Magic Types: Black, Primal, Metamagic, Divine, Mysticism
Each magic has 2 subschools, and 1 exotic spellschool
Black -> Necromancy, Witchcraft, (ex) Fiend
Primal -> Elemental, Nature, (ex) Cosmic
Metamagic -> Transmutation, Illusion, (ex) Fey
Divine -> Abjuration, Radiant, (ex) Draconic
Mysticism -> Spirit, Divination, (ex) Astral

When a person wants to channel a spell, they must know the spell. All spells will have a "minimum" number of complexity to be able to channel successfully. Say I have a firebolt, a fairly simple spell, that requires a "4" in primal magic to channel. 
I have 3 talents in primal magic and a +3 skill for a 3d10. I take the highest dice and compare it to the "4". If I succeed, i channel the spell. My roll on the spell doesnt' have an effect for how hard the spell is to avoid. It is hardcoded into the spell. So firebolt may require a 6 in evasion to dodge. The enemy would have to make a check against that, or it hits. The damage is likewise hardcoded into the spell.  This deals 5 damage. 

There are two options to reduce the difficulty of a spell: Channeling it as a ritual, and having a component. A ritual takes 1 hour and a component may be expensive. Every spell will have a component to make it easier to channel at the cost of financial contribution. Obviously, it makes no sense to channel a firebolt as a ritual in combat.

However, learning spells will require that a player use both the ritual and component (while not getting their benefits to make it easier).  So if a player wants to learn firebolt, they have to successfully roll a 4 while doing a ritual and using the component.  This is designed to simulate research and not to be done in combat, obviously.  This would be much more interesting for harder spells.  Think about a resurrection spell that requires a body and a diamond. A player would have to practice on corpses that meet the requirements of the spell over long periods. It may take several tries for them to learn it. 

A player is limited by spell slots, or how many spells they can know at a time. A player can trade out an old spell for a new one as they learn it.


Player Resources:

All players will have Health, Resolve and Energy.

Health determines what it sounds like. 

Resolve is mental health.  For instance, psychic damage deals damage directly to this. When a player reaches 0 resolve, they may "break" becoming more susceptible to mental effects like fear, panic and maybe even becoming catatonic. A player can also use resolve to "Stay up" in cmbat after reaching 0 health.

Energy is the resource for using Actions and Reactions.  By default a player has 5 max Energy, and generates +2 per round of combat, limiting their actions and reactions

In combat, a player can take 2 actions and move. Of course they are limited by Energy as well. 


Reaching 0 Health:
When a character reaches 0 health, they can elect to spend resolve to continue fighting at the risk of greater injury.
When a creature starts their turn with 0 health, if they want to remain consicious, they must make a resilience check of 4 or higher. They can choose to either fall prone and do nothing, or spend a resolve to keep fighting.
If a creature stays up at 0 health, they must roll a d20 when they take more than 5 damage or take damage from bleeding or poison. Otherwise, the hit is just a narrative "scar" or non-fatal wound.
A 11-20 means they are okay. a 1 means they are executed. a 2-9 means they receive a permanent injury of some kind (maybe roll on a table unless the dm has a "narrative token" to use)
If a creature does fall unconscious, to regain consciousness, they must either be stabilized and gain at least 1 health or complete a full rest at half health. 

 
Crafting:

Crafting works the same as the other skills (weapon & magic)
Crafting Skills: Engineering, Fabrication, Alchemy, Cooking, Glyphcraft, Bioshaping
There are talents and skills that determine what you can craft. Like spells, recipes can be learned.
There will be recipes for crafting which determine extra ingredients (like research) and such to make things.
Once a player character knows a recipie, they dont need that anymore

There is a concept of overcrafting which works similar to the attack dice having "extra damage". So if a talent 3, skill 4 player rolls a check to make a sword that requires a 6 to make:
they roll 3d12 and roll a 6, 7 and 3.  
The 7 is their success for the craft, and the 6 contributes to "overcrafting" which improves the recipe.

Languages:
Languages are a big part of the system, but mechanically detatched.  As with the other skills, they will have "4" tiers.
0 stars means you don't know the language at all
1 is basical knowledge
2 is fluency
3 is mastery

basic knowledge may cause you to have a penalty on persuasion/insight when trying to talk to or understand someone (1 less dice)
fluency is normal dice
and mastery is an extra dice
There are also magical languages that may have some effects.

MODULES:
Modules are the bread and butter of the system - they are mini-skill trees themed as an archetype.  There are 7 tiers with 11 total traits going in a 1-2-1-2-1-2-1 pattern where the player must select 1 option in the choice tiers. These are where unique actions & reactions will be obtained as well as skill increases and other traits/abilities that make a character more unqiue.
For example, Medic may give an Action to "triage" where they can apply some sort of healing effect.
A necromancer module may look something like this (WIP)


PLAYER PROGRESSION:

Instead of leveling, players will gain module points, awarded by their GM. They can then invest these into modules to grow stronger. Languages may be handled in a bit more nuanced way and be less official. 

There is currently a "trait" system to handle the more social aspects of the game, and how a player can recover/lose resolve over the course of roleplay or combat.

MOVEMENT:
All players have a standard movement. It will likely be between 4-6. Using the "Sprint Action" lets them go double of that by using a Energy) 

COMBAT RULES:
Characters act in initiative order, by rolling initiative with their coordination skill
Rounds are 6 seconds

Characters can only use reactions after their first turn. (making initative a little bit stronger)
Every round, a character can take 2 actions and move their standard movement and take as many reactions as they want.


DEFAULT ABILILITIES:
All characters will have default abilities

Actions:

Rest (remove winded, gain +2 energy)
Sprint (move full speed, spend 1 energy)
Grapple (+1 energy, lasts only one round)
Jump (+1 energy pick a tile to jump to, roll a fitness check, you succeed..Up to your movemnet speed)
ex: i want to to jump 4 units, i have 1 talent in physique and 2 skill for a 1d6. I only roll a 3, so i only jump 3 units.
Attack (Costs no energy)
Channel A Spell (Costs some energy)

Reactions:
Attack of Opportunity (hit a guy leaving your area, spend 1 energy)
Cover Eyes (Cover eyes from vision attacks, have to be quick)
Cover Ears (Cover ears from sonic attacks, have to be quick)
Fall Prone (Fall to the ground)

CONDITIONS:
(These are still a WIP and not final)

Mental Conditions
Condition	Effect
Broken	Resolve is 0. Cannot regain Resolve. All Mind checks (Resilience, Concentration, Logic, Senses) suffer a -1 die penalty. Must make a DC 10 check during a Favorable Rest (Resilience or Concentration) to recover.
Numbed	Cannot gain or lose Resolve. Cannot use Resolve to stay up at 0 Health.
Dazed	Cannot use Concentration. Ends at the end of your next turn automatically.
Stunned	Cannot take Actions or Reactions. Requires a DC 10 Resilience, Concentration, or Endurance check to recover. The DC is reduced by 1 after each failed attempt.
Afraid	Cannot take Reactions. Must roll DC 12 Resilience to use an Action. On failure, you move away from the source of fear a number of units equal to half the difference. On success, the condition ends. Each failure lowers the DC by 1.
Maddened	You attack allies and cannot distinguish friend from foe. All targets are treated as hostile.
Charmed	You are under the influence of another creature. Cannot target them with hostile actions. May obey commands.
Confused	Each turn, roll 1d4: (1) attack random target, (2) move in a random direction, (3) lose your Action, (4) act normally.

Physical Conditions
Condition	Effect
Winded	Cannot regenerate energy. Ends after taking a Rest Action.
Prone	You are on the ground. Movement is halved. Melee attackers gain +1 die against you. Ranged attackers have Disadvantage.
Bleeding	Take 1 damage at the end of your turn. Can be stopped with a successful Medicine check or magical healing.
Blinded	-1 die on all Attack rolls and Defense rolls (Evasion or Deflection). Cannot make visual checks.
Incapacitated	You cannot take Actions, Reactions, or Movement. Automatically fail physical defense checks. Affects sleeping, paralyzed, frozen, or unconscious states.
Impaired	You cannot move or take Reactions. -1 die on both Attack rolls and Defense checks. Cannot use 2-handed weapons effectively. Applies to being Grappled, tangled, hobbled, etc.
Weakened	You deal -1 damage with all attacks and abilities. Optional: also take -1 die on Might or Endurance checks.
Energized	Regenerate +1 extra energy per round. Optional: +1 movement speed. Ends after 2 rounds or upon becoming Winded.

Stealth Condition
Condition	Effect
Obscured	You are undetected by normal senses. Encompasses being invisible, hidden, or obscured by terrain or magic. You cannot be directly targeted unless a creature succeeds on a relevant detection check (Senses, Magic, etc.). Attackers have Disadvantage; your attacks gain +1 die if undetected.

Possible other conditions (poisoned, diseased, panic?, 

Creature tiers
Minion
Thrall
Foe
Champion
Elite
Legend
Mythic


Cultural Ideas
Bonus social dice with different groups, like merchants, nobles, soldiers, etc.