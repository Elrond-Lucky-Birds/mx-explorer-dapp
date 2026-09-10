import axios from 'axios';

// Module-level cache for herotag data
const herotagCache = new Map<string, string | null>();
import { AdapterProviderPropsType, AdapterProviderType } from 'types/adapter.types';

const api: AdapterProviderType = ({
  baseUrl,
  url,
  params,
  timeout,
  signal,
  headers
}) => {
  if (!baseUrl) {
    return Promise.resolve();
  }
  return axios.get(`${baseUrl}${url}`, {
    params,
    timeout,
    signal,
    headers
  });
};

// Helper function to fetch herotag data
const fetchHerotag = async (
  baseUrl: string,
  address: string
): Promise<string | null> => {
  // Check cache first
  if (herotagCache.has(address)) {
    return herotagCache.get(address) || null;
  }

  try {
    const { data } = await axios.get(`/herotag/username/${address}`, {
      baseURL: baseUrl
    });
    const username = data.username;

    // Cache the result
    herotagCache.set(address, username);
    return username;
  } catch (error) {
    // Cache null for failed requests
    herotagCache.set(address, null);
    return null;
  }
};

// Generic herotag injector for different data structures
const injectHerotagData = async (
  baseUrl: string,
  data: any,
  injectorConfig: {
    type: 'account' | 'transfers' | 'username';
    addressFields: string[];
    nameFields: string[];
  }
): Promise<any> => {
  if (!data) return data;

  const { type, addressFields, nameFields } = injectorConfig;

  if (type === 'account') {
    // Handle single account object
    if (data.username) return data; // Already has username

    const address = data.address;
    if (address) {
      const herotagUsername = await fetchHerotag(baseUrl, address);
      if (herotagUsername) {
        return {
          ...data,
          username: `${herotagUsername}.elrond`
        };
      }
    }
    return data;
  }

  if (type === 'transfers') {
    // Handle transfers array
    if (!Array.isArray(data)) return data;

    const enhancedTransfers = [];
    for (let i = 0; i < data.length; i++) {
      const transfer = data[i];
      const enhancedTransfer = { ...transfer };

      // Process each address field
      for (const addressField of addressFields) {
        const address = transfer[addressField];
        if (address) {
          // Find corresponding name field
          const nameField = nameFields.find((field) =>
            field.includes(addressField)
          );

          if (nameField) {
            const assets = enhancedTransfer[nameField];
            // Only fetch herotag if assets don't exist or don't have a name
            if (!assets || !assets.name) {
              const herotagUsername = await fetchHerotag(baseUrl, address);
              if (herotagUsername) {
                enhancedTransfer[nameField] = {
                  ...assets,
                  name: `${herotagUsername}.elrond`
                };
              }
            }
          }
        }
      }

      enhancedTransfers.push(enhancedTransfer);
    }

    return enhancedTransfers;
  }

  if (type === 'username') {
    // Handle username lookup - if data is null/undefined (404), try herotag
    if (!data) {
      // For username type, we expect the address to be in the first addressField
      const address = addressFields[0];
      if (address) {
        const herotagUsername = await fetchHerotag(baseUrl, address);
        if (herotagUsername) {
          return {
            username: `${herotagUsername}.elrond`
          };
        }
      }
    }
    return data;
  }

  return data;
};

