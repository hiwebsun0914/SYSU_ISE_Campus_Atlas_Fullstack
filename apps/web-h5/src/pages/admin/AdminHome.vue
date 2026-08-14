<template>
  <div class="admin-page">
    <a class="admin-skip-link" href="#admin-main">跳到管理内容</a>

    <aside class="admin-rail" aria-label="管理员导航">
      <button class="admin-rail-brand" type="button" aria-label="返回工作台" @click="goSection('overview')">
        <span>SYSU</span>
        <strong>EXPLORE<br />CONTROL</strong>
      </button>
      <nav class="admin-rail-nav">
        <button
          v-for="item in navigation"
          :key="item.id"
          type="button"
          :class="{ active: activeSection === item.id }"
          :aria-current="activeSection === item.id ? 'location' : undefined"
          @click="goSection(item.id)"
        >
          <component :is="item.icon" :size="18" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </button>
      </nav>
      <div class="admin-rail-account">
        <span>{{ roleLabel }}</span>
        <strong>{{ dashboard.currentAdmin?.username || '管理员' }}</strong>
        <button type="button" @click="leaveAdminMode">
          <CircleUserRound :size="17" aria-hidden="true" />
          返回普通模式
        </button>
        <button type="button" @click="logout">
          <LogOut :size="17" aria-hidden="true" />
          退出登录
        </button>
      </div>
    </aside>

    <header class="admin-mobile-bar">
      <button class="admin-mobile-brand" type="button" aria-label="返回工作台" @click="goSection('overview')">
        <span>SYSU</span>
        <strong>管理员模式</strong>
      </button>
      <button
        class="admin-menu-button"
        type="button"
        aria-haspopup="dialog"
        :aria-expanded="menuOpen"
        aria-controls="admin-mobile-menu"
        @click="openMenu"
      >
        <Menu :size="19" aria-hidden="true" />
        菜单
      </button>
    </header>

    <dialog id="admin-mobile-menu" ref="menuDialog" class="admin-menu-dialog" @close="menuOpen = false" @click="closeDialogBackdrop">
      <div class="admin-menu-head">
        <div>
          <span>{{ roleLabel }}</span>
          <strong>{{ dashboard.currentAdmin?.username || '管理员' }}</strong>
        </div>
        <button type="button" aria-label="关闭菜单" @click="closeMenu">
          <X :size="20" aria-hidden="true" />
        </button>
      </div>
      <nav aria-label="手机端管理员导航">
        <button
          v-for="item in navigation"
          :key="item.id"
          type="button"
          :aria-current="activeSection === item.id ? 'location' : undefined"
          @click="goSection(item.id)"
        >
          <component :is="item.icon" :size="19" aria-hidden="true" />
          <span>{{ item.label }}</span>
          <ChevronRight :size="17" aria-hidden="true" />
        </button>
      </nav>
      <button class="admin-menu-site" type="button" @click="leaveAdminMode">
        <CircleUserRound :size="18" aria-hidden="true" />
        返回普通模式
      </button>
      <button class="admin-menu-logout" type="button" @click="logout">
        <LogOut :size="18" aria-hidden="true" />
        退出管理员账号
      </button>
    </dialog>

    <main id="admin-main" class="admin-main">
      <section v-if="initialLoading" class="admin-loading" aria-busy="true" aria-label="正在加载管理员空间">
        <div class="admin-skeleton admin-skeleton-stat"></div>
        <div class="admin-skeleton admin-skeleton-line"></div>
        <div class="admin-skeleton-grid">
          <div v-for="index in 4" :key="index" class="admin-skeleton admin-skeleton-cell"></div>
        </div>
        <div class="admin-skeleton admin-skeleton-panel"></div>
      </section>

      <section v-else-if="fatalError" class="admin-fatal" role="alert">
        <TriangleAlert :size="30" aria-hidden="true" />
        <h1>管理员空间暂时无法加载</h1>
        <p>{{ fatalError }}</p>
        <button class="admin-button admin-button-primary" type="button" @click="loadAdminSpace">
          <RefreshCcw :size="17" aria-hidden="true" />
          重新加载
        </button>
      </section>

      <template v-else>
        <header class="admin-workbench" aria-label="管理工作台摘要">
          <div class="admin-workbench-top">
            <div class="admin-workbench-heading">
              <div class="admin-mode-line">
                <ShieldCheck :size="17" aria-hidden="true" />
                <span>管理员模式</span>
                <i aria-hidden="true"></i>
                <small>{{ roleLabel }}</small>
              </div>
              <h1>管理控制台</h1>
            </div>
            <div class="admin-workbench-actions">
              <button
                v-if="dashboard.metrics.pendingTotal > 0"
                class="admin-button admin-button-primary"
                type="button"
                @click="goSection('review')"
              >
                <ClipboardCheck :size="17" aria-hidden="true" />
                开始审核
              </button>
              <button class="admin-button admin-button-quiet" type="button" :disabled="refreshing" @click="refreshAll">
                <RefreshCcw :size="17" aria-hidden="true" :class="{ spinning: refreshing }" />
                {{ refreshing ? '正在刷新' : '刷新数据' }}
              </button>
            </div>
          </div>
          <nav class="admin-pending-chips" aria-label="待处理事项，点击直达对应视图">
            <button type="button" @click="goSection('review', 'checkins')">
              <b>{{ dashboard.metrics.pendingCheckins }}</b>
              待审打卡
            </button>
            <button type="button" @click="goSection('review', 'submissions')">
              <b>{{ dashboard.metrics.pendingSubmissions }}</b>
              待审投稿
            </button>
            <button type="button" @click="goSection('feedback')">
              <b>{{ feedbackStat.submitted + feedbackStat.in_progress }}</b>
              待处理反馈
            </button>
            <button type="button" @click="goSection('anomalies')">
              <b>{{ anomalyStat.all }}</b>
              异常线索
            </button>
          </nav>
        </header>

        <section v-show="activeSection === 'overview'" id="overview" class="admin-section admin-analytics-section" aria-labelledby="overview-title">
          <div class="admin-section-head">
            <div>
              <h2 id="overview-title">运营总览</h2>
              <p>近七日趋势来自带时间戳的成功打卡记录；排行榜按用户已解锁地点汇总。</p>
            </div>
            <span>近 7 日</span>
          </div>

          <dl class="admin-mini-stats" aria-label="总体数据">
            <div>
              <dt>用户总数</dt>
              <dd>{{ dashboard.metrics.userCount }}</dd>
            </div>
            <div>
              <dt>投稿总数</dt>
              <dd>{{ dashboard.metrics.submissionCount }}</dd>
            </div>
            <div>
              <dt>打卡总数</dt>
              <dd>{{ dashboard.metrics.checkinCount }}</dd>
            </div>
            <div>
              <dt>优秀作品</dt>
              <dd>{{ dashboard.metrics.featuredCount }}</dd>
            </div>
          </dl>

          <div class="admin-analytics-grid">
            <figure class="admin-activity-chart">
              <figcaption>
                <strong>打卡活跃度</strong>
                <span>共 {{ activityTotal }} 条带时间记录</span>
              </figcaption>
              <div class="admin-bars" aria-label="近七日打卡数量柱状图">
                <div v-for="day in dashboard.activity" :key="day.date" class="admin-bar-column">
                  <span class="admin-bar-value">{{ day.count }}</span>
                  <div class="admin-bar-track">
                    <i :style="{ '--bar-scale': activityBarScale(day.count) }"></i>
                  </div>
                  <time :datetime="day.date">{{ day.label }}</time>
                </div>
              </div>
            </figure>

            <div class="admin-hotspots">
              <div class="admin-subhead">
                <strong>热门打卡点</strong>
                <span>按解锁人数</span>
              </div>
              <ol v-if="dashboard.hotspots.length">
                <li v-for="(item, index) in dashboard.hotspots" :key="item.locationId">
                  <span>{{ String(index + 1).padStart(2, '0') }}</span>
                  <div>
                    <strong>{{ item.name }}</strong>
                    <small>#{{ item.locationId }} · {{ item.points }} 分</small>
                  </div>
                  <b>{{ item.count }}</b>
                </li>
              </ol>
              <div v-else class="admin-empty compact">
                <MapPinned :size="24" aria-hidden="true" />
                <div><strong>尚无地点排行</strong><p>产生首条成功打卡后这里会自动更新。</p></div>
              </div>
            </div>
          </div>
        </section>

        <section v-show="activeSection === 'review'" id="review" class="admin-section admin-review-section" aria-labelledby="review-title">
          <div class="admin-section-head">
            <div>
              <h2 id="review-title">审核中心</h2>
              <p>照片打卡与投稿作品共用一套处理节奏，操作结果直接写回原有数据结构。</p>
            </div>
            <span>{{ activeQueueCount }} 项</span>
          </div>

          <div class="admin-tab-row" role="tablist" aria-label="审核内容类型" @keydown="handleQueueTabKeydown">
            <button
              id="queue-tab-checkins"
              type="button"
              role="tab"
              :aria-selected="reviewQueue === 'checkins'"
              aria-controls="queue-panel"
              :tabindex="reviewQueue === 'checkins' ? 0 : -1"
              @click="setReviewQueue('checkins')"
            >
              <Camera :size="17" aria-hidden="true" />
              打卡照片
              <span>{{ checkinStat.pending || 0 }}</span>
            </button>
            <button
              id="queue-tab-submissions"
              type="button"
              role="tab"
              :aria-selected="reviewQueue === 'submissions'"
              aria-controls="queue-panel"
              :tabindex="reviewQueue === 'submissions' ? 0 : -1"
              @click="setReviewQueue('submissions')"
            >
              <Images :size="17" aria-hidden="true" />
              投稿作品
              <span>{{ submissionStat.pending || 0 }}</span>
            </button>
          </div>

          <div class="admin-filter-row">
            <label :for="reviewQueue + '-status'">审核状态</label>
            <select :id="reviewQueue + '-status'" v-model="activeReviewStatus" @change="fetchReviewQueue">
              <option v-for="option in activeStatusOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
            <button class="admin-text-action" type="button" :disabled="reviewLoading" @click="fetchReviewQueue">
              <RefreshCcw :size="16" aria-hidden="true" :class="{ spinning: reviewLoading }" />
              更新队列
            </button>
          </div>

          <Transition name="admin-crossfade" mode="out-in">
            <div id="queue-panel" :key="reviewQueue + activeReviewStatus" class="admin-queue" role="tabpanel" :aria-labelledby="'queue-tab-' + reviewQueue">
              <div v-if="reviewLoading" class="admin-queue-loading" aria-label="正在加载审核队列">
                <div v-for="index in 3" :key="index" class="admin-review-skeleton"></div>
              </div>

              <template v-else-if="reviewQueue === 'checkins'">
                <article v-for="item in checkins" :key="item.id" class="admin-review-row">
                  <button
                    class="admin-review-media"
                    type="button"
                    :disabled="!item.photo"
                    :aria-label="item.photo ? '查看打卡照片大图' : '该打卡没有可预览照片'"
                    @click="item.photo && openPreview(item.photo, item.locationName)"
                  >
                    <img v-if="item.photo" :src="item.photo" :alt="item.username + '在' + item.locationName + '的打卡照片'" width="320" height="240" loading="lazy" />
                    <Camera v-else :size="28" aria-hidden="true" />
                  </button>
                  <div class="admin-review-copy">
                    <div class="admin-review-meta">
                      <span :class="['admin-status', 'status-' + item.status]">{{ checkinStatusLabel(item.status) }}</span>
                      <time :datetime="toDateTime(item.uploadTime)">{{ formatTime(item.uploadTime) }}</time>
                    </div>
                    <h3>{{ item.locationName }}</h3>
                    <p>{{ item.username }} · 地点 #{{ item.locationId }} · 通过后计 {{ item.points }} 分</p>
                    <p v-if="item.reviewNote" class="admin-review-description">审核说明：{{ item.reviewNote }}</p>
                    <p v-if="item.status === 'appealed'" class="admin-appeal">申诉：{{ item.appealReason || '用户申请重新复核' }}</p>
                  </div>
                  <div v-if="item.status === 'pending' || item.status === 'appealed'" class="admin-review-actions">
                    <button class="admin-button admin-button-primary" type="button" :disabled="isBusy(item.id)" @click="approveCheckin(item)">
                      <Check :size="17" aria-hidden="true" />
                      {{ isBusy(item.id) ? '处理中' : (item.status === 'appealed' ? '通过申诉' : '通过') }}
                    </button>
                    <button class="admin-button admin-button-danger" type="button" :disabled="isBusy(item.id)" @click="openReject('checkin', item)">
                      <Ban :size="17" aria-hidden="true" />
                      {{ item.status === 'appealed' ? '维持驳回' : '驳回' }}
                    </button>
                  </div>
                </article>
              </template>

              <template v-else>
                <article v-for="item in submissions" :key="item.id" class="admin-review-row admin-submission-row">
                  <button
                    class="admin-review-media"
                    type="button"
                    :disabled="!submissionImage(item)"
                    :aria-label="submissionImage(item) ? '查看投稿作品大图' : '该投稿没有可预览图片'"
                    @click="submissionImage(item) && openPreview(submissionImage(item), item.title)"
                  >
                    <img v-if="submissionImage(item)" :src="submissionImage(item)" :alt="item.title + '作品预览'" width="320" height="240" loading="lazy" />
                    <Images v-else :size="28" aria-hidden="true" />
                  </button>
                  <div class="admin-review-copy">
                    <div class="admin-review-meta">
                      <span :class="['admin-status', 'status-' + item.status]">{{ submissionStatusLabel(item.status) }}</span>
                      <span v-if="item.featured" class="admin-status status-featured"><Star :size="13" aria-hidden="true" />优秀</span>
                      <time :datetime="toDateTime(item.createdAt)">{{ formatTime(item.createdAt) }}</time>
                    </div>
                    <h3>{{ item.title || '未命名作品' }}</h3>
                    <p>{{ item.username }} · {{ item.locationName || ('地点 #' + item.locationId) }} · {{ item.categoryName }}</p>
                    <p class="admin-review-description">{{ item.description || '未填写作品说明。' }}</p>
                    <p v-if="item.appealStatus === 'pending'" class="admin-appeal">申诉：{{ item.appealReason || '用户申请复核' }}</p>
                  </div>
                  <div class="admin-review-actions">
                    <button
                      v-if="canReviewSubmission(item)"
                      class="admin-button admin-button-primary"
                      type="button"
                      :disabled="isBusy(item.id)"
                      @click="approveSubmission(item)"
                    >
                      <Check :size="17" aria-hidden="true" />
                      {{ item.appealStatus === 'pending' ? '通过申诉' : '通过' }}
                    </button>
                    <button
                      v-if="canReviewSubmission(item)"
                      class="admin-button admin-button-danger"
                      type="button"
                      :disabled="isBusy(item.id)"
                      @click="openReject('submission', item)"
                    >
                      <Ban :size="17" aria-hidden="true" />
                      {{ item.appealStatus === 'pending' ? '维持驳回' : '驳回' }}
                    </button>
                    <button
                      v-if="item.status === 'approved'"
                      class="admin-button admin-button-quiet"
                      type="button"
                      :disabled="isBusy(item.id)"
                      @click="toggleFeature(item)"
                    >
                      <Star :size="17" aria-hidden="true" />
                      {{ item.featured ? '取消优秀' : '标记优秀' }}
                    </button>
                  </div>
                </article>
              </template>

              <div v-if="!reviewLoading && activeQueueCount === 0" class="admin-empty">
                <CheckCircle2 :size="27" aria-hidden="true" />
                <div>
                  <strong>当前队列已经处理完毕</strong>
                  <p>切换审核状态可以查看已处理内容。</p>
                </div>
                <button class="admin-button admin-button-quiet" type="button" @click="refreshAll">刷新数据</button>
              </div>
            </div>
          </Transition>
        </section>

        <section v-show="activeSection === 'feedback'" id="feedback" class="admin-section admin-feedback-section" aria-labelledby="admin-feedback-title">
          <div class="admin-section-head">
            <div>
              <h2 id="admin-feedback-title">问题反馈</h2>
              <p>接收用户提交的问题与建议，记录处理进度；回复内容会同步显示在用户的反馈记录中。</p>
            </div>
            <span>{{ feedbackStat.submitted + feedbackStat.in_progress }} 条待处理</span>
          </div>

          <div class="admin-filter-row">
            <label for="feedback-status">处理状态</label>
            <select id="feedback-status" v-model="feedbackStatus" @change="fetchFeedback">
              <option value="submitted">待接收</option>
              <option value="in_progress">处理中</option>
              <option value="resolved">已解决</option>
              <option value="closed">已关闭</option>
              <option value="all">全部反馈</option>
            </select>
            <button class="admin-text-action" type="button" :disabled="feedbackLoading" @click="fetchFeedback">
              <RefreshCcw :size="16" aria-hidden="true" :class="{ spinning: feedbackLoading }" />
              更新反馈
            </button>
          </div>

          <div v-if="feedbackLoading" class="admin-queue-loading" aria-label="正在加载问题反馈">
            <div v-for="index in 2" :key="index" class="admin-review-skeleton"></div>
          </div>
          <div v-else-if="feedbackItems.length" class="admin-feedback-list">
            <article v-for="item in feedbackItems" :key="item.id">
              <div class="admin-feedback-head">
                <span :class="['admin-status', 'status-' + (item.status || 'submitted')]">{{ feedbackStatusLabel(item.status) }}</span>
                <strong>{{ item.categoryName || '问题反馈' }}</strong>
                <time :datetime="toDateTime(item.createdAt)">{{ formatTime(item.createdAt) }}</time>
              </div>
              <p class="admin-feedback-content">{{ item.content }}</p>
              <div v-if="item.images?.length" class="admin-feedback-images" aria-label="反馈附图">
                <button v-for="(image, index) in item.images" :key="image.key || image.url" type="button" @click="openPreview(image.url, `反馈附图 ${index + 1}`)">
                  <img :src="image.url" :alt="`反馈附图 ${index + 1}`" loading="lazy" />
                </button>
              </div>
              <p class="admin-feedback-user">
                <CircleUserRound :size="16" aria-hidden="true" />
                {{ item.username || ('用户 ' + item.userId) }} · 联系方式：{{ item.contact || '未填写' }}
              </p>
              <label :for="'feedback-reply-' + item.id">管理员回复</label>
              <textarea
                :id="'feedback-reply-' + item.id"
                v-model="feedbackDrafts[item.id]"
                rows="3"
                maxlength="1000"
                placeholder="填写处理结果，解决反馈时会同步给用户"
              ></textarea>
              <div class="admin-feedback-actions">
                <button
                  v-if="item.status === 'submitted' || !item.status"
                  class="admin-button admin-button-quiet"
                  type="button"
                  :disabled="isBusy('feedback-' + item.id)"
                  @click="updateFeedback(item, 'in_progress')"
                >
                  <MessageSquareText :size="17" aria-hidden="true" />
                  接收处理
                </button>
                <button
                  v-if="item.status !== 'resolved' && item.status !== 'closed'"
                  class="admin-button admin-button-primary"
                  type="button"
                  :disabled="isBusy('feedback-' + item.id)"
                  @click="updateFeedback(item, 'resolved')"
                >
                  <CheckCircle2 :size="17" aria-hidden="true" />
                  标记已解决
                </button>
              </div>
            </article>
          </div>
          <div v-else class="admin-empty admin-empty-inline">
            <CheckCircle2 :size="25" aria-hidden="true" />
            <div><strong>当前没有符合条件的问题反馈</strong><p>用户提交后会立即出现在这里。</p></div>
          </div>
        </section>

        <section v-show="activeSection === 'anomalies'" id="anomalies" class="admin-section admin-anomaly-section" aria-labelledby="anomaly-title">
          <div class="admin-section-head">
            <div>
              <h2 id="anomaly-title">打卡异常</h2>
              <p>系统基于定位距离、同日重复、未知地点和超时待审记录生成可解释的复核线索。</p>
            </div>
            <span>{{ anomalyStat.all }} 条</span>
          </div>

          <div class="admin-anomaly-summary" aria-label="异常严重程度统计">
            <button v-for="item in anomalyFilters" :key="item.value" type="button" :aria-pressed="anomalyFilter === item.value" @click="setAnomalyFilter(item.value)">
              <span>{{ item.label }}</span>
              <strong>{{ item.count }}</strong>
            </button>
          </div>

          <ol v-if="anomalies.length" class="admin-anomaly-list">
            <li v-for="item in anomalies" :key="item.id">
              <span :class="['admin-severity', 'severity-' + item.severity]">
                <TriangleAlert :size="16" aria-hidden="true" />
                {{ severityLabel(item.severity) }}
              </span>
              <div>
                <h3>{{ item.title }}</h3>
                <p>{{ item.username }} · {{ item.locationName }}</p>
                <small>{{ item.detail }}</small>
              </div>
              <time :datetime="toDateTime(item.occurredAt)">{{ formatTime(item.occurredAt) }}</time>
            </li>
          </ol>
          <div v-else class="admin-empty admin-empty-inline">
            <ShieldCheck :size="25" aria-hidden="true" />
            <div>
              <strong>当前没有符合筛选条件的异常</strong>
              <p>异常规则只使用真实打卡记录，不会补造数据。</p>
            </div>
          </div>
        </section>

        <section v-show="activeSection === 'awards'" id="awards" class="admin-section admin-award-section" aria-labelledby="awards-title">
          <div class="admin-section-head">
            <div>
              <h2 id="awards-title">投稿管理</h2>
              <p>管理已发布作品的上架状态、优秀标记与奖项结果；待审核的新投稿请在审核中心处理。</p>
            </div>
            <span>{{ awardStat.all }} 件作品</span>
          </div>

          <div class="admin-award-tools">
            <label for="award-category">奖项类别</label>
            <select id="award-category" v-model="awardCategory" @change="fetchAwards">
              <option value="all">全部类别</option>
              <option v-for="c in awardCategories" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
            <div class="admin-award-ops">
              <button class="admin-button admin-button-quiet" type="button" :disabled="computing" @click="computeWinners">
                <Trophy :size="16" aria-hidden="true" />
                {{ computing ? '正在计算' : '计算获奖' }}
              </button>
              <button class="admin-button admin-button-quiet" type="button" :disabled="exporting" @click="exportCsv">
                <Download :size="16" aria-hidden="true" />
                {{ exporting ? '正在导出' : '导出名单' }}
              </button>
            </div>
          </div>

          <div class="admin-tab-row admin-award-tabs" role="tablist" aria-label="投稿状态筛选">
            <button
              v-for="tab in awardStatusTabs"
              :key="tab.value"
              type="button"
              role="tab"
              :aria-selected="awardStatus === tab.value"
              @click="setAwardStatus(tab.value)"
            >
              {{ tab.label }}
              <span>{{ awardStat[tab.value] ?? 0 }}</span>
            </button>
          </div>

          <div v-if="awardLoading" class="admin-queue-loading" aria-label="正在加载投稿列表">
            <div v-for="index in 3" :key="index" class="admin-review-skeleton"></div>
          </div>
          <template v-else>
            <article v-for="item in awardItems" :key="item.id" class="admin-review-row admin-submission-row">
              <button
                class="admin-review-media"
                type="button"
                :disabled="!submissionImage(item)"
                :aria-label="submissionImage(item) ? '查看投稿作品大图' : '该投稿没有可预览图片'"
                @click="submissionImage(item) && openPreview(submissionImage(item), item.title)"
              >
                <img v-if="submissionImage(item)" :src="submissionImage(item)" :alt="item.title + '作品预览'" width="320" height="240" loading="lazy" />
                <Images v-else :size="28" aria-hidden="true" />
              </button>
              <div class="admin-review-copy">
                <div class="admin-review-meta">
                  <span :class="['admin-status', 'status-' + item.status]">{{ submissionStatusLabel(item.status) }}</span>
                  <span v-if="item.featured" class="admin-status status-featured"><Star :size="13" aria-hidden="true" />优秀</span>
                  <time :datetime="toDateTime(item.createdAt)">{{ formatTime(item.createdAt) }}</time>
                </div>
                <h3>{{ item.title || '未命名作品' }}</h3>
                <p>{{ item.username }} · {{ item.locationName || ('地点 #' + item.locationId) }} · {{ item.categoryName }} · {{ item.votes ?? 0 }} 票</p>
                <p class="admin-review-description">{{ item.description || '未填写作品说明。' }}</p>
              </div>
              <div class="admin-review-actions">
                <button
                  v-if="canReviewSubmission(item)"
                  class="admin-button admin-button-primary"
                  type="button"
                  :disabled="isBusy(item.id)"
                  @click="approveSubmission(item)"
                >
                  <Check :size="17" aria-hidden="true" />
                  通过
                </button>
                <button
                  v-if="canReviewSubmission(item)"
                  class="admin-button admin-button-danger"
                  type="button"
                  :disabled="isBusy(item.id)"
                  @click="openReject('submission', item)"
                >
                  <Ban :size="17" aria-hidden="true" />
                  驳回
                </button>
                <button
                  v-if="item.status === 'approved'"
                  class="admin-button admin-button-quiet"
                  type="button"
                  :disabled="isBusy(item.id)"
                  @click="toggleFeature(item)"
                >
                  <Star :size="17" aria-hidden="true" />
                  {{ item.featured ? '取消优秀' : '标记优秀' }}
                </button>
                <button
                  v-if="item.status === 'approved'"
                  class="admin-button admin-button-danger"
                  type="button"
                  :disabled="isBusy(item.id)"
                  @click="downSubmission(item)"
                >
                  <Download :size="17" aria-hidden="true" />
                  下架
                </button>
                <button
                  v-if="item.status === 'down'"
                  class="admin-button admin-button-quiet"
                  type="button"
                  :disabled="isBusy(item.id)"
                  @click="restoreSubmission(item)"
                >
                  <RefreshCcw :size="17" aria-hidden="true" />
                  恢复上架
                </button>
              </div>
            </article>
            <div v-if="!awardItems.length" class="admin-empty admin-empty-inline">
              <Images :size="25" aria-hidden="true" />
              <div><strong>当前筛选下没有投稿</strong><p>切换状态或类别可以查看其他作品。</p></div>
            </div>
          </template>
        </section>

        <section v-show="activeSection === 'locations'" id="locations" class="admin-section admin-location-section" aria-labelledby="locations-title">
          <div class="admin-section-head">
            <div>
              <h2 id="locations-title">地点配置</h2>
              <p>调整打卡点名称、位置、图文介绍与单点积分；保存后立即对全站生效，不影响已发放的历史积分。</p>
            </div>
            <span>{{ locationTotal }} 个地点</span>
          </div>

          <div class="admin-search-field">
            <label for="location-search">查找地点</label>
            <div>
              <Search :size="18" aria-hidden="true" />
              <input id="location-search" v-model.trim="locationQuery" type="search" placeholder="名称或位置" @input="queueLocationSearch" />
            </div>
            <small>积分须为 0–100 之间、以 0.5 为步进的分值。</small>
          </div>

          <div v-if="locationLoading" class="admin-queue-loading" aria-label="正在加载地点列表">
            <div v-for="index in 3" :key="index" class="admin-review-skeleton"></div>
          </div>
          <div v-else-if="locations.length" class="admin-location-list">
            <article v-for="loc in locations" :key="loc.backendId">
              <div class="admin-location-main">
                <strong>{{ loc.name }}</strong>
                <span>#{{ loc.backendId }} · {{ loc.position || '位置未填写' }}</span>
              </div>
              <div class="admin-location-row">
                <span :class="['admin-status', loc.isHidden ? 'status-featured' : 'role-visitor']">{{ loc.isHidden ? '隐藏点' : '普通点' }}</span>
                <label class="admin-location-points" :for="'loc-points-' + loc.backendId">
                  积分
                  <input
                    :id="'loc-points-' + loc.backendId"
                    v-model.number="locationPoints[loc.backendId]"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    inputmode="decimal"
                  />
                </label>
                <button
                  class="admin-button admin-button-quiet"
                  type="button"
                  :disabled="!locationPointsChanged(loc) || isBusy('loc-' + loc.backendId)"
                  @click="saveLocationPoints(loc)"
                >
                  <Check :size="16" aria-hidden="true" />
                  {{ isBusy('loc-' + loc.backendId) ? '保存中' : '保存分值' }}
                </button>
                <button class="admin-text-action" type="button" @click="openLocationEdit(loc)">
                  编辑资料
                </button>
              </div>
            </article>
          </div>
          <div v-else class="admin-empty admin-empty-inline">
            <MapPinned :size="25" aria-hidden="true" />
            <div><strong>没有匹配的地点</strong><p>换个关键词试试。</p></div>
          </div>
        </section>

        <section v-show="activeSection === 'users'" id="users" class="admin-section admin-permission-section" aria-labelledby="users-title">
          <div class="admin-section-head">
            <div>
              <h2 id="users-title">用户权限</h2>
              <p>超级管理员可以把特定账号设为审核员；审核员不能提权，也不能修改受保护账号。</p>
            </div>
            <span>{{ adminUserCount }} 位管理员</span>
          </div>

          <div v-if="!canManageRoles" class="admin-permission-lock">
            <LockKeyhole :size="25" aria-hidden="true" />
            <div>
              <strong>当前账号是审核员</strong>
              <p>你可以审核内容、查看统计并管理地点，但只有超级管理员可以调整账号权限。</p>
            </div>
          </div>

          <template v-else>
            <div class="admin-search-field">
              <label for="user-search">查找账号</label>
              <div>
                <Search :size="18" aria-hidden="true" />
                <input id="user-search" v-model.trim="userSearch" type="search" placeholder="昵称、姓名或学号" />
              </div>
              <small>修改会立即影响该账号下一次管理员接口访问。</small>
            </div>

            <div class="admin-user-list">
              <article v-for="user in filteredUsers" :key="user.id">
                <div class="admin-user-avatar">
                  <img v-if="user.avatar" :src="user.avatar" :alt="user.username + '的头像'" width="48" height="48" loading="lazy" />
                  <CircleUserRound v-else :size="23" aria-hidden="true" />
                </div>
                <div class="admin-user-copy">
                  <strong>{{ user.username }}</strong>
                  <span>{{ user.realName || '未填写姓名' }} · {{ user.studentId || ('账号 ' + user.id) }}</span>
                </div>
                <span :class="['admin-role', 'role-' + user.role]">{{ userRoleLabel(user.role) }}</span>
                <button
                  v-if="user.role === 'visitor'"
                  class="admin-button admin-button-quiet"
                  type="button"
                  :disabled="isBusy('role-' + user.id) || user.protectedOwner"
                  @click="changeUserRole(user, 'admin')"
                >
                  <UserCog :size="17" aria-hidden="true" />
                  设为审核员
                </button>
                <button
                  v-else-if="user.role === 'admin'"
                  class="admin-button admin-button-danger"
                  type="button"
                  :disabled="isBusy('role-' + user.id) || user.protectedOwner"
                  @click="changeUserRole(user, 'visitor')"
                >
                  <UserMinus :size="17" aria-hidden="true" />
                  撤销权限
                </button>
                <span v-else class="admin-protected">受保护</span>
              </article>
            </div>
          </template>
        </section>

        <footer class="admin-footer">
          <p>SYSU CAMPUS EXPLORE · ADMIN CONTROL · 数据来自当前用户、打卡与投稿存储 · {{ currentYear }}</p>
        </footer>
      </template>
    </main>

    <dialog ref="rejectDialog" class="admin-dialog" @close="resetRejectDialog" @click="closeDialogBackdrop">
      <form @submit.prevent="confirmReject">
        <div class="admin-dialog-head">
          <div>
            <span>审核决定</span>
            <h2>驳回{{ rejectState.kind === 'submission' ? '投稿作品' : '打卡照片' }}</h2>
          </div>
          <button type="button" aria-label="关闭驳回窗口" @click="rejectDialog?.close()"><X :size="20" aria-hidden="true" /></button>
        </div>
        <p class="admin-dialog-target">{{ rejectTargetLabel }}</p>
        <label for="reject-note">驳回理由</label>
        <textarea
          id="reject-note"
          ref="rejectNoteInput"
          v-model.trim="rejectState.note"
          rows="5"
          maxlength="200"
          aria-required="true"
          :aria-invalid="Boolean(rejectState.error)"
          aria-describedby="reject-note-help"
          placeholder="例如：照片无法确认地点，请重新拍摄包含建筑特征的画面"
          @blur="validateRejectNote"
          @input="rejectState.touched && validateRejectNote()"
        ></textarea>
        <small id="reject-note-help" :class="{ error: rejectState.error }">{{ rejectState.error || '该说明会保留在审核记录中。' }}</small>
        <div class="admin-dialog-actions">
          <button class="admin-button admin-button-quiet" type="button" @click="rejectDialog?.close()">取消</button>
          <button class="admin-button admin-button-danger" type="submit" :disabled="rejectState.submitting">
            <Ban :size="17" aria-hidden="true" />
            {{ rejectState.submitting ? '正在驳回' : '确认驳回' }}
          </button>
        </div>
      </form>
    </dialog>

    <dialog ref="locationDialog" class="admin-dialog" @click="closeDialogBackdrop">
      <form @submit.prevent="saveLocationEdit">
        <div class="admin-dialog-head">
          <div>
            <span>地点配置</span>
            <h2>编辑{{ locationForm.name || '打卡点' }}</h2>
          </div>
          <button type="button" aria-label="关闭地点编辑窗口" @click="locationDialog?.close()"><X :size="20" aria-hidden="true" /></button>
        </div>
        <label for="loc-edit-name">地点名称</label>
        <input id="loc-edit-name" v-model.trim="locationForm.name" class="admin-dialog-input" type="text" maxlength="80" required />
        <label for="loc-edit-position">位置描述</label>
        <input id="loc-edit-position" v-model.trim="locationForm.position" class="admin-dialog-input" type="text" maxlength="120" placeholder="例如：南校园 311 号" />
        <label for="loc-edit-image">封面图片地址</label>
        <input id="loc-edit-image" v-model.trim="locationForm.image" class="admin-dialog-input" type="url" maxlength="2000" placeholder="https://…" />
        <label for="loc-edit-points">单点积分</label>
        <input id="loc-edit-points" v-model.number="locationForm.points" class="admin-dialog-input" type="number" min="0" max="100" step="0.5" required />
        <label for="loc-edit-description">地点介绍（支持简单 HTML）</label>
        <textarea id="loc-edit-description" v-model="locationForm.description" rows="6" maxlength="20000"></textarea>
        <small :class="{ error: locationForm.error }">{{ locationForm.error || '保存后立即生效；已发放的历史积分不受影响。' }}</small>
        <div class="admin-dialog-actions">
          <button class="admin-button admin-button-quiet" type="button" @click="locationDialog?.close()">取消</button>
          <button class="admin-button admin-button-primary" type="submit" :disabled="locationForm.saving">
            <Check :size="17" aria-hidden="true" />
            {{ locationForm.saving ? '正在保存' : '保存地点' }}
          </button>
        </div>
      </form>
    </dialog>

    <dialog ref="previewDialog" class="admin-preview-dialog" aria-label="图片预览" @close="previewState.url = ''" @click="closeDialogBackdrop">
      <div>
        <img v-if="previewState.url" :src="previewState.url" :alt="previewState.label" />
        <button type="button" aria-label="关闭图片预览" @click="previewDialog?.close()"><X :size="22" aria-hidden="true" /></button>
        <p>{{ previewState.label }}</p>
      </div>
    </dialog>

    <Transition name="admin-toast">
      <div v-if="toast.message" :class="['admin-toast', 'tone-' + toast.tone]" role="status" @mouseenter="pauseToast" @mouseleave="resumeToast">
        <CheckCircle2 v-if="toast.tone === 'ok'" :size="18" aria-hidden="true" />
        <TriangleAlert v-else :size="18" aria-hidden="true" />
        <span>{{ toast.message }}</span>
        <button v-if="toast.retry" type="button" @click="runToastRetry">重试</button>
        <button type="button" aria-label="关闭提示" @click="clearToast"><X :size="17" aria-hidden="true" /></button>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/space-grotesk/latin-600.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import {
  Activity,
  Ban,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  ClipboardCheck,
  Download,
  Images,
  LockKeyhole,
  LogOut,
  MapPinned,
  Menu,
  MessageSquareText,
  RefreshCcw,
  Search,
  ShieldCheck,
  Star,
  TriangleAlert,
  Trophy,
  UserCog,
  UserMinus,
  Users,
  X
} from '@lucide/vue'
import { request } from '@/utils/request'

