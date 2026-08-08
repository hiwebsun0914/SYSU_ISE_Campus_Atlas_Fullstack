// data/awards.js
// 奖项配置：第六部分 最佳创意奖 / 最佳摄影奖
// 修改这里的配置即可调整截止时间、投稿数量、图片大小等规则
module.exports = {
  // 投稿 / 点赞等活动截止时间（北京时间），之后普通用户只能浏览
  deadline: '2026-09-16T23:59:59+08:00',

  // 颁奖时间（用于前端展示）
  awardCeremony: '2026-09-19 迎新晚会后',

  // 每个用户在每个奖项最多可提交几份（用于防止重复提交）
  perUserPerCategory: 1,

  // 每份作品上传图片数量（本活动每份作品 1 张）
  maxImagesPerWork: 1,

  // 单张图片大小上限（MB）
  maxImageMB: 10,

  // 每个用户每天最多投票数（防止刷票）
  maxVotesPerDay: 3,

  // 允许的图片类型
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],

  categories: [
    {
      id: 'creative',
      name: '最佳创意奖',
      shortName: '创意',
      icon: '💡',
      description: '用独特的视角与脑洞，展现你对校园的创意表达。',
      welcome: '当大家在打卡学校地标的时候，不妨和三五好友一起，拍下有创意的照片，可以是一起摆出有趣的组合动作，也可以在镜头中与建筑物互动，发挥你的想法，拍下创意作品，提交到最佳创意奖作品区。',
      requirements: [
        '围绕校园打卡点进行创意创作',
        '图片清晰，内容积极向上',
        '填写作品名称与作品说明'
      ]
    },
    {
      id: 'photography',
      name: '最佳摄影奖',
      shortName: '摄影',
      icon: '📷',
      description: '用镜头记录校园最美瞬间，让更多人看到你眼中的风景。',
      welcome: '如果你想留下学校古朴建筑的美丽瞬间，发挥你的才能，抓拍学校不一样的风景，投稿至最佳摄影奖。',
      requirements: [
        '作品须为本人拍摄',
        '围绕校园打卡点取景',
        '填写作品名称与拍摄说明'
      ]
    }
  ],

  // 获奖等级（管理员在审核后台为作品设置）
  winnerRanks: [
    { id: 'first',   label: '一等奖' },
    { id: 'second',  label: '二等奖' },
    { id: 'third',   label: '三等奖' },
    { id: 'popular', label: '人气奖' }
  ]
};
