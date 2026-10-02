import { installMaterializedSkill } from "../native.mjs";

export class SkillAdapter {
  constructor(capability) {
    this.capability = capability;
  }

  async install(options) {
    return installMaterializedSkill(this.capability, options);
  }
}
