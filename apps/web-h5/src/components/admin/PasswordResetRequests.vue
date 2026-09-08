<template>
  <section class="reset-requests" aria-labelledby="reset-requests-title">
    <div class="admin-section-head"><div><h3 id="reset-requests-title">密码重置申请</h3><p>让申请人微信私聊奶小龙学长。核实身份后批准，将一次性链接发给本人。</p></div><button class="admin-button admin-button-quiet" :disabled="loading" @click="load">{{ loading ? '加载中' : '刷新申请' }}</button></div>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="!loading && !error && !items.length">暂无密码重置申请</p>
    <article v-for="item in items" :key="item.id" class="reset-item">
      <strong>{{ item.username }} · {{ labels[item.status] }}</strong>
      <p>申请编号 {{ item.id }} · {{ new Date(item.createdAt).toLocaleString() }}</p>
      <p>申请填写：{{ item.realName }} · {{ item.studentId }}</p>
      <p>已登记：{{ item.registeredRealName || '未填写姓名' }} · {{ item.registeredStudentId || '未填写学号' }}</p>
      <p>说明：{{ item.note }}</p>
      <p v-if="item.reviewNote">处理备注：{{ item.reviewNote }} · 审批人 {{ item.reviewedBy }}</p>
      <div class="admin-dialog-actions">
        <template v-if="item.status === 'pending'"><button class="admin-button" @click="open(item, 'approve')">核实并批准</button><button class="admin-button admin-button-quiet" @click="open(item, 'reject')">拒绝</button></template>
        <button v-if="item.status === 'approved' || (item.status === 'expired' && item.reviewedAt && item.reviewNote && !item.completedAt)" class="admin-button admin-button-quiet" @click="open(item, 'reissue')">重新签发链接</button>
      </div>
    </article>
    <dialog ref="dialog" class="admin-dialog" aria-labelledby="reset-review-title" @close="clear" @cancel="busy && $event.preventDefault()">
      <form @submit.prevent="decide">
        <h2 id="reset-review-title">{{ action === 'reject' ? '拒绝申请' : '确认身份并签发链接' }}</h2>
        <p>{{ selected?.username }} · {{ selected?.id }}</p>
        <template v-if="!link">
          <label for="reset-review-note">{{ action === 'reject' ? '拒绝原因' : '微信核实备注' }}</label>
          <textarea id="reset-review-note" v-model.trim="note" rows="3" maxlength="500" required :disabled="busy" placeholder="记录核实依据，不要填写密码或完整聊天记录" />
          <label v-if="action !== 'reject'"><input v-model="verified" type="checkbox" required :disabled="busy" /> 已通过微信核实本人身份，未仅凭姓名、学号或申请编号批准</label>
          <p v-if="action === 'reissue'">签发后旧链接立即失效。</p>
        </template>
        <template v-else>
          <p>链接 30 分钟有效，仅能使用一次。请复制并通过已核实的微信会话发给本人，关闭窗口后不再展示。</p>
          <textarea aria-label="一次性重置链接" :value="link" readonly rows="4" />
          <button class="admin-button admin-button-quiet" type="button" @click="copy">{{ copied ? '已复制' : '复制链接' }}</button>
        </template>
        <p v-if="dialogError" role="alert">{{ dialogError }}</p>
        <div class="admin-dialog-actions"><button type="button" class="admin-button admin-button-quiet" :disabled="busy" @click="dialog.close()">{{ link ? '完成' : '取消' }}</button><button v-if="!link" class="admin-button" :disabled="busy">{{ busy ? '正在处理' : '确认' }}</button></div>
      </form>
    </dialog>
  </section>
</template>
<script setup>
import { ref, onMounted } from 'vue'
import { request } from '@/utils/request'
const items=ref([]), loading=ref(false), error=ref(''), dialog=ref(null), selected=ref(null), action=ref(''), note=ref(''), verified=ref(false), busy=ref(false), link=ref(''), copied=ref(false), dialogError=ref('')
const labels={pending:'待审批',approved:'待设置密码',rejected:'已拒绝',completed:'已完成',expired:'已过期'}
async function api(path, method='GET', data=null) {
  const r=await request('/password-reset/requests'+path,method,data)
  if(!r.ok || r.data?.code!==0) throw new Error(r.data?.message || '请求失败，请确认云端已部署密码重置功能')
  return r.data
}
async function load(){loading.value=true;error.value='';try{items.value=(await api('')).list}catch(e){error.value=e.message}finally{loading.value=false}}
function clear(){selected.value=null;note.value='';verified.value=false;link.value='';copied.value=false;dialogError.value=''}
function open(item, choice){clear();selected.value=item;action.value=choice;dialog.value.showModal()}
async function decide(){
  if(busy.value || !selected.value || (action.value!=='reject' && !verified.value))return
  busy.value=true;dialogError.value=''
  try{const r=await api('/'+selected.value.id+'/decision','POST',{action:action.value,note:note.value});link.value=r.link||'';if(!link.value)dialog.value.close();await load()}
  catch(e){dialogError.value=e.message}finally{busy.value=false}
}
async function copy(){try{await navigator.clipboard.writeText(link.value);copied.value=true}catch{dialogError.value='自动复制失败，请长按或选中上方链接手动复制'}}
onMounted(load)
</script>
<style scoped>
.reset-requests{margin-block:24px;border-block:1px solid var(--color-rule);padding-block:24px}.reset-item{border-top:1px solid var(--color-rule);padding-block:20px;overflow-wrap:anywhere}.reset-item p{margin:8px 0;font-size:14px}.reset-requests label{display:block;margin-block:14px}.reset-requests input[type=checkbox]{width:auto;margin-right:8px}.reset-requests textarea{box-sizing:border-box;width:100%}
</style>
