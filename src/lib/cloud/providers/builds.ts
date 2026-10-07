import {z} from 'zod'
import {CloudError} from '../types'
import {serviceName} from './gcp'
import {createBuildPlan} from '../../deploy/runtime/build-plan'
const configSchema=z.object({nodeImage:z.string().regex(/^node:24-bookworm-slim@sha256:[a-f0-9]{64}$/),dockerImage:z.string().regex(/^gcr\.io\/cloud-builders\/docker@sha256:[a-f0-9]{64}$/),staticImage:z.string().regex(/^nginxinc\/nginx-unprivileged:stable-alpine@sha256:[a-f0-9]{64}$/)}).strict()
export type BuildConfiguration=z.infer<typeof configSchema>
export function buildConfiguration():BuildConfiguration{return configSchema.parse({nodeImage:process.env.CLOUD_NODE_IMAGE,dockerImage:process.env.CLOUD_DOCKER_IMAGE,staticImage:process.env.CLOUD_STATIC_IMAGE})}
export function cloudBuildPlan(value:{resourceId:string;jobId:string;runtime:'static'|'next-standalone';sourceGeneration:string;config:BuildConfiguration}){
 const input=z.object({resourceId:z.uuid(),jobId:z.uuid(),runtime:z.enum(['static','next-standalone']),sourceGeneration:z.string().regex(/^[1-9][0-9]{0,18}$/),config:configSchema}).strict().parse(value)
 const service=serviceName(input.resourceId),compact=input.resourceId.replaceAll('-','')
 const sourceBucket='axxes-source-'+compact,sourceObject='source/'+input.jobId+'.tar.gz',image='us-west1-docker.pkg.dev/axxes-customer-hosting/'+service+'/app:job-'+input.jobId
 const base=createBuildPlan({kind:'next-standalone',nodeImage:input.config.nodeImage,builderImage:input.config.dockerImage,buildServiceAccount:'build-'+compact.slice(0,22)+'@axxes-customer-hosting.iam.gserviceaccount.com',image,sourceBucket,sourceObject,sourceGeneration:input.sourceGeneration})
 const staticDockerfile=`FROM ${input.config.nodeImage} AS build
WORKDIR /app
COPY source/ ./
RUN npm ci && npm run build && test -f dist/index.html && test -z "$(find dist -type l -print -quit)" && test -z "$(find dist ! -type d ! -type f -print -quit)"
FROM ${input.config.staticImage} AS runtime
COPY --from=build --chown=nginx:nginx /app/dist/ /usr/share/nginx/html/
USER nginx
EXPOSE 8080
`
 return {...base,dockerfile:input.runtime==='static'?staticDockerfile:base.dockerfile,build:{...base.build,tags:['axxes-job-'+input.jobId]}}
}
export function buildResult(build:any,imageName:string):{state:'pending'|'failed'|'succeeded';image?:string;errorCode?:string}{
 if(['PENDING','QUEUED','WORKING'].includes(build?.status))return {state:'pending'}
 if(['FAILURE','INTERNAL_ERROR','TIMEOUT','CANCELLED','EXPIRED'].includes(build?.status))return {state:'failed',errorCode:'app_build_failed'}
 if(build?.status!=='SUCCESS')throw new CloudError('invalid_build_response',503)
 const images=build.results?.images
 if(!Array.isArray(images)||images.length!==1||images[0].name!==imageName||!/^sha256:[a-f0-9]{64}$/.test(images[0].digest))throw new CloudError('build_image_mismatch',503)
 return {state:'succeeded',image:imageName.slice(0,imageName.lastIndexOf(':'))+'@'+images[0].digest}
}
