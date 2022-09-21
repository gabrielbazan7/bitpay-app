import {Effect} from '../../../index';
import axios from 'axios';
import {Token} from '../../wallet.models';
import {
  failedGetTokenOptions,
  successGetCustomTokenOptions,
  successGetMaticTokenOptions,
  successGetTokenOptions,
} from '../../wallet.actions';
import {
  BitpaySupportedCurrencies,
  BitpaySupportedEthereumTokens,
  BitpaySupportedMaticTokens,
  CurrencyOpts,
} from '../../../../constants/currencies';
import {LogActions} from '../../../log';

export const startGetTokenOptions =
  (): Effect<Promise<void>> => async dispatch => {
    try {
      dispatch(LogActions.info('starting [startGetTokenOptions]'));
      const {
        data: {tokens},
      } = await axios.get<{
        tokens: {[key in string]: Token};
      }>('https://api.1inch.io/v4.0/1/tokens');

      const tokenOptions: {[key in string]: Token} = {};
      const tokenOptionsByAddress: {[key in string]: Token} = {};
      const tokenData: {[key in string]: CurrencyOpts} = {};

      Object.values(tokens).forEach(token => {
        if (
          BitpaySupportedCurrencies[token.symbol.toLowerCase()] ||
          BitpaySupportedEthereumTokens[token.symbol.toLowerCase()]
        ) {
          return;
        } // remove bitpay supported tokens and currencies
        populateTokenInfo({
          chain: 'ETH',
          token,
          tokenOptions,
          tokenData,
          tokenOptionsByAddress,
        });
      });

      const {
        data: {tokens: maticTokens},
      } = await axios.get<{
        tokens: {[key in string]: Token};
      }>('https://api.1inch.io/v4.0/137/tokens');

      const maticTokenOptions: {[key in string]: Token} = {};
      const maticTokenOptionsByAddress: {[key in string]: Token} = {};
      const maticTokenData: {[key in string]: CurrencyOpts} = {};

      Object.values(maticTokens).forEach(token => {
        if (
          BitpaySupportedCurrencies[token.symbol.toLowerCase()] ||
          BitpaySupportedMaticTokens[token.symbol.toLowerCase()]
        ) {
          return;
        } // remove bitpay supported tokens and currencies
        populateTokenInfo({
          chain: 'MATIC',
          token,
          tokenOptions: maticTokenOptions,
          tokenData: maticTokenData,
          tokenOptionsByAddress: maticTokenOptionsByAddress,
        });
      });

      dispatch(
        successGetTokenOptions({
          tokenOptions,
          tokenData,
          tokenOptionsByAddress,
        }),
      );

      dispatch(
        successGetMaticTokenOptions({
          maticTokenOptions,
          maticTokenData,
          maticTokenOptionsByAddress,
        }),
      );
      dispatch(LogActions.info('successful [startGetTokenOptions]'));
    } catch (e) {
      let errorStr;
      if (e instanceof Error) {
        errorStr = e.message;
      } else {
        errorStr = JSON.stringify(e);
      }
      dispatch(failedGetTokenOptions());
      dispatch(LogActions.error(`failed [startGetTokenOptions]: ${errorStr}`));
    }
  };

export const addCustomTokenOption =
  (token: Token): Effect =>
  async dispatch => {
    try {
      const customTokenOptions: {[key in string]: Token} = {};
      const customTokenOptionsByAddress: {[key in string]: Token} = {};
      const customTokenData: {[key in string]: CurrencyOpts} = {};
      if (
        BitpaySupportedCurrencies[token.symbol.toLowerCase()] ||
        BitpaySupportedEthereumTokens[token.symbol.toLowerCase()]
      ) {
        return;
      } // remove bitpay supported tokens and currencies
      populateTokenInfo({
        chain: 'ETH',
        token,
        tokenOptions: customTokenOptions,
        tokenData: customTokenData,
        tokenOptionsByAddress: customTokenOptionsByAddress,
      });
      dispatch(
        successGetCustomTokenOptions({
          customTokenOptions,
          customTokenData,
          customTokenOptionsByAddress,
        }),
      );
    } catch (e) {
      const errString = e instanceof Error ? e.message : JSON.stringify(e);
      dispatch(LogActions.error(`Add custom options: ${errString}`));
      dispatch(failedGetTokenOptions());
    }
  };

const populateTokenInfo = ({
  chain,
  token,
  tokenOptions,
  tokenData,
  tokenOptionsByAddress,
}: {
  chain: string;
  token: Token;
  tokenOptions: {[key in string]: Token};
  tokenData: {[key in string]: CurrencyOpts};
  tokenOptionsByAddress: {[key in string]: Token};
}) => {
  tokenOptions[token.symbol.toLowerCase()] = token;
  tokenOptionsByAddress[token.address.toLowerCase()] = token;
  tokenData[token.symbol.toLowerCase()] = {
    name: token.name,
    chain,
    coin: token.symbol,
    logoURI: token.logoURI,
    unitInfo: {
      unitName: token.symbol.toUpperCase(),
      unitToSatoshi: 10 ** token.decimals,
      unitDecimals: token.decimals,
      unitCode: token.symbol,
    },
    properties: {
      hasMultiSig: false,
      hasMultiSend: false,
      isUtxo: false,
      isERCToken: true,
      isStableCoin: false,
      singleAddress: true,
      isCustom: true,
    },
    paymentInfo: {
      paymentCode: 'EIP681b',
      protocolPrefix: {livenet: 'ethereum', testnet: 'ethereum'}, // TODO MATIC
      ratesApi: '',
      blockExplorerUrls: 'etherscan.io/',
      blockExplorerUrlsTestnet: 'kovan.etherscan.io/',
    },
    feeInfo: {
      feeUnit: 'Gwei',
      feeUnitAmount: 1e9,
      blockTime: 0.2,
      maxMerchantFee: 'urgent',
    },
    theme: {
      coinColor: '#2775ca',
      backgroundColor: '#2775c9',
      gradientBackgroundColor: '#2775c9',
    },
  };
};
