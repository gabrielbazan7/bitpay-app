/**
 * @jest-environment-options {"customExportConditions": ["node", "require"]}
 */
import {Buffer as RNBuffer} from '@craftzdog/react-native-buffer';
import {mountDklsWorkerHost} from '@test/dklsWebView';
import {getFakeBwsWallets, resetFakeBws} from '@test/fakeBws';
import {restrictBufferApi} from '@test/rnBuffer';

jest.unmock('@bitpay-labs/bitcore-tss');
jest.mock('superagent', () => require('@test/fakeBws').fakeBwsAgent);
jest.mock('buffer', () => {
  const actual = jest.requireActual('buffer');
  return {
    ...actual,
    Buffer: require('@test/rnBuffer').restrictBufferApi(
      actual.Buffer,
      jest.requireActual('buffer/').Buffer,
    ),
  };
});
jest.mock('../tss-account/tss-account', () => ({
  ...jest.requireActual('../tss-account/tss-account'),
  startTSSEvmAccountSync: jest.fn(() => () => Promise.resolve()),
}));
jest.mock('../../../../managers/LogManager', () => ({
  logManager: {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

const nodeBuffer = global.Buffer;
global.Buffer = restrictBufferApi(nodeBuffer, RNBuffer);

const configureTestStore = require('@test/store').default;
const {
  startCreateTSSKey,
  generateJoinerSessionId,
  addCoSignerToTSS,
  startTSSCeremony,
  joinTSSWithCode,
  cancelTSSCeremony,
} = require('./create-multisig');
const {createWalletAddress} = require('../address/address');
const {createTxProposal, publishTx} = require('../send/send');
const {startTSSSigning} = require('../tss-send/tss-send');
const {syncTSSEvmAccount} = require('../tss-account/tss-account');
const {BitpaySupportedEvmCoins} = require('../../../../constants/currencies');
const {bootstrapKey} = require('../../../transforms/transforms');
const {BwcProvider} = require('../../../../lib/bwc');

jest.setTimeout(120000);

const RECIPIENT = '0x000000000000000000000000000000000000dEaD';

const settleAll = async (promises: Promise<any>[]) => {
  const results = await Promise.allSettled(promises);
  const failure = results.find(r => r.status === 'rejected');
  if (failure) {
    throw (failure as PromiseRejectedResult).reason;
  }
  return results.map(r => (r as PromiseFulfilledResult<any>).value);
};

const createSigningCallbacks = () => ({
  onStatusChange: jest.fn(),
  onCopayerStatusChange: jest.fn(),
  onRoundUpdate: jest.fn(),
  onProgressUpdate: jest.fn(),
  onComplete: jest.fn(),
  onError: jest.fn(),
});

const createTSSKeyPair = async (network: string, ceremonyKeyIds: string[]) => {
  const creatorStore = configureTestStore({});
  const joinerStore = configureTestStore({});

  const {key} = await creatorStore.dispatch(
    startCreateTSSKey({
      coin: 'eth',
      chain: 'eth',
      network,
      m: 2,
      n: 2,
      myName: 'Creator',
      walletName: 'TSS Wallet',
    }),
  );
  const {sessionId, partyKey} = await joinerStore.dispatch(
    generateJoinerSessionId({name: 'Joiner'}),
  );
  const {joinCode} = await creatorStore.dispatch(
    addCoSignerToTSS({keyId: key.id, joinerSessionId: sessionId, partyId: 1}),
  );
  ceremonyKeyIds.push(key.id);

  const [creatorKey, joinerKey] = await settleAll([
    creatorStore.dispatch(startTSSCeremony(key.id)),
    joinerStore.dispatch(
      joinTSSWithCode({
        joinCode,
        partyKey,
        myName: 'Joiner',
        onKeyCreated: (keyId: string) => ceremonyKeyIds.push(keyId),
      }),
    ),
  ]);
  return {creatorStore, joinerStore, creatorKey, joinerKey};
};

let unmountDklsWorker: () => void;

beforeAll(async () => {
  resetFakeBws();
  unmountDklsWorker = await mountDklsWorkerHost();
});

afterAll(() => {
  unmountDklsWorker();
  global.Buffer = nodeBuffer;
});

describe('TSS wallet flow against the real bitcore-wallet-client', () => {
  let creatorStore: any;
  let joinerStore: any;
  let creatorKey: any;
  let joinerKey: any;
  const ceremonyKeyIds: string[] = [];
  const hiddenOpCoin = BitpaySupportedEvmCoins.op;

  const getSavedKey = (store: any, key: any) =>
    store.getState().WALLET.keys[key.id];

  const syncBothParties = async () => {
    await creatorStore.dispatch(syncTSSEvmAccount(creatorKey.id));
    await joinerStore.dispatch(syncTSSEvmAccount(joinerKey.id));
    return creatorStore.dispatch(syncTSSEvmAccount(creatorKey.id));
  };

  const signWithBothParties = async (chain: string) => {
    const creatorWallet = getSavedKey(creatorStore, creatorKey).wallets.find(
      (wallet: any) => wallet.chain === chain,
    );
    const joinerWallet = getSavedKey(joinerStore, joinerKey).wallets.find(
      (wallet: any) => wallet.chain === chain,
    );
    const createdTxp = await creatorStore.dispatch(
      createTxProposal(creatorWallet, {
        outputs: [{toAddress: RECIPIENT, amount: 1000, gasLimit: 21000}],
        gasPrice: 1000000000,
      }),
    );
    const txp = await publishTx(creatorWallet, createdTxp);
    const creatorCallbacks = createSigningCallbacks();
    const joinerCallbacks = createSigningCallbacks();

    await settleAll([
      creatorStore.dispatch(
        startTSSSigning({
          key: getSavedKey(creatorStore, creatorKey),
          wallet: creatorWallet,
          txp: JSON.parse(JSON.stringify(txp)),
          callbacks: creatorCallbacks,
        }),
      ),
      joinerStore.dispatch(
        startTSSSigning({
          key: getSavedKey(joinerStore, joinerKey),
          wallet: joinerWallet,
          txp: JSON.parse(JSON.stringify(txp)),
          callbacks: joinerCallbacks,
        }),
      ),
    ]);

    const [signature] = creatorCallbacks.onComplete.mock.calls[0];
    expect(joinerCallbacks.onComplete).toHaveBeenCalledWith(signature);
    return {txp, signature};
  };

  beforeAll(async () => {
    ({creatorStore, joinerStore, creatorKey, joinerKey} =
      await createTSSKeyPair('livenet', ceremonyKeyIds));
  });

  afterAll(() => {
    BitpaySupportedEvmCoins.op = BitpaySupportedEvmCoins.op || hiddenOpCoin;
    for (const keyId of ceremonyKeyIds) {
      creatorStore.dispatch(cancelTSSCeremony(keyId));
    }
  });

  it('completes the ceremony for the creator and the co-signer', () => {
    expect(creatorKey.tssSession.status).toBe('complete');
    expect(joinerKey.tssSession.status).toBe('complete');
    expect(creatorKey.wallets[0].pendingTssSession).toBeUndefined();
    expect(joinerKey.wallets[0].pendingTssSession).toBeUndefined();
  });

  it('links both parties to the same BWS wallet and shared public key', () => {
    expect(creatorKey.wallets[0].credentials.walletId).toBe(
      joinerKey.wallets[0].credentials.walletId,
    );
    expect(creatorKey.methods.getXPubKey('livenet')).toBe(
      joinerKey.methods.getXPubKey('livenet'),
    );
  });

  it('lets each party read a receive address from its saved wallet', async () => {
    for (const [store, key] of [
      [creatorStore, creatorKey],
      [joinerStore, joinerKey],
    ]) {
      const address = await store.dispatch(
        createWalletAddress({wallet: key.wallets[0], newAddress: false}),
      );

      expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    }
  });

  it('restores each saved TSS key with the same shared public key after a restart', () => {
    for (const [store, key] of [
      [creatorStore, creatorKey],
      [joinerStore, joinerKey],
    ]) {
      const persisted = JSON.parse(
        JSON.stringify(store.getState().WALLET.keys[key.id]),
      );

      const restored = bootstrapKey(persisted, key.id);

      expect(restored.methods.getXPubKey('livenet')).toBe(
        key.methods.getXPubKey('livenet'),
      );
    }
  });

  it('signs a transaction proposal with both parties into a signature from the wallet address', async () => {
    const creatorWallet = creatorKey.wallets[0];
    const createdTxp = await creatorStore.dispatch(
      createTxProposal(creatorWallet, {
        outputs: [{toAddress: RECIPIENT, amount: 1000, gasLimit: 21000}],
        gasPrice: 1000000000,
      }),
    );
    const txp = await publishTx(creatorWallet, createdTxp);
    const creatorCallbacks = createSigningCallbacks();
    const joinerCallbacks = createSigningCallbacks();

    await settleAll([
      creatorStore.dispatch(
        startTSSSigning({
          key: creatorKey,
          wallet: creatorWallet,
          txp: JSON.parse(JSON.stringify(txp)),
          callbacks: creatorCallbacks,
        }),
      ),
      joinerStore.dispatch(
        startTSSSigning({
          key: joinerKey,
          wallet: joinerKey.wallets[0],
          txp: JSON.parse(JSON.stringify(txp)),
          callbacks: joinerCallbacks,
        }),
      ),
    ]);

    const [signature] = creatorCallbacks.onComplete.mock.calls[0];
    expect(joinerCallbacks.onComplete).toHaveBeenCalledWith(signature);

    const BWC = BwcProvider.getInstance();
    const unsignedTx = BWC.getUtils().buildTx(txp).uncheckedSerialize();
    const signedTx = BWC.getCore().Transactions.applySignature({
      chain: 'ETH',
      tx: Array.isArray(unsignedTx) ? unsignedTx[0] : unsignedTx,
      signature,
    });
    const walletAddress = BWC.getUtils().deriveAddress(
      'P2PKH',
      [],
      'm/0/0',
      1,
      'livenet',
      'eth',
      undefined,
      undefined,
      creatorWallet.credentials.clientDerivedPublicKey,
    ).address;
    expect(BWC.getCore().ethers.Transaction.from(signedTx).from).toBe(
      walletAddress,
    );
  });

  it('adds every supported EVM network to the account of both parties, also when the co-signer syncs later', async () => {
    delete BitpaySupportedEvmCoins.op;

    expect(await creatorStore.dispatch(syncTSSEvmAccount(creatorKey.id))).toBe(
      true,
    );
    expect(getSavedKey(creatorStore, creatorKey).wallets).toHaveLength(1);
    expect(await joinerStore.dispatch(syncTSSEvmAccount(joinerKey.id))).toBe(
      false,
    );
    expect(await creatorStore.dispatch(syncTSSEvmAccount(creatorKey.id))).toBe(
      false,
    );

    const [creatorWallets, joinerWallets] = [
      getSavedKey(creatorStore, creatorKey).wallets,
      getSavedKey(joinerStore, joinerKey).wallets,
    ];
    const accountAddress = creatorKey.wallets[0].receiveAddress;
    for (const wallets of [creatorWallets, joinerWallets]) {
      expect(wallets.map((wallet: any) => wallet.chain)).toEqual([
        'eth',
        'matic',
        'arb',
        'base',
      ]);
      for (const wallet of wallets) {
        expect(wallet.tssKeyId).toBe(creatorKey.wallets[0].tssKeyId);
        expect(wallet.receiveAddress).toBe(accountAddress);
        expect(wallet.credentials.publicKeyRing).toHaveLength(2);
      }
    }
    expect(creatorWallets.map((wallet: any) => wallet.id)).toEqual(
      joinerWallets.map((wallet: any) => wallet.id),
    );
    expect(getSavedKey(creatorStore, creatorKey).tssPendingNetworks).toEqual(
      {},
    );
    expect(getFakeBwsWallets().every((wallet: any) => wallet.tssKeyId)).toBe(
      true,
    );
  });

  it('adds an EVM network that becomes supported after the account was created', async () => {
    BitpaySupportedEvmCoins.op = hiddenOpCoin;

    expect(await syncBothParties()).toBe(false);

    const accountAddress = creatorKey.wallets[0].receiveAddress;
    for (const [store, key] of [
      [creatorStore, creatorKey],
      [joinerStore, joinerKey],
    ]) {
      const opWallet = getSavedKey(store, key).wallets.find(
        (wallet: any) => wallet.chain === 'op',
      );
      expect(opWallet.receiveAddress).toBe(accountAddress);
      expect(opWallet.credentials.publicKeyRing).toHaveLength(2);
    }
  });

  it('signs an Arbitrum proposal with both parties for chain id 42161 from the account address', async () => {
    const {txp, signature} = await signWithBothParties('arb');

    const BWC = BwcProvider.getInstance();
    const unsignedTx = BWC.getUtils().buildTx(txp).uncheckedSerialize();
    const signedTx = BWC.getCore().ethers.Transaction.from(
      BWC.getCore().Transactions.applySignature({
        chain: 'ARB',
        tx: Array.isArray(unsignedTx) ? unsignedTx[0] : unsignedTx,
        signature,
      }),
    );
    expect(txp.chain).toBe('arb');
    expect(signedTx.chainId).toBe(42161n);
    expect(signedTx.from.toLowerCase()).toBe(
      creatorKey.wallets[0].receiveAddress.toLowerCase(),
    );
  });
});

describe('TSS EVM account on testnet against the real bitcore-wallet-client', () => {
  it('adds Polygon with the account address for both parties', async () => {
    const ceremonyKeyIds: string[] = [];
    const {creatorStore, joinerStore, creatorKey, joinerKey} =
      await createTSSKeyPair('testnet', ceremonyKeyIds);

    try {
      await creatorStore.dispatch(syncTSSEvmAccount(creatorKey.id));
      await joinerStore.dispatch(syncTSSEvmAccount(joinerKey.id));
      await creatorStore.dispatch(syncTSSEvmAccount(creatorKey.id));

      for (const [store, key] of [
        [creatorStore, creatorKey],
        [joinerStore, joinerKey],
      ]) {
        const polygonWallet = store
          .getState()
          .WALLET.keys[key.id].wallets.find(
            (wallet: any) => wallet.chain === 'matic',
          );
        expect(polygonWallet.network).toBe('testnet');
        expect(polygonWallet.credentials.coin).toBe('matic');
        expect(polygonWallet.receiveAddress).toBe(
          key.wallets[0].receiveAddress,
        );
        expect(polygonWallet.credentials.publicKeyRing).toHaveLength(2);
      }
    } finally {
      for (const keyId of ceremonyKeyIds) {
        creatorStore.dispatch(cancelTSSCeremony(keyId));
      }
    }
  });
});
