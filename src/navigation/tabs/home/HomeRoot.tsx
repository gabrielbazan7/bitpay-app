import {useScrollToTop, useTheme} from '@react-navigation/native';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {
  AppState,
  AppStateStatus,
  RefreshControl,
  ScrollView,
} from 'react-native';
import {
  BASE_BWS_URL,
  EXCHANGE_RATES_SORT_ORDER,
  STATIC_CONTENT_CARDS_ENABLED,
} from '../../../constants/config';
import {SupportedCurrencyOptions} from '../../../constants/SupportedCurrencyOptions';
import {
  setShowKeyMigrationFailureModal,
  showBottomNotificationModal,
} from '../../../store/app/app.actions';
import {requestBrazeContentRefresh} from '../../../store/app/app.effects';
import {
  selectBrazeDoMore,
  selectBrazeQuickLinks,
  selectBrazeShopWithCrypto,
} from '../../../store/app/app.selectors';
import {selectCardGroups} from '../../../store/card/card.selectors';
import {getAndDispatchUpdatedWalletBalances} from '../../../store/wallet/effects/status/statusv2';
import {updatePortfolioBalance} from '../../../store/wallet/wallet.actions';
import {SlateDark, White} from '../../../styles/colors';
import {
  calculatePercentageDifference,
  getCurrencyAbbreviation,
  sleep,
} from '../../../utils/helper-methods';
import {useAppDispatch, useAppSelector} from '../../../utils/hooks';
import {BalanceUpdateError} from '../../wallet/components/ErrorMessages';
import AdvertisementsList from './components/advertisements/AdvertisementsList';
import DefaultAdvertisements from './components/advertisements/DefaultAdvertisements';
import Crypto from './components/Crypto';
import ExchangeRatesList, {
  ExchangeRateItemProps,
} from './components/exchange-rates/ExchangeRatesList';
import ProfileButton from './components/HeaderProfileButton';
import ScanButton from './components/HeaderScanButton';
import HomeSection from './components/HomeSection';
import LinkingButtons from './components/LinkingButtons';
import MockOffers from './components/offers/MockOffers';
import OffersCarousel from './components/offers/OffersCarousel';
import PortfolioBalance from './components/PortfolioBalance';
import DefaultQuickLinks from './components/quick-links/DefaultQuickLinks';
import QuickLinksCarousel from './components/quick-links/QuickLinksCarousel';
import {HeaderContainer, HeaderLeftContainer} from './components/Styled';
import KeyMigrationFailureModal from './components/KeyMigrationFailureModal';
import {useThemeType} from '../../../utils/hooks/useThemeType';
import {ProposalBadgeContainer} from '../../../components/styled/Containers';
import {ProposalBadge} from '../../../components/styled/Text';
import {
  receiveCrypto,
  sendCrypto,
} from '../../../store/wallet/effects/send/send';
import {Analytics} from '../../../store/analytics/analytics.effects';
import {withErrorFallback} from '../TabScreenErrorFallback';
import TabContainer from '../TabContainer';
import ArchaxFooter from '../../../components/archax/archax-footer';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {TabsScreens, TabsStackParamList} from '../TabsStack';
import {
  BitpaySupportedCoins,
  BitpaySupportedTokens,
} from '../../../constants/currencies';
import {TssKeyGen} from 'bitcore-wallet-client/ts_build/src/lib/tsskey';
import {BwcProvider} from '../../../lib/bwc';
import {TssSign} from 'bitcore-wallet-client/ts_build/src/lib/tsssign';

export type HomeScreenProps = NativeStackScreenProps<
  TabsStackParamList,
  TabsScreens.HOME
>;

