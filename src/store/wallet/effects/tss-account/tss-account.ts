import merge from 'lodash.merge';
import {Effect} from '../../../index';
import {BwcProvider} from '../../../../lib/bwc';
import {buildWalletObj, mapAbbreviationAndName} from '../../utils/wallet';
import {IsEVMChain} from '../../utils/currency';
import {updateTssAccount} from '../../wallet.actions';
import {
  Key,
  TssKeyMember,
  TssKeyRoster,
  TssPendingNetwork,
  TssSessionData,
  Wallet,
} from '../../wallet.models';
import {logManager} from '../../../../managers/LogManager';
import {tokenManager} from '../../../../managers/TokenManager';
import {BASE_BWS_URL} from '../../../../constants/config';
import {BitpaySupportedEvmCoins} from '../../../../constants/currencies';
import {createWalletAddress} from '../address/address';
import {
  subscribeEmailNotifications,
  subscribePushNotifications,
} from '../../../app/app.effects';

const BWC = BwcProvider.getInstance();

const RETRY_DELAYS_MS = [5, 10, 20, 40, 80, 160, 320].map(s => s * 1000);
const runningSyncs = new Map<string, Promise<boolean>>();
const activeRetryLoops = new Set<string>();

const getErrorString = (err: unknown): string =>
  err instanceof Error ? err.message : JSON.stringify(err);

export const getExpectedTSSEvmChains = (): string[] =>
  Object.keys(BitpaySupportedEvmCoins);

const getTSSWalletCoin = (chain: string): string => {
  const coin = BitpaySupportedEvmCoins[chain].coin;
  return coin === 'pol' ? 'matic' : coin;
};

export const getCreatorTSSMembers = (
  tssSession: TssSessionData,
  ownRequestPubKey: string,
): TssKeyMember[] => [
  {partyId: 0, requestPubKey: ownRequestPubKey},
  ...(tssSession.copayers || [])
    .filter(copayer => !!copayer.pubKey)
    .map(copayer => ({
      partyId: copayer.partyId,
      requestPubKey: copayer.pubKey,
    })),
];

export const getJoinerTSSMembers = (
  tssSession: TssSessionData,
  ownRequestPubKey: string,
): TssKeyMember[] => [
  {partyId: 0, requestPubKey: tssSession.creatorPubKey!},
  {partyId: tssSession.partyId, requestPubKey: ownRequestPubKey},
];

const getVerifiedTSSMembers = (key: Key, tssKeyId: string): TssKeyMember[] => {
  const members = [...(key.tssMembers || [])];
  const creatorPubKey = members.find(
    member => member.partyId === 0,
  )?.requestPubKey;
  const isRosterVerified =
    !!key.tssRoster &&
    !!creatorPubKey &&
    BWC.getTssKey().verifyRoster({
      roster: key.tssRoster,
      tssKeyId,
      creatorPubKey,
    });
  for (const member of isRosterVerified ? key.tssRoster!.members : []) {
    if (!members.some(m => m.requestPubKey === member.requestPubKey)) {
      members.push(member);
    }
  }
  return members;
};

const getTSSNetworkWallets = (key: Key): Wallet[] =>
  key.wallets.filter(
    wallet =>
      !!wallet.tssKeyId &&
      IsEVMChain(wallet.chain) &&
      !wallet.credentials?.token,
  );

const buildTSSNetworkWallet =
  (client: any, tssMetadata: any): Effect<Wallet> =>
  dispatch => {
    const {tokenOptionsByAddress} = tokenManager.getTokenOptions();
    const {coin, chain} = client.credentials;
    const {currencyAbbreviation, currencyName} = dispatch(
      mapAbbreviationAndName(coin, chain, undefined),
    );
    return merge(
      client,
      buildWalletObj(
        {
          ...client.credentials.toObj(),
          currencyAbbreviation,
          currencyName,
          receiveAddress: client.receiveAddress,
          tssMetadata,
        } as any,
        tokenOptionsByAddress,
      ),
    ) as Wallet;
  };

const subscribeTSSNetworkNotifications =
  (client: any): Effect<void> =>
  (dispatch, getState) => {
    const {
      APP: {
        notificationsAccepted,
        emailNotifications,
        brazeEid,
        defaultLanguage,
      },
    } = getState();
    if (notificationsAccepted) {
      dispatch(subscribePushNotifications(client, brazeEid!));
    }
    if (emailNotifications?.accepted && emailNotifications?.email) {
      dispatch(
        subscribeEmailNotifications(client, {
          email: emailNotifications.email,
          language: defaultLanguage,
          unit: 'btc',
        }),
      );
    }
  };

