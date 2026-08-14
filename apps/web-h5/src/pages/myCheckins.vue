<template>
  <div class="profile-page">
    <a class="profile-skip-link" href="#profile-main">跳到主要内容</a>

    <main id="profile-main" class="profile-shell">
      <section v-if="loading" class="profile-loading" aria-busy="true" aria-label="正在加载个人主页">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-line"></div>
        <div class="skeleton skeleton-band"></div>
        <div class="skeleton-grid">
          <div class="skeleton skeleton-panel"></div>
          <div class="skeleton skeleton-panel"></div>
        </div>
      </section>

      <section v-else-if="loadError" class="fatal-state" role="alert">
        <AlertCircle :size="28" aria-hidden="true" />
        <h1>个人主页暂时没有加载完成</h1>
        <p>{{ loadError }}</p>
        <button class="button button-primary" type="button" @click="fetchDashboard">
          <RotateCcw :size="17" aria-hidden="true" />
          重新加载
        </button>
      </section>

      <template v-else>
        <aside v-if="pageNotice" class="notice-banner" role="status" aria-live="polite">
          <AlertCircle :size="17" aria-hidden="true" />
          <span>{{ pageNotice }}</span>
          <button type="button" aria-label="关闭提示" @click="pageNotice = ''">
            <X :size="16" aria-hidden="true" />
          </button>
        </aside>

        <section class="profile-hero" aria-labelledby="profile-title">
          <div class="profile-identity">
            <div class="profile-avatar">
              <img
                v-if="avatarSrc && !avatarFailed"
                :src="avatarSrc"
                :alt="displayName + '的头像'"
                width="112"
                height="112"
                decoding="async"
                @error="avatarFailed = true"
              />
              <UserRound v-else :size="42" />
            </div>
            <div class="profile-heading">
              <p class="eyebrow">STUDENT PROFILE</p>
              <div class="profile-title-row">
                <h1 id="profile-title" :title="displayName">{{ displayName }}</h1>
                <button
                  class="button button-secondary hero-edit"
                  type="button"
                  aria-label="编辑资料"
                  title="编辑资料"
                  @click="openProfileDialog"
                >
                  <Pencil :size="14" aria-hidden="true" />
                  <span class="hero-edit-label">编辑资料</span>
                </button>
              </div>
            </div>
            <div
              class="profile-personality-space"
              :aria-label="personalityFigure ? `${personalityFigure.code} 校园人格形象` : undefined"
              :aria-hidden="personalityFigure ? undefined : 'true'"
            >
              <img
                v-if="personalityFigure"
                class="profile-personality-main"
                :src="personalityFigure.mainSrc"
                alt=""
                aria-hidden="true"
                decoding="async"
              />
              <img
                v-if="personalityFigure"
                class="profile-personality-sub"
                :src="personalityFigure.subSrc"
                :alt="`${personalityFigure.code} 校园人格小人`"
                decoding="async"
              />
            </div>
            <dl class="profile-identifiers">
              <div>
                <dt>姓名</dt>
                <dd>{{ userInfo.realName || '未填写' }}</dd>
              </div>
              <div>
                <dt>学号</dt>
                <dd>{{ userInfo.studentId || '未填写' }}</dd>
              </div>
              <div>
                <dt>账户</dt>
                <dd>{{ userInfo.id || '未同步' }}</dd>
              </div>
            </dl>
          </div>
          <div class="stat-strip" aria-label="个人概览">
            <RouterLink class="stat-entry" to="/points-rank" aria-label="当前积分，查看积分排名">
              <span>POINTS</span>
              <strong>{{ userInfo.points || 0 }}</strong>
              <small>当前积分 · 查看排名</small>
            </RouterLink>
            <div>
              <span>ROUTES</span>
              <strong>{{ completedRouteCount }}</strong>
              <small>路线已完成</small>
            </div>
            <div>
              <span>REVIEW</span>
              <strong>{{ submissionCounts.pending }}</strong>
              <small>投稿待审核</small>
            </div>
            <div>
              <span>WORKS</span>
              <strong>{{ submissionCounts.all }}</strong>
              <small>投稿总数</small>
            </div>
          </div>
        </section>

        <div class="profile-workbench profile-workbench-single">
          <div v-if="false" class="workbench-main">
            <section class="profile-section atlas-section" aria-labelledby="atlas-title">
              <div class="section-heading section-heading-split">
                <div>
                  <h2 id="atlas-title">探索进度与打卡记录</h2>
                </div>
                <button class="text-link" type="button" @click="router.push('/map')">
                  打开校园地图
                  <ChevronRight :size="16" aria-hidden="true" />
                </button>
              </div>

              <div class="atlas-progress">
                <div class="atlas-progress-copy">
                  <strong>{{ atlasProgress }}%</strong>
                  <span>已解锁 {{ unlockedCount }} 个地点，另有 {{ lockingCount }} 个正在审核</span>
                </div>
                <div
                  class="atlas-signal"
                  role="progressbar"
                  aria-label="校园探索进度"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  :aria-valuenow="atlasProgress"
                  :style="atlasProgressStyle"
                >
                  <span></span>
                </div>
              </div>

              <div class="record-block">
                <div class="record-block-head">
                  <h3>最近打卡</h3>
                  <button
                    v-if="recentCheckins.length > 4"
                    class="quiet-button"
                    type="button"
                    :aria-expanded="checkinsExpanded"
                    @click="checkinsExpanded = !checkinsExpanded"
                  >
                    {{ checkinsExpanded ? '收起记录' : '查看全部' }}
                  </button>
                </div>

                <ol v-if="visibleCheckins.length" class="checkin-list">
                  <li v-for="record in visibleCheckins" :key="recordKey(record)">
                    <div class="record-index">{{ String(record.locationId).padStart(3, '0') }}</div>
                    <div class="record-copy">
                      <strong>{{ badgeName(record.locationId) }}</strong>
                      <span>{{ formatMethod(record.method) }} / {{ formatDistance(record.distance) }}</span>
                    </div>
                    <time :datetime="record.time">{{ formatDate(record.time, 'short') }}</time>
                  </li>
                </ol>

                <div v-else class="empty-state">
                  <MapPin :size="24" aria-hidden="true" />
                  <div>
                    <strong>还没有打卡记录</strong>
                    <p>从校园地图选择一个地点，完成第一次探索。</p>
                  </div>
                  <button class="button button-secondary" type="button" @click="router.push('/map')">去地图打卡</button>
                </div>
              </div>
            </section>

            <section class="profile-section collection-section" aria-labelledby="collection-title">
              <div class="section-heading">
                <h2 id="collection-title">徽章与成就</h2>
                <p>地点徽章来自真实打卡，个人成就由主页中的进度自动计算。</p>
              </div>

              <div class="collection-tabs" role="tablist" aria-label="徽章与成就">
                <button
                  v-for="(tab, index) in collectionTabs"
                  :id="'collection-tab-' + tab.id"
                  :key="tab.id"
                  type="button"
                  role="tab"
                  :aria-selected="collectionTab === tab.id"
                  :aria-controls="'collection-panel-' + tab.id"
                  :tabindex="collectionTab === tab.id ? 0 : -1"
                  @click="collectionTab = tab.id"
                  @keydown="handleCollectionTabKeydown($event, index)"
                >
                  {{ tab.label }}
                  <span>{{ tab.count }}</span>
                </button>
              </div>

              <div
                v-if="collectionTab === 'badges'"
                id="collection-panel-badges"
                role="tabpanel"
                aria-labelledby="collection-tab-badges"
                class="badge-panel"
              >
                <ul v-if="unlockedBadges.length" class="badge-list">
                  <li v-for="badge in unlockedBadges" :key="badge.id">
                    <img
                      :src="badge.thumb"
                      :alt="badge.name + '徽章'"
                      width="128"
                      height="128"
                      loading="lazy"
                      decoding="async"
                    />
                    <span>{{ String(badge.id).padStart(3, '0') }}</span>
                    <strong>{{ badge.name }}</strong>
                  </li>
                </ul>
                <div v-else class="empty-state compact">
                  <Award :size="24" aria-hidden="true" />
                  <div>
                    <strong>第一枚徽章还在路上</strong>
                    <p>完成一个地点打卡后，徽章会自动进入这里。</p>
                  </div>
                </div>
              </div>

              <div
                v-else
                id="collection-panel-achievements"
                role="tabpanel"
                aria-labelledby="collection-tab-achievements"
                class="achievement-panel"
              >
                <ul class="achievement-list">
                  <li
                    v-for="achievement in achievements"
                    :key="achievement.id"
                    :class="{ achieved: achievement.achieved }"
                  >
                    <component :is="achievement.achieved ? CheckCircle2 : LockKeyhole" :size="20" aria-hidden="true" />
                    <div>
                      <strong>{{ achievement.name }}</strong>
                      <span>{{ achievement.condition }}</span>
                    </div>
                    <small>{{ achievement.achieved ? '已达成' : '进行中' }}</small>
                  </li>
                </ul>
              </div>
            </section>

            <section class="profile-section submission-section" aria-labelledby="submission-title">
              <div class="section-heading section-heading-split">
                <div>
                  <h2 id="submission-title">投稿作品</h2>
                </div>
                <button class="button button-primary" type="button" @click="router.push('/award/submit')">
                  <Plus :size="16" aria-hidden="true" />
                  发起投稿
                </button>
              </div>

              <div class="submission-filters" aria-label="筛选投稿状态">
                <button
                  v-for="filter in submissionFilters"
                  :key="filter.id"
                  type="button"
                  :aria-pressed="submissionFilter === filter.id"
                  @click="submissionFilter = filter.id"
                >
                  {{ filter.label }}
                  <span>{{ filter.count }}</span>
                </button>
              </div>

              <div v-if="filteredSubmissions.length" class="submission-list">
                <article
                  v-for="submission in filteredSubmissions"
                  :key="submission.id"
                  class="submission-card"
                >
                  <div class="submission-media">
                    <img
                      v-if="submissionImage(submission) && !failedSubmissionImages.has(String(submission.id))"
                      :src="submissionImage(submission)"
                      :alt="submission.title + '作品预览'"
                      width="640"
                      height="400"
                      loading="lazy"
                      decoding="async"
                      @error="markSubmissionImageFailed(submission.id)"
                    />
                    <ImageIcon v-else :size="30" aria-hidden="true" />
                  </div>
                  <div class="submission-copy">
                    <div class="submission-meta">
                      <span>{{ submission.categoryName || '校园作品' }}</span>
                      <span :class="'status status-' + statusInfo(submission.status).tone">
                        <component :is="statusInfo(submission.status).icon" :size="14" aria-hidden="true" />
                        {{ statusInfo(submission.status).label }}
                      </span>
                    </div>
                    <h3>{{ submission.title || '未命名作品' }}</h3>
                    <p>{{ submission.description || '暂未填写作品说明。' }}</p>
                    <div class="submission-foot">
                      <span>{{ submission.locationName || badgeName(submission.locationId) }}</span>
                      <time :datetime="toDateTime(submission.createdAt)">{{ formatDate(submission.createdAt, 'short') }}</time>
                      <button type="button" @click="openSubmission(submission.id)">
                        查看详情
                        <ChevronRight :size="15" aria-hidden="true" />
                      </button>
                    </div>
                    <p v-if="submission.status === 'rejected' && submission.reviewNote" class="review-note">
                      审核说明：{{ submission.reviewNote }}
                    </p>
                  </div>
                </article>
              </div>

              <div v-else class="empty-state">
                <ImageIcon :size="24" aria-hidden="true" />
                <div>
                  <strong>{{ submissions.length ? '当前筛选下没有作品' : '还没有投稿作品' }}</strong>
                  <p>{{ submissions.length ? '切换状态筛选查看其他投稿。' : '提交创意或摄影作品后，审核状态会显示在这里。' }}</p>
                </div>
              </div>
            </section>
          </div>

          <aside class="workbench-side">
            <section v-if="false" class="side-panel personality-panel" aria-labelledby="personality-title">
              <div class="section-heading">
                <p class="eyebrow">ISETI / PLACE @ SYSU</p>
                <h2 id="personality-title">校园人格</h2>
              </div>

              <template v-if="userInfo.personality">
                <div class="personality-code">
                  {{ userInfo.personality.mainCode }} / {{ userInfo.personality.subCode }}
                </div>
                <h3>{{ userInfo.personality.mainName }}</h3>
                <p class="personality-sub">{{ userInfo.personality.subName }}</p>
                <blockquote>{{ userInfo.personality.line || '你的校园探索方式已经记录。' }}</blockquote>
                <dl class="personality-details">
                  <div>
                    <dt>今日推荐</dt>
                    <dd>{{ userInfo.personality.placeName || '校园随机地点' }}</dd>
                  </div>
                  <div>
                    <dt>行动任务</dt>
                    <dd>{{ userInfo.personality.task || '从一次真实探索开始。' }}</dd>
                  </div>
                </dl>
                <ul v-if="userInfo.personality.badges?.length" class="personality-badges" aria-label="人格标签">
                  <li v-for="badge in userInfo.personality.badges" :key="badge.code">{{ badge.name }}</li>
                </ul>
                <p v-if="personalitySyncMessage" class="inline-status">{{ personalitySyncMessage }}</p>
                <button class="button button-secondary full-width" type="button" @click="router.push('/place')">
                  <RotateCcw :size="16" aria-hidden="true" />
                  重新测试
                </button>
              </template>

              <div v-else class="empty-state vertical">
                <Compass :size="26" aria-hidden="true" />
                <div>
                  <strong>还没有 ISETI 结果</strong>
                  <p>完成 PLACE @ SYSU 测试，获得你的校园人格与今日地点。</p>
                </div>
                <button class="button button-primary full-width" type="button" @click="router.push('/place')">开始测试</button>
                <p v-if="personalitySyncMessage" class="inline-error">{{ personalitySyncMessage }}</p>
              </div>
            </section>

            <section id="feedback" :class="['side-panel', 'feedback-panel', { expanded: feedbackExpanded }]" aria-labelledby="feedback-title">
              <button
                class="feedback-toggle"
                type="button"
                :aria-expanded="feedbackExpanded"
                aria-controls="feedback-body"
                @click="feedbackExpanded = !feedbackExpanded"
              >
                <span class="feedback-toggle-icon" aria-hidden="true"><MessageSquareText :size="20" /></span>
                <span>
                  <strong id="feedback-title">问题反馈</strong>
                  <small>{{ feedbackExpanded ? '收起反馈表单' : '遇到问题或有建议时，在这里告诉我们' }}</small>
                </span>
                <ChevronDown :size="19" aria-hidden="true" />
              </button>

              <div v-show="feedbackExpanded" id="feedback-body" class="feedback-body">
              <form novalidate @submit.prevent="submitFeedback">
                <div class="form-field">
                  <label for="feedback-category">反馈类型</label>
                  <select
                    id="feedback-category"
                    v-model="feedbackForm.category"
                    :aria-invalid="Boolean(feedbackErrors.category)"
                    @change="onFeedbackInput('category')"
                    @blur="validateFeedbackField('category')"
                  >
                    <option value="suggestion">功能建议</option>
                    <option value="bug">问题反馈</option>
                    <option value="content">内容纠错</option>
                    <option value="other">其他</option>
                  </select>
                  <div class="field-message-slot" aria-live="polite">
                    <p v-if="feedbackErrors.category" class="field-error">{{ feedbackErrors.category }}</p>
                  </div>
                </div>

                <div class="form-field">
                  <div class="label-row">
                    <label for="feedback-content">具体内容</label>
                    <span>{{ feedbackForm.content.length }}/1000</span>
                  </div>
                  <textarea
                    id="feedback-content"
                    v-model="feedbackForm.content"
                    rows="5"
                    maxlength="1000"
                    placeholder="请描述操作步骤、遇到的情况或你的建议"
                    :aria-invalid="Boolean(feedbackErrors.content)"
                    aria-describedby="feedback-content-help"
                    @input="onFeedbackInput('content')"
                    @blur="validateFeedbackField('content')"
                  ></textarea>
                  <div id="feedback-content-help" class="field-message-slot" aria-live="polite">
                    <p v-if="feedbackErrors.content" class="field-error">{{ feedbackErrors.content }}</p>
                    <p v-else class="field-help">至少 5 个字符，请勿填写密码等敏感信息。</p>
                  </div>
                </div>

                <div class="form-field feedback-image-field">
                  <div class="label-row">
                    <label for="feedback-images">补充图片 <span>选填</span></label>
                    <span>{{ feedbackImages.length }}/9</span>
                  </div>
                  <input
                    id="feedback-images"
                    ref="feedbackImageInput"
                    class="visually-hidden-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    @change="onFeedbackImagesChosen"
                  />
                  <div class="feedback-image-grid">
                    <div v-for="image in feedbackImages" :key="image.uid" class="feedback-image-preview">
                      <img :src="image.preview" :alt="image.file.name" />
                      <button type="button" :aria-label="`移除图片 ${image.file.name}`" :disabled="feedbackSaveState === 'loading'" @click="removeFeedbackImage(image.uid)">
                        <X :size="15" aria-hidden="true" />
                      </button>
                    </div>
                    <button
                      v-if="feedbackImages.length < 9"
                      class="feedback-image-add"
                      type="button"
                      :disabled="feedbackSaveState === 'loading'"
                      @click="feedbackImageInput?.click()"
                    >
                      <ImageIcon :size="22" aria-hidden="true" />
                      <span>添加图片</span>
                    </button>
                  </div>
                  <div class="field-message-slot" aria-live="polite">
                    <p v-if="feedbackErrors.images" class="field-error">{{ feedbackErrors.images }}</p>
                    <p v-else class="field-help">最多 9 张，支持 JPG、PNG、WebP、GIF，单张不超过 10MB。</p>
                  </div>
                </div>

                <div class="form-field">
                  <label for="feedback-contact">联系方式</label>
                  <input
                    id="feedback-contact"
                    v-model="feedbackForm.contact"
                    type="text"
                    maxlength="100"
                    autocomplete="off"
                    placeholder="请输入微信号"
                    required
                    aria-required="true"
                    :aria-invalid="Boolean(feedbackErrors.contact)"
                    @input="onFeedbackInput('contact')"
                    @blur="validateFeedbackField('contact')"
                  />
                  <div class="field-message-slot" aria-live="polite">
                    <p v-if="feedbackErrors.contact" class="field-error">{{ feedbackErrors.contact }}</p>
                  </div>
                </div>

                <p v-if="feedbackMessage" :class="feedbackSaveState === 'error' ? 'inline-error' : 'inline-status'" role="status">
                  {{ feedbackMessage }}
                </p>

                <button
                  class="button button-primary full-width stateful-button"
                  type="submit"
                  :data-state="feedbackSaveState"
                  :disabled="feedbackSaveState === 'loading'"
                >
                  <LoaderCircle v-if="feedbackSaveState === 'loading'" class="spinner" :size="17" aria-hidden="true" />
                  <CheckCircle2 v-else-if="feedbackSaveState === 'success'" :size="17" aria-hidden="true" />
                  <Send v-else :size="17" aria-hidden="true" />
                  {{ feedbackButtonCopy }}
                </button>
              </form>

              <div v-if="feedbackHistory.length" class="feedback-history">
                <h3>最近反馈</h3>
                <ol>
                  <li v-for="item in feedbackHistory.slice(0, 3)" :key="item.id">
                    <div>
                      <strong>{{ item.categoryName || '问题反馈' }}</strong>
                      <span>{{ feedbackStatusLabel(item.status) }}</span>
                    </div>
                    <p>{{ item.content }}</p>
                    <div v-if="item.images?.length" class="feedback-history-images">
                      <a v-for="image in item.images" :key="image.key || image.url" :href="image.url" target="_blank" rel="noopener">
                        <img :src="image.url" alt="反馈附图" loading="lazy" />
                      </a>
                    </div>
                    <p v-if="item.reply" class="feedback-reply"><strong>管理员回复：</strong>{{ item.reply }}</p>
                    <time :datetime="toDateTime(item.createdAt)">{{ formatDate(item.createdAt, 'short') }}</time>
                  </li>
                </ol>
              </div>
              </div>
            </section>
          </aside>
        </div>

        <button v-if="isAdmin" class="profile-admin-entry" type="button" @click="router.push('/admin')">
          <ShieldCheck :size="20" aria-hidden="true" />
          <span>进入管理员模式</span>
          <ChevronRight :size="18" aria-hidden="true" />
        </button>

        <button class="profile-logout-button profile-logout-standalone" type="button" @click="logout">
          <LogOut :size="18" aria-hidden="true" />
          退出登录
        </button>
      </template>
    </main>

    <footer class="profile-footer">
      <span>SYSU ISE CAMPUS EXPLORE</span>
      <span>学生个人空间</span>
      <button type="button" @click="openCommandPalette">快速导航</button>
    </footer>

    <dialog
      ref="profileDialog"
      class="profile-dialog"
      aria-labelledby="profile-dialog-title"
      @click="handleProfileDialogBackdrop"
      @keydown.esc.prevent="closeProfileDialog"
      @close="resetProfileDialog"
    >
      <form class="dialog-sheet" novalidate @submit.prevent="saveProfile">
        <header class="dialog-header">
          <div>
            <p v-if="profileStep === 'crop'" class="eyebrow">AVATAR CROP / 头像裁剪</p>
            <h2 id="profile-dialog-title">{{ profileStep === 'crop' ? '选取头像区域' : '编辑个人资料' }}</h2>
          </div>
          <button class="icon-button" type="button" aria-label="关闭资料编辑" @click="closeProfileDialog">
            <X :size="19" aria-hidden="true" />
          </button>
        </header>

        <section v-if="profileStep === 'crop'" class="avatar-crop-step" aria-labelledby="profile-dialog-title">
          <p class="avatar-crop-instruction">拖动图片调整位置，缩放后让需要保留的部分位于正方形框内。</p>
          <div
            ref="cropWorkspace"
            class="avatar-crop-workspace"
            tabindex="0"
            aria-label="头像裁剪区域，可拖动图片或使用方向键调整位置"
            @pointerdown="startCropDrag"
            @pointermove="moveCropDrag"
            @pointerup="endCropDrag"
            @pointercancel="endCropDrag"
            @wheel.prevent="onCropWheel"
            @keydown="onCropKeydown"
          >
            <img
              v-if="cropSourceUrl"
              :src="cropSourceUrl"
              :style="cropImageStyle"
              alt="待裁剪头像"
              draggable="false"
            />
            <div class="avatar-crop-frame" aria-hidden="true"></div>
          </div>
          <label class="avatar-zoom-control" for="avatar-crop-zoom">
            <span>缩放</span>
            <input
              id="avatar-crop-zoom"
              v-model.number="cropZoom"
              type="range"
              min="1"
              max="3"
              step="0.01"
              @input="clampCropOffset"
            />
            <output>{{ Math.round(cropZoom * 100) }}%</output>
          </label>
          <footer class="avatar-crop-actions">
            <button class="button button-secondary" type="button" @click="cancelAvatarCrop">取消</button>
            <button class="button button-primary" type="button" @click="confirmAvatarCrop">确定</button>
          </footer>
        </section>

        <template v-else>
          <div class="profile-editor">
          <input
            id="profile-avatar"
            ref="avatarInput"
            class="avatar-file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
            :aria-invalid="Boolean(profileErrors.avatar)"
            @change="onAvatarFileSelected"
          />
            <label class="avatar-change-trigger" for="profile-avatar">
              <span class="avatar-preview">
                <img
                  v-if="profileAvatarPreview && !profilePreviewFailed"
                  :src="profileAvatarPreview"
                  alt="当前头像"
                  width="88"
                  height="88"
                  @error="profilePreviewFailed = true"
                />
                <UserRound v-else :size="34" aria-hidden="true" />
              </span>
              <span>更换头像</span>
            </label>
            <p v-if="profileErrors.avatar" class="field-error" role="status">{{ profileErrors.avatar }}</p>
            <p v-else-if="avatarFile" class="avatar-selection-status" role="status">已裁剪，保存资料后生效</p>
          </div>

        <div class="dialog-form-grid">
          <div class="form-field">
            <label for="profile-username">昵称</label>
            <input
              id="profile-username"
              ref="firstProfileField"
              v-model="profileForm.username"
              type="text"
              maxlength="24"
              autocomplete="nickname"
              :aria-invalid="Boolean(profileErrors.username)"
              @input="onProfileInput('username')"
              @blur="validateProfileField('username')"
            />
            <div class="field-message-slot" aria-live="polite">
              <p v-if="profileErrors.username" class="field-error">{{ profileErrors.username }}</p>
            </div>
          </div>

          <div class="form-field locked-profile-field">
            <label for="profile-real-name">姓名</label>
            <input
              id="profile-real-name"
              v-model="profileForm.realName"
              type="text"
              autocomplete="name"
              readonly
              aria-readonly="true"
              aria-describedby="profile-real-name-help"
            />
            <div id="profile-real-name-help" class="locked-field-help">
              <LockKeyhole :size="14" aria-hidden="true" />
              <span>姓名已在注册时确认，不可修改</span>
            </div>
          </div>

          <div class="form-field">
            <label for="profile-student-id">学号 <span>选填</span></label>
            <input
              id="profile-student-id"
              v-model="profileForm.studentId"
              type="text"
              maxlength="24"
              autocomplete="off"
              :aria-invalid="Boolean(profileErrors.studentId)"
              @input="onProfileInput('studentId')"
              @blur="validateProfileField('studentId')"
            />
            <div class="field-message-slot" aria-live="polite">
              <p v-if="profileErrors.studentId" class="field-error">{{ profileErrors.studentId }}</p>
              <p v-else class="field-help">6 至 24 位字母、数字、下划线或连字符。</p>
            </div>
          </div>

          <div class="form-field">
            <label for="profile-phone">联系电话 <span>选填</span></label>
            <input
              id="profile-phone"
              v-model="profileForm.phone"
              type="tel"
              maxlength="30"
              autocomplete="tel"
              :aria-invalid="Boolean(profileErrors.phone)"
              @input="onProfileInput('phone')"
              @blur="validateProfileField('phone')"
            />
            <div class="field-message-slot" aria-live="polite">
              <p v-if="profileErrors.phone" class="field-error">{{ profileErrors.phone }}</p>
            </div>
          </div>

          <div class="form-field form-field-wide">
            <div class="label-row">
              <label for="profile-bio">个人简介 <span>选填</span></label>
              <span>{{ profileForm.bio.length }}/160</span>
            </div>
            <textarea
              id="profile-bio"
              v-model="profileForm.bio"
              rows="3"
              maxlength="160"
              placeholder="写下你正在探索的校园主题"
              :aria-invalid="Boolean(profileErrors.bio)"
              @input="onProfileInput('bio')"
              @blur="validateProfileField('bio')"
            ></textarea>
            <div class="field-message-slot" aria-live="polite">
              <p v-if="profileErrors.bio" class="field-error">{{ profileErrors.bio }}</p>
            </div>
          </div>
        </div>

        <p v-if="profileMessage" :class="profileSaveState === 'error' ? 'inline-error' : 'inline-status'" role="status">
          {{ profileMessage }}
        </p>

        <footer class="dialog-actions">
          <button class="button button-secondary" type="button" @click="closeProfileDialog">取消</button>
          <button
            class="button button-primary stateful-button"
            type="submit"
            :data-state="profileSaveState"
            :disabled="profileSaveState === 'loading' || profileSaveState === 'success'"
          >
            <LoaderCircle v-if="profileSaveState === 'loading'" class="spinner" :size="17" aria-hidden="true" />
            <CheckCircle2 v-else-if="profileSaveState === 'success'" :size="17" aria-hidden="true" />
            <Pencil v-else :size="16" aria-hidden="true" />
            {{ profileButtonCopy }}
          </button>
        </footer>
        </template>
      </form>
    </dialog>

    <dialog
      ref="commandDialog"
      class="command-dialog"
      aria-labelledby="command-dialog-title"
      @click="handleCommandBackdrop"
      @keydown.esc.prevent="closeCommandPalette"
      @close="resetCommandPalette"
    >
      <div class="command-sheet">
        <h2 id="command-dialog-title" class="sr-only">快速前往</h2>
        <div class="command-search">
          <Search :size="18" aria-hidden="true" />
          <input
            ref="commandInput"
            v-model="commandQuery"
            type="search"
            placeholder="搜索页面或操作"
            aria-label="搜索页面或操作"
            aria-controls="command-results"
            @keydown.down.prevent="moveCommand(1)"
            @keydown.up.prevent="moveCommand(-1)"
            @keydown.enter.prevent="runSelectedCommand"
          />
          <kbd>ESC</kbd>
        </div>
        <div id="command-results" class="command-results" role="listbox" aria-label="快速前往结果">
          <button
            v-for="(command, index) in filteredCommands"
            :key="command.label"
            type="button"
            role="option"
            :aria-selected="commandIndex === index"
            :class="{ selected: commandIndex === index }"
            @mouseenter="commandIndex = index"
            @click="executeCommand(command)"
          >
            <component :is="command.icon" :size="18" aria-hidden="true" />
            <span>
              <strong>{{ command.label }}</strong>
              <small>{{ command.hint }}</small>
            </span>
            <ChevronRight :size="16" aria-hidden="true" />
          </button>
          <p v-if="!filteredCommands.length" class="command-empty">没有匹配的页面或操作</p>
        </div>
      </div>
    </dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  AlertCircle,
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Compass,
  Home,
  Image as ImageIcon,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Map,
  MapPin,
  MessageSquareText,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Trophy,
  UserRound,
  X,
  XCircle
} from '@lucide/vue'
import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/space-grotesk/latin-600.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import '@fontsource/noto-serif-sc/chinese-simplified-400.css'
import { request } from '@/utils/request'
import {
  clearAnonymousPersonality,
  discardLegacyPersonality,
  readAccountPersonality,
  readAnonymousPersonality,
  saveAccountPersonality
} from '@/utils/personalityStorage'
import { badgeCatalog, badgeThumb, getBadge } from '@/data/badgeCatalog'
import ddlPersonalityScene from '../assets/place/main/ddl.webp'
import donePersonalityScene from '../assets/place/main/done.webp'
import growPersonalityScene from '../assets/place/main/grow.webp'
import hostPersonalityScene from '../assets/place/main/host.webp'
import pingPersonalityScene from '../assets/place/main/ping.webp'
import sidePersonalityScene from '../assets/place/main/side.webp'
import syncPersonalityScene from '../assets/place/main/sync.webp'
import tryPersonalityScene from '../assets/place/main/try.webp'
import basePersonalityVisual from '../assets/place/subtypes/base.webp'
import lensPersonalityVisual from '../assets/place/subtypes/lens.webp'
import mapsPersonalityVisual from '../assets/place/subtypes/maps.webp'
import runPersonalityVisual from '../assets/place/subtypes/run.webp'
import stayPersonalityVisual from '../assets/place/subtypes/tree.webp'
import wikiPersonalityVisual from '../assets/place/subtypes/wiki.webp'

