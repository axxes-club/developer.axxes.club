import test from 'node:test'
import assert from 'node:assert/strict'
import {access} from 'node:fs/promises'
import {product} from '../../src/product.config'
test('every advertised developer navigation URL has an App Router page',async()=>{
 const missing:string[]=[]
 for(const section of product.sections){try{await access(`src/app${section.href}/page.tsx`)}catch{missing.push(section.href)}}
 assert.deepEqual(missing,[],`Navigation leads to missing routes: ${missing.join(', ')}`)
})
test('previously advertised URLs retain pages for existing bookmarks',async()=>{
 for(const suffix of ['apps','keys','webhooks','usage'])await access(`src/app/dashboard/developer/${suffix}/page.tsx`)
})
