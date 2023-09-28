import log from '../../../lib/logger';
import PricesTfApi from "../../../lib/pricer/pricestf/prices-tf-api"

export default async function getCratetfCratesList(): Promise<string[]> {
    try {
        log.info("Getting crate list from crate.tf...")
        const response = await PricesTfApi.apiRequest(
            'GET',
            "/backend", 
            {action: "getcratelist"},
            null,
            null,
            "https://backend.crate.tf"
        );

        // eslint-disable-next-line
        // @ts-ignore
        return response ?? [];

        } catch(e) {
            log.error("Error fetching cratelist from crate.tf: "+e);
            return [];
        }
}