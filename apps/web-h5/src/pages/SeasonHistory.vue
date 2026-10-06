<template>
  <main class="season-page">
    <header><RouterLink to="/">← 返回首页</RouterLink><p class="eyebrow">迎新活动 · 我的记录</p><h1>{{ seasons.config?.name }}</h1><p>这里长期保留你作为新生参加本届活动的记录。</p></header>
    <p v-if="error" role="alert" class="notice">{{ error }}</p>
    <p v-if="busy" role="status">正在读取记录…</p>
    <template v-if="mine">
      <p v-if="mine.status === 'open' && !mine.eligibility" class="notice">你可以查看本届公开内容，但目前没有本届打卡、投稿或投票资格。</p>
      <section class="totals" aria-label="我的活动统计"><div><strong>{{ mine.progress.points }}</strong><span>积分</span></div><div><strong>{{ mine.progress.unlockedLocations.length }}</strong><span>已通过打卡</span></div><div><strong>{{ mine.progress.completedRoutes.length }}</strong><span>完成路线</span></div></section>
      <section><h2>获奖记录</h2><p v-if="!mine.awards.length">暂无已公布的获奖记录。</p><ul v-else><li v-for="item in mine.awards" :key="item.id">{{ item.title }} · {{ item.winnerLabel || `第 ${item.winnerRank} 名` }}</li></ul></section>
      <section><h2>完成路线</h2><p v-if="!mine.progress.completedRoutes.length">本届尚无完成路线。</p><ul><li v-for="id in mine.progress.completedRoutes" :key="id">{{ routeName(id) }}</li></ul></section>
      <section><h2>打卡与审核记录</h2><p v-if="!records.length">本届尚无打卡记录。</p><ul class="records"><li v-for="(item,index) in records" :key="index"><strong>{{ locationName(item.locationId) }}</strong><span>{{ statusName(item.status) }} · {{ formatTime(item.reviewedAt || item.submittedAt || item.time) }}</span><p v-if="item.note">{{ item.note }}</p><a v-if="item.photo || item.thumbnail" :href="item.photo || item.thumbnail" target="_blank" rel="noopener">查看照片</a></li></ul></section>
    </template>
    <section v-if="admin" class="management">
      <h2>活动期管理</h2><label>查看活动 <select v-model="managedId" @change="loadPreview"><option v-for="item in adminList" :key="item.seasonId" :value="item.seasonId">{{ item.name }} · {{ statusName(item.status) }}</option></select></label>
      <template v-if="preview">
        <p>待审核打卡 {{ preview.pending.checkins }} 条，投稿及申诉 {{ preview.pending.submissions }} 条。</p>
        <details><summary>查看归档预览</summary><h3>积分排名</h3><ol><li v-for="row in preview.pointsRank" :key="row.userId">{{ row.username }} · {{ row.points }} 分</li></ol><h3>获奖预览</h3><pre>{{ JSON.stringify(preview.awards, null, 2) }}</pre></details>
        <button v-if="preview.season.status === 'archived'" @click="downloadArchive">下载完整归档</button>
        <template v-if="owner">
          <fieldset v-if="preview.season.status === 'draft'"><legend>逐一复核管理员（角色调整请到管理端）</legend><label v-for="person in preview.adminReview" :key="person.id"><input v-model="reviewed" type="checkbox" :value="String(person.id)"> {{ person.username }} · {{ person.role }}</label></fieldset>
          <section v-if="preview.season.status === 'draft'" class="roster-import"><h3>导入当级新生花名册</h3><p>支持 .xlsx 和 UTF-8 CSV。首行需包含姓名、学号、入学年份、学院；文件由后端解析，原文件不会公开。</p><label>选择花名册<input ref="rosterFile" type="file" accept=".xlsx,.csv" @change="rosterSelected = $event.target.files?.[0] || null"></label><button :disabled="working || !rosterSelected" @click="importRoster">{{ rosterSummary ? '替换并重新导入' : '导入花名册' }}</button><p v-if="rosterSummary">已导入 {{ rosterSummary.count }} 人 · {{ rosterSummary.sourceName }} · {{ formatTime(rosterSummary.importedAt) }}</p><ul v-if="rosterSummary?.colleges?.length"><li v-for="item in rosterSummary.colleges" :key="item.name">{{ item.name }}：{{ item.count }} 人</li></ul></section>
          <p v-if="preview.season.status !== 'archived'">归档和开启新届前，需要管理员完成当前数据的备份与隔离恢复演练。</p>
          <label v-if="preview.season.status !== 'archived'"><input v-model="confirmed" type="checkbox"> 我已核对活动期及下方操作</label>
          <div class="actions"><button v-if="preview.season.status === 'open'" :disabled="working || !confirmed" @click="transition('settle')">停止参与，进入结算</button><button v-if="preview.season.status === 'settling'" :disabled="working || !confirmed || preview.pending.checkins + preview.pending.submissions > 0" @click="transition('archive')">冻结结果并归档</button><button v-if="preview.season.status === 'draft'" :disabled="working || !confirmed || reviewed.length !== preview.adminReview.length" @click="transition('activate')">开启本届并设为当前</button></div>
          <details v-if="preview.season.status === 'draft'"><summary>活动规则与保留策略</summary><p>草稿继承上一届规则；可在此核对并修改截止、公布时间、路线、积分与奖项规则。保留期限留空表示不自动清理。</p><textarea v-model="configText" rows="16" aria-label="活动配置 JSON" spellcheck="false"></textarea><button :disabled="working" @click="saveConfig">保存草稿配置</button></details>
        </template>
      </template>
      <form v-if="owner" @submit.prevent="createDraft"><h3>创建下一届草稿</h3><label>活动标识<input v-model="draft.seasonId" required pattern="[a-z0-9][a-z0-9-]{0,63}" placeholder="2027-welcome"></label><label>活动名称<input v-model="draft.name" required maxlength="80" placeholder="2027 迎新活动"></label><label>截止时间<input v-model="draft.deadline" type="datetime-local" required></label><label>结果公布时间<input v-model="draft.revealAt" type="datetime-local" required></label><button :disabled="working">创建草稿</button></form>
    </section>
  </main>
