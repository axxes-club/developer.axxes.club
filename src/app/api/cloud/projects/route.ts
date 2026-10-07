import {readCloudRequest} from '@/lib/cloud/api-context'
import {cloudHandler} from '@/lib/cloud/http';import {getCloudContext} from '@/lib/cloud/context';import {createProject,listProjects} from '@/lib/cloud/store'
export const dynamic='force-dynamic'
export const GET=cloudHandler(readCloudRequest,async ctx=>({projects:await listProjects(ctx)}))
export const POST=cloudHandler(getCloudContext,async(ctx,input)=>({project:await createProject(ctx,input)}))
