import {cloudHandler} from '@/lib/cloud/http';import {getCloudContext} from '@/lib/cloud/context';import {quoteResource} from '@/lib/cloud/admission'
export const POST=cloudHandler(getCloudContext,(ctx,input)=>quoteResource(ctx,input))
