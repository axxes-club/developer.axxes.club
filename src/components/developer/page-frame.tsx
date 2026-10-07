import {PageHeader} from '@/components/ui'
export function DeveloperFrame({title,description,children}:{title:string;description:string;children:React.ReactNode}){
 return <div className="mx-auto max-w-4xl px-5 py-8"><PageHeader title={title} description={description}/><div className="space-y-6">{children}</div></div>
}