const router = useRouter()
const route = useRoute()

/* ===== 视图导航：单页控制台，切换视图而非长滚动 ===== */
const navigation = [
  { id: 'overview', label: '运营总览', icon: Activity },
  { id: 'review', label: '审核中心', icon: ClipboardCheck },
  { id: 'feedback', label: '问题反馈', icon: MessageSquareText },
  { id: 'anomalies', label: '打卡异常', icon: TriangleAlert },
  { id: 'awards', label: '投稿管理', icon: Images },
  { id: 'locations', label: '地点配置', icon: MapPinned },
  { id: 'users', label: '用户权限', icon: Users }
]

const blankMetrics = () => ({
  pendingTotal: 0,
  pendingCheckins: 0,
  pendingSubmissions: 0,
  pendingFeedback: 0,
  userCount: 0,
  submissionCount: 0,
  checkinCount: 0,
  anomalyCount: 0,
  featuredCount: 0
})

const dashboard = reactive({ currentAdmin: null, metrics: blankMetrics(), activity: [], hotspots: [], anomalyPreview: [] })
const checkins = ref([])
const submissions = ref([])
const anomalies = ref([])
const feedbackItems = ref([])
const users = ref([])
const checkinStat = reactive({ all: 0, pending: 0, appealed: 0, approved: 0, rejected: 0 })
const submissionStat = reactive({ all: 0, pending: 0, approved: 0, rejected: 0, down: 0, featured: 0 })
const anomalyStat = reactive({ all: 0, high: 0, medium: 0, low: 0 })
const feedbackStat = reactive({ all: 0, submitted: 0, in_progress: 0, resolved: 0, closed: 0 })
const feedbackDrafts = reactive({})

