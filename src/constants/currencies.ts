export type SupportedCoins = 'btc' | 'bch' | 'ltc' | 'doge' | 'eth' | 'matic';
export type SupportedEthereumTokens =
  | 'usdc'
  | 'gusd'
  | 'usdp'
  | 'pax' // backward compatibility
  | 'busd'
  | 'dai'
  | 'wbtc'
  | 'shib'
  | 'ape'
  | 'euroc';
export type SupportedMaticTokens = '';
export type SupportedCurrencies =
  | SupportedCoins
  | SupportedEthereumTokens
  | SupportedMaticTokens;

export interface CurrencyOpts {
  // Bitcore-node
  name: string;
  chain: string;
  coin: string;
  logoURI?: string;
  unitInfo?: {
    // Config/Precision
    unitName: string;
    unitToSatoshi: number;
    unitDecimals: number;
    unitCode: string;
  };
  properties: {
    // Properties
    hasMultiSig: boolean;
    hasMultiSend: boolean;
    isUtxo: boolean;
    isERCToken: boolean;
    isStableCoin: boolean;
    singleAddress: boolean;
    isCustom?: boolean;
  };
  paymentInfo: {
    paymentCode: string;
    protocolPrefix: {livenet: string; testnet: string};
    // Urls
    ratesApi: string;
    blockExplorerUrls: string;
    blockExplorerUrlsTestnet: string;
  };
  feeInfo: {
    // Fee Units
    feeUnit: string;
    feeUnitAmount: number;
    blockTime: number;
    maxMerchantFee: string;
  };
  theme: {
    coinColor: string;
    backgroundColor: string;
    gradientBackgroundColor: string;
  };
  tokens?: {[key in string]: CurrencyOpts};
}

