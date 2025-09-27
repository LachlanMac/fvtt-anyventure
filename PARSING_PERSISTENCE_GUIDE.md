# Parsing and Persistence Guide for Anyventure System

This guide explains the complete process for ensuring that parsed character data persists correctly through the character recalculation system.

## Overview

The Anyventure system uses a complex parsing and persistence flow to handle character progression through modules. When you add new parseable fields, you must update multiple places to ensure data flows correctly through the entire system.

## The Data Flow

```
Module Data Codes → Parse → Delta → Merge → Apply → Save to _base → Restore
```

## Required Steps for New Fields

### 1. Add to `createEmptyDelta()` in `data-parser.js`

Every new field category must be initialized in the empty delta structure:

```javascript
export function createEmptyDelta() {
  return {
    // ... existing fields ...

    // NEW FIELD CATEGORY
    yourNewField: {
      property1: 0,
      property2: 0
    }
  };
}
```

### 2. Add Parsing Logic in `data-parser.js`

Add the parsing logic for your new codes:

```javascript
// In parseAutoEffect() for simple A-codes
const autoMap = {
  // ... existing mappings ...
  'X': 'yourNewProperty'  // AX=5 maps to yourNewProperty
};

// OR create new parsing function for complex codes
function parseYourNewEffect([_, code, valueStr], delta) {
  const value = parseInt(valueStr);
  const yourNewMap = {
    'A': 'property1',
    'B': 'property2'
  };

  if (yourNewMap[code]) {
    delta.yourNewField[yourNewMap[code]] += value;
  }
}
```

### 3. Add to `mergeDeltas()` in `character-parser.js`

**THIS IS CRITICAL** - without this step, parsed values will be lost during character recalculation:

```javascript
function mergeDeltas(sourceDelta, targetDelta) {
  // ... existing merges ...

  // Merge your new field
  Object.entries(sourceDelta.yourNewField).forEach(([property, value]) => {
    if (property === 'specialProperty') {
      // Special handling if needed (like max values)
      targetDelta.yourNewField[property] = Math.max(targetDelta.yourNewField[property], value);
    } else {
      // Standard addition
      targetDelta.yourNewField[property] += value;
    }
  });
}
```

### 4. Add to `applyParsedEffectsToCharacter()` in `character-parser.js`

Include your field in the character object that gets passed to `applyDeltaToCharacter()`:

```javascript
const character = {
  // ... existing fields ...
  yourNewField: dup(actor.system.yourNewField || {})
};
```

And in the return updateData:

```javascript
const updateData = {
  // ... existing fields ...
  'system.yourNewField': character.yourNewField
};
```

### 5. Add to `applyDeltaToCharacter()` in `data-parser.js`

Add the logic to apply the delta to the character structure:

```javascript
// Apply your new field
Object.entries(delta.yourNewField).forEach(([property, value]) => {
  if (value !== 0) {
    if (!character.yourNewField) character.yourNewField = {};
    character.yourNewField[property] = (character.yourNewField[property] || 0) + value;
  }
});
```

### 6. Add Base Snapshot Support in `character-parser.js`

Add your field to the base snapshot creation in `recalculateCharacterFromModules()`:

```javascript
const baseSnapshot = {
  // ... existing fields ...
  yourNewField: dup(updateData['system.yourNewField'] || {
    property1: 0,
    property2: 0
  })
};
```

### 7. Add to `_restoreFromBase()` in `actor.mjs`

Add restoration logic:

```javascript
_restoreFromBase(systemData) {
  // ... existing restorations ...

  if (base.yourNewField) systemData.yourNewField = clone(base.yourNewField);
}
```

### 8. Add Default Initialization in `actor.mjs`

Add legacy support in `prepareBaseData()`:

```javascript
// Ensure yourNewField exists (for legacy characters)
if (!systemData.yourNewField) {
  systemData.yourNewField = {
    property1: 0,
    property2: 0
  };
}
if (!systemData._base.yourNewField) {
  systemData._base.yourNewField = {
    property1: 0,
    property2: 0
  };
}
```

### 9. Add to In-Place Parsing Function

If using `parseAndApplyCharacterEffectsInPlace()`, add your field there too:

```javascript
const character = {
  // ... existing fields ...
  yourNewField: actor.system.yourNewField || {}
};

// After applying delta
actor.system.yourNewField = character.yourNewField;
```

## Common Pitfalls

### 1. Missing from `mergeDeltas()`
**Symptom:** Parsing logs show correct values, but they become zeros after merging
**Cause:** The most common issue - parsed values get lost during delta merging

### 2. Wrong Property Names
**Symptom:** Values don't transfer between delta and character
**Cause:** Mismatched property names between delta structure and character structure

### 3. Missing Base Snapshot
**Symptom:** Values reset to zero after character recalculation
**Cause:** Field not included in base snapshot creation or restoration

### 4. Missing Legacy Support
**Symptom:** Errors on existing characters
**Cause:** No default initialization for characters created before the field existed

## Testing Checklist

When adding a new field, test:

1. ✅ Parsing: Does the data code parse correctly?
2. ✅ Merging: Do multiple sources combine correctly?
3. ✅ Application: Does the parsed data apply to the character?
4. ✅ Persistence: Does it survive character recalculation?
5. ✅ Restoration: Does it restore from _base correctly?
6. ✅ Legacy: Do existing characters handle the new field?

## Example: weaponModifications Journey

The `weaponModifications` field went through this exact process:

1. ✅ Added to `createEmptyDelta()` - had this
2. ✅ Added parsing logic for AA-AF codes - had this
3. ❌ **MISSING from `mergeDeltas()`** - this was the bug!
4. ❌ Missing from `applyParsedEffectsToCharacter()` - this was also missing
5. ✅ Had base snapshot support
6. ✅ Had restoration logic
7. ✅ Had legacy support

The missing steps 3 and 4 caused the values to be lost during character recalculation.

## Key Files to Update

1. `/modules/utils/data-parser.js` - Parsing and application logic
2. `/modules/utils/character-parser.js` - Merging and persistence logic
3. `/modules/documents/actor.mjs` - Restoration and legacy support

## Remember

**Every field that can be modified by module parsing must go through ALL these steps.** Missing even one step will cause data persistence issues that are difficult to debug.