import { MAP_DOMAIN } from '@/lib/layer-domains';
import { makeAdminLayerGeojsonHandler } from '@/lib/layer-routes';

export default makeAdminLayerGeojsonHandler(MAP_DOMAIN);
