<script setup>
import { computed } from 'vue'
import { usePlano } from '../composables/usePlano.js'
import WeekCard from '../components/WeekCard.vue'
import { gerarPdf, gerarPdfUnicode } from '../../shared/pdf.js'
const { perfil, perfilDoPlano, plano, concluidas, progresso, alternarTarefa } = usePlano()
const proxima = computed(() => {
  if (!plano.value) return null
  for (const semana of plano.value.semanas) for (const [i,tarefa] of semana.tarefas.entries()) {
    if (!concluidas.value.includes(`${semana.numero - 1}-${i}`)) return { semana: semana.numero, tarefa, duracao: semana.minutosPorTarefa?.[i] }
  }
  return null
})
const semanaActual = computed(() => {
  if (!plano.value) return 1
  const primeira = plano.value.semanas.find(s => s.tarefas.some((_, i) => !concluidas.value.includes(`${s.numero - 1}-${i}`)))
  return primeira?.numero || 4
})
async function descarregar() {
  if (!plano.value) return
  let pdf
  try { pdf = await gerarPdfUnicode(perfilDoPlano.value || perfil.value, plano.value) }
  catch { pdf = gerarPdf(perfilDoPlano.value || perfil.value, plano.value) }
  const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'RumoCerto_MZ_Plano_30_Dias.pdf'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 3000)
}
</script>

<template>
  <div class="container inner-page progress-page">
    <div class="page-heading">
      <span class="eyebrow">ACOMPANHAMENTO</span>
      <h1>Progresso do plano</h1>
      <p>Consulte as actividades por semana e assinale as tarefas concluídas.</p>
    </div>
    <template v-if="plano">
      <section class="progress-summary">
        <div><span class="eyebrow">PLANO DE 30 DIAS</span><h2>{{ plano.titulo }}</h2><p>{{ progresso.feitas }} de {{ progresso.total }} tarefas concluídas</p></div>
        <div class="progress-figure"><strong>{{ progresso.percentagem }}%</strong><span>concluído</span></div>
        <div class="progress-track" role="progressbar" :aria-valuenow="progresso.percentagem" aria-valuemin="0" aria-valuemax="100" aria-label="Progresso do plano"><div :style="{ width: progresso.percentagem + '%' }"></div></div>
      </section>
      <section v-if="proxima" class="next-task" aria-label="A próxima actividade">
        <div class="next-task-icon" aria-hidden="true">↗</div>
        <div><span class="eyebrow">A SEGUIR · SEMANA {{ proxima.semana }}</span><h3>{{ proxima.tarefa }}</h3><p v-if="proxima.duracao">Tempo sugerido: {{ proxima.duracao }} minutos</p></div>
      </section>
      <div v-else class="progress-complete" role="status"><strong>Plano concluído</strong><p>Reveja os resultados alcançados e defina o próximo objectivo.</p></div>
      <div class="progress-actions">
        <span class="progress-hint">Seleccione uma semana para consultar as actividades.</span>
        <div class="progress-action-buttons"><RouterLink to="/plano" class="text-link">Rever objectivo</RouterLink><button type="button" class="btn btn-outline" @click="descarregar">Descarregar PDF ↓</button></div>
      </div>
      <div class="week-grid">
        <WeekCard v-for="s in plano.semanas" :key="s.numero" :semana="s" :concluidas="concluidas" interactivo :inicialmente-aberta="s.numero === semanaActual" @alternar="alternarTarefa" />
      </div>
    </template>
    <section v-else class="surface empty-plano"><div class="empty-icon" aria-hidden="true">↗</div><h2>Ainda não existe um plano</h2><p>Crie um plano de desenvolvimento para acompanhar as actividades e a evolução semanal.</p><RouterLink to="/plano" class="btn btn-primary">Criar plano ↗</RouterLink></section>
  </div>
</template>
