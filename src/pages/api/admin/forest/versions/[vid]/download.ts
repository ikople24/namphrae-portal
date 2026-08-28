import { FOREST_DOMAIN } from '@/lib/layer-domains';
import { makeAdminDownloadHandler } from '@/lib/layer-routes';

export default makeAdminDownloadHandler(FOREST_DOMAIN);
