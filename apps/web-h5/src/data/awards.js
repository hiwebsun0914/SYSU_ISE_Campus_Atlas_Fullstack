// src/data/awards.js
// 前端奖项展示配置（后端 /submissions/meta 会返回同样的规则，这里作为兜底）
export const AWARD_CONFIG = {
  deadline: '2026-09-16T23:59:59+08:00',
  awardCeremony: '2026-09-19 迎新晚会后',
  perUserPerCategory: 1,
  maxImagesPerWork: 1,
  maxImageMB: 10,
  maxVotesPerDay: 3,
  winnerCounts: {
    creative: 5,
    photography: 2
  },
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  categories: [
    {
      id: 'creative',
      name: '最佳创意奖',
      shortName: '创意',
      icon: '💡',
      color: '#8c1515',
      description: '用独特的视角与脑洞，展现你对校园的创意表达。',
      welcome: '当大家在打卡学校地标的时候，不妨和三五好友一起，拍下有创意的照片，可以是一起摆出有趣的组合动作，也可以在镜头中与建筑物互动，发挥你的想法，拍下创意作品，提交到最佳创意奖作品区。',
      requirements: ['围绕校园打卡点进行创意创作', '图片清晰，内容积极向上', '填写作品名称与作品说明']
    },
    {
      id: 'photography',
      name: '最佳摄影奖',
      shortName: '摄影',
      icon: '📷',
      color: '#0d9488',
      description: '用镜头记录校园最美瞬间，让更多人看到你眼中的风景。',
      welcome: '如果你想留下学校古朴建筑的美丽瞬间，发挥你的才能，抓拍学校不一样的风景，投稿至最佳摄影奖。',
      requirements: ['作品须为本人拍摄', '围绕校园打卡点取景', '填写作品名称与拍摄说明']
    }
  ]
}
