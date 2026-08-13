import axios from 'axios';
import crypto from 'crypto';
import {MOONPAY_WEBHOOK_API_KEY, MOONPAY_WEBHOOK_API_KEY_EMBEDDED} from '@env';
import {BASE_BWS_URL} from '../../../../constants/config';
import {
  MoonpayGetCurrenciesRequestData,
  MoonpayGetCurrencyLimitsRequestData,
  MoonpayGetQuoteEmbeddedRequestData,
  MoonpayGetTransactionDetailsEmbeddedRequestData,
  MoonpayQuoteEmbeddedData,
  MoonpayTransactionDetailsEmbeddedData,
} from '../../buy-crypto.models';
import {moonpaySellEnv} from '../../../../navigation/services/sell-crypto/utils/moonpay-sell-utils';
import {logManager} from '../../../../managers/LogManager';

const bwsUri = BASE_BWS_URL;

export const moonpayGetCurrencies = async (
  requestData: MoonpayGetCurrenciesRequestData,
): Promise<any> => {
  try {
    const config = {
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const {data} = await axios.post(
      bwsUri + '/v1/service/moonpay/getCurrencies',
      requestData,
      config,
    );

    return Promise.resolve(data);
  } catch (err) {
    const errStr = err instanceof Error ? err.message : JSON.stringify(err);
    logManager.error('Error fetching Moonpay currencies: ' + errStr);
    return Promise.reject(err);
  }
};

export const moonpayGetCurrencyLimits = async (
  requestData: MoonpayGetCurrencyLimitsRequestData,
): Promise<any> => {
  try {
    const config = {
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const {data} = await axios.post(
      bwsUri + '/v1/service/moonpay/currencyLimits',
      requestData,
      config,
    );

    if (data instanceof Array) {
      return Promise.resolve(data[0]);
    } else {
      return Promise.resolve(data);
    }
  } catch (err) {
    const errStr = err instanceof Error ? err.message : JSON.stringify(err);
    logManager.error('Error fetching Moonpay currency limits: ' + errStr);
    return Promise.reject(err);
  }
};

export const moonpayGetSellTransactionDetails = async (
  transactionId?: string,
  externalId?: string,
): Promise<any> => {
  try {
    if (!transactionId && !externalId) {
      const msg = 'Missing parameters';
      return Promise.reject(msg);
    }

    let body;
    if (transactionId) {
      body = {
        transactionId,
        env: moonpaySellEnv,
      };
    } else if (externalId) {
      body = {
        externalId,
        env: moonpaySellEnv,
      };
    }

    const config = {
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const {data} = await axios.post(
      bwsUri + '/v1/service/moonpay/sellTransactionDetails',
      body,
      config,
    );

    if (data instanceof Array) {
      return Promise.resolve(data[0]);
    } else {
      return Promise.resolve(data);
    }
  } catch (err) {
    return Promise.reject(err);
  }
};

export const moonpayGetPaymentMethodsEmbedded = async (
  requestData: any,
): Promise<any> => {
  const URL_BASE = 'https://api.moonpay.com';
  const URL = URL_BASE + '/platform/v1/payment-methods';

  const headers = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + requestData.accessToken,
  };
  try {
    const {data} = await axios.get(URL, {headers});
    return Promise.resolve(data);
  } catch (err: any) {
    const errStr = err instanceof Error ? err.message : JSON.stringify(err);
    logManager.error('Error getting Moonpay quote embedded: ' + errStr);
    return Promise.reject(err);
  }
};

export const moonpayGetQuoteEmbedded = async (
  requestData: MoonpayGetQuoteEmbeddedRequestData,
): Promise<MoonpayQuoteEmbeddedData> => {
  const URL_BASE = 'https://api.moonpay.com';
  const URL = URL_BASE + '/platform/v1/quotes/buy';

  const body = {
    source: {
      asset: {code: requestData.baseCurrencyCode},
      amount: requestData.baseCurrencyAmount.toString(),
    },
    destination: {
      asset: {code: requestData.currencyAbbreviation},
    },
    wallet: {
      address: requestData.destinationAddress,
    },
    paymentMethod: {
      type: requestData.paymentMethod,
    },
  };

  try {
    const data = await fetch(URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${requestData.accessToken}`,
      },
      body: JSON.stringify(body),
    });
    const jsonData = await data.json();
    return Promise.resolve(jsonData?.data ?? jsonData);
  } catch (err: any) {
    const errStr = err instanceof Error ? err.message : JSON.stringify(err);
    logManager.error('Error getting Moonpay quote embedded: ' + errStr);
    return Promise.reject(err);
  }
};

/**
 * TEST ONLY - Simulates a MoonPay webhook event against the local BWS.
 * Signs the payload with HMAC-SHA256 exactly like MoonPay does:
 * Moonpay-Signature-V2: t=<timestamp>,s=<hex hmac of `${timestamp}.${rawBody}`>
 * TODO: remove this function before releasing.
 */
export const moonpayTestWebhookLocal = async (opts?: {
  isEmbedded?: boolean; // sign with the embedded webhook key
  invalidSignature?: boolean; // send a bad signature to test the 400 path
  status?: string;
  // Pass both to replay the exact same delivery twice and test deduplication.
  // Leaving them out makes every call a brand new transaction.
  transactionId?: string;
  updatedAt?: string;
  // Stored by BWS as the event userId.
  externalCustomerId?: string;
  // Tag echoed into the request query string so the BWS access log shows which
  // scenario produced each response. BWS ignores unknown query params, and the
  // signature covers the body only, so this cannot affect verification.
  test?: string;
}): Promise<any> => {
  const bwsUri2 = 'http://xxxxxx:3232/bws/api'; // TODO: review your localhost ip

  // Read from .env so the shared secrets never live in source. They must match
  // the webhookApiKey / webhookApiKeyEmbedded of the same MoonPay account
  // configured in BWS, otherwise the signature check fails with a 400.
  const envVar = opts?.isEmbedded
    ? 'MOONPAY_WEBHOOK_API_KEY_EMBEDDED'
    : 'MOONPAY_WEBHOOK_API_KEY';
  const apiKey = opts?.isEmbedded
    ? MOONPAY_WEBHOOK_API_KEY_EMBEDDED
    : MOONPAY_WEBHOOK_API_KEY;

  if (!apiKey) {
    const msg = `Missing ${envVar} in .env`;
    logManager.error('Error testing Moonpay webhook: ' + msg);
    return Promise.reject(new Error(msg));
  }

  const externalCustomerId = opts?.externalCustomerId ?? 'test-customer-id';
  const payload = {
    type: 'transaction_updated',
    externalCustomerId,
    data: {
      id: opts?.transactionId ?? 'test-tx-' + Date.now(),
      status: opts?.status ?? 'completed',
      createdAt: new Date().toISOString(),
      // Required by BWS: it is part of the delivery idempotency key.
      updatedAt: opts?.updatedAt ?? new Date().toISOString(),
      baseCurrencyAmount: 100,
      baseCurrency: {code: 'usd'},
      quoteCurrencyAmount: 0.0015,
      currency: {code: 'btc', metadata: {networkCode: 'bitcoin'}},
      paymentMethod: 'credit_debit_card',
      externalTransactionId: 'test-wallet-1-' + Date.now(),
      externalCustomerId,
    },
  };

  // The signature is byte-exact over the raw body, so serialize once and
  // send that exact string (axios does not re-serialize string bodies).
  const rawBody = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  let signature = crypto
    .createHmac('sha256', apiKey)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  if (opts?.invalidSignature) {
    signature = '0'.repeat(signature.length);
  }

  const path = '/v1/service/moonpay/webhook';
  const scenario = opts?.test ?? 'unlabeled';
  const url = `${bwsUri2}${path}?test=${encodeURIComponent(scenario)}`;

  console.log(
    `============ moonpayTestWebhookLocal [${scenario}] externalCustomerId=${externalCustomerId} transactionId=${payload.data.id}`,
  );

  try {
    const {data, status} = await axios.post(url, rawBody, {
      headers: {
        'Content-Type': 'application/json',
        'Moonpay-Signature-V2': `t=${timestamp},s=${signature}`,
      },
    });

    console.log(
      `============ moonpayTestWebhookLocal [${scenario}] response`,
      status,
      data,
    );
    return Promise.resolve(data);
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.log(
        `============ moonpayTestWebhookLocal [${scenario}] error response`,
        err.response?.status,
        err.response?.data,
      );
    }
    const errStr = err instanceof Error ? err.message : JSON.stringify(err);
    logManager.error(`Error testing Moonpay webhook [${scenario}]: ` + errStr);
    return Promise.reject(err);
  }
};

export const moonpayGetTransactionDetailsEmbedded = async (
  requestData: MoonpayGetTransactionDetailsEmbeddedRequestData,
): Promise<MoonpayTransactionDetailsEmbeddedData> => {
  const URL_BASE = 'https://api.moonpay.com';
  const URL =
    URL_BASE + '/platform/v1/transactions/' + requestData.transactionId;

  const headers = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + requestData.accessToken,
  };

  try {
    const {data} = await axios.get(URL, {headers});
    return Promise.resolve(data?.data ?? data);
  } catch (err: any) {
    const errStr = err instanceof Error ? err.message : JSON.stringify(err);
    logManager.error(
      'Error getting Moonpay transaction details embedded: ' + errStr,
    );
    return Promise.reject(err);
  }
};
