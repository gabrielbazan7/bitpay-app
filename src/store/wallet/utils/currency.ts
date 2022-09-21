import {Effect} from '../..';
import {
  BitpaySupportedCurrencies,
  BitpaySupportedEthereumTokens,
  BitpaySupportedMaticTokens,
} from '../../../constants/currencies';

export const GetProtocolPrefix =
  (
    currencyAbbreviation: string,
    network: string = 'livenet',
    chain: string,
  ): Effect<string> =>
  (dispatch, getState) => {
    const {
      WALLET: {tokenData, customTokenData, maticTokenData},
    } = getState();

    let tokens;
    const currency = currencyAbbreviation.toLowerCase();
    switch (chain) {
      case 'eth':
        tokens = {...tokenData, ...customTokenData};
        return (
          // @ts-ignore
          BitpaySupportedEthereumTokens[currency]?.paymentInfo.protocolPrefix[
            network
          ] ||
          // @ts-ignore
          tokens[currency]?.paymentInfo.protocolPrefix[network]
        );
      case 'matic':
        tokens = maticTokenData;
        return (
          // @ts-ignore
          BitpaySupportedMaticTokens[currency]?.paymentInfo.protocolPrefix[
            network
          ] ||
          // @ts-ignore
          tokens[currency]?.paymentInfo.protocolPrefix[network]
        );
      default:
        // @ts-ignore
        return BitpaySupportedCurrencies[currency]?.paymentInfo.protocolPrefix[
          network
        ];
    }
  };

export const GetPrecision =
  (
    currencyAbbreviation: string,
    chain: string,
  ): Effect<
    | {
        unitName: string;
        unitToSatoshi: number;
        unitDecimals: number;
        unitCode: string;
      }
    | undefined
  > =>
  (dispatch, getState) => {
    const {
      WALLET: {tokenData, customTokenData, maticTokenData},
    } = getState();

    let tokens;
    const currency = currencyAbbreviation.toLowerCase();
    switch (chain) {
      case 'eth':
        tokens = {...tokenData, ...customTokenData};
        return (
          BitpaySupportedEthereumTokens[currency]?.unitInfo ||
          tokens[currency]?.unitInfo
        );
      case 'matic':
        tokens = maticTokenData;
        return (
          BitpaySupportedMaticTokens[currency]?.unitInfo ||
          tokens[currency]?.unitInfo
        );
      default:
        return BitpaySupportedCurrencies[currency]?.unitInfo;
    }
  };

export const IsUtxoCoin = (currencyAbbreviation: string): boolean => {
  return ['btc', 'bch', 'doge', 'ltc'].includes(
    currencyAbbreviation.toLowerCase(),
  );
};

export const IsCustomERCToken = (currencyAbbreviation: string) => {
  return (
    !BitpaySupportedCurrencies[currencyAbbreviation.toLowerCase()] ||
    !BitpaySupportedEthereumTokens[currencyAbbreviation.toLowerCase()] ||
    !BitpaySupportedMaticTokens[currencyAbbreviation.toLowerCase()]
  );
};

// export const GetChain =
//   (currencyAbbreviation: string): Effect<string> =>
//   (dispatch, getState) => {
//     const {
//       WALLET: {tokenData, customTokenData},
//     } = getState();
//     const tokens = {...tokenData, ...customTokenData};
//     const currency = currencyAbbreviation.toLowerCase();
//     return BitpaySupportedCurrencies[currency]?.chain || tokens[currency]?.chain;
//   };

export const IsERCToken =
  (currencyAbbreviation: string, chain: string): Effect<boolean> =>
  (dispatch, getState) => {
    const {
      WALLET: {tokenData, customTokenData, maticTokenData},
    } = getState();
    let tokens;
    const currency = currencyAbbreviation.toLowerCase();
    switch (chain) {
      case 'eth':
        tokens = {...tokenData, ...customTokenData};
        return (
          BitpaySupportedEthereumTokens[currency]?.properties.isERCToken ||
          tokens[currency]?.properties.isERCToken
        );
      case 'matic':
        tokens = maticTokenData;
        return (
          BitpaySupportedMaticTokens[currency]?.properties.isERCToken ||
          tokens[currency]?.properties.isERCToken
        );
      default:
        return false;
    }
  };

