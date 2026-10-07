import _configureTestStore from '@test/store';
import {startTSSEvmAccountSync, syncTSSEvmAccount} from './tss-account';
import {deleteKey, successUpdateKey} from '../../wallet.actions';
import {WalletActionTypes} from '../../wallet.types';

type MockStore = {
  dispatch: (action: any) => any;
  getState: () => any;
};
const configureTestStore = _configureTestStore as unknown as (
  overrides?: any,
) => MockStore;

jest.mock('@test/store', () => ({
  __esModule: true,
  default: jest.fn((overrides: any = {}) => {
    const {walletReducer, initialState} = require('../../wallet.reducer');
    const state: any = {
      APP: {
        notificationsAccepted: false,
        emailNotifications: {accepted: false},
      },
      WALLET: {...initialState, ...(overrides.WALLET || {})},
    };
    const getState = () => state;
    const dispatch = jest.fn((action: any): any => {
      if (typeof action === 'function') {
        return action(dispatch, getState);
      }
      state.WALLET = walletReducer(state.WALLET, action);
      return action;
    });
    return {dispatch, getState};
  }),
}));

jest.mock('../../../../managers/LogManager', () => ({
  logManager: {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../../../managers/TokenManager', () => ({
  tokenManager: {getTokenOptions: jest.fn(() => ({tokenOptionsByAddress: {}}))},
}));

jest.mock('../../../../constants/config', () => ({
  BASE_BWS_URL: 'https://bws.test/bws/api',
}));

jest.mock('../../../../constants/currencies', () => ({
  BitpaySupportedEvmCoins: {
    eth: {name: 'Ethereum', coin: 'eth'},
    matic: {name: 'Polygon', coin: 'pol'},
    arb: {name: 'Arbitrum', coin: 'eth'},
  },
}));

jest.mock('../../utils/currency', () => ({
  IsEVMChain: jest.fn((chain: string) => chain !== 'btc'),
}));

jest.mock('../../utils/wallet', () => ({
  buildWalletObj: jest.fn((credentials: any) => ({
    id: credentials.walletId,
    chain: credentials.chain,
    tssKeyId: credentials.tssKeyId,
    receiveAddress: credentials.receiveAddress,
  })),
  mapAbbreviationAndName: jest.fn(() => () => ({
    currencyAbbreviation: 'eth',
    currencyName: 'Ether',
  })),
  checkPrivateKeyEncrypted: jest.fn(() => false),
}));

jest.mock('../address/address', () => ({
  createWalletAddress: jest.fn(({wallet}: any) => async () => {
    wallet.receiveAddress = '0xaccountaddress';
    return wallet.receiveAddress;
  }),
}));

jest.mock('../../../app/app.effects', () => ({
  subscribePushNotifications: jest.fn(() => ({type: 'MOCK_PUSH_NOTIF'})),
  subscribeEmailNotifications: jest.fn(() => ({type: 'MOCK_EMAIL_NOTIF'})),
}));

jest.mock('../../../../lib/bwc', () => {
  const mockInstance: any = {
    getClient: jest.fn(),
    getTssKey: jest.fn(),
  };
  return {
    BwcProvider: {getInstance: jest.fn(() => mockInstance)},
    __mockInstance: mockInstance,
  };
});

const {__mockInstance: mockBwcInstance} = jest.requireMock(
  '../../../../lib/bwc',
) as any;
const {BitpaySupportedEvmCoins: mockEvmCoins} = jest.requireMock(
  '../../../../constants/currencies',
) as any;
const {logManager: mockLogManager} = jest.requireMock(
  '../../../../managers/LogManager',
) as any;

const ACCOUNT_ADDRESS = '0xaccountaddress';
const TSS_KEY_ID = 'tss-key-id-1';
const CREATOR_PUB = 'creator-request-pub-key';
const JOINER_PUB = 'joiner-request-pub-key';
const THIRD_PUB = 'third-request-pub-key';
const OUTSIDER_PUB = 'outsider-request-pub-key';
const MEMBERS = [
  {partyId: 0, requestPubKey: CREATOR_PUB},
  {partyId: 1, requestPubKey: JOINER_PUB},
];
const ROSTER = {
  tssKeyId: TSS_KEY_ID,
  members: MEMBERS,
  signature: 'roster-signature',
};

let serverWallets: Record<string, {chain: string; ring: string[]}>;
let serverInvites: Record<string, Record<string, any>>;

const getWalletCoin = (chain: string) => (chain === 'matic' ? 'matic' : 'eth');

function createFakeCredentials(data: any = {}) {
  const credentials: any = {
    tssKeyId: TSS_KEY_ID,
    network: 'livenet',
    walletPrivKey: 'wallet-priv-key',
    publicKeyRing: [],
    ...data,
  };
  credentials.isComplete = () => credentials.publicKeyRing.length > 1;
  credentials.addPublicKeyRing = jest.fn((ring: any[]) => {
    credentials.publicKeyRing = ring;
  });
  credentials.toObj = () => JSON.parse(JSON.stringify(credentials));
  return credentials;
}

function createFakeClient(data: any = {}) {
  const client: any = {credentials: createFakeCredentials(data)};
  client.fromObj = jest.fn((obj: any) => {
    client.credentials = createFakeCredentials(obj);
  });
  client.openWallet = jest.fn(async () => {
    const {credentials} = client;
    const walletId =
      credentials.walletId ||
      Object.keys(serverWallets).find(
        id =>
          serverWallets[id].chain === credentials.chain &&
          serverWallets[id].ring.includes(credentials.requestPubKey),
      );
    if (!walletId || !serverWallets[walletId]) {
      throw new Error('bwc.ErrorWALLET_NOT_FOUND');
    }
    credentials.walletId = walletId;
    credentials.addPublicKeyRing(
      serverWallets[walletId].ring.map(requestPubKey => ({requestPubKey})),
    );
  });
  return client;
}

const mockTssKeyClass = {
  verifyRoster: jest.fn(
    ({roster}: any) => roster?.signature === 'roster-signature',
  ),
  inviteMembers: jest.fn(async ({client, members, roster}: any) => {
    const {walletId, requestPubKey} = client.credentials;
    const recipients = members.filter(
      (member: any) => member.requestPubKey !== requestPubKey,
    );
    serverInvites[walletId] = serverInvites[walletId] || {};
    for (const member of recipients) {
      serverInvites[walletId][member.requestPubKey] = {
        senderRequestPubKey: requestPubKey,
        encryptedSecret: 'encrypted-secret',
        roster,
      };
    }
    return recipients.length;
  }),
};

const getRegistry = (requestPubKey: string) =>
  Object.entries(serverWallets).map(([id, {chain, ring}]) => ({
    id,
    chain,
    coin: getWalletCoin(chain),
    network: 'livenet',
    copayers: ring.length,
    joined: ring.includes(requestPubKey),
    invite: serverInvites[id]?.[requestPubKey] || null,
  }));

function createFakeTssKey({
  partyId = 0,
  requestPubKey = CREATOR_PUB,
  m = 2,
  n = 2,
} = {}) {
  return {
    metadata: {id: TSS_KEY_ID, m, n, partyId},
    createCredentials: jest.fn((_password: any, opts: any) =>
      createFakeCredentials({...opts, requestPubKey}),
    ),
    createRoster: jest.fn((members: any[]) => ({
      tssKeyId: TSS_KEY_ID,
      members,
      signature: 'roster-signature',
    })),
    createWalletForChain: jest.fn(
      async ({chain, coin, members, roster}: any) => {
        const walletId = `${chain}-wallet`;
        serverWallets[walletId] = {chain, ring: [requestPubKey]};
        const client = createFakeClient({
          walletId,
          chain,
          coin,
          requestPubKey,
          publicKeyRing: [{requestPubKey}],
        });
        await mockTssKeyClass.inviteMembers({client, members, roster});
        return {client};
      },
    ),
    joinWalletFromInvite: jest.fn(async ({wallet}: any) => {
      serverWallets[wallet.id].ring.push(requestPubKey);
      delete serverInvites[wallet.id][requestPubKey];
      return {
        client: createFakeClient({
          walletId: wallet.id,
          chain: wallet.chain,
          coin: wallet.coin,
          requestPubKey,
        }),
        roster: wallet.invite.roster,
      };
    }),
  };
}

function createTssWallet({
  chain = 'eth',
  requestPubKey = CREATOR_PUB,
  ring = [CREATOR_PUB, JOINER_PUB],
}: {chain?: string; requestPubKey?: string; ring?: string[]} = {}) {
  const walletId = `${chain}-wallet`;
  serverWallets[walletId] = serverWallets[walletId] || {chain, ring};
  const wallet = createFakeClient({
    walletId,
    chain,
    coin: getWalletCoin(chain),
    requestPubKey,
    copayerName: 'Alice',
    publicKeyRing: ring.map(pubKey => ({requestPubKey: pubKey})),
  });
  Object.assign(wallet, {
    id: walletId,
    chain,
    tssKeyId: TSS_KEY_ID,
    receiveAddress: ACCOUNT_ADDRESS,
  });
  wallet.getTssKeyWallets = jest.fn(async () => ({
    wallets: getRegistry(requestPubKey),
  }));
  return wallet;
}

function createTssKeyState({
  tssKey = createFakeTssKey(),
  wallets,
  ...overrides
}: any) {
  return {
    id: 'key-1',
    methods: tssKey,
    wallets,
    isPrivKeyEncrypted: false,
    isReadOnly: false,
    tssMembers: MEMBERS,
    tssRoster: ROSTER,
    ...overrides,
  };
}

const createStoreWithKey = (key: any) =>
  configureTestStore({WALLET: {keys: {[key.id]: key}}});

const getKey = (store: MockStore, keyId = 'key-1') =>
  store.getState().WALLET.keys[keyId];

const tick = async (n = 100) => {
  for (let i = 0; i < n; i++) {
    await Promise.resolve();
  }
};

// @jest/fake-timers 28 lacks advanceTimersByTimeAsync — interleave manually.
const advanceAndFlush = async (ms: number, steps = 10) => {
  const stepMs = Math.max(1, Math.floor(ms / steps));
  for (let i = 0; i < steps; i++) {
    jest.advanceTimersByTime(stepMs);
    await tick(10);
  }
};

beforeEach(() => {
  jest.clearAllMocks();
  serverWallets = {};
  serverInvites = {};
  mockBwcInstance.getTssKey.mockImplementation(() => mockTssKeyClass);
  mockBwcInstance.getClient.mockImplementation((credentials?: string) =>
    createFakeClient(credentials ? JSON.parse(credentials) : {}),
  );
});

afterEach(() => {
  jest.useRealTimers();
});

describe('syncTSSEvmAccount', () => {
  it('creates only the missing EVM networks and invites the other members', async () => {
    const tssKey = createFakeTssKey();
    const store = createStoreWithKey(
      createTssKeyState({tssKey, wallets: [createTssWallet()]}),
    );

    const hasPendingWork = await store.dispatch(syncTSSEvmAccount('key-1'));

    expect(hasPendingWork).toBe(true);
    expect(
      tssKey.createWalletForChain.mock.calls.map(([params]) => params.chain),
    ).toEqual(['matic', 'arb']);
    expect(tssKey.createWalletForChain).toHaveBeenCalledWith(
      expect.objectContaining({
        chain: 'matic',
        coin: 'matic',
        network: 'livenet',
        walletName: 'Polygon',
        copayerName: 'Alice',
        members: MEMBERS,
        roster: ROSTER,
      }),
    );
    expect(Object.keys(getKey(store).tssPendingNetworks)).toEqual([
      'matic',
      'arb',
    ]);
    expect(serverInvites['arb-wallet'][JOINER_PUB]).toBeDefined();
    expect(mockTssKeyClass.inviteMembers).toHaveBeenCalledTimes(2);
    expect(getKey(store).wallets).toHaveLength(1);
  });

  it.each(['deleted', 'replaced'])(
    'stops the sync when its key is %s and retries a replacement',
    async change => {
      const tssKey = createFakeTssKey();
      const primary = createTssWallet();
      const store = createStoreWithKey(
        createTssKeyState({tssKey, wallets: [primary]}),
      );
      const replacement =
        change === 'replaced'
          ? createTssKeyState({wallets: [createTssWallet()]})
          : undefined;
      primary.getTssKeyWallets.mockImplementation(async () => {
        store.dispatch(
          replacement
            ? successUpdateKey({key: replacement})
            : deleteKey({keyId: 'key-1'}),
        );
        return {wallets: getRegistry(CREATOR_PUB)};
      });

      expect(await store.dispatch(syncTSSEvmAccount('key-1'))).toBe(
        !!replacement,
      );
      expect(getKey(store)).toBe(replacement);
      expect(tssKey.createWalletForChain).not.toHaveBeenCalled();
      expect(store.dispatch).not.toHaveBeenCalledWith(
        expect.objectContaining({type: WalletActionTypes.UPDATE_TSS_ACCOUNT}),
      );
    },
  );

  it.each([
    ['pending', 'deleted'],
    ['pending', 'replaced'],
    ['local', 'deleted'],
    ['local', 'replaced'],
  ])(
    'does not invite after a %s wallet opens for a %s key',
    async (kind, change) => {
      const arb = createTssWallet({chain: 'arb', ring: [CREATOR_PUB]});
      const store = createStoreWithKey(
        createTssKeyState({
          wallets: [
            createTssWallet(),
            createTssWallet({chain: 'matic'}),
            ...(kind === 'local' ? [arb] : []),
          ],
          ...(kind === 'pending'
            ? {
                tssPendingNetworks: {
                  arb: {credentials: arb.credentials.toObj()},
                },
              }
            : {}),
        }),
      );
      const interruptOpen = (client: any) => {
        const open = client.openWallet;
        client.openWallet = jest.fn(async (opts: any) => {
          store.dispatch(
            change === 'deleted'
              ? deleteKey({keyId: 'key-1'})
              : successUpdateKey({
                  key: createTssKeyState({wallets: [createTssWallet()]}),
                }),
          );
          return open(opts);
        });
        return client;
      };
      if (kind === 'local') {
        interruptOpen(arb);
      } else {
        mockBwcInstance.getClient.mockImplementation((credentials?: string) =>
          interruptOpen(
            createFakeClient(credentials ? JSON.parse(credentials) : {}),
          ),
        );
      }

      expect(await store.dispatch(syncTSSEvmAccount('key-1'))).toBe(
        change === 'replaced',
      );
      expect(mockTssKeyClass.inviteMembers).not.toHaveBeenCalled();
    },
  );

  it('hands the secrets recovered while refreshing a local wallet to the update', async () => {
    const matic = createTssWallet({chain: 'matic', ring: [CREATOR_PUB]});
    delete matic.credentials.walletPrivKey;
    const openMatic = matic.openWallet;
    matic.openWallet = jest.fn(async (opts: any) => {
      matic.credentials.walletPrivKey = 'recovered-wallet-priv-key';
      return openMatic(opts);
    });
    const store = createStoreWithKey(
      createTssKeyState({wallets: [createTssWallet(), matic]}),
    );

    await store.dispatch(syncTSSEvmAccount('key-1'));

    const update = (store.dispatch as jest.Mock).mock.calls
      .map(([action]: any[]) => action)
      .find(
        (action: any) => action?.type === WalletActionTypes.UPDATE_TSS_ACCOUNT,
      );
    expect(update.payload.wallets).toContain(matic);
    expect(
      getKey(store).wallets.filter(
        (wallet: any) => wallet.id === 'matic-wallet',
      ),
    ).toHaveLength(1);
  });

  it('does not restore a local wallet removed while the sync was running', async () => {
    const primary = createTssWallet();
    const matic = createTssWallet({chain: 'matic', ring: [CREATOR_PUB]});
    const store = createStoreWithKey(
      createTssKeyState({wallets: [primary, matic]}),
    );
    primary.getTssKeyWallets.mockImplementation(async () => {
      const key = getKey(store);
      store.dispatch(
        successUpdateKey({
          key: {
            ...key,
            wallets: key.wallets.filter((wallet: any) => wallet !== matic),
          },
        }),
      );
      return {wallets: getRegistry(CREATOR_PUB)};
    });

    await store.dispatch(syncTSSEvmAccount('key-1'));

    expect(getKey(store).wallets).not.toContain(matic);
  });

  it('joins a network from the invite of another member and promotes it', async () => {
    serverWallets['arb-wallet'] = {chain: 'arb', ring: [CREATOR_PUB]};
    serverInvites['arb-wallet'] = {
      [JOINER_PUB]: {
        senderRequestPubKey: CREATOR_PUB,
        encryptedSecret: 'encrypted-secret',
        roster: ROSTER,
      },
    };
    serverWallets['matic-wallet'] = {chain: 'matic', ring: [CREATOR_PUB]};
    const tssKey = createFakeTssKey({partyId: 1, requestPubKey: JOINER_PUB});
    const store = createStoreWithKey(
      createTssKeyState({
        tssKey,
        tssRoster: undefined,
        wallets: [createTssWallet({requestPubKey: JOINER_PUB})],
      }),
    );

    const hasPendingWork = await store.dispatch(syncTSSEvmAccount('key-1'));

    expect(tssKey.joinWalletFromInvite).toHaveBeenCalledTimes(1);
    expect(tssKey.joinWalletFromInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: 'https://bws.test/bws/api',
        wallet: expect.objectContaining({id: 'arb-wallet'}),
        members: MEMBERS,
        creatorPubKey: CREATOR_PUB,
      }),
    );
    expect(tssKey.createWalletForChain).not.toHaveBeenCalled();
    const key = getKey(store);
    expect(key.wallets.map((wallet: any) => wallet.id)).toEqual([
      'eth-wallet',
      'arb-wallet',
    ]);
    expect(key.wallets[1].receiveAddress).toBe(ACCOUNT_ADDRESS);
    expect(key.tssRoster).toEqual(ROSTER);
    expect(key.tssPendingNetworks).toEqual({});
    expect(hasPendingWork).toBe(true);
  });

  it('waits for an invite instead of creating a network another member claimed', async () => {
    serverWallets['matic-wallet'] = {chain: 'matic', ring: [CREATOR_PUB]};
    serverWallets['arb-wallet'] = {chain: 'arb', ring: [CREATOR_PUB]};
    const tssKey = createFakeTssKey({partyId: 1, requestPubKey: JOINER_PUB});
    const store = createStoreWithKey(
      createTssKeyState({
        tssKey,
        wallets: [createTssWallet({requestPubKey: JOINER_PUB})],
      }),
    );

    const hasPendingWork = await store.dispatch(syncTSSEvmAccount('key-1'));

    expect(hasPendingWork).toBe(true);
    expect(tssKey.createWalletForChain).not.toHaveBeenCalled();
    expect(tssKey.joinWalletFromInvite).not.toHaveBeenCalled();
    expect(getKey(store).wallets).toHaveLength(1);
  });

  it('adopts a network it already joined but did not persist', async () => {
    serverWallets['matic-wallet'] = {
      chain: 'matic',
      ring: [CREATOR_PUB, JOINER_PUB],
    };
    serverWallets['arb-wallet'] = {
      chain: 'arb',
      ring: [CREATOR_PUB, JOINER_PUB],
    };
    const tssKey = createFakeTssKey({partyId: 1, requestPubKey: JOINER_PUB});
    const store = createStoreWithKey(
      createTssKeyState({
        tssKey,
        wallets: [createTssWallet({requestPubKey: JOINER_PUB})],
      }),
    );

    const hasPendingWork = await store.dispatch(syncTSSEvmAccount('key-1'));

    expect(hasPendingWork).toBe(false);
    expect(tssKey.createCredentials).toHaveBeenCalledWith(undefined, {
      chain: 'arb',
      coin: 'eth',
      network: 'livenet',
      account: 0,
    });
    expect(tssKey.joinWalletFromInvite).not.toHaveBeenCalled();
    expect(tssKey.createWalletForChain).not.toHaveBeenCalled();
    expect(getKey(store).wallets.map((wallet: any) => wallet.id)).toEqual([
      'eth-wallet',
      'matic-wallet',
      'arb-wallet',
    ]);
  });

  it('does not adopt a wallet that does not match the registry', async () => {
    serverWallets['arb-wallet'] = {
      chain: 'arb',
      ring: [CREATOR_PUB, JOINER_PUB],
    };
    const tssKey = createFakeTssKey({partyId: 1, requestPubKey: JOINER_PUB});
    const primary = createTssWallet({requestPubKey: JOINER_PUB});
    primary.getTssKeyWallets.mockResolvedValue({
      wallets: [
        {
          id: 'other-arb-wallet',
          chain: 'arb',
          coin: 'eth',
          network: 'livenet',
          copayers: 2,
          joined: true,
          invite: null,
        },
      ],
    });
    const store = createStoreWithKey(
      createTssKeyState({tssKey, wallets: [primary]}),
    );

    const hasPendingWork = await store.dispatch(syncTSSEvmAccount('key-1'));

    expect(hasPendingWork).toBe(true);
    expect(mockLogManager.warn).toHaveBeenCalledWith(
      expect.stringContaining('Adopted TSS wallet does not match the registry'),
    );
    expect(getKey(store).tssPendingNetworks.arb).toBeUndefined();
    expect(getKey(store).wallets).toHaveLength(1);
  });

  it('promotes a network at m members and keeps refreshing its ring until n', async () => {
    const members = [...MEMBERS, {partyId: 2, requestPubKey: THIRD_PUB}];
    const roster = {...ROSTER, members};
    const ring = [CREATOR_PUB, JOINER_PUB, THIRD_PUB];
    const tssKey = createFakeTssKey({m: 2, n: 3});
    const arbClient = createFakeClient({
      walletId: 'arb-wallet',
      chain: 'arb',
      coin: 'eth',
      requestPubKey: CREATOR_PUB,
    });
    serverWallets['arb-wallet'] = {
      chain: 'arb',
      ring: [CREATOR_PUB, JOINER_PUB],
    };
    const store = createStoreWithKey(
      createTssKeyState({
        tssKey,
        tssMembers: members,
        tssRoster: roster,
        tssPendingNetworks: {arb: {credentials: arbClient.credentials.toObj()}},
        wallets: [
          createTssWallet({ring}),
          createTssWallet({chain: 'matic', ring}),
        ],
      }),
    );

    expect(await store.dispatch(syncTSSEvmAccount('key-1'))).toBe(true);
    let key = getKey(store);
    expect(key.wallets.map((wallet: any) => wallet.id)).toEqual([
      'eth-wallet',
      'matic-wallet',
      'arb-wallet',
    ]);
    expect(key.tssPendingNetworks).toEqual({});
    expect(serverInvites['arb-wallet'][THIRD_PUB]).toBeDefined();

    serverWallets['arb-wallet'].ring.push(THIRD_PUB);

    expect(await store.dispatch(syncTSSEvmAccount('key-1'))).toBe(false);
    key = getKey(store);
    expect(key.wallets[2].credentials.publicKeyRing).toEqual(
      ring.map(requestPubKey => ({requestPubKey})),
    );
  });

  it('drops ring members that are not in the verified directory', async () => {
    serverWallets['matic-wallet'] = {
      chain: 'matic',
      ring: [CREATOR_PUB, JOINER_PUB],
    };
    serverWallets['arb-wallet'] = {
      chain: 'arb',
      ring: [CREATOR_PUB, OUTSIDER_PUB],
    };
    const arbCredentials = createFakeCredentials({
      walletId: 'arb-wallet',
      chain: 'arb',
      coin: 'eth',
      requestPubKey: CREATOR_PUB,
    }).toObj();
    const store = createStoreWithKey(
      createTssKeyState({
        tssPendingNetworks: {arb: {credentials: arbCredentials}},
        wallets: [createTssWallet(), createTssWallet({chain: 'matic'})],
      }),
    );

    expect(await store.dispatch(syncTSSEvmAccount('key-1'))).toBe(true);

    const key = getKey(store);
    expect(key.wallets).toHaveLength(2);
    expect(key.tssPendingNetworks.arb.credentials.publicKeyRing).toEqual([
      {requestPubKey: CREATOR_PUB},
    ]);
    expect(serverInvites['arb-wallet'][JOINER_PUB]).toBeDefined();
    expect(serverInvites['arb-wallet'][OUTSIDER_PUB]).toBeUndefined();
  });

  it('skips the steps that need the key password when the key is encrypted', async () => {
    const tssKey = createFakeTssKey();
    const store = createStoreWithKey(
      createTssKeyState({
        tssKey,
        isPrivKeyEncrypted: true,
        wallets: [createTssWallet()],
      }),
    );

    expect(await store.dispatch(syncTSSEvmAccount('key-1'))).toBe(false);
    expect(tssKey.createWalletForChain).not.toHaveBeenCalled();
    expect(tssKey.createCredentials).not.toHaveBeenCalled();

    await store.dispatch(
      syncTSSEvmAccount('key-1', {password: 'key-password'}),
    );
    expect(tssKey.createWalletForChain).toHaveBeenCalledWith(
      expect.objectContaining({chain: 'matic', password: 'key-password'}),
    );
  });

  it('does not call BWS when every network is complete', async () => {
    const primary = createTssWallet();
    const store = createStoreWithKey(
      createTssKeyState({
        wallets: [
          primary,
          createTssWallet({chain: 'matic'}),
          createTssWallet({chain: 'arb'}),
        ],
      }),
    );

    expect(await store.dispatch(syncTSSEvmAccount('key-1'))).toBe(false);
    expect(primary.getTssKeyWallets).not.toHaveBeenCalled();
  });

  it('does not sync a key without a verified member directory', async () => {
    const tssKey = createFakeTssKey();
    const primary = createTssWallet();
    const store = createStoreWithKey(
      createTssKeyState({tssKey, tssMembers: undefined, wallets: [primary]}),
    );

    expect(await store.dispatch(syncTSSEvmAccount('key-1'))).toBe(false);
    expect(primary.getTssKeyWallets).not.toHaveBeenCalled();
    expect(tssKey.createWalletForChain).not.toHaveBeenCalled();
  });

  it('leaves out a network whose TSS join BWS rejects', async () => {
    const tssKey = createFakeTssKey();
    tssKey.createWalletForChain.mockRejectedValueOnce(
      new Error(
        'TSS_NON_PARTICIPANT: You are not a participant in this session',
      ),
    );
    const store = createStoreWithKey(
      createTssKeyState({tssKey, wallets: [createTssWallet()]}),
    );

    expect(await store.dispatch(syncTSSEvmAccount('key-1'))).toBe(true);
    expect(mockLogManager.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Could not add matic wallet: TSS_NON_PARTICIPANT',
      ),
    );
    const key = getKey(store);
    expect(Object.keys(key.tssPendingNetworks)).toEqual(['arb']);
    expect(key.wallets).toHaveLength(1);
  });

  it('adds an EVM chain that becomes supported after the key was created', async () => {
    const tssKey = createFakeTssKey();
    const store = createStoreWithKey(
      createTssKeyState({
        tssKey,
        wallets: [
          createTssWallet(),
          createTssWallet({chain: 'matic'}),
          createTssWallet({chain: 'arb'}),
        ],
      }),
    );
    mockEvmCoins.newchain = {name: 'New Chain', coin: 'eth'};

    try {
      await store.dispatch(syncTSSEvmAccount('key-1'));
    } finally {
      delete mockEvmCoins.newchain;
    }

    expect(tssKey.createWalletForChain).toHaveBeenCalledTimes(1);
    expect(tssKey.createWalletForChain).toHaveBeenCalledWith(
      expect.objectContaining({
        chain: 'newchain',
        coin: 'eth',
        walletName: 'New Chain',
      }),
    );
  });

  it('ignores registry networks that the app does not support', async () => {
    serverWallets['matic-wallet'] = {
      chain: 'matic',
      ring: [CREATOR_PUB, JOINER_PUB],
    };
    serverWallets['arb-wallet'] = {
      chain: 'arb',
      ring: [CREATOR_PUB, JOINER_PUB],
    };
    serverWallets['unknown-wallet'] = {chain: 'unknown', ring: [CREATOR_PUB]};
    serverInvites['unknown-wallet'] = {
      [JOINER_PUB]: {
        senderRequestPubKey: CREATOR_PUB,
        encryptedSecret: 'encrypted-secret',
      },
    };
    const tssKey = createFakeTssKey({partyId: 1, requestPubKey: JOINER_PUB});
    const store = createStoreWithKey(
      createTssKeyState({
        tssKey,
        wallets: [createTssWallet({requestPubKey: JOINER_PUB})],
      }),
    );

    await store.dispatch(syncTSSEvmAccount('key-1'));

    expect(tssKey.joinWalletFromInvite).not.toHaveBeenCalled();
    expect(
      getKey(store).wallets.some((wallet: any) => wallet.chain === 'unknown'),
    ).toBe(false);
  });

  it('runs one sync at a time for the same key', async () => {
    const primary = createTssWallet();
    let releaseFirstSync: () => void = () => {};
    let running = 0;
    let maxRunning = 0;
    primary.getTssKeyWallets.mockImplementation(async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      if (primary.getTssKeyWallets.mock.calls.length === 1) {
        await new Promise<void>(resolve => {
          releaseFirstSync = resolve;
        });
      }
      running--;
      return {wallets: getRegistry(CREATOR_PUB)};
    });
    const store = createStoreWithKey(createTssKeyState({wallets: [primary]}));

    const first = store.dispatch(syncTSSEvmAccount('key-1'));
    const second = store.dispatch(syncTSSEvmAccount('key-1'));
    await tick();
    expect(primary.getTssKeyWallets).toHaveBeenCalledTimes(1);

    releaseFirstSync();
    await Promise.all([first, second]);

    expect(primary.getTssKeyWallets).toHaveBeenCalledTimes(2);
    expect(maxRunning).toBe(1);
    expect(Object.keys(getKey(store).tssPendingNetworks)).toEqual([
      'matic',
      'arb',
    ]);
  });
});