/* ===== 投稿管理（奖项运营） ===== */
const awardItems = ref([])
const awardStat = reactive({ all: 0, pending: 0, approved: 0, rejected: 0, down: 0, featured: 0 })
const awardStatus = ref('approved')
const awardCategory = ref('all')
const awardLoading = ref(false)
const computing = ref(false)
const exporting = ref(false)
const awardStatusTabs = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已驳回' },
  { value: 'down', label: '已下架' },
  { value: 'featured', label: '优秀' }
]
const awardCategories = [
  { id: 'creative', name: '最佳创意奖' },
  { id: 'photography', name: '最佳摄影奖' }
]

/* ===== 地点配置 ===== */
const locations = ref([])
const locationTotal = ref(0)
const locationQuery = ref('')
const locationLoading = ref(false)
const locationPoints = reactive({})
const locationDialog = ref(null)
const locationForm = reactive({ id: null, name: '', position: '', image: '', description: '', points: 0, error: '', saving: false })
let locationSearchTimer = 0

const initialLoading = ref(true)
const refreshing = ref(false)
const reviewLoading = ref(false)
const feedbackLoading = ref(false)
const fatalError = ref('')
const activeSection = ref('overview')
const reviewQueue = ref(route.query.queue === 'submissions' ? 'submissions' : 'checkins')
const checkinStatus = ref('pending')
const submissionStatus = ref('pending')
const anomalyFilter = ref('all')
const feedbackStatus = ref('submitted')
const busy = ref({})
const viewLoaded = reactive({ awards: false, locations: false })