const runTSSEvmAccountSync =
  (keyId: string, password?: string): Effect<Promise<boolean>> =>
  async (dispatch, getState) => {
    const key: Key | undefined = getState().WALLET.keys[keyId];
    if (!key || key.isReadOnly || !key.tssMembers?.length) {
      return false;
    }
    const localWallets = getTSSNetworkWallets(key);
    const primary = localWallets.find(
      wallet => !!wallet.credentials.isComplete?.(),
    );
    if (!primary) {
      return false;
    }

    const tssKey = key.methods as any;
    const tssKeyId = primary.tssKeyId!;
    const {m, n} = tssKey.metadata;
    const expectedChains = getExpectedTSSEvmChains();
    const pending: {[chain: string]: TssPendingNetwork} = {
      ...(key.tssPendingNetworks || {}),
    };
    const isAccountComplete =
      !Object.keys(pending).length &&
      expectedChains.every(chain =>
        localWallets.some(
          wallet =>
            wallet.chain === chain &&
            (wallet.credentials.publicKeyRing?.length || 0) >= n,
        ),
      );
    if (isAccountComplete) {
      return false;
    }

    const network = primary.credentials.network;
    const copayerName =
      primary.credentials.copayerName || key.tssSession?.myName || 'me';
    const canDeriveCredentials = !key.isPrivKeyEncrypted || !!password;
    const isCurrentKey = () =>
      getState().WALLET.keys[keyId]?.methods === tssKey;
    const keyStillExists = () => !!getState().WALLET.keys[keyId];

    const {wallets: registry} = await primary.getTssKeyWallets();
    const members = getVerifiedTSSMembers(key, tssKeyId);
    const isDirectoryComplete = members.length >= n;
    const creatorPubKey = members.find(
      member => member.partyId === 0,
    )?.requestPubKey;
    const updatedWallets: Wallet[] = [];
    const refreshedWallets: Wallet[] = [];
    const createdChains = new Set<string>();
    let roster: TssKeyRoster | undefined = key.tssRoster;
    let hasPendingWork = false;

    const isKnownChain = (chain: string) =>
      localWallets.some(wallet => wallet.chain === chain) || !!pending[chain];
    const memberKeys = new Set(members.map(member => member.requestPubKey));
    const refreshRing = (client: any) => {
      const currentRing = client.credentials.publicKeyRing || [];
      const ring = isDirectoryComplete
        ? currentRing.filter((item: any) => memberKeys.has(item.requestPubKey))
        : currentRing;
      if (isDirectoryComplete) {
        client.credentials.addPublicKeyRing(ring);
      }
      const ringKeys = new Set(ring.map((item: any) => item.requestPubKey));
      return {
        ringSize: ring.length,
        missingMembers: members.filter(
          member => !ringKeys.has(member.requestPubKey),
        ),
      };
    };

    for (const registryWallet of registry) {
      if (!isCurrentKey()) {
        return keyStillExists();
      }
      if (
        !canDeriveCredentials ||
        !expectedChains.includes(registryWallet.chain) ||
        isKnownChain(registryWallet.chain)
      ) {
        continue;
      }
      try {
        if (registryWallet.joined) {
          const credentials = tssKey.createCredentials(password, {
            chain: registryWallet.chain,
            coin: registryWallet.coin,
            network: registryWallet.network,
            account: 0,
          });
          const client: any = BWC.getClient();
          client.fromObj(credentials.toObj());
          await client.openWallet({forceOpen: true});
          const {walletId, tssKeyId: clientTssKeyId} = client.credentials;
          if (walletId !== registryWallet.id || clientTssKeyId !== tssKeyId) {
            throw new Error('Adopted TSS wallet does not match the registry');
          }
          pending[registryWallet.chain] = {
            credentials: client.credentials.toObj(),
          };
        } else if (registryWallet.invite) {
          const {client, roster: receivedRoster} =
            await tssKey.joinWalletFromInvite({
              baseUrl: BASE_BWS_URL,
              wallet: registryWallet,
              copayerName,
              members,
              creatorPubKey,
              password,
            });
          pending[registryWallet.chain] = {
            credentials: client.credentials.toObj(),
          };
          roster = receivedRoster || roster;
        } else {
          hasPendingWork = true;
        }
      } catch (err) {
        hasPendingWork = true;
        logManager.warn(
          `[TSS Account] Could not join ${
            registryWallet.chain
          } wallet: ${getErrorString(err)}`,
        );
      }
    }

    for (const chain of expectedChains) {
      if (!isCurrentKey()) {
        return keyStillExists();
      }
      if (
        !canDeriveCredentials ||
        isKnownChain(chain) ||
        registry.some(wallet => wallet.chain === chain)
      ) {
        continue;
      }
      try {
        const {client} = await tssKey.createWalletForChain({
          baseUrl: BASE_BWS_URL,
          chain,
          coin: getTSSWalletCoin(chain),
          network,
          walletName: BitpaySupportedEvmCoins[chain].name,
          copayerName,
          members,
          roster,
          password,
        });
        pending[chain] = {credentials: client.credentials.toObj()};
        createdChains.add(chain);
      } catch (err) {
        hasPendingWork = true;
        logManager.warn(
          `[TSS Account] Could not add ${chain} wallet: ${getErrorString(err)}`,
        );
      }
    }

    for (const [chain, entry] of Object.entries(pending)) {
      try {
        const client: any = BWC.getClient(JSON.stringify(entry.credentials));
        await client.openWallet({forceOpen: true});
        if (!isCurrentKey()) {
          return keyStillExists();
        }
        const {ringSize, missingMembers} = refreshRing(client);
        if (missingMembers.length && !createdChains.has(chain)) {
          await BWC.getTssKey().inviteMembers({
            client,
            members: missingMembers,
            roster,
          });
        }
        if (ringSize < m || ringSize < n) {
          hasPendingWork = true;
        }
        if (ringSize < m) {
          pending[chain] = {credentials: client.credentials.toObj()};
          continue;
        }
        await dispatch(
          createWalletAddress({
            wallet: client,
            newAddress: false,
            skipDispatch: true,
          }),
        );
        if (!isCurrentKey()) {
          return keyStillExists();
        }
        updatedWallets.push(
          dispatch(buildTSSNetworkWallet(client, tssKey.metadata)),
        );
        dispatch(subscribeTSSNetworkNotifications(client));
        delete pending[chain];
      } catch (err) {
        hasPendingWork = true;
        logManager.warn(
          `[TSS Account] Could not refresh pending ${chain} wallet: ${getErrorString(
            err,
          )}`,
        );
      }
    }

    for (const wallet of localWallets) {
      if ((wallet.credentials.publicKeyRing?.length || 0) >= n) {
        continue;
      }
      try {
        await wallet.openWallet({forceOpen: true});
        if (!isCurrentKey()) {
          return keyStillExists();
        }
        const {ringSize, missingMembers} = refreshRing(wallet);
        if (missingMembers.length && wallet.credentials.walletPrivKey) {
          await BWC.getTssKey().inviteMembers({
            client: wallet,
            members: missingMembers,
            roster,
          });
        }
        if (ringSize < n) {
          hasPendingWork = true;
        }
        refreshedWallets.push(wallet);
      } catch (err) {
        hasPendingWork = true;
        logManager.warn(
          `[TSS Account] Could not refresh ${
            wallet.chain
          } copayers: ${getErrorString(err)}`,
        );
      }
    }

    if (!isCurrentKey()) {
      return keyStillExists();
    }
    const currentWalletIds = new Set(
      getState().WALLET.keys[keyId].wallets.map(wallet => wallet.id),
    );
    dispatch(
      updateTssAccount({
        keyId,
        wallets: [
          ...updatedWallets,
          ...refreshedWallets.filter(wallet => currentWalletIds.has(wallet.id)),
        ],
        tssPendingNetworks: pending,
        tssRoster: roster,
      }),
    );
    return hasPendingWork;
  };