const router = useRouter()
const totalBadges = badgeCatalog.length
const profileDialog = ref(null)
const commandDialog = ref(null)
const firstProfileField = ref(null)
const commandInput = ref(null)
const avatarInput = ref(null)
const feedbackImageInput = ref(null)
const cropWorkspace = ref(null)

const mainPersonalityVisuals = {
  GROW: growPersonalityScene,
  SIDE: sidePersonalityScene,
  DONE: donePersonalityScene,
  DDL: ddlPersonalityScene,
  HOST: hostPersonalityScene,
  SYNC: syncPersonalityScene,
  TRY: tryPersonalityScene,
  PING: pingPersonalityScene
}

const subtypePersonalityVisuals = {
  STAY: stayPersonalityVisual,
  MAPS: mapsPersonalityVisual,
  RUN: runPersonalityVisual,
  LENS: lensPersonalityVisual,
  WIKI: wikiPersonalityVisual,
  BASE: basePersonalityVisual
}

const loading = ref(true)
const loadError = ref('')
const pageNotice = ref('')
const userInfo = ref({})
const submissions = ref([])
const failedSubmissionImages = ref(new Set())
const feedbackHistory = ref([])
const feedbackExpanded = ref(false)
const checkinsExpanded = ref(false)
const avatarFailed = ref(false)
const personalitySyncMessage = ref('')
const submissionFilter = ref('all')
const collectionTab = ref('badges')
const personalityFigure = computed(() => {
  const localPersonality = readAccountPersonality(userInfo.value.id)
  const mainCode = userInfo.value.personality?.mainCode || localPersonality?.mainCode
  const rawSubCode = userInfo.value.personality?.subCode || localPersonality?.subCode
  const subCode = rawSubCode === 'TREE' ? 'STAY' : rawSubCode
  const mainSrc = mainPersonalityVisuals[mainCode]
  const subSrc = subtypePersonalityVisuals[subCode]
  return mainSrc && subSrc ? { code: `${mainCode} / ${subCode}`, mainSrc, subSrc } : null
})

