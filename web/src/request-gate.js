export function createRequestGate({ maxConcurrent = 3, maxConcurrentReads = 2 } = {}) {
  let inFlight = 0;
  let inFlightReads = 0;
  const queue = [];

  function canStart(readOnly) {
    if (inFlight >= maxConcurrent) return false;
    if (readOnly && inFlightReads >= maxConcurrentReads) return false;
    return true;
  }

  function grant(entry) {
    inFlight += 1;
    if (entry.readOnly) inFlightReads += 1;
    entry.resolve();
  }

  function drain() {
    while (inFlight < maxConcurrent && queue.length) {
      // User-initiated writes must not starve behind background reads.
      let index = queue.findIndex(entry => !entry.readOnly && canStart(false));
      if (index < 0 && inFlightReads < maxConcurrentReads) {
        index = queue.findIndex(entry => entry.readOnly && canStart(true));
      }
      if (index < 0) return;
      const [entry] = queue.splice(index, 1);
      grant(entry);
    }
  }

  function acquire({ readOnly = false } = {}) {
    return new Promise(resolve => {
      queue.push({ readOnly: Boolean(readOnly), resolve });
      drain();
    });
  }

  function release({ readOnly = false } = {}) {
    inFlight = Math.max(0, inFlight - 1);
    if (readOnly) inFlightReads = Math.max(0, inFlightReads - 1);
    drain();
  }

  return {
    acquire,
    release,
    snapshot: () => ({ inFlight, inFlightReads, queued: queue.length }),
  };
}
