import { installMaterializedSkill } from "../native.mjs";

export class SkillAdapter {
  constructor(capability) {
    this.capability = capability;
  }

  async install(options) {
    const { agent, scope, overwrite, force } = options;
    return installMaterializedSkill(this.capability, { agent, scope, overwrite, force });
  }
}
