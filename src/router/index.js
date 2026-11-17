import { createRouter, createWebHashHistory } from 'vue-router'
import InicioView from '../views/InicioView.vue'
import IndicadoresView from '../views/IndicadoresView.vue'
import DetalheView from '../views/DetalheView.vue'
import PlanoView from '../views/PlanoView.vue'
import ProgressoView from '../views/ProgressoView.vue'
import SobreView from '../views/SobreView.vue'
import NaoEncontradoView from '../views/NaoEncontradoView.vue'
const routes = [
  {path:'/',component:InicioView,meta:{title:'Início'}},
  {path:'/indicadores',component:IndicadoresView,meta:{title:'Indicadores'}},
  {path:'/indicadores/:codigo',component:DetalheView,props:true,meta:{title:'Detalhe do indicador'}},
  {path:'/plano',component:PlanoView,meta:{title:'Criar plano'}},
  {path:'/progresso',component:ProgressoView,meta:{title:'O meu progresso'}},
  {path:'/sobre',component:SobreView,meta:{title:'Sobre o projecto'}},
  {path:'/:pathMatch(.*)*',component:NaoEncontradoView,meta:{title:'Página não encontrada'}}
]
const router=createRouter({history:createWebHashHistory(import.meta.env.BASE_URL),routes,scrollBehavior:()=>({top:0})})
router.afterEach(to=>{document.title=`${to.meta.title || 'RumoCerto MZ'} · RumoCerto MZ`})
export default router