export const GetBlockExplorerUrl =
  (
    currencyAbbreviation: string,
    network: string = 'livenet',
    chain: string,
  ): Effect<string> =>
  (dispatch, getState) => {
    const {
      WALLET: {tokenData, customTokenData, maticTokenData},
    } = getState();

    let tokens;
    const currency = currencyAbbreviation.toLowerCase();
    switch (chain) {
      case 'eth':
        tokens = {...tokenData, ...customTokenData};
        return network === 'livenet'
          ? BitpaySupportedEthereumTokens[currency]?.paymentInfo
              .blockExplorerUrls ||
              tokens[currency]?.paymentInfo.blockExplorerUrls
          : BitpaySupportedEthereumTokens[currency]?.paymentInfo
              .blockExplorerUrlsTestnet ||
              tokens[currency]?.paymentInfo.blockExplorerUrlsTestnet;
      case 'matic':
        tokens = maticTokenData;
        return network === 'livenet'
          ? BitpaySupportedMaticTokens[currency]?.paymentInfo
              .blockExplorerUrls ||
              tokens[currency]?.paymentInfo.blockExplorerUrls
          : BitpaySupportedMaticTokens[currency]?.paymentInfo
              .blockExplorerUrlsTestnet ||
              tokens[currency]?.paymentInfo.blockExplorerUrlsTestnet;
      default:
        return network === 'livenet'
          ? BitpaySupportedCurrencies[currency]?.paymentInfo.blockExplorerUrls
          : BitpaySupportedCurrencies[currency]?.paymentInfo
              .blockExplorerUrlsTestnet;
    }
  };

export const GetFeeUnits =
  (
    currencyAbbreviation: string,
    chain: string,
  ): Effect<{
    feeUnit: string;
    feeUnitAmount: number;
    blockTime: number;
    maxMerchantFee: string;
  }> =>
  (dispatch, getState) => {
    const {
      WALLET: {tokenData, customTokenData, maticTokenData},
    } = getState();
    let tokens;
    const currency = currencyAbbreviation.toLowerCase();
    switch (chain) {
      case 'eth':
        tokens = {...tokenData, ...customTokenData};
        return (
          BitpaySupportedEthereumTokens[currency]?.feeInfo ||
          tokens[currency]?.feeInfo
        );
      case 'matic':
        tokens = maticTokenData;
        return (
          BitpaySupportedMaticTokens[currency]?.feeInfo ||
          tokens[currency]?.feeInfo
        );
      default:
        return BitpaySupportedCurrencies[currency]?.feeInfo;
    }
  };

export const GetTheme =
  (
    currencyAbbreviation: string,
    chain: string,
  ): Effect<{
    coinColor: string;
    backgroundColor: string;
    gradientBackgroundColor: string;
  }> =>
  (dispatch, getState) => {
    const {
      WALLET: {tokenData, customTokenData, maticTokenData},
    } = getState();
    let tokens;
    const currency = currencyAbbreviation.toLowerCase();
    switch (chain) {
      case 'eth':
        tokens = {...tokenData, ...customTokenData};
        return (
          BitpaySupportedEthereumTokens[currency]?.theme ||
          tokens[currency]?.theme
        );
      case 'matic':
        tokens = maticTokenData;
        return (
          BitpaySupportedMaticTokens[currency]?.theme || tokens[currency]?.theme
        );
      default:
        return BitpaySupportedCurrencies[currency]?.theme;
    }
  };

export const GetName =
  (currencyAbbreviation: string, chain: string): Effect<string> =>
  (dispatch, getState) => {
    const {
      WALLET: {tokenData, customTokenData, maticTokenData},
    } = getState();
    let tokens;
    const currency = currencyAbbreviation.toLowerCase();
    switch (chain) {
      case 'eth':
        tokens = {...tokenData, ...customTokenData};
        return (
          BitpaySupportedEthereumTokens[currency]?.name ||
          tokens[currency]?.name
        );
      case 'matic':
        tokens = maticTokenData;
        return (
          BitpaySupportedMaticTokens[currency]?.name || tokens[currency]?.name
        );
      default:
        return BitpaySupportedCurrencies[currency]?.name;
    }
  };

export const isSingleAddressCoin =
  (currencyAbbreviation: string, chain: string): Effect<boolean> =>
  (dispatch, getState) => {
    const {
      WALLET: {tokenData, customTokenData, maticTokenData},
    } = getState();
    let tokens;
    const currency = currencyAbbreviation.toLowerCase();
    switch (chain) {
      case 'eth':
        tokens = {...tokenData, ...customTokenData};
        return (
          BitpaySupportedEthereumTokens[currency]?.properties.singleAddress ||
          tokens[currency]?.properties.singleAddress
        );
      case 'matic':
        tokens = maticTokenData;
        return (
          BitpaySupportedMaticTokens[currency]?.properties.singleAddress ||
          tokens[currency]?.properties.singleAddress
        );
      default:
        return BitpaySupportedCurrencies[currency]?.properties.singleAddress;
    }
  };
