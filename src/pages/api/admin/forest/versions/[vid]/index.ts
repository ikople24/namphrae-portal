import { FOREST_DOMAIN } from '@/lib/layer-domains';
import { makeAdminVersionHandler } from '@/lib/layer-routes';

export default makeAdminVersionHandler(FOREST_DOMAIN);
