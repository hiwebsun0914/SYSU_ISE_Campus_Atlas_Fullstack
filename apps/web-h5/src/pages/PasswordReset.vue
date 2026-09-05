<template>
  <main class="reset-page">
    <div class="reset-shell">
      <nav class="reset-nav" aria-label="账号恢复导航">
        <RouterLink to="/signin"><ArrowLeft :size="16" aria-hidden="true" />返回登录</RouterLink>
        <span>SYSU / ISE</span>
      </nav>
      <header class="reset-header">
        <p class="eyebrow"><span aria-hidden="true"></span>账号恢复</p>
        <h1>{{ token ? '设置新密码' : '找回你的账号' }}</h1>
        <p class="reset-description">{{ token ? '设置完成后，使用新密码重新登录。' : '填写账号信息，核实身份后即可重置密码。' }}</p>
      </header>
      <section class="reset-card" :aria-label="token ? '设置新密码' : '密码重置申请'">
        <div class="card-heading"><ShieldCheck :size="18" aria-hidden="true" /><h2>{{ done ? '提交完成' : token ? '设置密码' : '重置申请' }}</h2></div>
        <div v-if="done" role="status" class="result">
          <Check :size="24" aria-hidden="true" />
          <strong>{{ message }}</strong>
          <template v-if="requestId">
            <p class="request-id">申请编号 <b>{{ requestId }}</b></p>
            <p>微信私聊奶小龙学长，发送申请编号和账户名。若曾提交申请，请说明情况以便核对已有记录。</p>
            <small>申请 24 小时有效；批准后的链接 30 分钟有效，仅可使用一次。请勿发送密码。</small>
          </template>
          <RouterLink v-else class="reset-submit" to="/signin">使用新密码登录<ArrowRight :size="17" aria-hidden="true" /></RouterLink>
        </div>
        <form v-else @submit.prevent="submit">
          <template v-if="!token">
            <label>账户名<input v-model.trim="form.username" autocomplete="username" maxlength="100" required placeholder="填写登录时使用的账户名" /></label>
            <div class="identity-fields">
              <label><span>姓名 <small class="required-mark">必填</small></span><input v-model.trim="form.realName" autocomplete="name" maxlength="100" required aria-required="true" placeholder="真实姓名" /></label>
              <label><span>学号 <small class="required-mark">必填</small></span><input v-model.trim="form.studentId" maxlength="100" required aria-required="true" placeholder="你的学号" /></label>
            </div>
            <label>申请说明<textarea v-model.trim="form.note" rows="2" maxlength="500" required placeholder="简要说明无法登录的情况，请勿填写密码" /></label>
            <div class="wechat-note"><span class="note-dot" aria-hidden="true"></span><p>提交后，<strong>微信私聊奶小龙学长</strong><br /><span>核实身份后，学长会发送重置链接。</span></p></div>
          </template>
          <template v-else>
            <label>新密码<input v-model="password" type="password" autocomplete="new-password" minlength="8" maxlength="72" required placeholder="至少 8 个字符" /></label>
            <label>确认新密码<input v-model="confirm" type="password" autocomplete="new-password" required placeholder="再次输入新密码" /></label>
            <small>至少 8 个字符、最多 72 字节，首尾不能有空格。保存后，所有设备需要重新登录。</small>
          </template>
          <p v-if="error" role="alert" class="error">{{ error }}</p>
          <button class="reset-submit" :disabled="busy">{{ busy ? '正在提交…' : token ? '保存新密码' : '提交申请' }}<ArrowRight :size="17" aria-hidden="true" /></button>
        </form>
      </section>
      <p class="reset-footer">{{ token ? '密码由你设置，管理员无法查看。' : '身份核实后再重置，保护你的账号。' }}</p>
    </div>
  </main>