const profileForm = ref({
  username: '',
  realName: '',
  studentId: '',
  phone: '',
  bio: ''
})
const profileOriginal = ref({})
const profileErrors = ref({})
const profileMessage = ref('')
const profileSaveState = ref('idle')
const profilePreviewFailed = ref(false)
const avatarFile = ref(null)
const avatarPreviewUrl = ref('')
const avatarUploadProgress = ref(0)
const profileStep = ref('edit')
const cropSourceUrl = ref('')
const cropSourceFile = ref(null)
const cropNaturalSize = ref({ width: 0, height: 0 })
const cropWorkspaceSize = ref({ width: 0, height: 0 })
const cropZoom = ref(1)
const cropOffset = ref({ x: 0, y: 0 })
const cropDragging = ref(false)
let cropPointerId = null
let cropPointerStart = { x: 0, y: 0, offsetX: 0, offsetY: 0 }

const feedbackForm = ref({ category: 'suggestion', content: '', contact: '' })
const feedbackErrors = ref({})
const feedbackMessage = ref('')
const feedbackSaveState = ref('idle')
const feedbackImages = ref([])
const feedbackUploadProgress = ref({ current: 0, total: 0 })
let feedbackImageSequence = 0

const commandQuery = ref('')
const commandIndex = ref(0)

