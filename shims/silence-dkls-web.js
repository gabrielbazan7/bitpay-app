import { callWorker } from '../src/dkls/DklsWorker';

const preview = (v) => {
  try { return JSON.stringify(v).slice(0, 200); } catch { return String(v).slice(0,200); }
};

export default async function init() {
  console.log('[DKLS shim] init()');
  const r = await callWorker({ type: 'init' });
  console.log('[DKLS shim] init() ok ->', r);
}

/**
 * NOTE: Converts any RN-side Message wrapper into a plain `{ _id }` handle
 * before sending it to the WebView. This is required because dkls-wasm expects
 * either a handle or a plain `{ payload, from_id, to_id }` object — not the
 * async JS wrapper. Without this normalization, the WebView may reject input
 * and trigger `CBOR decode` errors.
 */
async function toHandleJSON(m) {
  if (!m) return m;
  if (typeof m._id === 'number') return m;
  if (m._ready && typeof m._ready.then === 'function') {
    try {
      await m._ready;
    } catch (e) {
    }
  }
  if (typeof m._objId === 'number') {
    return { _id: m._objId };
  }
  if (m && typeof m === 'object' && 'payload' in m && 'from_id' in m) {
    return m;
  }
  return m;
}

async function normalizeMsgsForBridge(msgs) {
  if (!Array.isArray(msgs)) return msgs;
  return Promise.all(msgs.map(toHandleJSON));
}

function wrap(objId) {
  return {
    _id: objId,
    call(method, ...args) {
      console.log('[DKLS shim] proxy.call →', method, 'args=', preview(args));
      return callWorker({ type: 'call', objId, method, args });
    },
    free() {
      console.log('[DKLS shim] proxy.free');
      return callWorker({ type: 'free', objId });
    },
  };
}

function wrapAs(Cls, objId) {
  const o = Object.create(Cls.prototype);
  o._ready = Promise.resolve((o._proxy = wrap(objId)));
  // ayuda a que, si se serializa, viaje como handle
  o._objId = objId;
  o.toJSON = function(){ return { _id: this._objId ?? (this._proxy && this._proxy._id) }; };
  return o;
}

const toU8 = (x) =>
  x instanceof Uint8Array ? x :
  Array.isArray(x) ? new Uint8Array(x) :
  (x && typeof x === 'object') ? new Uint8Array(Object.values(x)) :
  x;

export class KeygenSession {
  constructor(participants, threshold, party_id, seed) {
    console.log('[DKLS shim] new KeygenSession', { participants, threshold, party_id, seedType: typeof seed });
    this._ready = callWorker({
      type: 'construct',
      className: 'KeygenSession',
      args: [participants, threshold, party_id, seed],
    }).then(({ objId }) => (this._proxy = wrap(objId)));
  }

  static async fromBytes(bytes) {
    console.log('[DKLS shim] KeygenSession.fromBytes bytesType=', (bytes instanceof Uint8Array ? 'u8' : typeof bytes), 'len=', bytes?.length ?? -1);
    const { objId } = await callWorker({
      type: 'staticConstruct',
      className: 'KeygenSession',
      method: 'fromBytes',
      args: [toU8(bytes)],
    });
    console.log('[DKLS shim] fromBytes -> objId', objId);
    return wrapAs(KeygenSession, objId);
  }

  static async initKeyRotation(keyshare, seed) {
    console.log('[DKLS shim] KeygenSession.initKeyRotation seedType=', typeof seed);
    const { objId } = await callWorker({
      type: 'staticConstruct',
      className: 'KeygenSession',
      method: 'initKeyRotation',
      args: seed ? [keyshare, toU8(seed)] : [keyshare],
    });
    console.log('[DKLS shim] initKeyRotation -> objId', objId);
    return wrapAs(KeygenSession, objId);
  }

  async toBytes() {
    await this._ready;
    const r = await this._proxy.call('toBytes');
    console.log('[DKLS shim] toBytes len=', r?.length ?? -1);
    return toU8(r);
  }

  async createFirstMessage() {
    await this._ready;
    const res = await this._proxy.call('createFirstMessage');
    console.log('[DKLS shim] createFirstMessage ->', preview(res));
    return (res && res.objId) ? wrapAs(Message, res.objId) : res;
  }