const menuDialog = ref(null)
const rejectDialog = ref(null)
const rejectNoteInput = ref(null)
const previewDialog = ref(null)
const menuOpen = ref(false)

const userSearch = ref('')

const rejectState = reactive({ kind: '', item: null, note: '', touched: false, error: '', submitting: false })
const previewState = reactive({ url: '', label: '' })
const toast = reactive({ message: '', tone: 'error', retry: null })
let toastTimer = 0
let toastRemaining = 0
let toastStartedAt = 0

const roleLabel = computed(() => dashboard.currentAdmin?.role === 'owner' ? '超级管理员' : '审核员')
const canManageRoles = computed(() => Boolean(dashboard.currentAdmin?.canManageRoles))
const activeReviewStatus = computed({
  get: () => reviewQueue.value === 'checkins' ? checkinStatus.value : submissionStatus.value,
  set: value => {
    if (reviewQueue.value === 'checkins') checkinStatus.value = value
    else submissionStatus.value = value
  }
})
const activeStatusOptions = computed(() => reviewQueue.value === 'checkins'
  ? [
      { value: 'pending', label: '待审核' },
      { value: 'appealed', label: '申诉复核' },
      { value: 'approved', label: '已通过' },
      { value: 'rejected', label: '已驳回' },
      { value: 'all', label: '全部记录' }
    ]
  : [
      { value: 'pending', label: '待审核' },
      { value: 'approved', label: '已通过' },
      { value: 'rejected', label: '已驳回' },
      { value: 'featured', label: '优秀作品' },
      { value: 'all', label: '全部投稿' }
    ])