</template>
<script setup>
import { ref, computed, onMounted } from 'vue'
import { request } from '@/utils/request'
import { seasons } from '@/stores/seasons'
const mine=ref(null),error=ref(''),busy=ref(true),admin=ref(false),owner=ref(false),adminList=ref([]),managedId=ref(seasons.selected),preview=ref(null),reviewed=ref([]),confirmed=ref(false),working=ref(false),locations=ref([]),configText=ref(''),rosterSummary=ref(null),rosterSelected=ref(null),rosterFile=ref(null)
const draft=ref({seasonId:'',name:'',deadline:'',revealAt:''})
const records=computed(()=>mine.value ? [...mine.value.progress.checkinRecords.map(x=>({...x,status:'approved'})),...mine.value.progress.pendingCheckins.map(x=>({...x,status:'pending'})),...mine.value.progress.checkinReviewRecords.filter(x=>x.status!=='approved')] : [])
const statusName=s=>({draft:'草稿',open:'开放',settling:'结算',archived:'归档',pending:'待审核',approved:'已通过',rejected:'已驳回'}[s] || s)
const formatTime=t=>t ? new Date(t).toLocaleString() : '时间未记录'
const locationName=id=>locations.value.find(x=>Number(x.backendId)===Number(id))?.name || `地点 ${id}`
const routeName=id=>seasons.config?.routes?.find(x=>x.id===id)?.name || id
async function call(url,method='GET',data=null,id=seasons.selected){const r=await request(url,method,data,{headers:{'X-Season-Id':id}});if(!r.ok || r.data?.code!==0)throw new Error(r.data?.message || '操作失败');return r.data}
async function loadPreview(){try{confirmed.value=false;reviewed.value=[];rosterSelected.value=null;if(rosterFile.value)rosterFile.value.value='';preview.value=(await call('/seasons/preview','GET',null,managedId.value)).data;if(owner.value){configText.value=JSON.stringify((await call('/seasons/admin-config','GET',null,managedId.value)).data,null,2);rosterSummary.value=(await call('/seasons/roster','GET',null,managedId.value)).data}}catch(e){error.value=e.message}}
async function refreshAdmin(){const r=await call('/seasons/admin');adminList.value=r.list;await loadPreview()}
async function action(fn){working.value=true;error.value='';try{await fn()}catch(e){error.value=e.message}finally{working.value=false}}
function transition(kind){return action(async()=>{await call('/seasons/'+kind,'POST',{reviewedAdminIds:reviewed.value},managedId.value);await refreshAdmin();if(kind==='activate'){localStorage.removeItem('activityScope');window.location.reload()}})}
function createDraft(){return action(async()=>{const data={...draft.value,deadline:new Date(draft.value.deadline).toISOString(),revealAt:new Date(draft.value.revealAt).toISOString()};await call('/seasons','POST',data);managedId.value=data.seasonId;await refreshAdmin()})}
function saveConfig(){return action(async()=>{await call('/seasons/admin-config','PUT',JSON.parse(configText.value),managedId.value);await loadPreview()})}
function importRoster(){return action(async()=>{const body=new FormData();body.append('file',rosterSelected.value);rosterSummary.value=(await call('/seasons/roster/import','POST',body,managedId.value)).data;rosterSelected.value=null;if(rosterFile.value)rosterFile.value.value='';await loadPreview()})}
function downloadArchive(){return action(async()=>{const data=await call('/seasons/archive','GET',null,managedId.value);const url=URL.createObjectURL(new Blob([JSON.stringify(data.data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=managedId.value+'-archive.json';a.click();URL.revokeObjectURL(url)})}
onMounted(async()=>{try{mine.value=(await call('/seasons/mine')).data;locations.value=seasons.config.locations || [];const me=(await call('/auth/me')).userInfo;admin.value=['admin','owner'].includes(me.role);owner.value=me.role==='owner';if(admin.value)await refreshAdmin()}catch(e){error.value=e.message}finally{busy.value=false}})
</script>
<style scoped>
.season-page{max-width:840px;margin:auto;padding:32px 20px 110px;color:#223c30;line-height:1.7}header{padding-bottom:24px;border-bottom:1px solid #d7e2d9}.eyebrow{font-size:12px;letter-spacing:.16em;color:#667f70;margin-top:28px}h1{font-size:30px;margin:8px 0}h2{font-size:20px}h3{font-size:16px}section{padding:22px 0;border-bottom:1px solid #d7e2d9}.totals{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.totals div{display:flex;flex-direction:column}.totals strong{font-size:32px;font-variant-numeric:tabular-nums}.totals span{font-size:13px;color:#667f70}a{color:#245c43;text-underline-offset:4px}.notice{padding:14px;background:#fff3e2;border-left:3px solid #ab7733}.records{list-style:none;padding:0}.records li{padding:12px 0;border-bottom:1px dashed #d7e2d9}.records span{display:block;font-size:13px;color:#667f70}.roster-import{padding:14px;margin:18px 0;border:1px solid #d7e2d9;border-radius:8px;background:#f8fbf8}.roster-import h3{margin-top:0}.roster-import ul{margin-bottom:0}label{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0}form label{display:grid;gap:5px}input,select,textarea{font:inherit;border:1px solid #bdcec1;border-radius:6px;padding:8px;background:#fff;color:inherit;max-width:100%;box-sizing:border-box}textarea{width:100%;font-size:12px}button{font:inherit;background:#245c43;color:white;border:0;border-radius:6px;padding:9px 16px;cursor:pointer;margin:8px 0}button:disabled{opacity:.45;cursor:not-allowed}.actions{display:flex;gap:12px}fieldset{border:1px solid #d7e2d9;margin-top:20px}details{margin:16px 0}summary{cursor:pointer}pre{overflow:auto;font-size:12px}form{max-width:480px;margin-top:28px}:focus-visible{outline:2px solid #245c43;outline-offset:3px}
</style>