export const BitpaySupportedEthereumTokens: {[key in string]: CurrencyOpts} = {
  usdp: {
    name: 'Paxos Dollar',
    coin: 'usdp',
    chain: 'ETH',
    unitInfo: {
      unitName: 'USDP',
      unitToSatoshi: 1e18,
      unitDecimals: 18,
      unitCode: 'usdp',
    },
    properties: {
      hasMultiSig: false,
      hasMultiSend: false,
      isUtxo: false,
      isERCToken: true,
      isStableCoin: true,
      singleAddress: true,
    },
    paymentInfo: {
      paymentCode: 'EIP681b',
      protocolPrefix: {livenet: 'ethereum', testnet: 'ethereum'},
      ratesApi: 'https://bws.bitpay.com/bws/api/v3/fiatrates/usdp',
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
      coinColor: '#e6f3f9',
      backgroundColor: '#00845d',
      gradientBackgroundColor: '#00845d',
    },
  },
  pax: {
    // backward compatibility
    name: 'Paxos Dollar',
    coin: 'usdp',
    chain: 'ETH',
    unitInfo: {
      unitName: 'USDP',
      unitToSatoshi: 1e18,
      unitDecimals: 18,
      unitCode: 'usdp',
    },
    properties: {
      hasMultiSig: false,
      hasMultiSend: false,
      isUtxo: false,
      isERCToken: true,
      isStableCoin: true,
      singleAddress: true,
    },
    paymentInfo: {
      paymentCode: 'EIP681b',
      protocolPrefix: {livenet: 'ethereum', testnet: 'ethereum'},
      ratesApi: 'https://bws.bitpay.com/bws/api/v3/fiatrates/pax',
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
      coinColor: '#e6f3f9',
      backgroundColor: '#00845d',
      gradientBackgroundColor: '#00845d',
    },
  },
  usdc: {
    name: 'USD Coin',
    chain: 'ETH',
    coin: 'usdc',
    unitInfo: {
      unitName: 'USDC',
      unitToSatoshi: 1e6,
      unitDecimals: 6,
      unitCode: 'usdc',
    },
    properties: {
      hasMultiSig: false,
      hasMultiSend: false,
      isUtxo: false,
      isERCToken: true,
      isStableCoin: true,
      singleAddress: true,
    },
    paymentInfo: {
      paymentCode: 'EIP681b',
      protocolPrefix: {livenet: 'ethereum', testnet: 'ethereum'},
      ratesApi: 'https://bws.bitpay.com/bws/api/v3/fiatrates/usdc',
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
  },
  gusd: {
    name: 'Gemini Dollar',
    chain: 'ETH',
    coin: 'gusd',
    unitInfo: {
      unitName: 'GUSD',
      unitToSatoshi: 1e2,
      unitDecimals: 2,
      unitCode: 'gusd',
    },
    properties: {
      hasMultiSig: false,
      hasMultiSend: false,
      isUtxo: false,
      isERCToken: true,
      isStableCoin: true,
      singleAddress: true,
    },
    paymentInfo: {
      paymentCode: 'EIP681b',
      protocolPrefix: {livenet: 'ethereum', testnet: 'ethereum'},
      ratesApi: 'https://bws.bitpay.com/bws/api/v3/fiatrates/gusd',
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
      coinColor: '#00ddfa',
      backgroundColor: '#00dcfa',
      gradientBackgroundColor: '#00dcfa',
    },
  },
  dai: {
    name: 'DAI',
    chain: 'ETH',
    coin: 'dai',
    unitInfo: {
      unitName: 'DAI',
      unitToSatoshi: 1e18,
      unitDecimals: 18,
      unitCode: 'dai',
    },
    properties: {
      hasMultiSig: false,
      hasMultiSend: false,
      isUtxo: false,
      isERCToken: true,
      isStableCoin: true,
      singleAddress: true,
    },
    paymentInfo: {
      paymentCode: 'EIP681b',
      protocolPrefix: {livenet: 'ethereum', testnet: 'ethereum'},
      ratesApi: 'https://bws.bitpay.com/bws/api/v3/fiatrates/gusd',
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
      coinColor: '#F5AC37',
      backgroundColor: '#F5AC37',
      gradientBackgroundColor: '#F5AC37',
    },
  },
  wbtc: {
    name: 'Wrapped Bitcoin',
    chain: 'ETH',
    coin: 'wbtc',
    unitInfo: {
      unitName: 'WBTC',
      unitToSatoshi: 1e8,
      unitDecimals: 8,
      unitCode: 'wbtc',
    },
    properties: {
      hasMultiSig: false,
      hasMultiSend: false,
      isUtxo: false,
      isERCToken: true,
      isStableCoin: true,
      singleAddress: true,
    },
    paymentInfo: {
      paymentCode: 'EIP681b',
      protocolPrefix: {livenet: 'ethereum', testnet: 'ethereum'},
      ratesApi: 'https://bws.bitpay.com/bws/api/v3/fiatrates/btc',
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
      coinColor: '#282A47',
      backgroundColor: '#282A47',
      gradientBackgroundColor: '#282A47',
    },
  },
  shib: {
    name: 'SHIBA INU',
    chain: 'ETH',
    coin: 'shib',
    unitInfo: {
      unitName: 'SHIB',
      unitToSatoshi: 1e18,
      unitDecimals: 18,
      unitCode: 'shib',
    },
    properties: {
      hasMultiSig: false,
      hasMultiSend: false,
      isUtxo: false,
      isERCToken: true,
      isStableCoin: false,
      singleAddress: true,
      isCustom: false,
    },
    paymentInfo: {
      paymentCode: 'EIP681b',
      protocolPrefix: {livenet: 'ethereum', testnet: 'ethereum'},
      ratesApi: 'https://bws.bitpay.com/bws/api/v3/fiatrates/shib',
      blockExplorerUrls: 'etherscan.io/',
      blockExplorerUrlsTestnet: 'kovan.etherscan.io/',
    },
    feeInfo: {
      feeUnit: 'Gwei',
      feeUnitAmount: 1000000000,
      blockTime: 0.2,
      maxMerchantFee: 'urgent',
    },
    theme: {
      coinColor: '#F00500',
      backgroundColor: '#F00500',
      gradientBackgroundColor: '#F00500',
    },
  },
  ape: {
    name: 'ApeCoin',
    chain: 'ETH',
    coin: 'ape',
    unitInfo: {
      unitName: 'APE',
      unitToSatoshi: 1e18,
      unitDecimals: 18,
      unitCode: 'ape',
    },
    properties: {
      hasMultiSig: false,
      hasMultiSend: false,
      isUtxo: false,
      isERCToken: true,
      isStableCoin: false,
      singleAddress: true,
      isCustom: false,
    },
    paymentInfo: {
      paymentCode: 'EIP681b',
      protocolPrefix: {livenet: 'ethereum', testnet: 'ethereum'},
      ratesApi: 'https://bws.bitpay.com/bws/api/v3/fiatrates/ape',
      blockExplorerUrls: 'etherscan.io/',
      blockExplorerUrlsTestnet: 'kovan.etherscan.io/',
    },
    feeInfo: {
      feeUnit: 'Gwei',
      feeUnitAmount: 1000000000,
      blockTime: 0.2,
      maxMerchantFee: 'urgent',
    },
    theme: {
      coinColor: '#0054F9',
      backgroundColor: '#0054F9',
      gradientBackgroundColor: '#0054F9',
    },
  },
  euroc: {
    name: 'Euro Coin',
    chain: 'ETH',
    coin: 'euroc',
    unitInfo: {
      unitName: 'EUROC',
      unitToSatoshi: 1e18,
      unitDecimals: 18,
      unitCode: 'euroc',
    },
    properties: {
      hasMultiSig: false,
      hasMultiSend: false,
      isUtxo: false,
      isERCToken: true,
      isStableCoin: false,
      singleAddress: true,
      isCustom: false,
    },
    paymentInfo: {
      paymentCode: 'EIP681b',
      protocolPrefix: {livenet: 'ethereum', testnet: 'ethereum'},
      ratesApi: 'https://bws.bitpay.com/bws/api/v3/fiatrates/euroc',
      blockExplorerUrls: 'etherscan.io/',
      blockExplorerUrlsTestnet: 'kovan.etherscan.io/',
    },
    feeInfo: {
      feeUnit: 'Gwei',
      feeUnitAmount: 1000000000,
      blockTime: 0.2,
      maxMerchantFee: 'urgent',
    },
    theme: {
      coinColor: '#1AA3FF',
      backgroundColor: '#1AA3FF',
      gradientBackgroundColor: '#1AA3FF',
    },
  },
};

export const BitpaySupportedMaticTokens: {[key in string]: CurrencyOpts} = {};

export const BitpaySupportedCurrencies: {[key in string]: CurrencyOpts} = {
  btc: {
    name: 'Bitcoin',
    chain: 'BTC',
    coin: 'btc',
    unitInfo: {
      unitName: 'BTC',
      unitToSatoshi: 100000000,
      unitDecimals: 8,
      unitCode: 'btc',
    },
    properties: {
      hasMultiSig: true,
      hasMultiSend: true,
      isUtxo: true,
      isERCToken: false,
      isStableCoin: false,
      singleAddress: false,
    },
    paymentInfo: {
      paymentCode: 'BIP73',
      protocolPrefix: {livenet: 'bitcoin', testnet: 'bitcoin'},
      ratesApi: 'https://bws.bitpay.com/bws/api/v3/fiatrates/btc',
      blockExplorerUrls: 'bitpay.com/insight/#/BTC/mainnet/',
      blockExplorerUrlsTestnet: 'bitpay.com/insight/#/BTC/testnet/',
    },
    feeInfo: {
      feeUnit: 'sat/byte',
      feeUnitAmount: 1000,
      blockTime: 10,
      maxMerchantFee: 'urgent',
    },
    theme: {
      coinColor: '#f7931a',
      backgroundColor: '#f7921a',
      gradientBackgroundColor: '#f7921a',
    },
  },
  bch: {
    name: 'Bitcoin Cash',
    chain: 'BCH',
    coin: 'bch',
    unitInfo: {
      unitName: 'BCH',
      unitToSatoshi: 100000000,
      unitDecimals: 8,
      unitCode: 'bch',
    },
    properties: {
      hasMultiSig: true,
      hasMultiSend: true,
      isUtxo: true,
      isERCToken: false,
      isStableCoin: false,
      singleAddress: false,
    },
    paymentInfo: {
      paymentCode: 'BIP73',
      protocolPrefix: {livenet: 'bitcoincash', testnet: 'bchtest'},
      ratesApi: 'https://bws.bitpay.com/bws/api/v3/fiatrates/bch',
      blockExplorerUrls: 'bitpay.com/insight/#/BCH/mainnet/',
      blockExplorerUrlsTestnet: 'bitpay.com/insight/#/BCH/testnet/',
    },
    feeInfo: {
      feeUnit: 'sat/byte',
      feeUnitAmount: 1000,
      blockTime: 10,
      maxMerchantFee: 'normal',
    },
    theme: {
      coinColor: '#2fcf6e',
      backgroundColor: '#2fcf6e',
      gradientBackgroundColor: '#2fcf6e',
    },
  },
  eth: {
    name: 'Ethereum',
    chain: 'ETH',
    coin: 'eth',
    unitInfo: {
      unitName: 'ETH',
      unitToSatoshi: 1e18,
      unitDecimals: 18,
      unitCode: 'eth',
    },
    properties: {
      hasMultiSig: true,
      hasMultiSend: false,
      isUtxo: false,
      isERCToken: false,
      isStableCoin: false,
      singleAddress: true,
    },
    paymentInfo: {
      paymentCode: 'EIP681',
      protocolPrefix: {livenet: 'ethereum', testnet: 'ethereum'},
      ratesApi: 'https://bws.bitpay.com/bws/api/v3/fiatrates/eth',
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
      coinColor: '#6b71d6',
      backgroundColor: '#6b71d6',
      gradientBackgroundColor: '#6b71d6',
    },
    tokens: BitpaySupportedEthereumTokens,
  },
  matic: {
    name: 'Matic',
    chain: 'MATIC',
    coin: 'matic',
    unitInfo: {
      unitName: 'MATIC',
      unitToSatoshi: 1e18,
      unitDecimals: 18,
      unitCode: 'matic',
    },
    properties: {
      hasMultiSig: true,
      hasMultiSend: false,
      isUtxo: false,
      isERCToken: false,
      isStableCoin: false,
      singleAddress: true,
    },
    paymentInfo: {
      paymentCode: 'EIP681',
      protocolPrefix: {livenet: 'matic', testnet: 'matic'},
      ratesApi: 'https://bws.bitpay.com/bws/api/v3/fiatrates/matic',
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
      coinColor: '#6b71d6',
      backgroundColor: '#6b71d6',
      gradientBackgroundColor: '#6b71d6',
    },
    tokens: BitpaySupportedMaticTokens,
  },
  xrp: {
    name: 'XRP',
    chain: 'XRP',
    coin: 'xrp',
    unitInfo: {
      unitName: 'XRP',
      unitToSatoshi: 1e6,
      unitDecimals: 6,
      unitCode: 'xrp',
    },
    properties: {
      hasMultiSig: false,
      hasMultiSend: false,
      isUtxo: false,
      isERCToken: false,
      isStableCoin: false,
      singleAddress: true,
    },
    paymentInfo: {
      paymentCode: 'BIP73',
      protocolPrefix: {livenet: 'ripple', testnet: 'ripple'},
      ratesApi: 'https://bws.bitpay.com/bws/api/v3/fiatrates/xrp',
      blockExplorerUrls: 'xrpscan.com/',
      blockExplorerUrlsTestnet: 'test.bithomp.com/explorer/',
    },
    feeInfo: {
      feeUnit: 'drops',
      feeUnitAmount: 1e6,
      blockTime: 0.05,
      maxMerchantFee: 'normal',
    },
    theme: {
      coinColor: '#000000',
      backgroundColor: '#565d6d',
      gradientBackgroundColor: '#565d6d',
    },
  },
  doge: {
    name: 'Dogecoin',
    chain: 'DOGE',
    coin: 'doge',
    unitInfo: {
      unitName: 'DOGE',
      unitToSatoshi: 1e8,
      unitDecimals: 8,
      unitCode: 'doge',
    },
    properties: {
      hasMultiSig: true,
      hasMultiSend: true,
      isUtxo: true,
      isERCToken: false,
      isStableCoin: false,
      singleAddress: false,
    },
    paymentInfo: {
      paymentCode: 'BIP73',
      protocolPrefix: {livenet: 'dogecoin', testnet: 'dogecoin'},
      ratesApi: 'https://bws.bitpay.com/bws/api/v3/fiatrates/doge',
      blockExplorerUrls: 'blockchair.com/',
      blockExplorerUrlsTestnet: 'sochain.com/',
    },
    feeInfo: {
      feeUnit: 'sat/byte',
      feeUnitAmount: 1e8,
      blockTime: 10,
      maxMerchantFee: 'normal',
    },
    theme: {
      coinColor: '#d8c172',
      backgroundColor: '#d8c172',
      gradientBackgroundColor: '#d8c172',
    },
  },
  ltc: {
    name: 'Litecoin',
    chain: 'LTC',
    coin: 'ltc',
    unitInfo: {
      unitName: 'LTC',
      unitToSatoshi: 100000000,
      unitDecimals: 8,
      unitCode: 'ltc',
    },
    properties: {
      hasMultiSig: true,
      hasMultiSend: true,
      isUtxo: true,
      isERCToken: false,
      isStableCoin: false,
      singleAddress: false,
    },
    paymentInfo: {
      paymentCode: 'BIP73',
      protocolPrefix: {livenet: 'litecoin', testnet: 'litecoin'},
      ratesApi: 'https://bws.bitpay.com/bws/api/v3/fiatrates/ltc',
      blockExplorerUrls: 'bitpay.com/insight/#/LTC/mainnet/',
      blockExplorerUrlsTestnet: 'bitpay.com/insight/#/LTC/testnet/',
    },
    feeInfo: {
      feeUnit: 'sat/byte',
      feeUnitAmount: 1000,
      blockTime: 2.5,
      maxMerchantFee: 'normal',
    },
    theme: {
      coinColor: '#A6A9AA',
      backgroundColor: '#A6A9AA',
      gradientBackgroundColor: '#A6A9AA',
    },
  },
};

export const POPULAR_TOKENS = [
  'UNI',
  'SUSHI',
  'BAT',
  'MATIC',
  '1INCH',
  'USDT',
  'LINK',
  'COMP',
  'MKR',
  'DYDX',
  'WDOGE',
  'renBTC',
  'WETH',
  'EURT',
  'YGG',
  'CRO',
  'AAVE',
  'GRT',
  'YFI',
  'CRV',
  'RUNE',
];

export const SUPPORTED_TOKENS = [
  'usdc',
  'gusd',
  'usdp',
  'busd',
  'dai',
  'wbtc',
  'shib',
  'ape',
  'euroc',
];
// export const SUPPORTED_COINS = ['btc', 'bch', 'eth', 'doge', 'ltc', 'xrp'];

// const supportedCoins = currencies.filter(
//   (currency): currency is SupportedCoins =>
//   SUPPORTED_CURRENCIES.coins.includes(currency),
// );
console.log('------------------');

// TODO Evitar usar array de strings... al menos que sea muy especifico... deberiamos usar array de objectos.... revisar donde se use eso y intentar arreglarrlo
export const SUPPORTED_ETHEREUM_TOKENS = Object.keys(
  BitpaySupportedEthereumTokens,
);
export const SUPPORTED_MATIC_TOKENS = Object.keys(BitpaySupportedMaticTokens);
export const SUPPORTED_COINS = Object.keys(BitpaySupportedCurrencies);
export const SUPPORTED_CURRENCIES = [...SUPPORTED_COINS, ...SUPPORTED_TOKENS];

// TODO MATIC aqui borre suported currencies... porque era la combinacion de todo lo de arriba y no se pueden juntar porque comparten symbol
