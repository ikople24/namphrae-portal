import { MAP_DOMAIN } from '@/lib/layer-domains';
import { makePublicLayerGeojsonHandler } from '@/lib/layer-routes';

export default makePublicLayerGeojsonHandler(MAP_DOMAIN);