const collectionTabs = computed(() => [
  { id: 'badges', label: '地点徽章', count: unlockedCount.value },
  { id: 'achievements', label: '个人成就', count: achievementUnlockedCount.value }
])

const displayName = computed(() => userInfo.value.username || userInfo.value.realName || '校园探索者')
const isAdmin = computed(() => ['admin', 'owner'].includes(String(userInfo.value.role || '')))
const avatarSrc = computed(() => String(userInfo.value.avatar || '').trim())
const profileAvatarPreview = computed(() => avatarPreviewUrl.value || avatarSrc.value)
const cropFrameSize = computed(() => Math.min(cropWorkspaceSize.value.width, cropWorkspaceSize.value.height) * 0.72)
const cropBaseScale = computed(() => {
  if (!cropNaturalSize.value.width || !cropNaturalSize.value.height || !cropFrameSize.value) return 1
  return Math.max(
    cropFrameSize.value / cropNaturalSize.value.width,
    cropFrameSize.value / cropNaturalSize.value.height
  )
})
const cropRenderedSize = computed(() => ({
  width: cropNaturalSize.value.width * cropBaseScale.value * cropZoom.value,
  height: cropNaturalSize.value.height * cropBaseScale.value * cropZoom.value
}))
const cropImageStyle = computed(() => ({
  width: `${cropRenderedSize.value.width}px`,
  height: `${cropRenderedSize.value.height}px`,
  transform: `translate3d(calc(-50% + ${cropOffset.value.x}px), calc(-50% + ${cropOffset.value.y}px), 0)`
}))
const unlockedIds = computed(() => new Set((userInfo.value.unlockedLocations || []).map(Number)))
const lockingIds = computed(() => new Set((userInfo.value.lockingLocations || []).map(Number)))
const unlockedCount = computed(() => unlockedIds.value.size)
const lockingCount = computed(() => lockingIds.value.size)
const completedRouteCount = computed(() => (userInfo.value.completedRoutes || []).length)
const atlasProgress = computed(() => Math.min(100, Math.round((unlockedCount.value / totalBadges) * 100)))
const atlasProgressStyle = computed(() => ({ '--atlas-scale': String(atlasProgress.value / 100) }))

