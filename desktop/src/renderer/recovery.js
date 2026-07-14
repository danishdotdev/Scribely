(function registerRecoveryHelper(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.scribelyRecovery = api;
})(typeof window === 'undefined' ? null : window, () => ({
  needsRecovery(session, activeSessionId) {
    return Boolean(
      session
      && session.mode === 'local_capture'
      && session.status === 'recording'
      && session.id !== activeSessionId
    );
  }
}));
