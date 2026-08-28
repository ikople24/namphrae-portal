import { FOREST_DOMAIN } from '@/lib/layer-domains';
import { makePublicLayerGeojsonHandler } from '@/lib/layer-routes';

export default makePublicLayerGeojsonHandler(FOREST_DOMAIN);