const recentCheckins = computed(() => {
  return [...(userInfo.value.checkinRecords || [])]
    .sort((a, b) => new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime())
})
const visibleCheckins = computed(() => checkinsExpanded.value ? recentCheckins.value : recentCheckins.value.slice(0, 4))

const unlockedBadges = computed(() => {
  return Array.from(unlockedIds.value)
    .map(id => getBadge(id))
    .filter(Boolean)
    .sort((a, b) => a.id - b.id)
    .map(item => ({ ...item, thumb: badgeThumb(item.icon, 256, 75) }))
})

const submissionCounts = computed(() => ({
  all: submissions.value.length,
  pending: submissions.value.filter(item => item.status === 'pending').length,
  approved: submissions.value.filter(item => item.status === 'approved').length,
  rejected: submissions.value.filter(item => item.status === 'rejected').length
}))

const submissionFilters = computed(() => [
  { id: 'all', label: '全部', count: submissionCounts.value.all },
  { id: 'pending', label: '待审核', count: submissionCounts.value.pending },
  { id: 'approved', label: '已通过', count: submissionCounts.value.approved },
  { id: 'rejected', label: '未通过', count: submissionCounts.value.rejected }
])

const filteredSubmissions = computed(() => {
  if (submissionFilter.value === 'all') return submissions.value
  return submissions.value.filter(item => item.status === submissionFilter.value)
})

const achievements = computed(() => [
  {
    id: 'first-checkin',
    name: '探索启程',
    condition: '解锁第 1 个校园地点',
    achieved: unlockedCount.value >= 1
  },
  {
    id: 'five-checkins',
    name: '康乐园漫游者',
    condition: '累计解锁 5 个校园地点',
    achieved: unlockedCount.value >= 5
  },
  {
    id: 'route',
    name: '路线完成者',
    condition: '完成 1 条校园探索路线',
    achieved: completedRouteCount.value >= 1
  },
  {
    id: 'photo',
    name: '校园记录者',
    condition: '留下 1 次照片打卡记录',
    achieved: recentCheckins.value.some(item => String(item.method || '').toLowerCase().includes('photo'))
  },
  {
    id: 'personality',
    name: '找到校园人格',
    condition: '完成 PLACE @ SYSU 测试',
    achieved: Boolean(userInfo.value.personality)
  },
  {
    id: 'contributor',
    name: '探索共建者',
    condition: '有 1 件投稿作品通过审核',
    achieved: submissionCounts.value.approved >= 1
  }
])
const achievementUnlockedCount = computed(() => achievements.value.filter(item => item.achieved).length)

const feedbackButtonCopy = computed(() => ({
  idle: '提交反馈',
  loading: feedbackUploadProgress.value.total
    ? `正在上传 ${feedbackUploadProgress.value.current}/${feedbackUploadProgress.value.total}`
    : '正在提交',
  success: '已提交',
  error: '重新提交'
}[feedbackSaveState.value] || '提交反馈'))

const profileButtonCopy = computed(() => ({
  idle: '保存资料',
  loading: '正在保存',
  success: '已保存',
  error: '重新保存'
}[profileSaveState.value] || '保存资料'))

const commands = [
  { label: '校园首页', hint: '返回功能总览', keywords: '首页 home', icon: Home, run: () => router.push('/') },
  { label: '校园地图', hint: '查看全部地点与解锁状态', keywords: '地图 地点 map', icon: Map, run: () => router.push('/map') },
  { label: '校园地图', hint: '定位地点并发起打卡', keywords: '地图 打卡 map', icon: MapPin, run: () => router.push('/map') },
  { label: 'ISETI 测试', hint: '查看或更新校园人格', keywords: '人格 测试 place iseti', icon: Compass, run: () => router.push('/place') },
  { label: '投稿活动', hint: '提交或查看校园作品', keywords: '投稿 作品 award', icon: Trophy, run: () => router.push('/award') },
  { label: '编辑个人资料', hint: '更新头像、昵称与学号', keywords: '资料 编辑 头像 学号', icon: Pencil, run: openProfileFromCommand },
  { label: '提交问题反馈', hint: '报告问题或提出建议', keywords: '问题 意见 反馈 bug', icon: MessageSquareText, run: focusFeedbackFromCommand },
  { label: '退出登录', hint: '清除当前设备的登录信息', keywords: '退出 logout', icon: LogOut, run: logout }
]

const filteredCommands = computed(() => {
  const query = commandQuery.value.trim().toLowerCase()
  if (!query) return commands
  return commands.filter(item => (item.label + ' ' + item.hint + ' ' + item.keywords).toLowerCase().includes(query))
})

function responseOkay(response) {
  return Boolean(response?.ok && response?.data?.code === 0)
}

function responseMessage(response, fallback) {
  return response?.data?.message || response?.data?.error || fallback
}

function redirectToSignin() {
  localStorage.removeItem('token')
  router.replace({ path: '/signin', query: { redirect: '/myCheckins' } })
}

