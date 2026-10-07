import test from 'node:test'
import assert from 'node:assert/strict'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import Reference from '../../src/app/dashboard/developer/docs/page'
import Quickstart from '../../src/app/dashboard/developer/quickstart/page'
import Guides from '../../src/app/dashboard/developer/guides/page'
import Prompts from '../../src/app/dashboard/developer/prompts/page'
import Plans from '../../src/app/dashboard/developer/plans/page'
import Changelog from '../../src/app/dashboard/developer/changelog/page'
import {API_PRODUCTS} from '../../src/lib/registry/api'
test('reference and prompt pages render every catalog operation without missing product resources',()=>{
 const reference=renderToStaticMarkup(createElement(Reference))
 const prompts=renderToStaticMarkup(createElement(Prompts))
 for(const p of API_PRODUCTS)for(const r of p.resources)for(const op of r.operations){assert.ok(reference.includes(op.path),op.id);assert.ok(prompts.includes(op.path),op.id)}
})
test('developer reference pages render and separate API limits from free app deployment',()=>{
 for(const page of [Quickstart,Guides,Plans,Changelog])assert.ok(renderToStaticMarkup(createElement(page)).includes('<h1'))
 const plans=renderToStaticMarkup(createElement(Plans));assert.ok(plans.includes('Free API plan does not permit free app deployments'))
})