const activeQueueCount = computed(() => reviewQueue.value === 'checkins' ? checkins.value.length : submissions.value.length)
const activityTotal = computed(() => dashboard.activity.reduce((sum, day) => sum + Number(day.count || 0), 0))
const activityMax = computed(() => Math.max(1, ...dashboard.activity.map(day => Number(day.count || 0))))
const anomalyFilters = computed(() => [
  { value: 'all', label: '全部', count: anomalyStat.all },
  { value: 'high', label: '高风险', count: anomalyStat.high },
  { value: 'medium', label: '需复核', count: anomalyStat.medium },
  { value: 'low', label: '低风险', count: anomalyStat.low }
])
const filteredUsers = computed(() => {
  const query = userSearch.value.toLowerCase()
  if (!query) return users.value
  return users.value.filter(user => `${user.id} ${user.username} ${user.realName || ''} ${user.studentId || ''}`.toLowerCase().includes(query))
})
const adminUserCount = computed(() => users.value.filter(user => user.role === 'admin' || user.role === 'owner').length)
const rejectTargetLabel = computed(() => {
  if (!rejectState.item) return ''
  return rejectState.kind === 'submission'
    ? `《${rejectState.item.title || '未命名作品'}》· ${rejectState.item.username}`
    : `${rejectState.item.username} · ${rejectState.item.locationName}`
})
const currentYear = new Date().getFullYear()

