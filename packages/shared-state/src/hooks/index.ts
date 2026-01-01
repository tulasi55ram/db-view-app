/**
 * React hooks for shared state and actions
 */

export {
  useQueryActions,
  useTableActions,
  useERDiagramActions,
  // Standalone timing functions for message handlers
  getQueryStartTime,
  setQueryStartTime,
  clearQueryStartTime,
} from './useQueryActions.js';
