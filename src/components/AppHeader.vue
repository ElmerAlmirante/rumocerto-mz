<script setup>
import { ref } from 'vue'
const aberto = ref(false)
const logo = `${import.meta.env.BASE_URL}branding/simbolo.webp`
const links = [
  { to: '/', label: 'Início' },
  { to: '/indicadores', label: 'Indicadores' },
  { to: '/progresso', label: 'Progresso' }
]
</script>

<template>
  <header class="site-header">
    <div class="container navbar">
      <RouterLink to="/" class="brand" aria-label="RumoCerto MZ, página inicial" @click="aberto = false">
        <span class="brand-mark" aria-hidden="true"><img :src="logo" alt="" width="43" height="43" /></span>
        <span>Rumo<span class="brand-accent">Certo</span><small>MZ</small></span>
      </RouterLink>
      <button type="button" class="menu-button" :aria-expanded="aberto" aria-controls="site-links" @click="aberto = !aberto">{{ aberto ? 'Fechar ×' : 'Menu ☰' }}</button>
      <nav id="site-links" class="nav-links" :class="{ 'nav-open': aberto }" aria-label="Navegação principal">
        <RouterLink v-for="item in links" :key="item.to" :to="item.to" @click="aberto = false">{{ item.label }}</RouterLink>
        <RouterLink class="nav-primary" to="/plano" @click="aberto = false">Criar plano <span aria-hidden="true">↗</span></RouterLink>
      </nav>
    </div>
  </header>
</template>