async function fetchDashboard() {
  if (!localStorage.getItem('token')) {
    redirectToSignin()
    return
  }

  loading.value = true
  loadError.value = ''
  pageNotice.value = ''

  try {
    const [meResponse, statusResponse, submissionsResponse, feedbackResponse] = await Promise.all([
      request('/auth/me', 'GET', null, { cacheBust: true }),
      request('/checkin/status', 'GET', null, { cacheBust: true }),
      request('/submissions/mine', 'GET', null, { cacheBust: true }),
      request('/feedback/mine', 'GET', null, { cacheBust: true })
    ])

    if (meResponse.status === 401) {
      redirectToSignin()
      return
    }
    if (!responseOkay(meResponse)) {
      throw new Error(responseMessage(meResponse, '无法读取用户资料，请检查本地服务是否正在运行。'))
    }

    const serverUser = meResponse.data.userInfo || {}
    if (responseOkay(statusResponse)) {
      serverUser.unlockedLocations = statusResponse.data.unlockedLocations || serverUser.unlockedLocations || []
      serverUser.lockingLocations = statusResponse.data.lockingLocations || serverUser.lockingLocations || []
      serverUser.pendingCheckins = statusResponse.data.pendingCheckins || serverUser.pendingCheckins || []
      serverUser.checkinReviewRecords = statusResponse.data.checkinReviewRecords || serverUser.checkinReviewRecords || []
    } else {
      pageNotice.value = '打卡审核状态暂时未更新，页面已显示最近一次账户数据。'
    }

    userInfo.value = serverUser
    avatarFailed.value = false
    const localUser = safeJsonParse(localStorage.getItem('userInfo'), {})
    localStorage.setItem('userInfo', JSON.stringify({ ...localUser, ...serverUser }))

    if (responseOkay(submissionsResponse)) {
      submissions.value = Array.isArray(submissionsResponse.data.list) ? submissionsResponse.data.list : []
      failedSubmissionImages.value = new Set()
    } else {
      submissions.value = []
      pageNotice.value = pageNotice.value || `投稿记录暂时未同步：${responseMessage(submissionsResponse, '服务暂时不可用。')}`
    }

    if (responseOkay(feedbackResponse)) {
      feedbackHistory.value = Array.isArray(feedbackResponse.data.list) ? feedbackResponse.data.list : []
    } else {
      feedbackHistory.value = []
      pageNotice.value = pageNotice.value || '反馈历史暂时无法读取，你仍可尝试提交新反馈。'
    }

    await syncLocalPersonality()
  } catch (error) {
    loadError.value = error?.message || '网络连接异常，请稍后重试。'
  } finally {
    loading.value = false
  }
}

async function syncLocalPersonality() {
  discardLegacyPersonality()
  const accountId = userInfo.value.id
  if (!accountId) return

  const accountResult = readAccountPersonality(accountId)
  const anonymousResult = readAnonymousPersonality()
  const localResult = [accountResult, anonymousResult]
    .filter(item => item?.mainCode && item?.subCode)
    .sort((a, b) => (Number(b.completedAt) || 0) - (Number(a.completedAt) || 0))[0]
  if (!localResult) {
    if (userInfo.value.personality) saveAccountPersonality(accountId, userInfo.value.personality)
    return
  }

  const cloudResult = userInfo.value.personality
  const localCompletedAt = Number(localResult.completedAt) || 0
  const cloudCompletedAt = Number(cloudResult?.completedAt) || 0

  if (cloudResult && (localCompletedAt === 0 || localCompletedAt <= cloudCompletedAt)) {
    saveAccountPersonality(accountId, cloudResult)
    clearAnonymousPersonality()
    return
  }

  const payload = {
    mainCode: localResult.mainCode,
    subCode: normalizeSubCode(localResult.subCode),
    badges: Array.isArray(localResult.badges)
      ? localResult.badges.map(item => typeof item === 'string' ? item : item?.code).filter(Boolean)
      : [],
    completedAt: localCompletedAt || Date.now()
  }
  const response = await request('/user/personality', 'PUT', payload)
  if (responseOkay(response)) {
    userInfo.value = { ...userInfo.value, personality: response.data.data.personality }
    saveAccountPersonality(accountId, response.data.data.personality)
    clearAnonymousPersonality()
    personalitySyncMessage.value = '本机的 ISETI 结果已同步到当前账户。'
  } else {
    personalitySyncMessage.value = '本机结果暂时无法同步，请稍后在测试页重试。'
  }
}

function normalizeSubCode(code) {
  return code === 'TREE' ? 'STAY' : code
}

function safeJsonParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

function badgeName(locationId) {
  return getBadge(locationId)?.name || ('地点 ' + (locationId || '未知'))
}

function recordKey(record) {
  return [record.locationId, record.time, record.method].join('-')
}

function formatMethod(method) {
  const labels = {
    photo: '照片打卡',
    map: '地图打卡',
    geo: '定位打卡',
    gps: '定位打卡'
  }
  const key = String(method || 'geo').toLowerCase()
  return labels[key] || '校园打卡'
}

function formatDistance(distance) {
  const value = Number(distance)
  if (!Number.isFinite(value)) return '距离未记录'
  if (value < 1000) return Math.round(value) + ' 米'
  return (value / 1000).toFixed(1) + ' 公里'
}

function toDate(value) {
  const date = new Date(value || 0)
  return Number.isNaN(date.getTime()) ? null : date
}

function toDateTime(value) {
  return toDate(value)?.toISOString() || ''
}

function formatDate(value, mode = 'long') {
  const date = toDate(value)
  if (!date) return '时间未记录'
  const options = mode === 'short'
    ? { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
    : { year: 'numeric', month: 'long', day: 'numeric' }
  return new Intl.DateTimeFormat('zh-CN', options).format(date)
}

function submissionImage(submission) {
  return submission?.images?.find(item => item?.url)?.url || ''
}

function markSubmissionImageFailed(id) {
  failedSubmissionImages.value = new Set([...failedSubmissionImages.value, String(id)])
}

function statusInfo(status) {
  const map = {
    pending: { label: '待审核', tone: 'pending', icon: Clock3 },
    approved: { label: '已通过', tone: 'approved', icon: CheckCircle2 },
    rejected: { label: '未通过', tone: 'rejected', icon: XCircle }
  }
  return map[status] || map.pending
}

function feedbackStatusLabel(status) {
  return {
    submitted: '已提交',
    processing: '处理中',
    in_progress: '处理中',
    resolved: '已回复',
    closed: '已结束'
  }[status] || '已提交'
}

function openSubmission(id) {
  router.push('/award/submission/' + encodeURIComponent(id))
}

function handleCollectionTabKeydown(event, index) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const tabs = collectionTabs.value
  let target = index
  if (event.key === 'ArrowRight') target = (index + 1) % tabs.length
  if (event.key === 'ArrowLeft') target = (index - 1 + tabs.length) % tabs.length
  if (event.key === 'Home') target = 0
  if (event.key === 'End') target = tabs.length - 1
  collectionTab.value = tabs[target].id
  nextTick(() => {
    document.getElementById('collection-tab-' + tabs[target].id)?.focus({ preventScroll: true })
  })
}

function editablePhone(value) {
  const phone = String(value || '').trim()
  return !phone || /^[0-9+()\-\s]{5,30}$/.test(phone) ? phone : ''
}

function openProfileDialog() {
  profileForm.value = {
    username: String(userInfo.value.username || ''),
    realName: String(userInfo.value.realName || ''),
    studentId: String(userInfo.value.studentId || ''),
    phone: editablePhone(userInfo.value.phone),
    bio: String(userInfo.value.bio || '')
  }
  profileOriginal.value = { ...profileForm.value }
  profileErrors.value = {}
  profileMessage.value = ''
  profileSaveState.value = 'idle'
  profilePreviewFailed.value = false
  clearAvatarSelection()
  profileDialog.value?.showModal()
  nextTick(() => firstProfileField.value?.focus())
}

function closeProfileDialog() {
  profileDialog.value?.close()
}

function resetProfileDialog() {
  clearAvatarSelection()
  profileErrors.value = {}
  profileMessage.value = ''
  profileSaveState.value = 'idle'
}

function handleProfileDialogBackdrop(event) {
  if (event.target === profileDialog.value) closeProfileDialog()
}

function normalizedProfileValue(field, value) {
  const text = String(value ?? '')
  return field === 'bio' ? text.trim() : text.trim()
}

function validateProfileField(field) {
  const value = normalizedProfileValue(field, profileForm.value[field])
  let message = ''
  if (field === 'username' && (Array.from(value).length < 2 || Array.from(value).length > 24)) {
    message = '昵称需要 2 至 24 个字符。'
  }
  if (field === 'realName' && Array.from(value).length > 30) {
    message = '姓名最多 30 个字符。'
  }
  if (field === 'studentId' && value && !/^[A-Za-z0-9_-]{6,24}$/.test(value)) {
    message = '学号需为 6 至 24 位字母、数字、下划线或连字符。'
  }
  if (field === 'phone' && value && !/^[0-9+()\-\s]{5,30}$/.test(value)) {
    message = '联系电话只能包含数字、空格和常用电话符号。'
  }
  if (field === 'bio' && Array.from(value).length > 160) {
    message = '个人简介最多 160 个字符。'
  }
  profileErrors.value = { ...profileErrors.value, [field]: message }
  return !message
}