</template>
<script setup>
import { reactive, ref } from 'vue'
import { ArrowLeft, ArrowRight, ShieldCheck, Check } from '@lucide/vue'
import { useRoute, useRouter } from 'vue-router'
import { request } from '@/utils/request'
const route = useRoute()
const router = useRouter()
const token = ref(typeof route.query.token === 'string' ? route.query.token : '')
// 从地址栏移除凭证，保留在当前页面内存中。
if (token.value) router.replace({ path: route.path, query: {} })
const form = reactive({ username: '', realName: '', studentId: '', note: '' })
const password = ref(''), confirm = ref(''), error = ref(''), message = ref(''), requestId = ref('')
const busy = ref(false), done = ref(false)
async function submit() {
  if (busy.value) return
  error.value = ''
  if (token.value && (password.value !== password.value.trim() || password.value.length < 8 || new TextEncoder().encode(password.value).length > 72)) {
    error.value = '密码至少 8 个字符、最多 72 字节，首尾不能有空格'; return
  }
  if (token.value && password.value !== confirm.value) { error.value = '两次输入的密码不一致'; return }
  busy.value = true
  try {
    const response = await request('/password-reset/' + (token.value ? 'complete' : 'requests'), 'POST', token.value ? { token: token.value, password: password.value } : { ...form })
    if (!response.ok || response.data?.code !== 0) throw new Error(response.data?.message || '提交失败，请稍后重试')
    if (token.value) {
      localStorage.removeItem('token'); localStorage.removeItem('userInfo')
      password.value = ''; confirm.value = ''
    }
    message.value = response.data.message
    requestId.value = response.data.id || ''
    done.value = true
  } catch (e) { error.value = e.message } finally { busy.value = false }
}
</script>
<style scoped>
.reset-page {
  --reset-ink: #0a2e3b;
  --reset-muted: #5e7271;
  --reset-border: #d6e4df;
  --reset-accent: #c7f24a;
  min-height: 100svh;
  padding: 16px 16px 32px;
  box-sizing: border-box;
  background-color: #f3f7f5;
  background-image: linear-gradient(#d6e4df40 1px, transparent 1px), linear-gradient(90deg, #d6e4df40 1px, transparent 1px);
  background-size: 32px 32px;
  color: var(--reset-ink);
  font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  line-height: 1.6;
}
.reset-shell { max-width: 440px; margin: 0 auto; }
.reset-nav { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--reset-border); padding-bottom: 8px; }
.reset-nav a { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; font-size: 13px; }
a { color: inherit; text-decoration: none; }
.reset-nav > span { font: 10px "SFMono-Regular", Menlo, Consolas, monospace; color: var(--reset-muted); }
.reset-header { padding: 24px 4px; }
.eyebrow { display: flex; align-items: center; gap: 8px; margin: 0 0 12px; font-size: 11px; font-weight: 600; }
.eyebrow > span, .note-dot { width: 7px; height: 7px; background: var(--reset-accent); border: 1px solid var(--reset-ink); border-radius: 50%; flex-shrink: 0; }
h1 { font-family: "DIN Alternate", "Avenir Next", "Noto Sans SC", sans-serif; font-size: 30px; line-height: 1.15; letter-spacing: -.03em; margin: 0; font-weight: 750; }
.reset-description { margin: 12px 0 0; font-size: 13px; color: var(--reset-muted); }
.reset-card { background: #fff; border: 1px solid var(--reset-border); border-radius: 24px; padding: 20px; }
.card-heading { display: flex; align-items: center; gap: 8px; padding-bottom: 16px; margin-bottom: 20px; border-bottom: 1px solid var(--reset-border); }
.card-heading h2 { font-size: 15px; margin: 0; font-weight: 650; }
form { display: grid; gap: 16px; }
label { display: grid; min-width: 0; gap: 6px; font-size: 12px; font-weight: 600; }
.required-mark { margin-left: 4px; color: #08766d; font-size: 10px; font-weight: 600; }
.identity-fields { display: grid; grid-template-columns: minmax(0, .85fr) minmax(0, 1.15fr); gap: 12px; }
input, textarea { min-width: 0; width: 100%; box-sizing: border-box; border: 1px solid var(--reset-border); border-radius: 8px; background: #fbfcfb; color: #102a2e; font-family: inherit; font-size: 16px; font-weight: 400; line-height: 1.5; padding: 9px 12px; }
input { height: 44px; }
textarea { height: 72px; resize: vertical; }
input::placeholder, textarea::placeholder { color: var(--reset-muted); opacity: 1; font-size: 12px; }
.wechat-note { display: flex; gap: 8px; align-items: flex-start; padding-block: 0 2px; }
.note-dot { margin-top: 7px; width: 5px; height: 5px; }
.wechat-note p { margin: 0; font-size: 12px; line-height: 1.8; }
.wechat-note strong { font-weight: 600; }
.wechat-note p > span, small { color: var(--reset-muted); font-size: 12px; }
.reset-submit { display: flex; align-items: center; justify-content: center; gap: 12px; min-height: 44px; padding: 10px 16px; box-sizing: border-box; border: 1px solid #b2d83f; border-radius: 999px; background: var(--reset-accent); color: var(--reset-ink); line-height: 1.5; font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
.reset-submit:active { transform: scale(.99); }
.reset-submit:disabled { opacity: .6; cursor: wait; }
.error { color: #c2413a; font-size: 13px; margin: 0; }
.reset-footer { margin: 16px 0 0; text-align: center; color: var(--reset-muted); font-size: 11px; }
.result { display: grid; gap: 16px; overflow-wrap: anywhere; font-size: 14px; }
.result > p { margin: 0; }
.request-id { padding-block: 12px; border-block: 1px solid var(--reset-border); }
.request-id b { display: block; font-family: "SFMono-Regular", Menlo, monospace; margin-top: 4px; }
:where(input, textarea, button, a):focus-visible { outline: 2px solid var(--reset-ink); outline-offset: 3px; box-shadow: 0 0 0 5px var(--reset-accent); }
@media (min-width: 700px) { .reset-page { padding-top: 40px; } .reset-header { padding-block: 32px; } .reset-card { padding: 24px; } }
@media (max-width: 340px) { .reset-card { padding: 16px; } .identity-fields { grid-template-columns: minmax(0, 1fr); } }
@media (prefers-reduced-motion: reduce) { .reset-submit:active { transform: none; } }
</style>