export const apiAdapter = {
  provider: api,
  getStats: ({ baseUrl, timeout }: AdapterProviderPropsType) => {
    return api({
      baseUrl,
      url: '/stats',
      timeout
    });
  },
  getNodes: api,
  getNodesVersions: ({ baseUrl, timeout }: AdapterProviderPropsType) => {
    return api({
      baseUrl,
      url: '/nodes/versions',
      timeout
    });
  },
  getShards: ({ baseUrl, timeout }: AdapterProviderPropsType) => {
    return api({
      baseUrl,
      url: '/shards',
      timeout
    });
  },
  getAccountDelegation: api,
  getAccountDelegationLegacy: api,
  getAccountStake: api,
  getProviders: api,
  getProvider: api,
  getEconomics: api,
  getAnalyticsChartList: api,
  getAnalyticsChart: api,
  getGrowthWidget: api,
  getMarkers: api,
  getAccountContractVerification: api,

  // Enhanced getAccount with herotag integration
  getAccountWithHerotag: async ({
    baseUrl,
    address,
    timeout,
    params
  }: {
    baseUrl: string;
    address: string;
    timeout: number;
    params?: any;
  }) => {
    try {
      // First, get the account data
      const accountResponse = await api({
        baseUrl,
        url: `/accounts/${address}`,
        params,
        timeout
      });

      // Inject herotag data using the generic injector
      const enhancedData = await injectHerotagData(
        baseUrl,
        accountResponse.data,
        {
          type: 'account',
          addressFields: ['address'],
          nameFields: ['username']
        }
      );

      return {
        ...accountResponse,
        data: enhancedData
      };
    } catch (error) {
      // If account fetch fails, return the error
      throw error;
    }
  },

  // Enhanced getTransfers with herotag integration
  getTransfersWithHerotag: async ({
    baseUrl,
    timeout,
    params
  }: {
    baseUrl: string;
    timeout: number;
    params?: any;
  }) => {
    try {
      // First, get the transfers data
      const transfersResponse = await api({
        baseUrl,
        url: '/transfers',
        params,
        timeout
      });

      // Only inject herotag data if withUsername=true is provided
      if (params?.withUsername === true) {
        const enhancedData = await injectHerotagData(
          baseUrl,
          transfersResponse.data,
          {
            type: 'transfers',
            addressFields: ['sender', 'receiver'],
            nameFields: ['senderAssets', 'receiverAssets']
          }
        );

        return {
          ...transfersResponse,
          data: enhancedData
        };
      }

      // Return original response if withUsername is not true
      return transfersResponse;
    } catch (error) {
      // If transfers fetch fails, return the error
      throw error;
    }
  },

  // Enhanced getAccountTransfers with herotag integration
  getAccountTransfersWithHerotag: async ({
    baseUrl,
    address,
    timeout,
    params
  }: {
    baseUrl: string;
    address: string;
    timeout: number;
    params?: any;
  }) => {
    try {
      // First, get the account transfers data
      const transfersResponse = await api({
        baseUrl,
        url: `/accounts/${address}/transfers`,
        params,
        timeout
      });

      // Only inject herotag data if withUsername=true is provided
      if (params?.withUsername === true) {
        const enhancedData = await injectHerotagData(
          baseUrl,
          transfersResponse.data,
          {
            type: 'transfers',
            addressFields: ['sender', 'receiver'],
            nameFields: ['senderAssets', 'receiverAssets']
          }
        );

        return {
          ...transfersResponse,
          data: enhancedData
        };
      }

      // Return original response if withUsername is not true
      return transfersResponse;
    } catch (error) {
      // If transfers fetch fails, return the error
      throw error;
    }
  },

  // Enhanced getTransaction with herotag integration
  getTransactionWithHerotag: async ({
    baseUrl,
    transactionId,
    timeout
  }: {
    baseUrl: string;
    transactionId: string;
    timeout: number;
  }) => {
    try {
      // First, get the transaction data
      const transactionResponse = await api({
        baseUrl,
        url: `/transactions/${transactionId}`,
        timeout
      });

      // Inject herotag data using the generic injector
      const enhancedData = await injectHerotagData(
        baseUrl,
        transactionResponse.data,
        {
          type: 'transfers',
          addressFields: ['sender', 'receiver'],
          nameFields: ['senderAssets', 'receiverAssets']
        }
      );

      return {
        ...transactionResponse,
        data: enhancedData
      };
    } catch (error) {
      // If transaction fetch fails, return the error
      throw error;
    }
  },

  // Enhanced getTransactions with herotag integration
  getTransactionsWithHerotag: async ({
    baseUrl,
    timeout,
    params
  }: {
    baseUrl: string;
    timeout: number;
    params?: any;
  }) => {
    try {
      // First, get the transactions data
      const transactionsResponse = await api({
        baseUrl,
        url: '/transactions',
        params,
        timeout
      });

      // Only inject herotag data if withUsername=true is provided
      if (params?.withUsername === true) {
        const enhancedData = await injectHerotagData(
          baseUrl,
          transactionsResponse.data,
          {
            type: 'transfers',
            addressFields: ['sender', 'receiver'],
            nameFields: ['senderAssets', 'receiverAssets']
          }
        );

        return {
          ...transactionsResponse,
          data: enhancedData
        };
      }

      // Return original response if withUsername is not true
      return transactionsResponse;
    } catch (error) {
      // If transactions fetch fails, return the error
      throw error;
    }
  },

  // Enhanced getUsername with herotag fallback
  getUsernameWithHerotag: async ({
    baseUrl,
    username,
    timeout
  }: {
    baseUrl: string;
    username: string;
    timeout: number;
  }) => {
    try {
      // First, try to get the username data from the original API
      const usernameResponse = await api({
        baseUrl,
        url: `/usernames/${username}`,
        timeout
      });

      // If successful, return the original response
      return usernameResponse;
    } catch (error: any) {
      // If the original API returns 404, try herotag API
      if (error.response?.status === 404) {
        try {
          // Try to find the username in herotag API
          const herotagResponse = await axios.get(
            `${baseUrl}/herotag/address/${username.replace(
              /(^@)|(\.elrond$)/,
              ''
            )}`
          );
          const herotagData = herotagResponse.data;

          if (herotagData && herotagData.username) {
            // Return a response with the herotag username
            return {
              data: {
                address: herotagData.address,
                username: `${herotagData.username}.elrond`
              },
              status: 200
            };
          }
        } catch (herotagError) {
          // If herotag also fails, return the original 404 error
          throw error;
        }
      }

      // Re-throw the original error for other status codes
      throw error;
    }
  }
};
