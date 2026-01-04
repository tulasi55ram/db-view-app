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
  generateCorrelationId,
} from './messageAdapter.js';

export type {
  MessageAdapter,
  CorrelatedMessage,
  SendMessageOptions,
} from '../types/index.js';
