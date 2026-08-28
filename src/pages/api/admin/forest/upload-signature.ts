import { FOREST_DOMAIN } from '@/lib/layer-domains';
import { makeAdminUploadSignatureHandler } from '@/lib/layer-routes';

export default makeAdminUploadSignatureHandler(FOREST_DOMAIN);
