import{I as n}from"./index-BjKeGK8H.js";/**
 * @license lucide-vue-next v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const l=e=>e.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase(),h=e=>e.replace(/^([A-Z])|[\s-_]+(\w)/g,(t,o,r)=>r?r.toUpperCase():o.toLowerCase()),w=e=>{const t=h(e);return t.charAt(0).toUpperCase()+t.slice(1)},p=(...e)=>e.filter((t,o,r)=>!!t&&t.trim()!==""&&r.indexOf(t)===o).join(" ").trim();/**
 * @license lucide-vue-next v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */var s={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor","stroke-width":2,"stroke-linecap":"round","stroke-linejoin":"round"};/**
 * @license lucide-vue-next v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const C=({size:e,strokeWidth:t=2,absoluteStrokeWidth:o,color:r,iconNode:c,name:a,class:g,...u},{slots:i})=>n("svg",{...s,width:e||s.width,height:e||s.height,stroke:r||s.stroke,"stroke-width":o?Number(t)*24/Number(e):t,class:p("lucide",...a?[`lucide-${l(w(a))}-icon`,`lucide-${l(a)}`]:["lucide-icon"]),...u},[...c.map(d=>n(...d)),...i.default?[i.default()]:[]]);/**
 * @license lucide-vue-next v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const m=(e,t)=>(o,{slots:r})=>n(C,{...o,iconNode:t,name:e},r),k=(e,t)=>{const o=e.__vccOpts||e;for(const[r,c]of t)o[r]=c;return o};export{k as _,m as c};