  async handleMessages(msgs, commitments, seed) {
    await this._ready;
    console.log('[DKLS shim] handleMessages in', {
      count: Array.isArray(msgs) ? msgs.length : -1,
      commitments: preview(commitments),
      seedType: typeof seed,
    });
    const safeMsgs = await normalizeMsgsForBridge(msgs);
    const res = await this._proxy.call('handleMessages', safeMsgs, commitments, seed);
    console.log('[DKLS shim] handleMessages out', preview(res));
    return Array.isArray(res) && res.length && res[0]?.objId
      ? res.map(r => wrapAs(Message, r.objId))
      : res;
  }

  async keyshare() {
    await this._ready;
    const res = await this._proxy.call('keyshare');
    console.log('[DKLS shim] keyshare ->', preview(res));
    return (res && res.objId) ? wrapAs(Keyshare, res.objId) : res;
  }
}

export class SignSession {
  constructor(keyshare, chain_path, seed) {
    console.log('[DKLS shim] new SignSession', { chain_path, seedType: typeof seed });
    this._ready = callWorker({
      type: 'construct',
      className: 'SignSession',
      args: [keyshare, chain_path, seed],
    }).then(({ objId }) => (this._proxy = wrap(objId)));
  }

  async createFirstMessage() {
    await this._ready;
    const res = await this._proxy.call('createFirstMessage');
    console.log('[DKLS shim] sign.createFirstMessage ->', preview(res));
    return (res && res.objId) ? wrapAs(Message, res.objId) : res;
  }

  async handleMessages(msgs, seed) {
    await this._ready;
    console.log('[DKLS shim] sign.handleMessages in', {
      count: Array.isArray(msgs) ? msgs.length : -1,
      seedType: typeof seed,
    });
    const safeMsgs = await normalizeMsgsForBridge(msgs);
    const res = await this._proxy.call('handleMessages', safeMsgs, seed);
    console.log('[DKLS shim] sign.handleMessages out', preview(res));
    return Array.isArray(res) && res.length && res[0]?.objId
      ? res.map(r => wrapAs(Message, r.objId))
      : res;
  }

  async lastMessage(message_hash) {
    await this._ready;
    console.log('[DKLS shim] lastMessage in hashLen=', message_hash?.length ?? -1);
    const r = await this._proxy.call('lastMessage', message_hash);
    console.log('[DKLS shim] lastMessage out', preview(r));
    return r;
  }

  async combine(msgs) {
    await this._ready;
    console.log('[DKLS shim] combine in count=', Array.isArray(msgs) ? msgs.length : -1);
    const r = await this._proxy.call('combine', msgs);
    console.log('[DKLS shim] combine out', preview(r));
    return r;
  }
}

export class Message {
  constructor(payload, from_id, to_id) {
    const isU8 = payload instanceof Uint8Array;
    const u8 = isU8 ? payload : new Uint8Array(payload ?? []);
    const len = u8.length;

    console.log('[DKLS shim] new Message', { payloadType: 'u8', len, from_id, to_id });
    this._ready = callWorker({
      type: 'construct',
      className: 'Message',
      args: [u8, from_id, to_id],
    }).then(({ objId }) => {
      this._proxy = wrap(objId);
      this._objId = objId;
      this.toJSON = () => ({ _id: this._objId ?? (this._proxy && this._proxy._id) });
    });
  }

  async payload() { await this._ready; return this._proxy.call('payload'); }
  async from_id() { await this._ready; return this._proxy.call('from_id'); }
  async to_id()   { await this._ready; return this._proxy.call('to_id'); }
  async free()    { await this._ready; return this._proxy.free(); }
}

export class Keyshare {
  constructor(objId) {
    if (typeof objId === 'number') {
      console.log('[DKLS shim] wrap Keyshare objId', objId);
      this._ready = Promise.resolve((this._proxy = wrap(objId)));
    } else {
      this._ready = Promise.reject(new Error('Keyshare should be obtained from KeygenSession.keyshare()'));
    }
  }
  async toBytes() { await this._ready; const r = await this._proxy.call('toBytes'); console.log('[DKLS shim] Keyshare.toBytes len=', r?.length ?? -1); return toU8(r); }
  async free()    { await this._ready; console.log('[DKLS shim] Keyshare.free'); return this._proxy.free(); }
}

try {
  module.exports = { __esModule: true, default: init, KeygenSession, SignSession, Message, Keyshare };
} catch {}