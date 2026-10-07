import {z} from 'zod'
const schema=z.object({
 kind:z.literal('next-standalone'),
 nodeImage:z.string().regex(/^node:24-bookworm-slim@sha256:[0-9a-f]{64}$/),
 builderImage:z.string().regex(/^gcr\.io\/cloud-builders\/docker@sha256:[0-9a-f]{64}$/),
 buildServiceAccount:z.string().regex(/^[a-z][a-z0-9-]{5,29}@axxes-customer-hosting\.iam\.gserviceaccount\.com$/),
 image:z.string().regex(/^us-west1-docker\.pkg\.dev\/axxes-customer-hosting\/[a-z][a-z0-9-]{0,62}\/app:[a-z0-9][a-z0-9-]{0,62}$/),
 sourceBucket:z.string().regex(/^axxes-source-[a-z0-9-]{1,45}$/),
 sourceObject:z.string().regex(/^source\/[a-z0-9-]{1,80}\.tar\.gz$/),
}).strict()
/** Trusted worker constructs the source archive: source/ contains checked repository
 * files; AXXES.Dockerfile and .dockerignore are generated outside that directory.
 * Per-job IAM admission and source extraction MUST run before this plan is submitted.
 * This planner submits nothing and makes no claim of tested framework compatibility.
 */
export function createBuildPlan(value:z.infer<typeof schema>){
 const input=schema.parse(value)
 const dockerfile=`FROM ${input.nodeImage} AS build
WORKDIR /app
COPY source/ ./
RUN mkdir -p public && npm ci && npm run build
RUN test -f .next/standalone/server.js
FROM ${input.nodeImage} AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=8080 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 8080
CMD ["node", "server.js"]
`
 return {dockerfile,dockerignore:'**\n!source/\n!source/**\n!AXXES.Dockerfile\n',build:{
  serviceAccount:'projects/axxes-customer-hosting/serviceAccounts/'+input.buildServiceAccount,
  source:{storageSource:{bucket:input.sourceBucket,object:input.sourceObject}},
  steps:[{name:input.builderImage,args:['build','--no-cache','-f','AXXES.Dockerfile','-t',input.image,'.']}],
  images:[input.image],timeout:'600s',options:{logging:'CLOUD_LOGGING_ONLY'},
 }}
}
