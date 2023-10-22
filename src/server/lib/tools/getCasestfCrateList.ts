import log from '../logger';
import PricesTfApi from '../pricer/pricestf/prices-tf-api';

export default async function getCasestfCratesList(): Promise<string[]> {
    try {
        log.info('Getting crate list from cases.tf...');
        const response = await PricesTfApi.apiRequest(
            'GET',
            '/backend',
            { action: 'getcratelist' },
            null,
            null,
            'https://backend.cases.tf'
        );

        // eslint-disable-next-line
        // @ts-ignore
        return response ?? [];
    } catch (e) {
        log.error(`Error fetching cratelist from cases.tf: ${String(e)}`);
        return [];
    }
}