export const syncTSSEvmAccount =
  (keyId: string, opts: {password?: string} = {}): Effect<Promise<boolean>> =>
  async dispatch => {
    const running = runningSyncs.get(keyId);
    if (running) {
      await running.catch(() => undefined);
      return dispatch(syncTSSEvmAccount(keyId, opts));
    }
    const run = dispatch(runTSSEvmAccountSync(keyId, opts.password));
    runningSyncs.set(keyId, run);
    try {
      return await run;
    } catch (err) {
      logManager.error(
        `[TSS Account] Sync failed for key ${keyId}: ${getErrorString(err)}`,
      );
      return true;
    } finally {
      runningSyncs.delete(keyId);
    }
  };

export const startTSSEvmAccountSync =
  (keyId: string): Effect<Promise<void>> =>
  async dispatch => {
    if (activeRetryLoops.has(keyId)) {
      return;
    }
    activeRetryLoops.add(keyId);
    try {
      for (const delay of [0, ...RETRY_DELAYS_MS]) {
        if (delay) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        const hasPendingWork = await dispatch(syncTSSEvmAccount(keyId));
        if (!hasPendingWork) {
          return;
        }
      }
    } finally {
      activeRetryLoops.delete(keyId);
    }
  };

export const startTSSEvmAccountsSync =
  (): Effect<void> => (dispatch, getState) => {
    for (const key of Object.values(getState().WALLET.keys) as Key[]) {
      if (!key.isReadOnly && getTSSNetworkWallets(key).length) {
        dispatch(startTSSEvmAccountSync(key.id));
      }
    }
  };
