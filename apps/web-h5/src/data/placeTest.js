const option = (label, scores = {}, sub = null, badges = []) => ({ label, scores, sub, badges })

export const SIGNALS = ['ACT', 'PLAN', 'OPEN', 'SOLO', 'MASTER', 'OUTPUT', 'ANCHOR', 'BOND', 'NOVEL', 'RANGE']

export const questions = [
  {
    id: 1,
    prompt: '小组作业群安静得像停服了，你会：',
    options: [
      option('我先丢一句：那我们怎么分工？', { ACT: 2, OPEN: 2, BOND: 1 }, 'MAPS', ['groupStarter']),
      option('先列个框架，再把文档链接发群里', { PLAN: 2, OUTPUT: 1, ACT: 1 }, 'BASE'),
      option('等有人起头，我负责把自己的部分做好', { SOLO: 1, OUTPUT: 2 }, 'STAY'),
      option('群聊先放着，DDL会替大家说话', { OUTPUT: 1, ACT: -1 }, 'RUN', ['ddlIgniter'])
    ]
  },
  {
    id: 2,
    prompt: '距离DDL还有七天，你的文件夹通常是：',
    options: [
      option('已经有01资料、02草稿、03终稿', { PLAN: 2, OUTPUT: 2 }, 'BASE'),
      option('资料看了不少，正文还在酝酿', { MASTER: 2, PLAN: 1 }, 'WIKI'),
      option('先做别的，最后两天效率会自己上线', { ACT: -1, OUTPUT: 2 }, 'RUN', ['ddlIgniter']),
      option('建了个空文档，至少心理上开工了', { ACT: 1, PLAN: 1 }, 'STAY', ['ddlIgniter'])
    ]
  },
  {
    id: 3,
    prompt: '碰到一门越学越上头的课，你会：',
    options: [
      option('顺手把老师没展开的部分也查了', { MASTER: 2, RANGE: 1 }, 'WIKI', ['aiVerifier']),
      option('先想办法把作业和考试拿下', { OUTPUT: 2, PLAN: 1 }, 'BASE'),
      option('拉个人一起交换资料和吐槽', { BOND: 2, OPEN: 1 }, 'STAY'),
      option('兴奋两周，然后被下一门课拐走', { NOVEL: 2, MASTER: 1 }, 'MAPS')
    ]
  },
  {
    id: 4,
    prompt: '老师说“这部分大家自己下去看看”，你会：',
    options: [
      option('真的会去看，甚至多开三个标签页', { MASTER: 2, PLAN: 1 }, 'WIKI', ['aiVerifier']),
      option('先记个星号，考前再决定它重不重要', { PLAN: 1, OUTPUT: 1 }, 'BASE'),
      option('问问同学到底要看到什么程度', { BOND: 1, OUTPUT: 1 }, 'STAY'),
      option('听懂了“下去”，没有听懂“看看”', { ACT: -1, PLAN: -1 }, 'RUN', ['ddlIgniter'])
    ]
  },
  {
    id: 5,
    prompt: '要选一门和专业没太大关系的公选课，你会：',
    options: [
      option('选一直想学但没机会学的', { MASTER: 2, NOVEL: 1 }, 'WIKI'),
      option('选作业清楚、评价稳定的', { PLAN: 2, OUTPUT: 1 }, 'BASE'),
      option('跟认识的人一起选，体验比较重要', { BOND: 2, OPEN: 1 }, 'STAY'),
      option('名字最怪的那门，看看到底教什么', { NOVEL: 2, RANGE: 1 }, 'MAPS')
    ]
  },
  {
    id: 6,
    prompt: '突然多出一个完整的周六，你会怎么安排？',
    options: [
      option('把一直拖着的事一口气清掉', { ACT: 2, OUTPUT: 2 }, 'BASE'),
      option('提前排好去哪、吃什么、几点回', { PLAN: 2, RANGE: 1 }, 'MAPS'),
      option('睡醒再说，状态比计划可靠', { SOLO: 2, PLAN: -1 }, 'STAY'),
      option('临时去一个从没认真逛过的地方', { NOVEL: 2, RANGE: 2 }, 'RUN', ['detour'])
    ]
  },
  {
    id: 7,
    prompt: '要做一个不太有把握的决定时，你通常会：',
    options: [
      option('先选一个方向，走两步再修正', { ACT: 2, NOVEL: 1 }, 'RUN'),
      option('查资料、列利弊，最好还能量化', { PLAN: 2, MASTER: 1 }, 'WIKI', ['aiVerifier']),
      option('找信任的人聊聊，看自己漏了什么', { BOND: 2, OPEN: 1 }, 'STAY'),
      option('再等等，也许事情会替我做决定', { ACT: -1, PLAN: -1 }, 'BASE')
    ]
  },
  {
    id: 8,
    prompt: '作业卡住半小时，你更可能：',
    options: [
      option('换一种办法继续顶，先让它动起来', { ACT: 2, OUTPUT: 2 }, 'RUN'),
      option('回头补原理，没搞懂会一直难受', { MASTER: 2, PLAN: 1 }, 'WIKI'),
      option('把问题整理好，去问同学或老师', { OPEN: 1, BOND: 1, OUTPUT: 1 }, 'STAY'),
      option('先交给AI，再把关键步骤逐个验一遍', { OUTPUT: 2, MASTER: 1 }, 'MAPS', ['aiVerifier'])
    ]
  },
  {
    id: 9,
    prompt: '新群建好五分钟还没人说第一句，你会：',
    options: [
      option('我来：大家好，我们先对一下信息？', { OPEN: 2, ACT: 2 }, 'MAPS', ['groupStarter']),
      option('发个表情，先测试一下群有没有活人', { OPEN: 1, NOVEL: 1 }, 'LENS', ['groupStarter']),
      option('等群主发言比较合理', { PLAN: 1, SOLO: 1 }, 'BASE'),
      option('只要别突然@全体成员就好', { SOLO: 2, OPEN: -1 }, 'STAY')
    ]
  },
  {
    id: 10,
    prompt: '到了一个几乎谁都不认识的活动，你会：',
    options: [
      option('先和旁边的人聊两句再说', { OPEN: 2, ACT: 1 }, 'RUN', ['groupStarter']),
      option('找到一个熟人就自动进入安全区', { BOND: 2, ANCHOR: 1 }, 'BASE'),
      option('先观察现场，等一个自然的开口机会', { SOLO: 1, OPEN: 1 }, 'LENS'),
      option('逛完想看的就走，一个人也挺完整', { SOLO: 2, MASTER: 1 }, 'LENS')
    ]
  },
  {
    id: 11,
    prompt: '朋友来找你吐槽一件很烦的事，你会：',
    options: [
      option('先听完，暂时不急着给方案', { BOND: 2, SOLO: 1 }, 'STAY'),
      option('一起拆问题，看看下一步能做什么', { OUTPUT: 2, BOND: 1 }, 'MAPS'),
      option('先帮他确认：这事确实很离谱', { OPEN: 1, BOND: 2 }, 'LENS'),
      option('约出来走一圈，边走边讲比较顺', { RANGE: 1, BOND: 2 }, 'RUN', ['detour'])
    ]
  },
  {
    id: 12,
    prompt: '午饭时间到了，你会：',
    options: [
      option('群里问一句：有人一起吗？', { OPEN: 2, BOND: 2 }, 'BASE', ['mealCaller']),
      option('找固定饭搭子，不必重新组队', { ANCHOR: 2, BOND: 2 }, 'BASE', ['mealCaller']),
      option('一个人吃，顺便把脑子静音', { SOLO: 2, ANCHOR: 1 }, 'STAY'),
      option('今天想换个没吃过的窗口', { NOVEL: 2, RANGE: 1 }, 'MAPS')
    ]
  },
  {
    id: 13,
    prompt: '连续社交一整天以后，你通常会：',
    options: [
      option('还可以，甚至能再续一场', { OPEN: 2, BOND: 1 }, 'RUN'),
      option('只想自己慢慢走回去', { SOLO: 2, RANGE: 1 }, 'STAY', ['detour']),
      option('和最熟的人待着不算继续社交', { BOND: 2, ANCHOR: 1 }, 'BASE'),
      option('戴上耳机，进入校园隐身模式', { SOLO: 2, OPEN: -1 }, 'LENS')
    ]
  },
  {
    id: 14,
    prompt: '路过一个看起来挺热闹的校园活动，你会：',
    options: [
      option('进去看看，来都来了', { NOVEL: 2, ACT: 1 }, 'RUN'),
      option('先看推送，确认是不是我会喜欢的', { PLAN: 1, MASTER: 1 }, 'WIKI'),
      option('叫个人一起，独自进去有点突兀', { BOND: 2, OPEN: 1 }, 'MAPS'),
      option('在人群外面看两分钟也算参与', { SOLO: 1, NOVEL: 1 }, 'LENS')
    ]
  },
  {
    id: 15,
    prompt: '走进常去的课室或图书馆，你通常会：',
    options: [
      option('下意识走向那几个熟悉的位置', { ANCHOR: 2, PLAN: 1 }, 'BASE', ['fixedSeat']),
      option('哪里空坐哪里，座位只是座位', { ANCHOR: -1, ACT: 1 }, 'RUN'),
      option('换一边坐，看看今天会不会更专注', { NOVEL: 1, MASTER: 1 }, 'LENS'),
      option('先看插座、空调和旁边坐了谁', { PLAN: 2, BOND: 1 }, 'MAPS', ['fixedSeat'])
    ]
  },
  {
    id: 16,
    prompt: '下课回宿舍，前面有两条路，你会：',
    options: [
      option('当然走最快的，今天的步数够了', { OUTPUT: 1, ANCHOR: 1 }, 'BASE'),
      option('看天气，舒服就走那条远一点的', { RANGE: 2, NOVEL: 1 }, 'RUN', ['detour']),
      option('跟着同行的人走，去哪都行', { BOND: 2, PLAN: -1 }, 'STAY'),
      option('随机拐，反正校园里总能绕回来', { RANGE: 2, NOVEL: 2 }, 'MAPS', ['detour'])
    ]
  },
  {
    id: 17,
    prompt: '两节课之间突然空出一小时，你会：',
    options: [
      option('找地方把一个小任务做完', { OUTPUT: 2, PLAN: 1 }, 'BASE'),
      option('找个安静角落，什么都不安排', { SOLO: 2, ANCHOR: 1 }, 'LENS'),
      option('问问附近的人要不要去吃点东西', { OPEN: 1, BOND: 2 }, 'RUN', ['mealCaller']),
      option('去附近一栋没进过的楼周围看看', { RANGE: 2, NOVEL: 2 }, 'WIKI', ['detour'])
    ]
  },
  {
    id: 18,
    prompt: '看到校园墙上有人讨论一件新鲜事，你会：',
    options: [
      option('顺着评论区把前因后果补齐', { MASTER: 1, RANGE: 1 }, 'WIKI'),
      option('转给朋友：你快看这个', { BOND: 2, OPEN: 1 }, 'MAPS'),
      option('先存着，过两天可能就有反转', { PLAN: 1, SOLO: 1 }, 'WIKI', ['aiVerifier']),
      option('看完就走，信息流里短暂路过', { NOVEL: 1, ANCHOR: -1 }, 'LENS')
    ]
  },
  {
    id: 19,
    prompt: '路过一栋名字很陌生的红楼，你会：',
    options: [
      option('看一眼门牌，再搜搜它以前做什么', { MASTER: 2, RANGE: 1 }, 'WIKI'),
      option('先拍下来，回去大概率会忘记搜', { NOVEL: 1, RANGE: 1 }, 'LENS'),
      option('如果同行的人停下，我也会看看', { BOND: 1, ACT: -1 }, 'LENS'),
      option('记住位置，下次专门来收这一格', { PLAN: 1, RANGE: 2 }, 'MAPS')
    ]
  },
  {
    id: 20,
    prompt: '手机相册里的校园照片更像：',
    options: [
      option('建筑、树影、湖面，几乎没人', { SOLO: 1, MASTER: 1 }, 'LENS', ['photoKeeper']),
      option('合照和聊天截图，人物是重点', { BOND: 2, OPEN: 1 }, 'STAY'),
      option('路过随手拍，构图靠现场运气', { NOVEL: 2, RANGE: 1 }, 'LENS', ['photoKeeper']),
      option('门牌和地图截图，方便以后再找', { PLAN: 1, RANGE: 2 }, 'MAPS')
    ]
  },
  {
    id: 21,
    prompt: '去食堂时，你的选择逻辑通常是：',
    options: [
      option('固定窗口，稳定比惊喜重要', { ANCHOR: 2, OUTPUT: 1 }, 'BASE', ['fixedSeat']),
      option('看队伍，哪边快去哪边', { OUTPUT: 2, PLAN: 1 }, 'RUN'),
      option('同行的人想吃什么就吃什么', { BOND: 2, ANCHOR: -1 }, 'STAY', ['mealCaller']),
      option('总得试试那个一直没吃过的', { NOVEL: 2, RANGE: 1 }, 'MAPS')
    ]
  },
  {
    id: 22,
    prompt: 'AI给了一个看起来很完整的答案，你会：',
    options: [
      option('关键数据和引用我会再查一遍', { MASTER: 2, PLAN: 1 }, 'WIKI', ['aiVerifier']),
      option('能用就先用，交付以后再说', { OUTPUT: 2, ACT: 1 }, 'RUN'),
      option('拿它当草稿，最后一定改成自己的话', { MASTER: 1, OUTPUT: 2 }, 'WIKI', ['aiVerifier']),
      option('再问一个AI，看看它们会不会打起来', { NOVEL: 2, MASTER: 1 }, 'MAPS', ['aiVerifier'])
    ]
  },
  {
    id: 23,
    prompt: 'DDL真的开始贴脸了，你会：',
    options: [
      option('进入超频模式，几个小时顶平时一天', { ACT: 2, OUTPUT: 2 }, 'RUN', ['ddlIgniter']),
      option('按清单逐项关门，一个都别漏', { PLAN: 2, OUTPUT: 2 }, 'BASE'),
      option('先找人互相报进度，不然容易掉线', { BOND: 2, OPEN: 1 }, 'STAY'),
      option('开始研究为什么我每次都这样', { MASTER: 1, ACT: -1 }, 'WIKI', ['ddlIgniter'])
    ]
  },
  {
    id: 24,
    prompt: '错过一节信息量很大的课，你会：',
    options: [
      option('立刻找课件和录播补上', { ACT: 2, PLAN: 1 }, 'WIKI'),
      option('借同学笔记，顺便问重点在哪', { BOND: 2, OUTPUT: 1 }, 'STAY'),
      option('先把知识点搜明白，再回来看课程', { MASTER: 2, RANGE: 1 }, 'WIKI', ['aiVerifier']),
      option('等复习周的我统一处理', { ACT: -1, OUTPUT: 1 }, 'RUN', ['ddlIgniter'])
    ]
  },
  {
    id: 25,
    prompt: '加入一个社团或项目以后，你通常会：',
    options: [
      option('会想把一件具体的事长期做深', { MASTER: 2, PLAN: 1 }, 'WIKI'),
      option('更在意认识到什么样的人', { BOND: 2, OPEN: 1 }, 'STAY'),
      option('有明确产出和节点会更有动力', { OUTPUT: 2, ACT: 1 }, 'BASE'),
      option('先把不同岗位都体验一点', { NOVEL: 2, RANGE: 1 }, 'MAPS')
    ]
  },
  {
    id: 26,
    prompt: '在校园里走到一条不熟的路，你会：',
    options: [
      option('打开地图，确认它最后通去哪', { PLAN: 2, RANGE: 1 }, 'MAPS'),
      option('继续走，走错也算解锁新路线', { RANGE: 2, NOVEL: 2 }, 'RUN', ['detour']),
      option('原路返回，今天没必要开新副本', { ANCHOR: 2, PLAN: 1 }, 'BASE'),
      option('先看看光线和周围建筑，慢点走', { SOLO: 1, MASTER: 1 }, 'LENS')
    ]
  },
  {
    id: 27,
    prompt: '状态不太好，但也不想一直闷着，你会：',
    options: [
      option('一个人去熟悉的地方待会儿', { SOLO: 2, ANCHOR: 2 }, 'BASE', ['fixedSeat']),
      option('找最熟的人散散步，不必解决问题', { BOND: 2, RANGE: 1 }, 'STAY'),
      option('去运动一下，把脑内缓存清掉', { ACT: 2, OUTPUT: 1 }, 'RUN'),
      option('换个没去过的地方，让注意力转移', { NOVEL: 2, RANGE: 2 }, 'MAPS', ['detour'])
    ]
  },
  {
    id: 28,
    prompt: '毕业以后，你觉得自己最容易记住的是：',
    options: [
      option('反复坐过的座位和走过的近路', { ANCHOR: 2, SOLO: 1 }, 'BASE', ['fixedSeat']),
      option('和具体的人一起发生过的事', { BOND: 2, OPEN: 1 }, 'STAY'),
      option('那些第一次去、后来却常去的地方', { NOVEL: 1, RANGE: 2 }, 'MAPS'),
      option('终于做成的项目和熬过的节点', { OUTPUT: 2, MASTER: 1 }, 'RUN', ['ddlIgniter'])
    ]
  }
]

