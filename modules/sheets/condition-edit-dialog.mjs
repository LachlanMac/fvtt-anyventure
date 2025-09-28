/**
 * Simple Condition Edit Dialog for Anyventure system
 * Allows editing of current and starting check values
 */
export class AnyventureConditionEditDialog extends foundry.applications.api.DialogV2 {

  constructor(effect, options = {}) {
    const flags = effect.flags?.anyventure || {};

    super({
      window: {
        title: `Edit ${effect.label || "Condition"}`,
        contentClasses: ["anyventure-condition-edit-dialog"]
      },
      content: `
        <form>
          <div class="form-group">
            <label for="current-check">Current Check DC:</label>
            <input type="number"
                   id="current-check"
                   name="currentCheck"
                   value="${flags.currentCheck || 10}"
                   min="1"
                   max="30" />
          </div>

          <div class="form-group">
            <label for="starting-check">Starting Check DC:</label>
            <input type="number"
                   id="starting-check"
                   name="startingCheck"
                   value="${flags.startingCheck || 10}"
                   min="1"
                   max="30" />
          </div>

          <div class="form-group">
            <label for="turns-active">Turns Active:</label>
            <input type="number"
                   id="turns-active"
                   name="turnsActive"
                   value="${flags.turnsActive || 0}"
                   min="0"
                   max="100" />
          </div>

          <div class="form-group">
            <label for="reduce-by">DC Reduces By:</label>
            <input type="number"
                   id="reduce-by"
                   name="reduceBy"
                   value="${flags.reduceBy || 1}"
                   min="0"
                   max="10" />
            <p class="hint">How much the DC reduces on failed recovery attempts</p>
          </div>
        </form>
      `,
      buttons: [
        {
          action: "save",
          label: "Save Changes",
          icon: "fa-solid fa-save",
          callback: (event, button, dialog) => this.handleSave(event, button, dialog)
        },
        {
          action: "cancel",
          label: "Cancel",
          icon: "fa-solid fa-times",
          callback: () => this.close()
        }
      ]
    });

    this.effect = effect;
  }

  async handleSave(event, button, dialog) {
    const formData = new FormData(dialog.querySelector('form'));

    const updates = {
      'flags.anyventure.currentCheck': parseInt(formData.get('currentCheck')) || 10,
      'flags.anyventure.startingCheck': parseInt(formData.get('startingCheck')) || 10,
      'flags.anyventure.turnsActive': parseInt(formData.get('turnsActive')) || 0,
      'flags.anyventure.reduceBy': parseInt(formData.get('reduceBy')) || 1
    };

    try {
      await this.effect.update(updates);
      ui.notifications.info(`Updated ${this.effect.label || "condition"} settings.`);
      this.close();
    } catch (error) {
      ui.notifications.error("Failed to update condition.");
      console.error("Condition update error:", error);
    }
  }

  /**
   * Static method to show the condition edit dialog
   */
  static async show(effect) {
    const dialog = new AnyventureConditionEditDialog(effect);
    return dialog.render({ force: true });
  }
}