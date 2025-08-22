import { NetworkType } from 'types/network.types';

import { getStorageCustomNetworks } from './helpers';
import { allApps, schema } from './sharedConfig';

export * from './sharedConfig';

export const networks: NetworkType[] = [
  {
    default: true,
    id: 'mainnet',
    name: 'Mainnet',
    chainId: '1',
    adapter: 'api',
    theme: 'default',
    egldLabel: 'EGLD',
    walletAddress: 'https://wallet.multiversx.com',
    explorerAddress: 'https://explorer.projectx.mx',
    nftExplorerAddress: 'https://xspotlight.com',
    apiAddress: 'https://kepler-public-mainnet.projectx.mx',
    growthApi: 'https://tools.multiversx.com/growth-api',
    hasExchangeData: true
  },

  // Saved Custom Network Configs
  ...getStorageCustomNetworks()
];

export const multiversxApps = allApps();

networks.forEach((network) => {
  schema.validate(network, { strict: true }).catch(({ errors }) => {
    console.error(`Config invalid format for ${network.id}`, errors);
  });
});
