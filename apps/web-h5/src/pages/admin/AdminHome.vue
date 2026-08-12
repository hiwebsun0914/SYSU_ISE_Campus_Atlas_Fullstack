<template>
  <div class="admin-page">
    <a class="admin-skip-link" href="#admin-main">跳到管理内容</a>

    <aside class="admin-rail" aria-label="管理员导航">
      <button class="admin-rail-brand" type="button" aria-label="返回管理总览" @click="goSection('overview')">
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
        <button type="button" @click="logout">
          <LogOut :size="17" aria-hidden="true" />
          退出登录
        </button>
      </div>
    </aside>

    <header class="admin-mobile-bar">
      <button class="admin-mobile-brand" type="button" aria-label="返回管理总览" @click="goSection('overview')">
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
        <section id="overview" class="admin-hero admin-observed" aria-labelledby="admin-title">
          <div class="admin-mode-line">
            <ShieldCheck :size="17" aria-hidden="true" />
            <span>管理员模式</span>
            <i aria-hidden="true"></i>
            <small>{{ roleLabel }}</small>
          </div>

          <div class="admin-hero-grid">
            <div class="admin-hero-stat">
              <strong aria-hidden="true">{{ animatedPending }}</strong>
              <div class="admin-hero-copy">
                <h1 id="admin-title">项内容等待处理</h1>
                <p>先清空审核队列，再处理异常、地点资料与权限配置。</p>
                <div class="admin-hero-actions">
                  <button class="admin-button admin-button-primary" type="button" @click="goSection('review')">
                    <ClipboardCheck :size="17" aria-hidden="true" />
                    开始审核
                  </button>
                  <button class="admin-button admin-button-quiet" type="button" :disabled="refreshing" @click="refreshAll">
                    <RefreshCcw :size="17" aria-hidden="true" :class="{ spinning: refreshing }" />
                    {{ refreshing ? '正在刷新' : '刷新数据' }}
                  </button>
                </div>
              </div>
              <span class="sr-only" aria-live="polite">当前有 {{ dashboard.metrics.pendingTotal }} 项内容等待处理</span>
            </div>

            <div class="admin-status-readout" aria-label="审核队列构成">
              <div>
                <span>打卡照片</span>
                <strong>{{ dashboard.metrics.pendingCheckins }}</strong>
                <small>待审核</small>
              </div>
              <div>
                <span>投稿作品</span>
                <strong>{{ dashboard.metrics.pendingSubmissions }}</strong>
                <small>待审核或申诉中</small>
              </div>
            </div>
          </div>

          <dl class="admin-stat-strip">
            <div>
              <dt>用户总数</dt>
              <dd>{{ dashboard.metrics.userCount }}</dd>
              <small>已注册账号</small>
            </div>
            <div>
              <dt>投稿总数</dt>
              <dd>{{ dashboard.metrics.submissionCount }}</dd>
              <small>全部作品</small>
            </div>
            <div>
              <dt>打卡总数</dt>
              <dd>{{ dashboard.metrics.checkinCount }}</dd>
              <small>已通过地点</small>
            </div>
            <div>
              <dt>异常记录</dt>
              <dd>{{ dashboard.metrics.anomalyCount }}</dd>
              <small>需要复核</small>
            </div>
          </dl>
        </section>

        <section id="review" class="admin-section admin-review-section admin-observed" aria-labelledby="review-title">
          <div class="admin-section-head">
            <div>
              <h2 id="review-title">审核队列</h2>
              <p>照片打卡与投稿作品共用一套处理节奏，操作结果直接写回 PR 已有的数据结构。</p>
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
                  </div>
                  <div v-if="item.status === 'pending'" class="admin-review-actions">
                    <button class="admin-button admin-button-primary" type="button" :disabled="isBusy(item.id)" @click="approveCheckin(item)">
                      <Check :size="17" aria-hidden="true" />
                      {{ isBusy(item.id) ? '处理中' : '通过' }}
                    </button>
                    <button class="admin-button admin-button-danger" type="button" :disabled="isBusy(item.id)" @click="openReject('checkin', item)">
                      <Ban :size="17" aria-hidden="true" />
                      驳回
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

        <section id="anomalies" class="admin-section admin-anomaly-section admin-observed" aria-labelledby="anomaly-title">
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

        <section id="analytics" class="admin-section admin-analytics-section admin-observed" aria-labelledby="analytics-title">
          <div class="admin-section-head">
            <div>
              <h2 id="analytics-title">活跃度与热门地点</h2>
              <p>近七日趋势来自带时间戳的成功打卡记录；排行榜按用户已解锁地点汇总。</p>
            </div>
            <span>近 7 日</span>
          </div>

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

        <section id="locations" class="admin-section admin-location-section admin-observed" aria-labelledby="locations-title">
          <div class="admin-section-head">
            <div>
              <h2 id="locations-title">打卡点与积分</h2>
              <p>编辑后的名称、介绍、图片和单点积分会同步到公开地点接口与后续打卡。</p>
            </div>
            <span>{{ locations.length }} 个地点</span>
          </div>

          <div class="admin-search-field">
            <label for="location-search">查找打卡点</label>
            <div>
              <Search :size="18" aria-hidden="true" />
              <input id="location-search" v-model.trim="locationSearch" type="search" placeholder="名称或编号，例如：图书馆" />
            </div>
            <small>当前显示 {{ visibleLocations.length }} / {{ filteredLocations.length }} 个匹配地点</small>
          </div>

          <div v-if="visibleLocations.length" class="admin-spec-list">
            <button v-for="location in visibleLocations" :key="location.id" type="button" @click="openLocationEditor(location)">
              <span class="admin-spec-id">{{ String(location.id).padStart(3, '0') }}</span>
              <div>
                <strong>{{ location.name }}</strong>
                <small>{{ location.position || '未填写位置' }}</small>
              </div>
              <b>{{ location.points }} 分</b>
              <Pencil :size="17" aria-hidden="true" />
            </button>
          </div>
          <div v-else class="admin-empty admin-empty-inline">
            <SearchX :size="25" aria-hidden="true" />
            <div><strong>没有匹配的打卡点</strong><p>尝试输入更短的名称或地点编号。</p></div>
          </div>
          <button v-if="visibleLocations.length < filteredLocations.length" class="admin-button admin-button-quiet admin-load-more" type="button" @click="locationLimit += 20">
            再显示 20 个
          </button>
        </section>

        <section id="permissions" class="admin-section admin-permission-section admin-observed" aria-labelledby="permissions-title">
          <div class="admin-section-head">
            <div>
              <h2 id="permissions-title">管理员权限</h2>
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

    <dialog ref="locationDialog" class="admin-dialog admin-location-dialog" @close="resetLocationDialog" @click="closeDialogBackdrop">
      <form @submit.prevent="saveLocation">
        <div class="admin-dialog-head">
          <div>
            <span>地点 #{{ locationForm.id }}</span>
            <h2>编辑打卡点</h2>
          </div>
          <button type="button" aria-label="关闭地点编辑窗口" @click="locationDialog?.close()"><X :size="20" aria-hidden="true" /></button>
        </div>
        <div class="admin-form-grid">
          <label for="location-name">地点名称</label>
          <input id="location-name" ref="locationNameInput" v-model.trim="locationForm.name" maxlength="80" required />
          <small>显示在地图、探索进度、投稿和管理员统计中。</small>

          <label for="location-position">校园位置</label>
          <input id="location-position" v-model.trim="locationForm.position" maxlength="120" placeholder="例如：南校园 335 号" />
          <small>用于帮助学生确认现场位置。</small>

          <label for="location-points">单次积分</label>
          <input id="location-points" v-model.number="locationForm.points" type="number" min="0" max="100" step="1" inputmode="numeric" required />
          <small>只影响此后首次通过的打卡，不追溯改写历史积分。</small>

          <label for="location-image">图片地址</label>
          <input id="location-image" v-model.trim="locationForm.image" type="url" maxlength="2000" placeholder="https://…" />
          <small>留空时沿用当前图片。</small>

          <label for="location-description">地点介绍</label>
          <textarea id="location-description" v-model="locationForm.description" rows="8" maxlength="20000"></textarea>
          <small>兼容 PR 中已有的基础 HTML；后端会移除脚本和事件属性。</small>
        </div>
        <p v-if="locationForm.error" class="admin-form-error" role="alert">{{ locationForm.error }}</p>
        <div class="admin-dialog-actions">
          <button class="admin-button admin-button-quiet" type="button" @click="locationDialog?.close()">取消</button>
          <button class="admin-button admin-button-primary" type="submit" :disabled="locationForm.saving">
            <Save :size="17" aria-hidden="true" />
            {{ locationForm.saving ? '正在保存' : '保存设置' }}
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
      <div v-if="toast.message" class="admin-toast" role="status" @mouseenter="pauseToast" @mouseleave="resumeToast">
        <TriangleAlert v-if="toast.tone === 'error'" :size="18" aria-hidden="true" />
        <span>{{ toast.message }}</span>
        <button v-if="toast.retry" type="button" @click="runToastRetry">重试</button>
        <button type="button" aria-label="关闭提示" @click="clearToast"><X :size="17" aria-hidden="true" /></button>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/space-grotesk/latin-600.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import '@fontsource/noto-sans-sc/chinese-simplified-400.css'
