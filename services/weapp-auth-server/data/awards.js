// data/awards.js
// 奖项配置：第六部分 最佳创意奖 / 最佳摄影奖
// 修改这里的配置即可调整截止时间、投稿数量、图片大小等规则
module.exports = {
  // 投稿截止时间（北京时间）
  deadline: '2026-09-20T23:59:59+08:00',

  // 每个用户在每个奖项最多可提交几份（用于防止重复提交）
  perUserPerCategory: 1,

  // 每份作品最多上传图片数量
  maxImagesPerWork: 3,

  // 单张图片大小上限（MB）
  maxImageMB: 10,

  // 允许的图片类型
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],

  categories: [
    {
      id: 'creative',
      name: '最佳创意奖',
      shortName: '创意',
      icon: '💡',
      description: '用独特的视角与脑洞，展现你对校园的创意表达。',
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
      requirements: [
        '作品须为本人拍摄',
        '围绕校园打卡点取景',
        '填写作品名称与拍摄说明'
      ]
    }
  ]
};
