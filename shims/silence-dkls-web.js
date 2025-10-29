import { callWorker } from '../src/dkls/DklsWorker';

export default async function init() {
  await callWorker({ type: 'init' });
}

function wrap(objId) {
  return {
    _id: objId,
    call(method, ...args) {
      return callWorker({ type: 'call', objId, method, args });
    },
    free() {
      return callWorker({ type: 'free', objId });
    },
  };
}

function wrapAs(Cls, objId) {
  const o = Object.create(Cls.prototype);
  o._ready = Promise.resolve((o._proxy = wrap(objId)));
  return o;
}

const toU8 = (x) =>
  x instanceof Uint8Array ? x :
  Array.isArray(x) ? new Uint8Array(x) :
  (x && typeof x === 'object') ? new Uint8Array(Object.values(x)) :
  x;

export class KeygenSession {
  constructor(participants, threshold, party_id, seed) {
    this._ready = callWorker({
      type: 'construct',
      className: 'KeygenSession',
      args: [participants, threshold, party_id, seed],
    }).then(({ objId }) => (this._proxy = wrap(objId)));
  }

  static async fromBytes(bytes) {
    const { objId } = await callWorker({
      type: 'staticConstruct',
      className: 'KeygenSession',
      method: 'fromBytes',
      args: [toU8(bytes)],
    });
    return wrapAs(KeygenSession, objId);
  }

  static async initKeyRotation(keyshare, seed) {
    const { objId } = await callWorker({
      type: 'staticConstruct',
      className: 'KeygenSession',
      method: 'initKeyRotation',
      args: seed ? [keyshare, toU8(seed)] : [keyshare],
    });
    return wrapAs(KeygenSession, objId);
  }

  async toBytes() {
    await this._ready;
    return toU8(await this._proxy.call('toBytes'));
  }

  async createFirstMessage() {
    await this._ready;
    const res = await this._proxy.call('createFirstMessage');
    return (res && res.objId) ? wrapAs(Message, res.objId) : res;
  }

  async handleMessages(msgs, commitments, seed) {
    await this._ready;
    const res = await this._proxy.call('handleMessages', msgs, commitments, seed);
    return Array.isArray(res) && res.length && res[0]?.objId
      ? res.map(r => wrapAs(Message, r.objId))
      : res;
  }

  async keyshare() {
    await this._ready;
    const res = await this._proxy.call('keyshare');
    return (res && res.objId) ? wrapAs(Keyshare, res.objId) : res;
  }
}

export class SignSession {
  constructor(keyshare, chain_path, seed) {
    this._ready = callWorker({
      type: 'construct',
      className: 'SignSession',
      args: [keyshare, chain_path, seed],
    }).then(({ objId }) => (this._proxy = wrap(objId)));
  }

  async createFirstMessage() {
    await this._ready;
    const res = await this._proxy.call('createFirstMessage');
    return (res && res.objId) ? wrapAs(Message, res.objId) : res;
  }

  async handleMessages(msgs, seed) {
    await this._ready;
    const res = await this._proxy.call('handleMessages', msgs, seed);
    return Array.isArray(res) && res.length && res[0]?.objId
      ? res.map(r => wrapAs(Message, r.objId))
      : res;
  }

  async lastMessage(message_hash) {
    await this._ready;
    return this._proxy.call('lastMessage', message_hash);
  }

  async combine(msgs) {
    await this._ready;
    return this._proxy.call('combine', msgs);
  }
}

export class Message {
  constructor(payload, from_id, to_id) {
    this._ready = callWorker({
      type: 'construct',
      className: 'Message',
      args: [payload, from_id, to_id],
    }).then(({ objId }) => (this._proxy = wrap(objId)));
  }

  async payload() {
    await this._ready;
    return this._proxy.call('payload');
  }
  async from_id() {
    await this._ready;
    return this._proxy.call('from_id');
  }
  async to_id() {
    await this._ready;
    return this._proxy.call('to_id');
  }

  async free() {
    await this._ready;
    return this._proxy.free();
  }
}

export class Keyshare {
  constructor(objId) {
    // normalizamos para permitir wrap directo si llega {objId}
    if (typeof objId === 'number') {
      this._ready = Promise.resolve((this._proxy = wrap(objId)));
    } else {
      // En práctica no se construye manualmente, viene desde keyshare()
      this._ready = Promise.reject(
        new Error('Keyshare should be obtained from KeygenSession.keyshare()')
      );
    }
  }

  async toBytes() {
    await this._ready;
    const res = await this._proxy.call('toBytes');
    return toU8(res);
  }

  async free() {
    await this._ready;
    return this._proxy.free();
  }
}

try {
  module.exports = {
    __esModule: true,
    default: init,
    KeygenSession,
    SignSession,
    Message,
    Keyshare,
  };
} catch {}