function apiError(response, fallback) {
  return response?.data?.message || fallback
}

async function api(path, method = 'GET', data = null, options = {}) {
  const response = await request(path, method, data, options)
  if (!response?.ok || response?.data?.code !== 0) throw new Error(apiError(response, '请求未完成，请稍后重试'))
  return response.data
}

function assignObject(target, source) {
  Object.keys(target).forEach(key => { if (!(key in source)) delete target[key] })
  Object.assign(target, source)
}

async function fetchDashboard() {
  const payload = await api('/admin/dashboard')
  const data = payload.data || {}
  dashboard.currentAdmin = data.currentAdmin || null
  assignObject(dashboard.metrics, { ...blankMetrics(), ...(data.metrics || {}) })
  dashboard.activity = Array.isArray(data.activity) ? data.activity : []
  dashboard.hotspots = Array.isArray(data.hotspots) ? data.hotspots : []
  dashboard.anomalyPreview = Array.isArray(data.anomalyPreview) ? data.anomalyPreview : []
}

async function fetchCheckins() {
  const payload = await api('/admin/checkins', 'GET', { status: checkinStatus.value })
  checkins.value = payload.list || []
  Object.assign(checkinStat, { all: 0, pending: 0, appealed: 0, approved: 0, rejected: 0, ...(payload.stat || {}) })
}

async function fetchSubmissions() {
  const payload = await api('/admin/submissions', 'GET', { status: submissionStatus.value, category: 'all' })
  submissions.value = payload.list || []
  Object.assign(submissionStat, { all: 0, pending: 0, approved: 0, rejected: 0, down: 0, featured: 0, ...(payload.stat || {}) })
}

async function fetchReviewQueue() {
  reviewLoading.value = true
  try {
    if (reviewQueue.value === 'checkins') await fetchCheckins()
    else await fetchSubmissions()
  } catch (error) {
    showError(error.message, fetchReviewQueue)
  } finally {
    reviewLoading.value = false
  }
}

async function fetchAnomalies() {
  const requestedSeverity = anomalyFilter.value
  const payload = await api('/admin/anomalies')
  Object.assign(anomalyStat, { all: 0, high: 0, medium: 0, low: 0, ...(payload.stat || {}) })
  const all = payload.list || []
  anomalies.value = requestedSeverity === 'all' ? all : all.filter(item => item.severity === requestedSeverity)
}

