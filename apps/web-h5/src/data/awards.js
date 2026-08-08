// src/data/awards.js
// 前端奖项展示配置（后端 /submissions/meta 会返回同样的规则，这里作为兜底）
export const AWARD_CONFIG = {
  deadline: '2026-09-20T23:59:59+08:00',
  perUserPerCategory: 1,
  maxImagesPerWork: 3,
  maxImageMB: 10,
  maxVotesPerDay: 3,
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  categories: [
    {
      id: 'creative',
      name: '最佳创意奖',
      shortName: '创意',
      icon: '💡',
      color: '#8c1515',
      description: '用独特的视角与脑洞，展现你对校园的创意表达。',
      requirements: ['围绕校园打卡点进行创意创作', '图片清晰，内容积极向上', '填写作品名称与作品说明']
    },
    {
      id: 'photography',
      name: '最佳摄影奖',
      shortName: '摄影',
      icon: '📷',
      color: '#0d9488',
      description: '用镜头记录校园最美瞬间，让更多人看到你眼中的风景。',
      requirements: ['作品须为本人拍摄', '围绕校园打卡点取景', '填写作品名称与拍摄说明']
    }
  ],
  winnerRanks: [
    { id: 'first', label: '一等奖' },
    { id: 'second', label: '二等奖' },
    { id: 'third', label: '三等奖' },
    { id: 'popular', label: '人气奖' }
  ]
}