describe('startTSSEvmAccountSync', () => {
  it('retries until a co-signer that starts later joins the new networks', async () => {
    jest.useFakeTimers();
    const tssKey = createFakeTssKey();
    const primary = createTssWallet();
    const store = createStoreWithKey(
      createTssKeyState({tssKey, wallets: [primary]}),
    );

    const loop = store.dispatch(startTSSEvmAccountSync('key-1'));
    await tick();
    expect(Object.keys(getKey(store).tssPendingNetworks)).toEqual([
      'matic',
      'arb',
    ]);

    serverWallets['matic-wallet'].ring.push(JOINER_PUB);
    serverWallets['arb-wallet'].ring.push(JOINER_PUB);
    await advanceAndFlush(5000);
    await loop;

    const key = getKey(store);
    expect(key.wallets.map((wallet: any) => wallet.id)).toEqual([
      'eth-wallet',
      'matic-wallet',
      'arb-wallet',
    ]);
    expect(key.tssPendingNetworks).toEqual({});
    expect(primary.getTssKeyWallets).toHaveBeenCalledTimes(2);

    await advanceAndFlush(20000);
    expect(primary.getTssKeyWallets).toHaveBeenCalledTimes(2);
  });

  it('does not start a second retry loop for the same key', async () => {
    jest.useFakeTimers();
    const primary = createTssWallet();
    const store = createStoreWithKey(createTssKeyState({wallets: [primary]}));

    const loop = store.dispatch(startTSSEvmAccountSync('key-1'));
    await tick();
    await store.dispatch(startTSSEvmAccountSync('key-1'));

    expect(primary.getTssKeyWallets).toHaveBeenCalledTimes(1);
    await advanceAndFlush(5000);
    expect(primary.getTssKeyWallets).toHaveBeenCalledTimes(2);

    serverWallets['matic-wallet'].ring.push(JOINER_PUB);
    serverWallets['arb-wallet'].ring.push(JOINER_PUB);
    await advanceAndFlush(10000);
    await loop;
    expect(primary.getTssKeyWallets).toHaveBeenCalledTimes(3);
  });

  it('retries until BWS supports TSS key wallets', async () => {
    jest.useFakeTimers();
    const tssKey = createFakeTssKey();
    const primary = createTssWallet();
    primary.getTssKeyWallets.mockRejectedValueOnce(
      new Error('Wallet service not found.'),
    );
    const store = createStoreWithKey(
      createTssKeyState({tssKey, wallets: [primary]}),
    );

    const loop = store.dispatch(startTSSEvmAccountSync('key-1'));
    await tick();
    expect(tssKey.createWalletForChain).not.toHaveBeenCalled();
    expect(getKey(store).tssPendingNetworks).toBeUndefined();
    expect(getKey(store).wallets).toHaveLength(1);
    expect(mockLogManager.error).toHaveBeenCalledWith(
      expect.stringContaining('Wallet service not found.'),
    );

    await advanceAndFlush(5000);
    expect(primary.getTssKeyWallets).toHaveBeenCalledTimes(2);
    expect(Object.keys(getKey(store).tssPendingNetworks)).toEqual([
      'matic',
      'arb',
    ]);

    serverWallets['matic-wallet'].ring.push(JOINER_PUB);
    serverWallets['arb-wallet'].ring.push(JOINER_PUB);
    await advanceAndFlush(10000);
    await loop;
    expect(getKey(store).tssPendingNetworks).toEqual({});
  });
});