async function fetchFeedback() {
  feedbackLoading.value = true
  try {
    const payload = await api('/admin/feedback', 'GET', { status: feedbackStatus.value })
    feedbackItems.value = payload.list || []
    Object.assign(feedbackStat, { all: 0, submitted: 0, in_progress: 0, resolved: 0, closed: 0, ...(payload.stat || {}) })
    feedbackItems.value.forEach(item => { feedbackDrafts[item.id] = item.reply || '' })
  } catch (error) {
    showError(error.message, fetchFeedback)
  } finally {
    feedbackLoading.value = false
  }
}

async function fetchUsers() {
  const payload = await api('/admin/users')
  users.value = payload.list || []
}

async function fetchAwards() {
  awardLoading.value = true
  try {
    const payload = await api('/admin/submissions', 'GET', { status: awardStatus.value, category: awardCategory.value })
    awardItems.value = payload.list || []
    Object.assign(awardStat, { all: 0, pending: 0, approved: 0, rejected: 0, down: 0, featured: 0, ...(payload.stat || {}) })
  } catch (error) {
    showError(error.message, fetchAwards)
  } finally {
    awardLoading.value = false
  }
}

function setAwardStatus(value) {
  awardStatus.value = value
  fetchAwards()
}

async function fetchLocations() {
  locationLoading.value = true
  try {
    const payload = await api('/admin/locations', 'GET', { query: locationQuery.value })
    locations.value = payload.list || []
    locationTotal.value = Number(payload.total || locations.value.length)
    locations.value.forEach(loc => { locationPoints[loc.backendId] = loc.points })
  } catch (error) {
    showError(error.message, fetchLocations)
  } finally {
    locationLoading.value = false
  }
}

function queueLocationSearch() {
  window.clearTimeout(locationSearchTimer)
  locationSearchTimer = window.setTimeout(fetchLocations, 300)
}

function locationPointsChanged(loc) {
  return Number(locationPoints[loc.backendId]) !== Number(loc.points)
}

async function saveLocationPoints(loc) {
  const busyId = 'loc-' + loc.backendId
  if (isBusy(busyId)) return
  setBusy(busyId, true)
  try {
    const payload = await api(`/admin/locations/${encodeURIComponent(loc.backendId)}`, 'PATCH', {
      points: Number(locationPoints[loc.backendId])
    })
    if (payload.data?.location) Object.assign(loc, payload.data.location)
    locationPoints[loc.backendId] = loc.points
    showMsg(`「${loc.name}」分值已保存`)
  } catch (error) {
    showError(error.message, () => saveLocationPoints(loc))
  } finally {
    setBusy(busyId, false)
  }
}

function openLocationEdit(loc) {
  locationForm.id = loc.backendId
  locationForm.name = loc.name || ''
  locationForm.position = loc.position || ''
  locationForm.image = loc.image || ''
  locationForm.description = loc.description || ''
  locationForm.points = Number(loc.points)
  locationForm.error = ''
  locationForm.saving = false
  locationDialog.value?.showModal()
}

async function saveLocationEdit() {
  if (locationForm.saving || locationForm.id == null) return
  const points = Number(locationForm.points)
  if (!Number.isFinite(points) || points < 0 || points > 100 || Math.round(points * 2) !== points * 2) {
    locationForm.error = '单点积分必须是 0–100 之间、以 0.5 为步进的分值'
    return
  }
  if (!locationForm.name.trim()) {
    locationForm.error = '地点名称不能为空'
    return
  }
  locationForm.saving = true
  locationForm.error = ''
  try {
    const payload = await api(`/admin/locations/${encodeURIComponent(locationForm.id)}`, 'PATCH', {
      name: locationForm.name,
      position: locationForm.position,
      image: locationForm.image,
      description: locationForm.description,
      points
    })
    const updated = payload.data?.location
    const target = locations.value.find(item => Number(item.backendId) === Number(locationForm.id))
    if (updated && target) {
      Object.assign(target, updated)
      locationPoints[target.backendId] = target.points
    }
    locationDialog.value?.close()
    showMsg(`「${updated?.name || locationForm.name}」已保存`)
  } catch (error) {
    locationForm.error = error.message
  } finally {
    locationForm.saving = false
  }
}

async function loadAdminSpace() {
  document.title = '管理员空间｜笃行校园探索'
  initialLoading.value = true
  fatalError.value = ''
  try {
    await Promise.all([fetchDashboard(), fetchCheckins(), fetchSubmissions(), fetchFeedback(), fetchAnomalies(), fetchUsers()])
  } catch (error) {
    fatalError.value = error.message || '管理员接口没有返回完整数据。'
  } finally {
    initialLoading.value = false
    await nextTick()
    applyInitialSection()
  }
}

async function refreshAll() {
  if (refreshing.value) return
  refreshing.value = true
  try {
    const tasks = [fetchDashboard(), fetchReviewQueue(), fetchFeedback(), fetchAnomalies(), fetchUsers()]
    if (viewLoaded.awards) tasks.push(fetchAwards())
    if (viewLoaded.locations) tasks.push(fetchLocations())
    await Promise.all(tasks)
  } catch (error) {
    showError(error.message, refreshAll)
  } finally {
    refreshing.value = false
  }
}

function setBusy(id, value) {
  const next = { ...busy.value }
  if (value) next[String(id)] = true
  else delete next[String(id)]
  busy.value = next
}

function isBusy(id) {
  return Boolean(busy.value[String(id)])
}

async function runModeration(id, operation, retry) {
  if (isBusy(id)) return
  setBusy(id, true)
  try {
    await operation()
    const tasks = [fetchReviewQueue(), fetchDashboard(), fetchAnomalies()]
    if (viewLoaded.awards) tasks.push(fetchAwards())
    await Promise.all(tasks)
  } catch (error) {
    showError(error.message, retry)
  } finally {
    setBusy(id, false)
  }
}

function approveCheckin(item) {
  return runModeration(
    item.id,
    () => api(`/admin/checkins/${encodeURIComponent(item.id)}/approve`, 'POST', {}),
    () => approveCheckin(item)
  )
}

function approveSubmission(item) {
  return runModeration(
    item.id,
    () => api(`/admin/submissions/${encodeURIComponent(item.id)}/approve`, 'POST', {}),
    () => approveSubmission(item)
  )
}

async function updateFeedback(item, status) {
  const busyId = `feedback-${item.id}`
  if (isBusy(busyId)) return
  setBusy(busyId, true)
  try {
    await api(`/admin/feedback/${encodeURIComponent(item.id)}`, 'PATCH', {
      status,
      reply: String(feedbackDrafts[item.id] || '').trim()
    })
    await Promise.all([fetchFeedback(), fetchDashboard()])
  } catch (error) {
    showError(error.message, () => updateFeedback(item, status))
  } finally {
    setBusy(busyId, false)
  }
}

function toggleFeature(item) {
  return runModeration(
    item.id,
    () => api(`/admin/submissions/${encodeURIComponent(item.id)}/feature`, 'POST', { featured: !item.featured }),
    () => toggleFeature(item)
  )
}

function downSubmission(item) {
  return runModeration(
    item.id,
    () => api(`/admin/submissions/${encodeURIComponent(item.id)}/down`, 'POST', {}),
    () => downSubmission(item)
  )
}

function restoreSubmission(item) {
  return runModeration(
    item.id,
    () => api(`/admin/submissions/${encodeURIComponent(item.id)}/restore`, 'POST', {}),
    () => restoreSubmission(item)
  )
}

