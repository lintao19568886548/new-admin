import { registerSkill } from '../skill-registry';
import { llmChatResponseSkill } from './llm-chat-response';

let registered = false;

export function registerBuiltinAgentSkills() {
  if (registered) {
    return;
  }
  registerSkill(llmChatResponseSkill);
  registered = true;
}
