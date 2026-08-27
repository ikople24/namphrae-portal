import { FOREST_DOMAIN } from '@/lib/layer-domains';
import { makeAdminVersionsHandler } from '@/lib/layer-routes';

export default makeAdminVersionsHandler(FOREST_DOMAIN);
