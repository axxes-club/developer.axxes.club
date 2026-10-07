import {getCloudContext} from './context'
import {authenticateCloudKey} from './key-store'
export async function readCloudRequest(request:Request){const auth=request.headers.get('authorization');if(auth){if(!auth.startsWith('Bearer '))return null;return authenticateCloudKey(auth.slice(7),'read')}return getCloudContext()}