import {
  Activity,
  Ban,
  BarChart3,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  ClipboardCheck,
  Images,
  LockKeyhole,
  LogOut,
  MapPinned,
  Menu,
  Pencil,
  RefreshCcw,
  Save,
  Search,
  SearchX,
  ShieldCheck,
  Star,
  TriangleAlert,
  UserCog,
  UserMinus,
  Users,
  X
} from '@lucide/vue'
import { request } from '@/utils/request'

const router = useRouter()
const route = useRoute()

const navigation = [
  { id: 'overview', label: '管理总览', icon: Activity },
  { id: 'review', label: '审核队列', icon: ClipboardCheck },
  { id: 'anomalies', label: '打卡异常', icon: TriangleAlert },
  { id: 'analytics', label: '数据分析', icon: BarChart3 },
  { id: 'locations', label: '地点设置', icon: MapPinned },
  { id: 'permissions', label: '权限管理', icon: Users }
]

const blankMetrics = () => ({
  pendingTotal: 0,
  pendingCheckins: 0,
  pendingSubmissions: 0,
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
const locations = ref([])
const users = ref([])
const checkinStat = reactive({ all: 0, pending: 0, approved: 0 })
const submissionStat = reactive({ all: 0, pending: 0, approved: 0, rejected: 0, down: 0, featured: 0 })
const anomalyStat = reactive({ all: 0, high: 0, medium: 0, low: 0 })

const initialLoading = ref(true)
const refreshing = ref(false)
const reviewLoading = ref(false)
const fatalError = ref('')
const activeSection = ref('overview')
const reviewQueue = ref(route.query.queue === 'submissions' ? 'submissions' : 'checkins')
const checkinStatus = ref('pending')
const submissionStatus = ref('pending')
const anomalyFilter = ref('all')
const busy = ref({})
const animatedPending = ref(0)

const menuDialog = ref(null)
const rejectDialog = ref(null)
const rejectNoteInput = ref(null)
const locationDialog = ref(null)
const locationNameInput = ref(null)
const previewDialog = ref(null)
const menuOpen = ref(false)

const locationSearch = ref('')
const locationLimit = ref(20)
const userSearch = ref('')

const rejectState = reactive({ kind: '', item: null, note: '', touched: false, error: '', submitting: false })
const locationForm = reactive({ id: null, name: '', position: '', points: 1, image: '', description: '', saving: false, error: '' })
const previewState = reactive({ url: '', label: '' })
const toast = reactive({ message: '', tone: 'error', retry: null })
let toastTimer = 0
let toastRemaining = 0
let toastStartedAt = 0
let sectionObserver = null
let counterFrame = 0

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
      { value: 'approved', label: '已通过' },
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
const filteredLocations = computed(() => {
  const query = locationSearch.value.toLowerCase()
  if (!query) return locations.value
  return locations.value.filter(item => `${item.id} ${item.name} ${item.position || ''}`.toLowerCase().includes(query))
})
const visibleLocations = computed(() => filteredLocations.value.slice(0, locationLimit.value))
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
  animatePending(dashboard.metrics.pendingTotal)
}

async function fetchCheckins() {
  const payload = await api('/admin/checkins', 'GET', { status: checkinStatus.value })
  checkins.value = payload.list || []
  Object.assign(checkinStat, { all: 0, pending: 0, approved: 0, ...(payload.stat || {}) })
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

async function fetchLocations() {
  const payload = await api('/admin/locations')
  locations.value = payload.list || []
}

async function fetchUsers() {
  const payload = await api('/admin/users')
  users.value = payload.list || []
}

async function loadAdminSpace() {
  document.title = '管理员空间｜笃行校园探索'
  initialLoading.value = true
  fatalError.value = ''
  try {
    await Promise.all([fetchDashboard(), fetchCheckins(), fetchSubmissions(), fetchAnomalies(), fetchLocations(), fetchUsers()])
  } catch (error) {
    fatalError.value = error.message || '管理员接口没有返回完整数据。'
  } finally {
    initialLoading.value = false
    await nextTick()
    setupSectionObserver()
    applyInitialSection()
  }
}

async function refreshAll() {
  if (refreshing.value) return
  refreshing.value = true
  try {
    await Promise.all([fetchDashboard(), fetchReviewQueue(), fetchAnomalies(), fetchLocations(), fetchUsers()])
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
    await Promise.all([fetchReviewQueue(), fetchDashboard(), fetchAnomalies()])
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

function toggleFeature(item) {
  return runModeration(
    item.id,
    () => api(`/admin/submissions/${encodeURIComponent(item.id)}/feature`, 'POST', { featured: !item.featured }),
    () => toggleFeature(item)
  )
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
    await Promise.all([fetchReviewQueue(), fetchDashboard(), fetchAnomalies()])
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

function openLocationEditor(location) {
  Object.assign(locationForm, {
    id: location.id,
    name: location.name || '',
    position: location.position || '',
    points: Number(location.points || 0),
    image: location.image || '',
    description: location.description || '',
    saving: false,
    error: ''
  })
  locationDialog.value?.showModal()
  nextTick(() => locationNameInput.value?.focus())
}

async function saveLocation() {
  locationForm.error = ''
  if (!locationForm.name.trim()) {
    locationForm.error = '地点名称不能为空。'
    return
  }
  if (!Number.isInteger(Number(locationForm.points)) || Number(locationForm.points) < 0 || Number(locationForm.points) > 100) {
    locationForm.error = '单点积分必须是 0–100 的整数。'
    return
  }

  locationForm.saving = true
  try {
    const payload = await api(`/admin/locations/${encodeURIComponent(locationForm.id)}`, 'PATCH', {
      name: locationForm.name,
      position: locationForm.position,
      points: Number(locationForm.points),
      image: locationForm.image,
      description: locationForm.description
    })
    const updated = payload.data?.location
    const index = locations.value.findIndex(item => Number(item.id) === Number(locationForm.id))
    if (updated && index >= 0) locations.value.splice(index, 1, updated)
    locationDialog.value?.close()
    await fetchDashboard()
  } catch (error) {
    locationForm.error = error.message
  } finally {
    locationForm.saving = false
  }
}

function resetLocationDialog() {
  Object.assign(locationForm, { id: null, name: '', position: '', points: 1, image: '', description: '', saving: false, error: '' })
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

function goSection(id) {
  activeSection.value = id
  closeMenu()
  nextTick(() => document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' }))
}

function setupSectionObserver() {
  sectionObserver?.disconnect()
  sectionObserver = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
    if (visible?.target?.id) activeSection.value = visible.target.id
  }, { rootMargin: '-18% 0px -62% 0px', threshold: [0.05, 0.2, 0.5] })
  document.querySelectorAll('.admin-observed').forEach(section => sectionObserver.observe(section))
}

function applyInitialSection() {
  const requested = String(route.query.section || '')
  if (navigation.some(item => item.id === requested)) goSection(requested)
}

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function animatePending(targetValue) {
  cancelAnimationFrame(counterFrame)
  const target = Math.max(0, Number(targetValue || 0))
  if (reducedMotion()) {
    animatedPending.value = target
    return
  }
  const startValue = animatedPending.value
  const startedAt = performance.now()
  const duration = 400
  const tick = now => {
    const progress = Math.min(1, (now - startedAt) / duration)
    const eased = 1 - Math.pow(1 - progress, 3)
    animatedPending.value = Math.round(startValue + (target - startValue) * eased)
    if (progress < 1) counterFrame = requestAnimationFrame(tick)
  }
  counterFrame = requestAnimationFrame(tick)
}

function showError(message, retry = null) {
  window.clearTimeout(toastTimer)
  toast.message = message || '操作未完成，请稍后重试。'
  toast.tone = 'error'
  toast.retry = typeof retry === 'function' ? retry : null
  toastRemaining = 6000
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

function activityBarScale(count) {
  return String(Math.max(0.04, Number(count || 0) / activityMax.value))
}

function submissionImage(item) {
  return item?.images?.find(image => image?.url)?.url || ''
}

function checkinStatusLabel(status) {
  return ({ pending: '待审核', approved: '已通过' })[status] || status
}

function submissionStatusLabel(status) {
  return ({ pending: '待审核', approved: '已通过', rejected: '已驳回', down: '已下架' })[status] || status
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

watch(locationSearch, () => { locationLimit.value = 20 })

onMounted(loadAdminSpace)

onBeforeUnmount(() => {
  sectionObserver?.disconnect()
  cancelAnimationFrame(counterFrame)
  window.clearTimeout(toastTimer)
})
</script>

<style src="../../styles/admin.css"></style>
