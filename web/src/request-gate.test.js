import { describe, expect, it } from 'vitest';
import { createRequestGate } from './request-gate.js';

function flush() {
  return Promise.resolve();
}

describe('request gate', () => {
  it('reserves one slot from background reads for an interactive write', async () => {
    const gate = createRequestGate({ maxConcurrent: 3, maxConcurrentReads: 2 });
    let thirdReadStarted = false;
    let writeStarted = false;

    await gate.acquire({ readOnly: true });
    await gate.acquire({ readOnly: true });
    gate.acquire({ readOnly: true }).then(() => { thirdReadStarted = true; });
    gate.acquire({ readOnly: false }).then(() => { writeStarted = true; });
    await flush();

    expect(writeStarted).toBe(true);
    expect(thirdReadStarted).toBe(false);
    expect(gate.snapshot()).toEqual({ inFlight: 3, inFlightReads: 2, queued: 1 });

    gate.release({ readOnly: false });
    await flush();
    expect(thirdReadStarted).toBe(false);

    gate.release({ readOnly: true });
    await flush();
    expect(thirdReadStarted).toBe(true);
  });

  it('promotes a queued write before queued reads when capacity opens', async () => {
    const gate = createRequestGate({ maxConcurrent: 3, maxConcurrentReads: 2 });
    const order = [];

    await gate.acquire({ readOnly: true });
    await gate.acquire({ readOnly: true });
    await gate.acquire({ readOnly: false });

    gate.acquire({ readOnly: true }).then(() => order.push('read'));
    gate.acquire({ readOnly: false }).then(() => order.push('write'));

    gate.release({ readOnly: true });
    await flush();
    expect(order).toEqual(['write']);
  });
});
