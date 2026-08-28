import { FOREST_DOMAIN } from '@/lib/layer-domains';
import { makeAdminIssuesHandler } from '@/lib/layer-routes';

export default makeAdminIssuesHandler(FOREST_DOMAIN);