const HomeRoot: React.FC<HomeScreenProps> = ({route, navigation}) => {
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const {currencyAbbreviation} = route.params || {};
  const theme = useTheme();
  const themeType = useThemeType();
  const [refreshing, setRefreshing] = useState(false);
  const brazeShopWithCrypto = useAppSelector(selectBrazeShopWithCrypto);
  const brazeDoMore = useAppSelector(selectBrazeDoMore);
  const brazeQuickLinks = useAppSelector(selectBrazeQuickLinks);
  const keys = useAppSelector(({WALLET}) => WALLET.keys);
  const wallets = Object.values(keys).flatMap(k => k.wallets);
  const pendingTxps = wallets.flatMap(w => w.pendingTxps);
  const appIsLoading = useAppSelector(({APP}) => APP.appIsLoading);
  const defaultAltCurrency = useAppSelector(({APP}) => APP.defaultAltCurrency);
  const keyMigrationFailure = useAppSelector(
    ({APP}) => APP.keyMigrationFailure,
  );
  const keyMigrationFailureModalHasBeenShown = useAppSelector(
    ({APP}) => APP.keyMigrationFailureModalHasBeenShown,
  );
  const showPortfolioValue = useAppSelector(({APP}) => APP.showPortfolioValue);
  const hasKeys = Object.values(keys).length;
  const cardGroups = useAppSelector(selectCardGroups);
  const hasCards = cardGroups?.length > 0;

  const showArchaxBanner = useAppSelector(({APP}) => APP.showArchaxBanner);

  // Shop with Crypto
  const memoizedShopWithCryptoCards = useMemo(() => {
    if (STATIC_CONTENT_CARDS_ENABLED && !brazeShopWithCrypto.length) {
      return MockOffers();
    }

    return brazeShopWithCrypto;
  }, [brazeShopWithCrypto]);

  // Do More
  const memoizedDoMoreCards = useMemo(() => {
    if (STATIC_CONTENT_CARDS_ENABLED && !brazeDoMore.length) {
      return DefaultAdvertisements(themeType).filter(advertisement => {
        return hasCards ? advertisement.id !== 'card' : true;
      });
    }

    return brazeDoMore;
  }, [brazeDoMore, hasCards, themeType]);

  // Exchange Rates
  const lastDayRates = useAppSelector(({RATE}) => RATE.lastDayRates);
  const rates = useAppSelector(({RATE}) => RATE.rates);
  const memoizedExchangeRates: Array<ExchangeRateItemProps> = useMemo(() => {
    const result = Object.entries(lastDayRates).reduce(
      (ratesList, [key, lastDayRate]) => {
        const lastDayRateForDefaultCurrency = lastDayRate.find(
          ({code}) => code === defaultAltCurrency.isoCode,
        );
        const rateForDefaultCurrency = rates[key].find(
          ({code}) => code === defaultAltCurrency.isoCode,
        );
        const option = SupportedCurrencyOptions.find(
          ({currencyAbbreviation}) => currencyAbbreviation === key,
        );

        if (option && option.chain && option.currencyAbbreviation) {
          const currencyName = getCurrencyAbbreviation(
            option?.tokenAddress
              ? option?.tokenAddress
              : option?.currencyAbbreviation,
            option?.chain,
          );
          const isStableCoin =
            BitpaySupportedCoins[currencyName]?.properties?.isStableCoin ||
            BitpaySupportedTokens[currencyName]?.properties?.isStableCoin;

          if (
            option &&
            lastDayRateForDefaultCurrency?.rate &&
            rateForDefaultCurrency?.rate &&
            !isStableCoin
          ) {
            const {
              id,
              img,
              currencyName,
              currencyAbbreviation,
              chain,
              tokenAddress,
            } = option;

            const percentChange = calculatePercentageDifference(
              rateForDefaultCurrency.rate,
              lastDayRateForDefaultCurrency.rate,
            );

            ratesList.push({
              id,
              img,
              currencyName,
              currencyAbbreviation,
              chain: chain ? chain : currencyAbbreviation,
              tokenAddress: tokenAddress,
              average: percentChange,
              currentPrice: rateForDefaultCurrency.rate,
            });
          }
        }
        return ratesList;
      },
      [] as ExchangeRateItemProps[],
    );

    return result.sort((a, b) => {
      const indexA = EXCHANGE_RATES_SORT_ORDER.indexOf(
        a.currencyAbbreviation.toLowerCase(),
      );
      const indexB = EXCHANGE_RATES_SORT_ORDER.indexOf(
        b.currencyAbbreviation.toLowerCase(),
      );

      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      if (indexA !== -1) {
        return -1;
      }
      if (indexB !== -1) {
        return 1;
      }
      return a.currencyName.localeCompare(b.currencyName);
    });
  }, [lastDayRates, rates, defaultAltCurrency]);

  // Quick Links
  const memoizedQuickLinks = useMemo(() => {
    if (STATIC_CONTENT_CARDS_ENABLED && !brazeQuickLinks.length) {
      return DefaultQuickLinks();
    }

    return brazeQuickLinks;
  }, [brazeQuickLinks]);

  useEffect(() => {
    return navigation.addListener('focus', () => {
      if (!appIsLoading) {
        dispatch(updatePortfolioBalance());
      } // portfolio balance is updated in app init
    });
  }, [dispatch, navigation, appIsLoading]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        dispatch(
          getAndDispatchUpdatedWalletBalances({
            context: 'homeRootOnRefresh',
            createTokenWalletWithFunds: true,
          }),
        ),
        dispatch(requestBrazeContentRefresh()),
        sleep(1000),
      ]);
      await sleep(2000);
    } catch (err) {
      dispatch(showBottomNotificationModal(BalanceUpdateError()));
    }
    setRefreshing(false);
  };

  const onPressTxpBadge = useMemo(
    () => () => {
      navigation.navigate('TransactionProposalNotifications', {});
    },
    [navigation],
  );

  useEffect(() => {
    if (keyMigrationFailure && !keyMigrationFailureModalHasBeenShown) {
      dispatch(setShowKeyMigrationFailureModal(true));
    }
  }, [dispatch, keyMigrationFailure, keyMigrationFailureModalHasBeenShown]);

  const scrollViewRef = useRef<ScrollView>(null);
  useScrollToTop(scrollViewRef);

  useEffect(() => {
    function onAppStateChange(status: AppStateStatus) {
      if (status === 'active' && currencyAbbreviation) {
        navigation.setParams({
          currencyAbbreviation: undefined,
        });
        const exchangeRatesSection = memoizedExchangeRates.find(
          ({currencyAbbreviation: abbr}) =>
            abbr.toLowerCase() === currencyAbbreviation.toLowerCase(),
        );
        if (exchangeRatesSection) {
          navigation.navigate('PriceCharts', {item: exchangeRatesSection});
        }
      }
    }

    const subscriptionAppStateChange = AppState.addEventListener(
      'change',
      onAppStateChange,
    );

    return () => subscriptionAppStateChange.remove();
  }, [currencyAbbreviation]);

  useEffect(() => {
    (async () => {
      try {
        const BWC = BwcProvider.getInstance();
        const Bitcore = BWC.getBitcore();
        const Key = BWC.getKey();
        const party0Key = new Key({seedType: 'new'});
        const party1Key = new Key({seedType: 'new'});
        const party2Key = new Key({seedType: 'new'});

        const chain = 'ETH';
        const network: 'livenet' | 'testnet' | 'regtest' = 'livenet';
        const m = 2;
        const n = 3;

        const tss0 = new TssKeyGen({
          chain,
          network,
          baseUrl: BASE_BWS_URL,
          key: party0Key,
        });
        const tss1 = new TssKeyGen({
          chain,
          network,
          baseUrl: BASE_BWS_URL,
          key: party1Key,
        });
        const tss2 = new TssKeyGen({
          chain,
          network,
          baseUrl: BASE_BWS_URL,
          key: party2Key,
        });
        console.log('TSS instances created');
        console.log('tss0', tss0);
        console.log('tss1', tss1);
        console.log('tss2', tss2);

        await tss0.newKey({m, n /*, password */});

        const party1Pub = party1Key.createCredentials(null, {
          network,
          n: 1,
          account: 0,
        }).requestPubKey;
        const party2Pub = party2Key.createCredentials(null, {
          network,
          n: 1,
          account: 0,
        }).requestPubKey;

        console.log('party1Pub', party1Pub);
        console.log('party2Pub', party2Pub);

        const code1 = tss0.createJoinCode({
          partyId: 1,
          partyPubKey: party1Pub /*, extra */,
          opts: {encoding: 'base64'},
        });
        const code2 = tss0.createJoinCode({
          partyId: 2,
          partyPubKey: party2Pub /*, extra */,
          opts: {encoding: 'base64'},
        });

        console.log('code1', code1);
        console.log('code2', code2);

        const result1 = await tss1.joinKey({
          code: code1,
          opts: {encoding: 'base64'} /*, password */,
        });
        const result2 = await tss2.joinKey({
          code: code2,
          opts: {encoding: 'base64'} /*, password */,
        });

        console.log('result1', result1);
        console.log('result2', result2);

        // const s0 = tss0.exportSession();

        // await tss0.restoreSession({session: s0});

        async function waitForTssComplete(inst: TssKeyGen) {
          return new Promise<void>((resolve, reject) => {
            inst.once('complete', resolve);
            inst.once('error', reject);
            inst.subscribe({timeout: 200});
          });
        }

        await Promise.all([
          waitForTssComplete(tss0),
          waitForTssComplete(tss1),
          waitForTssComplete(tss2),
        ]);

        const key0 = tss0.getTssKey();
        console.log('key0', key0);
        if (!key0) throw new Error('Key not ready');
        return;

        const waitComplete = (inst: TssKeyGen) =>
          new Promise<void>((resolve, reject) => {
            inst
              .on('roundready', r => console.log('[roundready]', r))
              .on('roundprocessed', r => console.log('[roundprocessed]', r))
              .on('roundsubmitted', r => console.log('[roundsubmitted]', r))
              .on('tsskey', k =>
                console.log(
                  '[tsskey] commonKeyChain',
                  k.keychain.commonKeyChain,
                ),
              )
              .on('tsskeystored', () => console.log('[tsskeystored]'))
              .on('wallet', w => console.log('[wallet created/joined]', w?.id))
              .on('complete', () => resolve())
              .on('error', e => reject(e));
            t;
            // Only party 0 passes walletName+copayerName to auto-create the wallet:
            const params =
              inst === tss0
                ? {
                    timeout: 250,
                    walletName: 'Ops Wallet',
                    copayerName: 'Gabriel',
                  }
                : {
                    timeout: 250,
                    copayerName: inst === tss1 ? 'Gustavo' : 'Marty',
                  };

            inst.subscribe(params as any);
          });

        // Run all three in parallel like the bwc unit tests
        // await Promise.all([waitComplete(tss0), waitComplete(tss1), waitComplete(tss2)]);

        // await tss0.createWallet({ walletName: 'Ops Wallet', copayerName: 'Gabriel' });
        // await tss1.joinWallet({ copayerName: 'Gustavo' });
        // await tss2.joinWallet({ copayerName: 'Marty' });

        // tss0.unsubscribe(); tss1.unsubscribe(); tss2.unsubscribe();
        return;

        const creds0 = key0.createCredentials(null, {
          chain,
          network,
          account: 0,
        });
        const key1 = tss1.getTssKey()!;
        const creds1 = key1.createCredentials(null, {
          chain,
          network,
          account: 0,
        });

        const msg = 'hola';
        const messageHash = Bitcore.crypto.Hash.sha256(Buffer.from(msg));
        const derivationPath = 'm/0/0';

        const sig0 = new TssSign({
          baseUrl: BASE_BWS_URL,
          request: new Request(BASE_BWS_URL) as any,
          credentials: creds0,
          tssKey: key0,
        });
        const sig1 = new TssSign({
          baseUrl: BASE_BWS_URL,
          request: new Request(BASE_BWS_URL) as any,
          credentials: creds1,
          tssKey: key1,
        });

        await sig0.start({messageHash, derivationPath});
        await sig1.start({messageHash, derivationPath});

        const waitSig = (inst: TssSign) =>
          new Promise<void>((resolve, reject) => {
            inst
              .on('roundready', r => console.log('[sig roundready]', r))
              .on('roundprocessed', r => console.log('[sig roundprocessed]', r))
              .on('roundsubmitted', r => console.log('[sig roundsubmitted]', r))
              .on('signature', s => console.log('[signature]', s))
              .on('complete', () => resolve())
              .on('error', e => reject(e));
            inst.subscribe({timeout: 250});
          });

        await Promise.all([waitSig(sig0), waitSig(sig1)]);

        const finalSig = sig0.getSignature();
        console.log('Final signature:', finalSig);

        sig0.unsubscribe();
        sig1.unsubscribe();
      } catch (e) {
        console.error('[TSS demo error]', e);
      }
    })();

    return () => {};
  }, []);

  return (
    <TabContainer>
      {appIsLoading ? null : (
        <>
          <HeaderContainer>
            <HeaderLeftContainer />
            {pendingTxps.length ? (
              <ProposalBadgeContainer onPress={onPressTxpBadge}>
                <ProposalBadge>{pendingTxps.length}</ProposalBadge>
              </ProposalBadgeContainer>
            ) : null}
            <ScanButton />
            <ProfileButton />
          </HeaderContainer>
          <ScrollView
            ref={scrollViewRef}
            // Prevent iOS from injecting automatic top insets which creates a gap
            // between the Archax banner and the Home header when the scene is edge-to-edge
            contentInsetAdjustmentBehavior="never"
            refreshControl={
              <RefreshControl
                tintColor={theme.dark ? White : SlateDark}
                refreshing={refreshing}
                onRefresh={onRefresh}
              />
            }>
            {/* ////////////////////////////// PORTFOLIO BALANCE */}
            {showPortfolioValue ? (
              <HomeSection style={{marginTop: 5}} slimContainer={true}>
                <PortfolioBalance />
              </HomeSection>
            ) : null}

            {/* ////////////////////////////// CTA BUY SWAP RECEIVE SEND BUTTONS */}
            {hasKeys && showPortfolioValue ? (
              <HomeSection style={{marginBottom: 25}}>
                <LinkingButtons
                  receive={{
                    cta: () => dispatch(receiveCrypto(navigation, 'HomeRoot')),
                  }}
                  send={{
                    cta: () => dispatch(sendCrypto('HomeRoot')),
                  }}
                />
              </HomeSection>
            ) : null}

            {/* ////////////////////////////// CRYPTO */}
            <HomeSection slimContainer={true}>
              <Crypto />
            </HomeSection>

            {/* ////////////////////////////// SHOP WITH CRYPTO */}
            {memoizedShopWithCryptoCards.length ? (
              <HomeSection
                title={t('Shop with Crypto')}
                action={t('See all')}
                onActionPress={() => {
                  navigation.navigate('Tabs', {screen: 'Shop'});
                  dispatch(
                    Analytics.track('Clicked Shop with Crypto', {
                      context: 'HomeRoot',
                    }),
                  );
                }}>
                <OffersCarousel contentCards={memoizedShopWithCryptoCards} />
              </HomeSection>
            ) : null}

            {/* ////////////////////////////// DO MORE */}
            {memoizedDoMoreCards.length ? (
              <HomeSection title={t('Do More')}>
                <AdvertisementsList contentCards={memoizedDoMoreCards} />
              </HomeSection>
            ) : null}

            {/* ////////////////////////////// EXCHANGE RATES */}
            {!showArchaxBanner && memoizedExchangeRates.length ? (
              <HomeSection title={t('Exchange Rates')} label="1D">
                <ExchangeRatesList
                  items={memoizedExchangeRates}
                  defaultAltCurrencyIsoCode={defaultAltCurrency.isoCode}
                />
              </HomeSection>
            ) : null}

            {/* ////////////////////////////// QUICK LINKS - Leave feedback etc */}
            {memoizedQuickLinks.length ? (
              <HomeSection title={t('Quick Links')}>
                <QuickLinksCarousel contentCards={memoizedQuickLinks} />
              </HomeSection>
            ) : null}
            {showArchaxBanner && <ArchaxFooter />}
          </ScrollView>
        </>
      )}
      <KeyMigrationFailureModal />
    </TabContainer>
  );
};

export default withErrorFallback(HomeRoot, {includeHeader: true});
