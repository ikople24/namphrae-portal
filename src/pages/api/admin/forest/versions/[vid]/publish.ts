import { FOREST_DOMAIN } from '@/lib/layer-domains';
import { makeAdminPublishHandler } from '@/lib/layer-routes';

export default makeAdminPublishHandler(FOREST_DOMAIN);
