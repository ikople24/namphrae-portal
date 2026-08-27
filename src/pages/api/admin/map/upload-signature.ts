import { MAP_DOMAIN } from '@/lib/layer-domains';
import { makeAdminUploadSignatureHandler } from '@/lib/layer-routes';

export default makeAdminUploadSignatureHandler(MAP_DOMAIN);
