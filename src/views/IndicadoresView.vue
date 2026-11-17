<script setup>
import { indicadores } from '../../shared/indicadores.js'
import IndicadorCard from '../components/IndicadorCard.vue'
</script>

<template>
  <div class="container inner-page">
    <div class="page-heading">
      <span class="eyebrow">INDICADORES NACIONAIS · MOÇAMBIQUE</span>
      <h1>Indicadores de desemprego juvenil</h1>
      <p>Séries publicadas pelo Banco Mundial, com estimativas da OIT relativas à força de trabalho dos 15 aos 24 anos.</p>
    </div>
    <div class="metric-grid">
      <IndicadorCard v-for="item in indicadores" :key="item.codigo" :indicador="item" />
    </div>
    <p class="source-caption">Os indicadores referem-se à força de trabalho, não à totalidade dos jovens sem emprego.</p>
    <details class="info-disclosure">
      <summary>Como interpretar estes indicadores? <span aria-hidden="true">+</span></summary>
      <div class="info-disclosure-content">
        <p>A taxa de desemprego mede a proporção de pessoas sem emprego, disponíveis e à procura de trabalho, entre as pessoas que pertencem à força de trabalho de 15 a 24 anos.</p>
        <p>São estimativas nacionais, não dados sobre vagas, profissões ou cidades específicas. Para consultar a evolução histórica e a fonte, seleccione um indicador.</p>
      </div>
    </details>
  </div>
</template>