function onProfileInput(field) {
  profilePreviewFailed.value = false
  profileMessage.value = ''
  if (profileSaveState.value !== 'loading') profileSaveState.value = 'idle'
  if (Object.prototype.hasOwnProperty.call(profileErrors.value, field)) validateProfileField(field)
}

function formatFileSize(bytes) {
  if (!Number.isFinite(Number(bytes))) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function revokeAvatarPreview() {
  if (avatarPreviewUrl.value) URL.revokeObjectURL(avatarPreviewUrl.value)
  avatarPreviewUrl.value = ''
}

function revokeCropSource() {
  if (cropSourceUrl.value) URL.revokeObjectURL(cropSourceUrl.value)
  cropSourceUrl.value = ''
  cropSourceFile.value = null
}

function clearAvatarSelection() {
  revokeAvatarPreview()
  revokeCropSource()
  avatarFile.value = null
  avatarUploadProgress.value = 0
  profilePreviewFailed.value = false
  profileStep.value = 'edit'
}

function readImageSize(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => reject(new Error('图片无法读取，请重新选择。'))
    image.src = url
  })
}

async function onAvatarFileSelected(event) {
  const file = event.target.files?.[0] || null
  event.target.value = ''
  profileMessage.value = ''
  profileSaveState.value = 'idle'
  profileErrors.value = { ...profileErrors.value, avatar: '' }
  if (!file) return

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    clearAvatarSelection()
    profileErrors.value = { ...profileErrors.value, avatar: '请选择 JPG、PNG 或 WebP 图片。' }
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    clearAvatarSelection()
    profileErrors.value = { ...profileErrors.value, avatar: '图片不能超过 5 MB。' }
    return
  }

  revokeCropSource()
  cropSourceFile.value = file
  cropSourceUrl.value = URL.createObjectURL(file)
  try {
    cropNaturalSize.value = await readImageSize(cropSourceUrl.value)
    cropZoom.value = 1
    cropOffset.value = { x: 0, y: 0 }
    profileStep.value = 'crop'
    await nextTick()
    measureCropWorkspace()
    cropWorkspace.value?.focus({ preventScroll: true })
  } catch (error) {
    revokeCropSource()
    profileErrors.value = { ...profileErrors.value, avatar: error?.message || '图片无法读取，请重新选择。' }
  }
}

function measureCropWorkspace() {
  const rect = cropWorkspace.value?.getBoundingClientRect()
  if (!rect) return
  cropWorkspaceSize.value = { width: rect.width, height: rect.height }
  clampCropOffset()
}

function clampCropOffset() {
  const maxX = Math.max(0, (cropRenderedSize.value.width - cropFrameSize.value) / 2)
  const maxY = Math.max(0, (cropRenderedSize.value.height - cropFrameSize.value) / 2)
  cropOffset.value = {
    x: Math.max(-maxX, Math.min(maxX, cropOffset.value.x)),
    y: Math.max(-maxY, Math.min(maxY, cropOffset.value.y))
  }
}

function startCropDrag(event) {
  if (event.button !== 0 && event.pointerType === 'mouse') return
  cropPointerId = event.pointerId
  cropDragging.value = true
  cropPointerStart = {
    x: event.clientX,
    y: event.clientY,
    offsetX: cropOffset.value.x,
    offsetY: cropOffset.value.y
  }
  cropWorkspace.value?.setPointerCapture(event.pointerId)
}

function moveCropDrag(event) {
  if (!cropDragging.value || event.pointerId !== cropPointerId) return
  cropOffset.value = {
    x: cropPointerStart.offsetX + event.clientX - cropPointerStart.x,
    y: cropPointerStart.offsetY + event.clientY - cropPointerStart.y
  }
  clampCropOffset()
}

function endCropDrag(event) {
  if (event.pointerId !== cropPointerId) return
  cropDragging.value = false
  cropPointerId = null
}

function changeCropZoom(nextZoom) {
  cropZoom.value = Math.max(1, Math.min(3, nextZoom))
  nextTick(clampCropOffset)
}

function onCropWheel(event) {
  changeCropZoom(cropZoom.value + (event.deltaY > 0 ? -0.08 : 0.08))
}

function onCropKeydown(event) {
  const delta = event.shiftKey ? 10 : 2
  const movement = {
    ArrowLeft: { x: delta, y: 0 },
    ArrowRight: { x: -delta, y: 0 },
    ArrowUp: { x: 0, y: delta },
    ArrowDown: { x: 0, y: -delta }
  }[event.key]
  if (!movement) return
  event.preventDefault()
  cropOffset.value = { x: cropOffset.value.x + movement.x, y: cropOffset.value.y + movement.y }
  clampCropOffset()
}

function cancelAvatarCrop() {
  revokeCropSource()
  profileStep.value = 'edit'
  nextTick(() => avatarInput.value?.focus())
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('头像裁剪失败，请重新选择。')), 'image/webp', 0.88)
  })
}

async function confirmAvatarCrop() {
  const file = cropSourceFile.value
  if (!file || !cropFrameSize.value) return
  try {
    const source = new Image()
    source.src = cropSourceUrl.value
    await source.decode()

    const rendered = cropRenderedSize.value
    const sourceX = ((rendered.width - cropFrameSize.value) / 2 - cropOffset.value.x) / rendered.width * source.naturalWidth
    const sourceY = ((rendered.height - cropFrameSize.value) / 2 - cropOffset.value.y) / rendered.height * source.naturalHeight
    const sourceSize = cropFrameSize.value / rendered.width * source.naturalWidth
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    const context = canvas.getContext('2d', { alpha: false })
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(source, sourceX, sourceY, sourceSize, sourceSize, 0, 0, 512, 512)
    const blob = await canvasToBlob(canvas)
    const filename = `${file.name.replace(/\.[^.]+$/, '') || 'avatar'}-cropped.webp`

    revokeAvatarPreview()
    avatarFile.value = new File([blob], filename, { type: 'image/webp', lastModified: Date.now() })
    avatarPreviewUrl.value = URL.createObjectURL(blob)
    profilePreviewFailed.value = false
    revokeCropSource()
    profileStep.value = 'edit'
  } catch (error) {
    profileErrors.value = { ...profileErrors.value, avatar: error?.message || '头像裁剪失败，请重新选择。' }
    profileStep.value = 'edit'
    revokeCropSource()
  }
}

async function uploadAvatar(file) {
  profileMessage.value = '正在上传裁剪后的头像…'
  const form = new FormData()
  form.append('avatar', file, file.name)
  const response = await request('/avatar/upload', 'POST', form, { timeout: 60000 })
  if (!responseOkay(response)) {
    throw new Error(responseMessage(response, '头像上传失败，请稍后重试。'))
  }
  avatarUploadProgress.value = 100
  return response.data.avatar_url
}

function persistProfileUser(updatedUser) {
  userInfo.value = updatedUser
  const localUser = safeJsonParse(localStorage.getItem('userInfo'), {})
  localStorage.setItem('userInfo', JSON.stringify({ ...localUser, ...updatedUser }))
}

