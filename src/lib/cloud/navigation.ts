import type {Capability} from './types'
export function cloudNavigation(capabilities:Capability[]){return [{href:'/cloud',label:'Overview'},{href:'/cloud/projects',label:'Projects'},...(capabilities.some(c=>c.key==='apps')?[{href:'/cloud/apps',label:'Apps'}]:[]),{href:'/cloud/activity',label:'Activity'},{href:'/cloud/billing',label:'Billing'},{href:'/cloud/settings',label:'Settings'}]}
