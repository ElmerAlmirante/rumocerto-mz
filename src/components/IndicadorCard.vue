<script setup>
import { computed } from 'vue'
import { useIndicador } from '../composables/useIndicador.js'
import { formatarTaxa } from '../../shared/indicadores.js'
const props = defineProps({ indicador: { type: Object, required: true } })
const { serie, carregando, erro, aviso, carregar } = useIndicador(() => props.indicador.codigo)
const ultimo = computed(() => serie.value.at(-1))
</script>

<template>
  <article class="metric-card">
    <div class="metric-card-top"><span class="metric-category">OIT · BANCO MUNDIAL</span><span class="metric-dot" aria-hidden="true"></span></div>
    <h3>{{ indicador.etiqueta }}</h3>
    <p class="metric-description">Força de trabalho · 15–24 anos</p>
    <div v-if="carregando" class="metric-value metric-loading" role="status">A carregar…</div>
    <div v-else-if="erro" class="metric-unavailable"><span>Dados indisponíveis</span><button class="text-button" type="button" @click="carregar(true)">Tentar novamente</button></div>
    <div v-else-if="ultimo" class="metric-value">{{ formatarTaxa(ultimo.valor) }}<small>{{ ultimo.ano }} · ano mais recente disponível</small></div>
    <div v-else class="metric-unavailable">Sem valores disponíveis</div>
    <p v-if="aviso" class="stale-note" role="status">{{ aviso }}</p><RouterLink class="text-link" :to="`/indicadores/${indicador.codigo}`">Consultar evolução <span aria-hidden="true">↗</span></RouterLink>
  </article>
</template>
