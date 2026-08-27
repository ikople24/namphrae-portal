import { FOREST_DOMAIN } from '@/lib/layer-domains';
import { makeAdminLayerGeojsonHandler } from '@/lib/layer-routes';

export default makeAdminLayerGeojsonHandler(FOREST_DOMAIN);