async function computeWinners() {
  if (computing.value) return
  computing.value = true
  try {
    const payload = await api('/admin/submissions/compute-winners', 'POST', {})
    const summary = payload.summary || payload.data?.summary || {}
    const photo = (summary.photography || []).length
    const creative = (summary.creative || []).length
    showMsg(`已按当前票数刷新：最佳摄影奖 ${photo} 名、最佳创意奖 ${creative} 名获奖`)
    if (viewLoaded.awards) await fetchAwards()
  } catch (error) {
    showError(error.message, computeWinners)
  } finally {
    computing.value = false
  }
}

async function exportCsv() {
  if (exporting.value) return
  exporting.value = true
  try {
    const response = await request('/admin/submissions/export', 'GET', { category: awardCategory.value }, {
      responseType: 'blob'
    })
    if (!response || !response.data) throw new Error('导出失败')
    const url = URL.createObjectURL(response.data)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `奖项投稿名单_${Date.now()}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
    showMsg('投稿名单已导出')
  } catch (error) {
    showError(error?.message || '导出失败，请重试', exportCsv)
  } finally {
    exporting.value = false
  }
}

function canReviewSubmission(item) {
  return item.status === 'pending' || (item.status === 'rejected' && item.appealStatus === 'pending')
}

async function changeUserRole(user, role) {
  const busyId = `role-${user.id}`
  if (isBusy(busyId)) return
  setBusy(busyId, true)
  try {
    await api(`/admin/users/${encodeURIComponent(user.id)}/role`, 'PATCH', { role })
    user.role = role
    await fetchDashboard()
  } catch (error) {
    showError(error.message, () => changeUserRole(user, role))
  } finally {
    setBusy(busyId, false)
  }
}

function openReject(kind, item) {
  rejectState.kind = kind
  rejectState.item = item
  rejectState.note = ''
  rejectState.touched = false
  rejectState.error = ''
  rejectDialog.value?.showModal()
  nextTick(() => rejectNoteInput.value?.focus())
}

function validateRejectNote() {
  rejectState.touched = true
  const length = rejectState.note.trim().length
  rejectState.error = length < 4 ? '理由至少需要 4 个字符，请说明用户应如何修改。' : ''
  return !rejectState.error
}

async function confirmReject() {
  if (!validateRejectNote() || !rejectState.item || rejectState.submitting) return
  const { kind, item, note } = rejectState
  rejectState.submitting = true
  try {
    const path = kind === 'submission'
      ? `/admin/submissions/${encodeURIComponent(item.id)}/reject`
      : `/admin/checkins/${encodeURIComponent(item.id)}/reject`
    await api(path, 'POST', { note })
    rejectDialog.value?.close()
    const tasks = [fetchReviewQueue(), fetchDashboard(), fetchAnomalies()]
    if (viewLoaded.awards && kind === 'submission') tasks.push(fetchAwards())
    await Promise.all(tasks)
  } catch (error) {
    rejectState.error = error.message
  } finally {
    rejectState.submitting = false
  }
}

function resetRejectDialog() {
  rejectState.kind = ''
  rejectState.item = null
  rejectState.note = ''
  rejectState.touched = false
  rejectState.error = ''
  rejectState.submitting = false
}

function openPreview(url, label) {
  previewState.url = url
  previewState.label = label || '审核图片'
  previewDialog.value?.showModal()
}

function closeDialogBackdrop(event) {
  if (event.target === event.currentTarget) event.currentTarget.close()
}

function setReviewQueue(queue) {
  reviewQueue.value = queue
  fetchReviewQueue()
}

function handleQueueTabKeydown(event) {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
  event.preventDefault()
  const next = reviewQueue.value === 'checkins' ? 'submissions' : 'checkins'
  setReviewQueue(next)
  nextTick(() => document.getElementById(`queue-tab-${next}`)?.focus({ preventScroll: true }))
}

async function setAnomalyFilter(value) {
  anomalyFilter.value = value
  await fetchAnomalies().catch(error => showError(error.message, () => setAnomalyFilter(value)))
}

function openMenu() {
  menuOpen.value = true
  menuDialog.value?.showModal()
}

function closeMenu() {
  if (menuDialog.value?.open) menuDialog.value.close()
}

/* ===== 视图切换：按需加载奖项/地点数据，回到顶部 ===== */
function goSection(id, queue) {
  if (queue === 'submissions' || queue === 'checkins') reviewQueue.value = queue
  activeSection.value = id
  closeMenu()
  if (id === 'awards' && !viewLoaded.awards) {
    viewLoaded.awards = true
    fetchAwards()
  }
  if (id === 'locations' && !viewLoaded.locations) {
    viewLoaded.locations = true
    fetchLocations()
  }
  nextTick(() => window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' }))
}

function applyInitialSection() {
  const requested = String(route.query.section || '')
  const mapped = ({ analytics: 'overview', permissions: 'users' })[requested] || requested
  if (navigation.some(item => item.id === mapped)) {
    goSection(mapped)
  } else if (route.query.queue === 'submissions') {
    goSection('review')
  }
}

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function showError(message, retry = null) {
  window.clearTimeout(toastTimer)
  toast.message = message || '操作未完成，请稍后重试。'
  toast.tone = 'error'
  toast.retry = typeof retry === 'function' ? retry : null
  toastRemaining = 6000
  resumeToast()
}

function showMsg(message) {
  window.clearTimeout(toastTimer)
  toast.message = message
  toast.tone = 'ok'
  toast.retry = null
  toastRemaining = 3200
  resumeToast()
}

function clearToast() {
  window.clearTimeout(toastTimer)
  toast.message = ''
  toast.retry = null
}

function pauseToast() {
  if (!toast.message) return
  window.clearTimeout(toastTimer)
  toastRemaining = Math.max(0, toastRemaining - (Date.now() - toastStartedAt))
}

function resumeToast() {
  if (!toast.message) return
  window.clearTimeout(toastTimer)
  toastStartedAt = Date.now()
  toastTimer = window.setTimeout(clearToast, toastRemaining || 6000)
}

function runToastRetry() {
  const retry = toast.retry
  clearToast()
  retry?.()
}

function logout() {
  localStorage.removeItem('token')
  localStorage.removeItem('userInfo')
  router.replace('/signin')
}

function leaveAdminMode() {
  closeMenu()
  router.push('/myCheckins')
}

function activityBarScale(count) {
  return String(Math.max(0.04, Number(count || 0) / activityMax.value))
}

function submissionImage(item) {
  return item?.images?.find(image => image?.url)?.url || ''
}

function checkinStatusLabel(status) {
  return ({ pending: '待审核', appealed: '申诉复核', approved: '已通过', rejected: '已驳回' })[status] || status
}

function submissionStatusLabel(status) {
  return ({ pending: '待审核', approved: '已通过', rejected: '已驳回', down: '已下架' })[status] || status
}

function feedbackStatusLabel(status) {
  return ({ submitted: '待接收', in_progress: '处理中', resolved: '已解决', closed: '已关闭' })[status || 'submitted'] || status
}

function severityLabel(severity) {
  return ({ high: '高风险', medium: '需复核', low: '低风险' })[severity] || '待确认'
}

function userRoleLabel(role) {
  return ({ owner: '超级管理员', admin: '审核员', visitor: '普通用户' })[role] || role
}

function toDateTime(value) {
  const date = new Date(Number(value) || value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

function formatTime(value) {
  if (!value) return '时间未记录'
  const date = new Date(Number(value) || value)
  if (Number.isNaN(date.getTime())) return '时间未记录'
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date)
}

onMounted(loadAdminSpace)

onBeforeUnmount(() => {
  window.clearTimeout(toastTimer)
  window.clearTimeout(locationSearchTimer)
})
</script>

<style src="../../styles/admin.css"></style>