export const mainTypes = {
  GROW: {
    name: '长期积累型',
    hook: '这条技能树不急着满级，但我会一直点下去。',
    intro: '你习惯把大学生活过成一条长线：慢慢积累、持续加点，比一时热闹更重要。',
    color: '#2F4F4F',
    vector: [75, 65, 50, 50, 85, 55, 50, 50, 55, 45]
  },
  SIDE: {
    name: '兴趣拓展型',
    hook: '主线还在加载，兴趣支线已经全开。',
    intro: '你的注意力会被有意思的东西牵走。专业是主线，但远远不是全部地图。',
    color: '#B8860B',
    vector: [50, 35, 45, 55, 80, 35, 35, 45, 85, 60]
  },
  DONE: {
    name: '目标完成型',
    hook: '事情没显示“已完成”，我就很难真正下线。',
    intro: '你喜欢把模糊的事情变成清单、节点和最终成果，完成感就是稳定电源。',
    color: '#8C1515',
    vector: [85, 80, 55, 45, 55, 90, 50, 50, 45, 40]
  },
  DDL: {
    name: '临期爆发型',
    displayCode: 'DDL!',
    hook: 'DDL一靠近，我的CPU才肯开始超频。',
    intro: '你不是一直高速运转的人，但临界点一到，整套系统会突然接管现场。',
    color: '#8C1515',
    vector: [30, 35, 45, 50, 45, 85, 40, 45, 55, 45]
  },
  HOST: {
    name: '主动组织型',
    hook: '群聊再沉默三秒，我就要发第一句了。',
    intro: '你擅长让事情从“大家都在看”进入“那我们开始吧”，也常替一群人按下开场键。',
    color: '#8C1515',
    vector: [75, 60, 90, 30, 50, 55, 45, 85, 60, 50]
  },
  SYNC: {
    name: '同伴同行型',
    hook: '搭子不必全能，频道对上就行。',
    intro: '你不需要把所有人拉进同一个圈子。找到对得上频道的人，体验就完整了。',
    color: '#2F4F4F',
    vector: [45, 45, 40, 60, 50, 45, 45, 85, 55, 45]
  },
  TRY: {
    name: '新鲜体验型',
    displayCode: 'TRY!',
    hook: '课表之外，大学生活也得逐项试玩。',
    intro: '你愿意替生活点开新选项。没试过不等于不适合，先体验一次再判断。',
    color: '#B8860B',
    vector: [75, 45, 55, 45, 55, 45, 30, 50, 90, 85]
  },
  PING: {
    name: '随性探索型',
    hook: '我只是随便走走，随机事件自己刷出来了。',
    intro: '你更相信现场而不是攻略。路线可以临时改，很多好体验本来就没有预告。',
    color: '#2F4F4F',
    vector: [40, 30, 40, 55, 45, 35, 35, 45, 85, 65]
  }
}