async function saveProfile() {
  const fields = Object.keys(profileForm.value).filter(field => field !== 'realName')
  const payload = {}
  fields.forEach(field => {
    const current = normalizedProfileValue(field, profileForm.value[field])
    const original = normalizedProfileValue(field, profileOriginal.value[field])
    if (current !== original) payload[field] = current
  })

  if (!Object.keys(payload).length && !avatarFile.value) {
    profileMessage.value = '没有需要保存的资料变更。'
    profileSaveState.value = 'error'
    return
  }

  const valid = Object.keys(payload).every(validateProfileField) && !profileErrors.value.avatar
  if (!valid) {
    profileMessage.value = '请先修正标记的资料项。'
    profileSaveState.value = 'error'
    return
  }

  profileSaveState.value = 'loading'
  profileMessage.value = ''
  let updatedUser = { ...userInfo.value }

  if (Object.keys(payload).length) {
    const response = await request('/user/profile', 'PUT', payload)
    if (!responseOkay(response)) {
      const field = response?.data?.field
      if (field && Object.prototype.hasOwnProperty.call(profileForm.value, field)) {
        profileErrors.value = { ...profileErrors.value, [field]: responseMessage(response, '请检查这一项。') }
      }
      profileMessage.value = responseMessage(response, '资料保存失败，请稍后重试。')
      profileSaveState.value = 'error'
      return
    }
    updatedUser = { ...updatedUser, ...response.data.data.userInfo }
  }

  try {
    if (avatarFile.value) {
      const avatar = await uploadAvatar(avatarFile.value)
      updatedUser = { ...updatedUser, avatar }
    }
  } catch (error) {
    persistProfileUser(updatedUser)
    if (Object.keys(payload).length) profileOriginal.value = { ...profileForm.value }
    const avatarError = error?.message || '头像上传失败，请稍后重试。'
    profileMessage.value = Object.keys(payload).length
      ? `其他资料已保存；${avatarError}`
      : avatarError
    profileSaveState.value = 'error'
    return
  }

  persistProfileUser(updatedUser)
  profileOriginal.value = { ...profileForm.value }
  avatarFailed.value = false
  clearAvatarSelection()
  profileMessage.value = '资料已保存，主页内容已更新。'
  profileSaveState.value = 'success'
}

function validateFeedbackField(field) {
  const value = String(feedbackForm.value[field] || '').trim()
  let message = ''
  if (field === 'category' && !['suggestion', 'bug', 'content', 'other'].includes(value)) {
    message = '请选择有效的反馈类型。'
  }
  if (field === 'content' && Array.from(value).length < 5) {
    message = '反馈内容至少需要 5 个字符。'
  }
  if (field === 'content' && Array.from(value).length > 1000) {
    message = '反馈内容最多 1000 个字符。'
  }
  if (field === 'contact' && !value) {
    message = '请填写微信号。'
  }
  if (field === 'contact' && Array.from(value).length > 100) {
    message = '联系方式最多 100 个字符。'
  }
  feedbackErrors.value = { ...feedbackErrors.value, [field]: message }
  return !message
}

function onFeedbackInput(field) {
  feedbackMessage.value = ''
  if (feedbackSaveState.value !== 'loading') feedbackSaveState.value = 'idle'
  if (Object.prototype.hasOwnProperty.call(feedbackErrors.value, field)) validateFeedbackField(field)
}

function onFeedbackImagesChosen(event) {
  const files = Array.from(event.target.files || [])
  event.target.value = ''
  feedbackErrors.value = { ...feedbackErrors.value, images: '' }
  feedbackMessage.value = ''
  if (feedbackSaveState.value !== 'loading') feedbackSaveState.value = 'idle'
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
  for (const file of files) {
    if (feedbackImages.value.length >= 9) {
      feedbackErrors.value = { ...feedbackErrors.value, images: '最多上传 9 张图片。' }
      break
    }
    if (!allowedTypes.has(file.type)) {
      feedbackErrors.value = { ...feedbackErrors.value, images: `${file.name} 格式不支持。` }
      continue
    }
    if (file.size > 10 * 1024 * 1024) {
      feedbackErrors.value = { ...feedbackErrors.value, images: `${file.name} 超过 10MB。` }
      continue
    }
    feedbackImages.value.push({
      uid: `feedback-image-${Date.now()}-${feedbackImageSequence++}`,
      file,
      preview: URL.createObjectURL(file)
    })
  }
}

function removeFeedbackImage(uid) {
  const index = feedbackImages.value.findIndex(image => image.uid === uid)
  if (index < 0) return
  URL.revokeObjectURL(feedbackImages.value[index].preview)
  feedbackImages.value.splice(index, 1)
  feedbackErrors.value = { ...feedbackErrors.value, images: '' }
}

function clearFeedbackImages() {
  feedbackImages.value.forEach(image => URL.revokeObjectURL(image.preview))
  feedbackImages.value = []
  feedbackUploadProgress.value = { current: 0, total: 0 }
}

async function uploadFeedbackImage(file) {
  const data = new FormData()
  data.append('file', file)
  const response = await request('/feedback/upload', 'POST', data)
  if (!responseOkay(response)) throw new Error(responseMessage(response, '图片上传失败，请稍后重试。'))
  return response.data.data
}

async function submitFeedback() {
  const valid = ['category', 'content', 'contact'].map(validateFeedbackField).every(Boolean)
  if (!valid) {
    feedbackMessage.value = '请先修正标记的反馈内容。'
    feedbackSaveState.value = 'error'
    return
  }

  feedbackSaveState.value = 'loading'
  feedbackMessage.value = ''
  let response
  try {
    const uploadedImages = []
    feedbackUploadProgress.value = { current: 0, total: feedbackImages.value.length }
    for (const image of feedbackImages.value) {
      uploadedImages.push(await uploadFeedbackImage(image.file))
      feedbackUploadProgress.value = { ...feedbackUploadProgress.value, current: feedbackUploadProgress.value.current + 1 }
    }
    feedbackUploadProgress.value = { current: 0, total: 0 }
    response = await request('/feedback', 'POST', {
      category: feedbackForm.value.category,
      content: feedbackForm.value.content.trim(),
      contact: feedbackForm.value.contact.trim(),
      images: uploadedImages
    })
  } catch (error) {
    feedbackUploadProgress.value = { current: 0, total: 0 }
    feedbackErrors.value = { ...feedbackErrors.value, images: error?.message || '图片上传失败，请稍后重试。' }
    feedbackMessage.value = '反馈尚未提交，请检查图片后重试。'
    feedbackSaveState.value = 'error'
    return
  }

  if (!responseOkay(response)) {
    const field = response?.data?.field
    if (field === 'images') {
      feedbackErrors.value = { ...feedbackErrors.value, images: responseMessage(response, '请重新选择反馈图片。') }
    } else if (field && Object.prototype.hasOwnProperty.call(feedbackForm.value, field)) {
      feedbackErrors.value = { ...feedbackErrors.value, [field]: responseMessage(response, '请检查这一项。') }
    }
    feedbackMessage.value = responseMessage(response, '反馈提交失败，请稍后重试。')
    feedbackSaveState.value = 'error'
    return
  }

  feedbackHistory.value = [response.data.data.feedback, ...feedbackHistory.value]
  feedbackForm.value = { ...feedbackForm.value, content: '', contact: '' }
  clearFeedbackImages()
  feedbackErrors.value = {}
  feedbackMessage.value = '反馈已提交，可在下方查看处理状态。'
  feedbackSaveState.value = 'success'
}

function openCommandPalette() {
  commandQuery.value = ''
  commandIndex.value = 0
  commandDialog.value?.showModal()
  nextTick(() => commandInput.value?.focus())
}

function closeCommandPalette() {
  commandDialog.value?.close()
}

function resetCommandPalette() {
  commandQuery.value = ''
  commandIndex.value = 0
}

function handleCommandBackdrop(event) {
  if (event.target === commandDialog.value) closeCommandPalette()
}

function moveCommand(direction) {
  if (!filteredCommands.value.length) return
  commandIndex.value = (commandIndex.value + direction + filteredCommands.value.length) % filteredCommands.value.length
}

function runSelectedCommand() {
  const command = filteredCommands.value[commandIndex.value]
  if (command) executeCommand(command)
}

function executeCommand(command) {
  closeCommandPalette()
  nextTick(() => command.run())
}

function openProfileFromCommand() {
  openProfileDialog()
}

function focusFeedbackFromCommand() {
  feedbackExpanded.value = true
  document.getElementById('feedback')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' })
  nextTick(() => document.getElementById('feedback-content')?.focus({ preventScroll: true }))
}

function logout() {
  localStorage.removeItem('token')
  localStorage.removeItem('userInfo')
  sessionStorage.removeItem('MYCHECKINS_USER_V1')
  sessionStorage.removeItem('MYCHECKINS_UNLOCK_SET_V1')
  router.replace('/signin')
}

function reducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function onGlobalKeydown(event) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    if (commandDialog.value?.open) closeCommandPalette()
    else openCommandPalette()
  }
}

onMounted(() => {
  document.title = '个人主页｜笃行校园探索'
  window.addEventListener('keydown', onGlobalKeydown)
  fetchDashboard()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
  if (profileDialog.value?.open) profileDialog.value.close()
  if (commandDialog.value?.open) commandDialog.value.close()
  revokeAvatarPreview()
  clearFeedbackImages()
})
</script>

<style src="../styles/profile.css"></style>
