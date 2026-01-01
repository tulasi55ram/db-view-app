/**
 * Utility exports
 */

export {
  createMessageAdapter,
  createVSCodeAdapter,
  createElectronAdapter,
  createDevAdapter,
  getMessageAdapter,
  resetMessageAdapter,
  sendMessage,
  sendMessageMulti,
} from './messageAdapter.js';

export type { MessageAdapter } from '../types/index.js';
