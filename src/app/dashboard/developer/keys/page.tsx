import {DeveloperFrame} from '@/components/developer/page-frame'
import {TokenManager} from '@/components/developer/token-manager'
export const metadata={title:'Personal tokens — AXXES.dev'}
export default function Keys(){return <DeveloperFrame title="Personal tokens" description="Review and revoke existing personal tokens associated with your account."><p className="text-sm text-muted">These are existing Nexus-format personal tokens, not platform-wide app API keys. New integration credentials should be created in the product serving the API.</p><TokenManager origin="https://nexus.axxes.club" manageOnly/></DeveloperFrame>}