export const signalWeights = [1.25, 0.75, 1, 0.35, 1.25, 1.25, 0.35, 1.25, 1.25, 0.75]

export const subTypes = {
  STAY: { name: '慢节奏停留型', note: '比起赶景点，你更擅长把一个地方慢慢待成自己的时间。' },
  MAPS: { name: '地标收集型', note: '门牌、地标和隐藏角落，会自动在你脑内变成待解锁图标。' },
  RUN: { name: '路线探索型', note: '你喜欢把地点连成路线，走过去这件事本身就是体验。' },
  LENS: { name: '视觉观察型', note: '光线、屋檐和水面倒影，比“到此一游”更容易让你停下。' },
  WIKI: { name: '维基百科型', note: '一栋楼叫什么、以前做什么，会直接决定它在你眼里的清晰度。' },
  BASE: { name: '熟悉地点型', note: '反复回到同一个地方，会让校园慢慢长出属于你的坐标。' }
}

export const badgeDefs = {
  ddlIgniter: { name: 'DDL 点火器', group: 'study' },
  groupStarter: { name: '小组开场键', group: 'social' },
  fixedSeat: { name: '固定座位拥有者', group: 'place' },
  mealCaller: { name: '饭搭子召集令', group: 'social' },
  aiVerifier: { name: 'AI 二次核验员', group: 'study' },
  detour: { name: '回宿舍绕路选手', group: 'place' },
  photoKeeper: { name: '私人相册管理员', group: 'place' }
}
