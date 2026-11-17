<script setup>
import {computed} from 'vue'
import {formatarTaxa} from '../../shared/indicadores.js'
const props=defineProps({serie:{type:Array,required:true}})
const pontos=computed(()=>props.serie.slice(-12))
const min=computed(()=>pontos.value.length?Math.max(0,Math.min(...pontos.value.map(x=>x.valor))-1):0)
const max=computed(()=>pontos.value.length?Math.max(...pontos.value.map(x=>x.valor))+1:10)
const coords=computed(()=>pontos.value.map((p,i)=>({x:pontos.value.length===1?340:36+i*640/(pontos.value.length-1),y:176-145*(p.valor-min.value)/Math.max(1,max.value-min.value),...p})))
</script>
<template><div class="chart-shell" v-if="pontos.length"><svg class="line-chart" viewBox="0 0 730 235" role="img" :aria-label="`Série histórica com ${pontos.length} anos, de ${pontos[0].ano} a ${pontos[pontos.length-1].ano}`"><line v-for="y in [31,103,176]" :key="y" x1="36" :y1="y" x2="676" :y2="y" class="chart-grid"/><text x="6" y="34" class="axis-label">{{max.toFixed(0)}}%</text><text x="6" y="179" class="axis-label">{{min.toFixed(0)}}%</text><polyline fill="none" stroke="#169586" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" :points="coords.map(p=>`${p.x},${p.y}`).join(' ')"/><g v-for="(p,i) in coords" :key="p.ano"><circle :cx="p.x" :cy="p.y" r="5" fill="#169586"><title>{{p.ano}}: {{formatarTaxa(p.valor)}}</title></circle><text v-if="i===0||i===coords.length-1||i%3===0" :x="p.x" y="206" text-anchor="middle" class="axis-label">{{p.ano}}</text></g></svg><details class="table-toggle"><summary>Consultar dados em tabela</summary><table><thead><tr><th>Ano</th><th>Taxa (%)</th></tr></thead><tbody><tr v-for="p in serie" :key="p.ano"><td>{{p.ano}}</td><td>{{formatarTaxa(p.valor)}}</td></tr></tbody></table></details></div></template>
