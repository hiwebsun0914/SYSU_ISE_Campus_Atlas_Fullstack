const option = (label, scores = {}, sub = null, badges = []) => ({ label, scores, sub, badges })

export const SIGNALS = ['ACT', 'PLAN', 'OPEN', 'SOLO', 'MASTER', 'OUTPUT', 'ANCHOR', 'BOND', 'NOVEL', 'RANGE']

export const questions = [
  {
    id: 1,
    prompt: '小组作业群安静得像停服了。',
    options: [
      option('我先丢一句：那我们怎么分工？', { ACT: 2, OPEN: 2, BOND: 1 }, 'MAPS', ['groupStarter']),
      option('先列个框架，再把文档链接发群里', { PLAN: 2, OUTPUT: 1, ACT: 1 }, 'BASE'),
      option('等有人起头，我负责把自己的部分做好', { SOLO: 1, OUTPUT: 2 }, 'TREE'),
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
      option('建了个空文档，至少心理上开工了', { ACT: 1, PLAN: 1 }, 'TREE', ['ddlIgniter'])
    ]
  },
  {
    id: 3,
    prompt: '碰到一门越学越上头的课。',
    options: [
      option('顺手把老师没展开的部分也查了', { MASTER: 2, RANGE: 1 }, 'WIKI', ['aiVerifier']),
      option('先想办法把作业和考试拿下', { OUTPUT: 2, PLAN: 1 }, 'BASE'),
      option('拉个人一起交换资料和吐槽', { BOND: 2, OPEN: 1 }, 'TREE'),
      option('兴奋两周，然后被下一门课拐走', { NOVEL: 2, MASTER: 1 }, 'MAPS')
    ]
  },
  {
    id: 4,
    prompt: '老师说“这部分大家自己下去看看”。',
    options: [
      option('真的会去看，甚至多开三个标签页', { MASTER: 2, PLAN: 1 }, 'WIKI', ['aiVerifier']),
      option('先记个星号，考前再决定它重不重要', { PLAN: 1, OUTPUT: 1 }, 'BASE'),
      option('问问同学到底要看到什么程度', { BOND: 1, OUTPUT: 1 }, 'TREE'),
      option('听懂了“下去”，没有听懂“看看”', { ACT: -1, PLAN: -1 }, 'RUN', ['ddlIgniter'])
    ]
  },
  {
    id: 5,
    prompt: '选一门和专业没太大关系的公选课。',
    options: [
      option('选一直想学但没机会学的', { MASTER: 2, NOVEL: 1 }, 'WIKI'),
      option('选作业清楚、评价稳定的', { PLAN: 2, OUTPUT: 1 }, 'BASE'),
      option('跟认识的人一起选，体验比较重要', { BOND: 2, OPEN: 1 }, 'TREE'),
      option('名字最怪的那门，看看到底教什么', { NOVEL: 2, RANGE: 1 }, 'MAPS')
    ]
  },
  {
    id: 6,
    prompt: '突然多出一个完整的周六。',
    options: [
      option('把一直拖着的事一口气清掉', { ACT: 2, OUTPUT: 2 }, 'BASE'),
      option('提前排好去哪、吃什么、几点回', { PLAN: 2, RANGE: 1 }, 'MAPS'),
      option('睡醒再说，状态比计划可靠', { SOLO: 2, PLAN: -1 }, 'TREE'),
      option('临时去一个从没认真逛过的地方', { NOVEL: 2, RANGE: 2 }, 'RUN', ['detour'])
    ]
  },
  {
    id: 7,
    prompt: '要做一个不太有把握的决定。',
    options: [
      option('先选一个方向，走两步再修正', { ACT: 2, NOVEL: 1 }, 'RUN'),
      option('查资料、列利弊，最好还能量化', { PLAN: 2, MASTER: 1 }, 'WIKI', ['aiVerifier']),
      option('找信任的人聊聊，看自己漏了什么', { BOND: 2, OPEN: 1 }, 'TREE'),
      option('再等等，也许事情会替我做决定', { ACT: -1, PLAN: -1 }, 'BASE')
    ]
  },
  {
    id: 8,
    prompt: '作业卡住半小时，你更可能：',
    options: [
      option('换一种办法继续顶，先让它动起来', { ACT: 2, OUTPUT: 2 }, 'RUN'),
      option('回头补原理，没搞懂会一直难受', { MASTER: 2, PLAN: 1 }, 'WIKI'),
      option('把问题整理好，去问同学或老师', { OPEN: 1, BOND: 1, OUTPUT: 1 }, 'TREE'),
      option('先交给AI，再把关键步骤逐个验一遍', { OUTPUT: 2, MASTER: 1 }, 'MAPS', ['aiVerifier'])
    ]
  },
  {
    id: 9,
    prompt: '新群建好五分钟，没人说第一句。',
    options: [
      option('我来：大家好，我们先对一下信息？', { OPEN: 2, ACT: 2 }, 'MAPS', ['groupStarter']),
      option('发个表情，先测试一下群有没有活人', { OPEN: 1, NOVEL: 1 }, 'LENS', ['groupStarter']),
      option('等群主发言比较合理', { PLAN: 1, SOLO: 1 }, 'BASE'),
      option('只要别突然@全体成员就好', { SOLO: 2, OPEN: -1 }, 'TREE')
    ]
  },
  {
    id: 10,
    prompt: '到了一个几乎谁都不认识的活动。',
    options: [
      option('先和旁边的人聊两句再说', { OPEN: 2, ACT: 1 }, 'RUN', ['groupStarter']),
      option('找到一个熟人就自动进入安全区', { BOND: 2, ANCHOR: 1 }, 'BASE'),
      option('先观察现场，等一个自然的开口机会', { SOLO: 1, OPEN: 1 }, 'LENS'),
      option('逛完想看的就走，一个人也挺完整', { SOLO: 2, MASTER: 1 }, 'LENS')
    ]
  },
  {
    id: 11,
    prompt: '朋友来找你吐槽一件很烦的事。',
    options: [
      option('先听完，暂时不急着给方案', { BOND: 2, SOLO: 1 }, 'TREE'),
      option('一起拆问题，看看下一步能做什么', { OUTPUT: 2, BOND: 1 }, 'MAPS'),
      option('先帮他确认：这事确实很离谱', { OPEN: 1, BOND: 2 }, 'LENS'),
      option('约出来走一圈，边走边讲比较顺', { RANGE: 1, BOND: 2 }, 'RUN', ['detour'])
    ]
  },
  {
    id: 12,
    prompt: '午饭时间到了。',
    options: [
      option('群里问一句：有人一起吗？', { OPEN: 2, BOND: 2 }, 'BASE', ['mealCaller']),
      option('找固定饭搭子，不必重新组队', { ANCHOR: 2, BOND: 2 }, 'BASE', ['mealCaller']),
      option('一个人吃，顺便把脑子静音', { SOLO: 2, ANCHOR: 1 }, 'TREE'),
      option('今天想换个没吃过的窗口', { NOVEL: 2, RANGE: 1 }, 'MAPS')
    ]
  },
  {
    id: 13,
    prompt: '连续社交一整天以后。',
    options: [
      option('还可以，甚至能再续一场', { OPEN: 2, BOND: 1 }, 'RUN'),
      option('只想自己慢慢走回去', { SOLO: 2, RANGE: 1 }, 'TREE', ['detour']),
      option('和最熟的人待着不算继续社交', { BOND: 2, ANCHOR: 1 }, 'BASE'),
      option('戴上耳机，进入校园隐身模式', { SOLO: 2, OPEN: -1 }, 'LENS')
    ]
  },
  {
    id: 14,
    prompt: '路过一个看起来挺热闹的校园活动。',
    options: [
      option('进去看看，来都来了', { NOVEL: 2, ACT: 1 }, 'RUN'),
      option('先看推送，确认是不是我会喜欢的', { PLAN: 1, MASTER: 1 }, 'WIKI'),
      option('叫个人一起，独自进去有点突兀', { BOND: 2, OPEN: 1 }, 'MAPS'),
      option('在人群外面看两分钟也算参与', { SOLO: 1, NOVEL: 1 }, 'LENS')
    ]
  },
  {
    id: 15,
    prompt: '走进常去的课室或图书馆。',
    options: [
      option('下意识走向那几个熟悉的位置', { ANCHOR: 2, PLAN: 1 }, 'BASE', ['fixedSeat']),
      option('哪里空坐哪里，座位只是座位', { ANCHOR: -1, ACT: 1 }, 'RUN'),
      option('换一边坐，看看今天会不会更专注', { NOVEL: 1, MASTER: 1 }, 'LENS'),
      option('先看插座、空调和旁边坐了谁', { PLAN: 2, BOND: 1 }, 'MAPS', ['fixedSeat'])
    ]
  },
  {
    id: 16,
    prompt: '下课回宿舍，前面有两条路。',
    options: [
      option('当然走最快的，今天的步数够了', { OUTPUT: 1, ANCHOR: 1 }, 'BASE'),
      option('看天气，舒服就走那条远一点的', { RANGE: 2, NOVEL: 1 }, 'RUN', ['detour']),
      option('跟着同行的人走，去哪都行', { BOND: 2, PLAN: -1 }, 'TREE'),
      option('随机拐，反正校园里总能绕回来', { RANGE: 2, NOVEL: 2 }, 'MAPS', ['detour'])
    ]
  },
  {
    id: 17,
    prompt: '两节课之间突然空出一小时。',
    options: [
      option('找地方把一个小任务做完', { OUTPUT: 2, PLAN: 1 }, 'BASE'),
      option('找个安静角落，什么都不安排', { SOLO: 2, ANCHOR: 1 }, 'LENS'),
      option('问问附近的人要不要去吃点东西', { OPEN: 1, BOND: 2 }, 'RUN', ['mealCaller']),
      option('去附近一栋没进过的楼周围看看', { RANGE: 2, NOVEL: 2 }, 'WIKI', ['detour'])
    ]
  },
  {
    id: 18,
    prompt: '看到校园墙上有人讨论一件新鲜事。',
    options: [
      option('顺着评论区把前因后果补齐', { MASTER: 1, RANGE: 1 }, 'WIKI'),
      option('转给朋友：你快看这个', { BOND: 2, OPEN: 1 }, 'MAPS'),
      option('先存着，过两天可能就有反转', { PLAN: 1, SOLO: 1 }, 'WIKI', ['aiVerifier']),
      option('看完就走，信息流里短暂路过', { NOVEL: 1, ANCHOR: -1 }, 'LENS')
    ]
  },
  {
    id: 19,
    prompt: '路过一栋名字很陌生的红楼。',
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
      option('合照和聊天截图，人物是重点', { BOND: 2, OPEN: 1 }, 'TREE'),
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
      option('同行的人想吃什么就吃什么', { BOND: 2, ANCHOR: -1 }, 'TREE', ['mealCaller']),
      option('总得试试那个一直没吃过的', { NOVEL: 2, RANGE: 1 }, 'MAPS')
    ]
  },
  {
    id: 22,
    prompt: 'AI给了一个看起来很完整的答案。',
    options: [
      option('关键数据和引用我会再查一遍', { MASTER: 2, PLAN: 1 }, 'WIKI', ['aiVerifier']),
      option('能用就先用，交付以后再说', { OUTPUT: 2, ACT: 1 }, 'RUN'),
      option('拿它当草稿，最后一定改成自己的话', { MASTER: 1, OUTPUT: 2 }, 'WIKI', ['aiVerifier']),
      option('再问一个AI，看看它们会不会打起来', { NOVEL: 2, MASTER: 1 }, 'MAPS', ['aiVerifier'])
    ]
  },
  {
    id: 23,
    prompt: 'DDL真的开始贴脸了。',
    options: [
      option('进入超频模式，几个小时顶平时一天', { ACT: 2, OUTPUT: 2 }, 'RUN', ['ddlIgniter']),
      option('按清单逐项关门，一个都别漏', { PLAN: 2, OUTPUT: 2 }, 'BASE'),
      option('先找人互相报进度，不然容易掉线', { BOND: 2, OPEN: 1 }, 'TREE'),
      option('开始研究为什么我每次都这样', { MASTER: 1, ACT: -1 }, 'WIKI', ['ddlIgniter'])
    ]
  },
  {
    id: 24,
    prompt: '错过一节信息量很大的课。',
    options: [
      option('立刻找课件和录播补上', { ACT: 2, PLAN: 1 }, 'WIKI'),
      option('借同学笔记，顺便问重点在哪', { BOND: 2, OUTPUT: 1 }, 'TREE'),
      option('先把知识点搜明白，再回来看课程', { MASTER: 2, RANGE: 1 }, 'WIKI', ['aiVerifier']),
      option('等复习周的我统一处理', { ACT: -1, OUTPUT: 1 }, 'RUN', ['ddlIgniter'])
    ]
  },
  {
    id: 25,
    prompt: '加入一个社团或项目以后。',
    options: [
      option('会想把一件具体的事长期做深', { MASTER: 2, PLAN: 1 }, 'WIKI'),
      option('更在意认识到什么样的人', { BOND: 2, OPEN: 1 }, 'TREE'),
      option('有明确产出和节点会更有动力', { OUTPUT: 2, ACT: 1 }, 'BASE'),
      option('先把不同岗位都体验一点', { NOVEL: 2, RANGE: 1 }, 'MAPS')
    ]
  },
  {
    id: 26,
    prompt: '在校园里走到一条不熟的路。',
    options: [
      option('打开地图，确认它最后通去哪', { PLAN: 2, RANGE: 1 }, 'MAPS'),
      option('继续走，走错也算解锁新路线', { RANGE: 2, NOVEL: 2 }, 'RUN', ['detour']),
      option('原路返回，今天没必要开新副本', { ANCHOR: 2, PLAN: 1 }, 'BASE'),
      option('先看看光线和周围建筑，慢点走', { SOLO: 1, MASTER: 1 }, 'LENS')
    ]
  },
  {
    id: 27,
    prompt: '状态不太好，但也不想一直闷着。',
    options: [
      option('一个人去熟悉的地方待会儿', { SOLO: 2, ANCHOR: 2 }, 'BASE', ['fixedSeat']),
      option('找最熟的人散散步，不必解决问题', { BOND: 2, RANGE: 1 }, 'TREE'),
      option('去运动一下，把脑内缓存清掉', { ACT: 2, OUTPUT: 1 }, 'RUN'),
      option('换个没去过的地方，让注意力转移', { NOVEL: 2, RANGE: 2 }, 'MAPS', ['detour'])
    ]
  },
  {
    id: 28,
    prompt: '毕业以后，你觉得自己最容易记住的是：',
    options: [
      option('反复坐过的座位和走过的近路', { ANCHOR: 2, SOLO: 1 }, 'BASE', ['fixedSeat']),
      option('和具体的人一起发生过的事', { BOND: 2, OPEN: 1 }, 'TREE'),
      option('那些第一次去、后来却常去的地方', { NOVEL: 1, RANGE: 2 }, 'MAPS'),
      option('终于做成的项目和熬过的节点', { OUTPUT: 2, MASTER: 1 }, 'RUN', ['ddlIgniter'])
    ]
  }
]

export const mainTypes = {
  GROW: {
    name: '长线练级人',
    hook: '这条技能树不急着满级，但我会一直点下去。',
    intro: '你习惯把大学生活过成一条长线：慢慢积累、持续加点，比一时热闹更重要。',
    color: '#2F4F4F',
    vector: [75, 65, 50, 50, 85, 55, 50, 50, 55, 45]
  },
  SIDE: {
    name: '兴趣杂食生',
    hook: '主线还在加载，兴趣支线已经全开。',
    intro: '你的注意力会被有意思的东西牵走。专业是主线，但远远不是全部地图。',
    color: '#B8860B',
    vector: [50, 35, 45, 55, 80, 35, 35, 45, 85, 60]
  },
  DONE: {
    name: '结项专业户',
    hook: '事情没显示“已完成”，我就很难真正下线。',
    intro: '你喜欢把模糊的事情变成清单、节点和最终成果，完成感就是稳定电源。',
    color: '#8C1515',
    vector: [85, 80, 55, 45, 55, 90, 50, 50, 45, 40]
  },
  DDL: {
    name: '截止线爆发户',
    displayCode: 'DDL!',
    hook: 'DDL一靠近，我的CPU才肯开始超频。',
    intro: '你不是一直高速运转的人，但临界点一到，整套系统会突然接管现场。',
    color: '#8C1515',
    vector: [30, 35, 45, 50, 45, 85, 40, 45, 55, 45]
  },
  HOST: {
    name: '群聊开场人',
    hook: '群聊再沉默三秒，我就要发第一句了。',
    intro: '你擅长让事情从“大家都在看”进入“那我们开始吧”，也常替一群人按下开场键。',
    color: '#8C1515',
    vector: [75, 60, 90, 30, 50, 55, 45, 85, 60, 50]
  },
  SYNC: {
    name: '同频搭子体',
    hook: '搭子不必全能，频道对上就行。',
    intro: '你不需要把所有人拉进同一个圈子。找到对得上频道的人，体验就完整了。',
    color: '#2F4F4F',
    vector: [45, 45, 40, 60, 50, 45, 45, 85, 55, 45]
  },
  TRY: {
    name: '校园尝鲜家',
    displayCode: 'TRY!',
    hook: '课表之外，大学生活也得逐项试玩。',
    intro: '你愿意替生活点开新选项。没试过不等于不适合，先体验一次再判断。',
    color: '#B8860B',
    vector: [75, 45, 55, 45, 55, 45, 30, 50, 90, 85]
  },
  PING: {
    name: '偶遇体质',
    hook: '我只是随便走走，随机事件自己刷出来了。',
    intro: '你更相信现场而不是攻略。路线可以临时改，很多好体验本来就没有预告。',
    color: '#2F4F4F',
    vector: [40, 30, 40, 55, 45, 35, 35, 45, 85, 65]
  }
}

export const signalWeights = [1.25, 0.75, 1, 0.35, 1.25, 1.25, 0.35, 1.25, 1.25, 0.75]

export const subTypes = {
  TREE: { name: '榕树下挂机人', note: '比起赶景点，你更擅长把一个地方慢慢待成自己的时间。' },
  MAPS: { name: '地图全收集玩家', note: '门牌、地标和隐藏角落，会自动在你脑内变成待解锁图标。' },
  RUN: { name: '下课即远征', note: '你喜欢把地点连成路线，走过去这件事本身就是体验。' },
  LENS: { name: '康乐园摄影蹲点王', note: '光线、屋檐和水面倒影，比“到此一游”更容易让你停下。' },
  WIKI: { name: '建筑考古学家', note: '一栋楼叫什么、以前做什么，会直接决定它在你眼里的清晰度。' },
  BASE: { name: '固定据点守护者', note: '反复回到同一个地方，会让校园慢慢长出属于你的坐标。' }
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

export const places = [
  { id: 20, name: '附属小学方亭', zone: 'northeast', tags: ['TREE', 'LENS', 'WIKI'], mains: ['SIDE', 'SYNC', 'HOST'], energy: ['low', 'mid'], company: ['solo', 'pair', 'group'], times: ['morning', 'afternoon', 'evening'], experiences: ['chill', 'photo', 'history'], access: '户外可达', fact: '红砖配宝蓝琉璃瓦，这座方亭的建成时间早于1932年。' },
  { id: 32, name: '竹种标本园', zone: 'northeast', tags: ['TREE', 'WIKI', 'LENS'], mains: ['GROW', 'SIDE', 'TRY'], energy: ['low', 'mid'], company: ['solo', 'pair'], times: ['morning', 'afternoon'], experiences: ['chill', 'photo', 'history', 'surprise'], access: '户外可达', fact: '这里由竹类分类学家莫古礼主持建立，保留着多种竹类活体标本。' },
  { id: 66, name: '松园湖', zone: 'northeast', tags: ['TREE', 'LENS', 'BASE'], mains: ['PING', 'GROW', 'DDL'], energy: ['low', 'mid'], company: ['solo', 'pair'], times: ['morning', 'afternoon', 'evening'], experiences: ['chill', 'photo', 'move'], access: '户外可达', fact: '松园湖是康乐园现存“四湖”之一。' },
  { id: 96, name: '园西湖', zone: 'west', tags: ['TREE', 'RUN', 'LENS'], mains: ['SYNC', 'DDL', 'PING'], energy: ['low', 'mid', 'high'], company: ['solo', 'pair'], times: ['morning', 'afternoon', 'evening'], experiences: ['chill', 'photo', 'move'], access: '户外可达', fact: '园西湖保留了康乐园旧日湖泊系统的一段水面。' },
  { id: 22, name: '中山大学南门', zone: 'south', tags: ['MAPS', 'LENS'], mains: ['DDL', 'HOST', 'TRY'], energy: ['low', 'mid'], company: ['solo', 'pair', 'group'], times: ['morning', 'afternoon', 'evening', 'night'], experiences: ['photo', 'surprise'], access: '户外可达', fact: '南门落在校园中轴线南端，是最直接的一枚中大坐标。' },
  { id: 71, name: '北门牌坊', zone: 'north', tags: ['MAPS', 'LENS', 'WIKI'], mains: ['DONE', 'TRY', 'HOST'], energy: ['mid', 'high'], company: ['solo', 'pair', 'group'], times: ['morning', 'afternoon', 'evening'], experiences: ['photo', 'history', 'move'], access: '户外可达', fact: '眼前的牌坊建于2001年，原型来自1935年的五山旧校址。' },
  { id: 83, name: '乙丑进士牌坊', zone: 'northwest', tags: ['MAPS', 'WIKI', 'LENS'], mains: ['SIDE', 'SYNC', 'DONE'], energy: ['low', 'mid'], company: ['solo', 'pair'], times: ['morning', 'afternoon'], experiences: ['photo', 'history', 'surprise'], access: '户外可达', fact: '这座1635年的石牌坊，后来从广州城内迁进了校园。' },
  { id: 85, name: '孙中山先生铜像', zone: 'center', tags: ['MAPS', 'WIKI', 'LENS'], mains: ['GROW', 'HOST', 'DONE'], energy: ['low', 'mid'], company: ['solo', 'pair', 'group'], times: ['morning', 'afternoon', 'evening'], experiences: ['photo', 'history', 'move'], access: '户外可达', fact: '铜像于1931年铸成，1956年从石牌迁到康乐园。' },
  { id: 38, name: '西大操场', zone: 'northwest', tags: ['RUN', 'BASE', 'MAPS'], mains: ['GROW', 'PING', 'HOST'], energy: ['mid', 'high'], company: ['solo', 'pair', 'group'], times: ['morning', 'afternoon', 'evening'], experiences: ['move', 'surprise'], access: '户外可达', fact: '这片老校园运动场建成于1945年。' },
  { id: 59, name: '英东体育馆', zone: 'southwest', tags: ['RUN', 'MAPS', 'LENS'], mains: ['TRY', 'HOST', 'DONE'], energy: ['mid', 'high'], company: ['solo', 'pair', 'group'], times: ['morning', 'afternoon', 'evening'], experiences: ['move', 'photo', 'surprise'], access: '室内视活动开放，外观可看', fact: '英东体育馆在1991年投入使用，装下过比赛、晚会和毕业典礼。' },
  { id: 61, name: '“摇篮”铜像', zone: 'northeast', tags: ['RUN', 'LENS', 'WIKI'], mains: ['SYNC', 'DDL', 'PING'], energy: ['low', 'mid'], company: ['solo', 'pair'], times: ['morning', 'afternoon', 'evening'], experiences: ['move', 'photo', 'history'], access: '户外可达', fact: '这座“摇篮”由海内外校友会在校庆时共同捐建。' },
  { id: 98, name: '中山大学西门', zone: 'west', tags: ['RUN', 'MAPS'], mains: ['SIDE', 'PING', 'TRY'], energy: ['mid', 'high'], company: ['solo', 'pair'], times: ['morning', 'afternoon', 'evening', 'night'], experiences: ['move', 'surprise'], access: '户外可达', fact: '它叫西门，门的朝向却不是正西。' },
  { id: 14, name: '格兰堂', zone: 'northeast', tags: ['LENS', 'WIKI', 'MAPS'], mains: ['GROW', 'TRY', 'DDL'], energy: ['low', 'mid'], company: ['solo', 'pair', 'group'], times: ['morning', 'afternoon'], experiences: ['photo', 'history'], access: '默认参观外观', fact: '格兰堂落成于1916年，楼顶大钟曾掌管校园作息。' },
  { id: 50, name: '怀士堂', zone: 'center', tags: ['LENS', 'WIKI', 'MAPS'], mains: ['HOST', 'PING', 'DONE'], energy: ['low', 'mid'], company: ['solo', 'pair', 'group'], times: ['morning', 'afternoon', 'evening'], experiences: ['photo', 'history'], access: '默认参观外观', fact: '哥特式双塔和中国式屋顶，被放进了同一栋怀士堂。' },
  { id: 82, name: '八角亭', zone: 'northwest', tags: ['LENS', 'WIKI', 'TREE'], mains: ['SIDE', 'SYNC', 'PING'], energy: ['low', 'mid'], company: ['solo', 'pair'], times: ['morning', 'afternoon'], experiences: ['photo', 'history', 'chill', 'surprise'], access: '户外可达', fact: '它曾做过果店和消费合作社，亭顶至今藏着水果篮。' },
  { id: 91, name: '永芳堂', zone: 'center', tags: ['LENS', 'WIKI', 'MAPS'], mains: ['DONE', 'TRY', 'GROW'], energy: ['low', 'mid'], company: ['solo', 'pair'], times: ['morning', 'afternoon'], experiences: ['photo', 'history'], access: '默认参观外观', fact: '1990年兴建的永芳堂，改造后换上红墙绿瓦和拱廊。' },
  { id: 16, name: '马丁堂', zone: 'northeast', tags: ['WIKI', 'LENS', 'MAPS'], mains: ['GROW', 'DDL', 'TRY'], energy: ['low', 'mid'], company: ['solo', 'pair'], times: ['morning', 'afternoon'], experiences: ['history', 'photo'], access: '默认参观外观', fact: '1906年落成的马丁堂，是康乐园第一栋永久建筑。' },
  { id: 54, name: '黑石屋', zone: 'northeast', tags: ['WIKI', 'LENS', 'MAPS'], mains: ['SIDE', 'PING', 'SYNC'], energy: ['low', 'mid'], company: ['solo', 'pair'], times: ['morning', 'afternoon'], experiences: ['history', 'photo', 'surprise'], access: '不对外开放，仅看外观', fact: '钟荣光曾住在这里，宋庆龄也曾来此避难。' },
  { id: 81, name: '中山大学博物馆', zone: 'northwest', tags: ['WIKI', 'MAPS', 'BASE'], mains: ['DONE', 'TRY', 'HOST'], energy: ['low', 'mid'], company: ['solo', 'pair', 'group'], times: ['morning', 'afternoon'], experiences: ['history', 'surprise'], access: '开放状态需现场确认', fact: '这里延续着中大文物馆和多个专业博物馆的收藏传统。' },
  { id: 86, name: '史达理堂', zone: 'northwest', tags: ['WIKI', 'LENS'], mains: ['GROW', 'DONE', 'SIDE'], energy: ['low', 'mid'], company: ['solo', 'pair'], times: ['morning', 'afternoon'], experiences: ['history', 'photo'], access: '默认参观外观', fact: '物理、化学、生物和植物标本室，曾经都在这栋楼里。' },
  { id: 12, name: '图书馆', zone: 'northeast', tags: ['BASE', 'WIKI'], mains: ['GROW', 'DONE', 'DDL'], energy: ['low', 'mid'], company: ['solo', 'pair'], times: ['morning', 'afternoon', 'evening'], experiences: ['chill', 'history'], access: '入馆规则以现场为准', fact: '中大图书馆的建设可以追溯到1924年。' },
  { id: 18, name: '南草坪餐厅', zone: 'south', tags: ['BASE', 'TREE'], mains: ['SYNC', 'HOST', 'DDL'], energy: ['low', 'mid'], company: ['solo', 'pair', 'group'], times: ['morning', 'afternoon', 'evening'], experiences: ['eat', 'chill'], access: '营业时间以现场为准', fact: '对许多学生来说，食堂也是南草坪一带最日常的社交坐标。' },
  { id: 64, name: '松涛园', zone: 'southwest', tags: ['BASE', 'MAPS'], mains: ['HOST', 'DDL', 'TRY'], energy: ['low', 'mid'], company: ['solo', 'pair', 'group'], times: ['morning', 'afternoon', 'evening'], experiences: ['eat', 'chill', 'surprise'], access: '营业时间以现场为准', fact: '新松涛园把康乐园的红墙碧瓦带进了学生日常。' },
  { id: 93, name: '学人书境', zone: 'northwest', tags: ['BASE', 'WIKI', 'LENS'], mains: ['SIDE', 'PING', 'SYNC'], energy: ['low'], company: ['solo', 'pair'], times: ['morning', 'afternoon'], experiences: ['chill', 'history', 'surprise'], access: '开放状态需现场确认', fact: '这间老红楼书店集中陈列中大学人的著作和校园出版物。' }
]

const rec = (placeId, line, task) => ({ placeId, line, task })

export const recommendations = {
  GROW: {
    TREE: rec(32, '从莫古礼主持建园到今天，这条竹子技能树已经点了近百年。', '找一种以前没认真看过的竹子，把名字记下来。'),
    MAPS: rec(16, '康乐园第一栋永久建筑，适合从校园地图的“第一格”开始。', '找到门楣上的年份，收下这枚校园起始坐标。'),
    RUN: rec(38, '这片1945年建成的操场很懂：长线升级，本来就是一圈一圈跑出来的。', '不用计配速，沿操场完整走或跑一圈。'),
    LENS: rec(14, '抬头找找那口曾经管着全校园上下课的大钟，时间也有自己的取景框。', '不拍全楼，只拍大钟或一个拱券。'),
    WIKI: rec(86, '物理、化学、生物曾在同一栋楼里生长，你应该会喜欢这棵老学术树。', '找一个学科留下的建筑细节，再读一遍它的旧用途。'),
    BASE: rec(12, '中大从1924年开始攒下的知识仓库，很适合做你的长期存档点。', '选一个愿意下次再来的位置，安静坐十分钟。')
  },
  SIDE: {
    TREE: rec(20, '红砖配宝蓝瓦，没什么正事也值得在这里坐一会儿。', '找个不挡路的位置，允许自己发五分钟呆。'),
    MAPS: rec(83, '一座1635年的牌坊从广州城里搬进校园，这条支线藏得够深。', '找到石额上的四个字，把这条支线收进地图。'),
    RUN: rec(98, '它叫西门，却朝南开；很适合专程去解锁一个校园冷知识。', '到了以后别原路返回，换一条路绕回去。'),
    LENS: rec(82, '亭顶藏着水果篮，屋檐下还有龙头，细节比第一眼热闹得多。', '只拍一个最奇怪的装饰，不必拍全景。'),
    WIKI: rec(54, '钟荣光住过，宋庆龄也曾来此避难；一栋小楼塞进了好几段大历史。', '只看外观，找找这栋住宅和教学楼有什么不同。'),
    BASE: rec(93, '红楼里藏着书、校史和纪念品，主线不急，先翻翻感兴趣的那页。', '从书架上随机挑一本，读完目录再决定走不走。')
  },
  DONE: {
    TREE: rec(66, '康乐园旧日十三处湖泊只留下四处，今天先安静勾掉其中一格。', '沿湖走一小段，到一个舒服的位置就停。'),
    MAPS: rec(71, '眼前这座是2001年的复刻版，原型却要追到1935年的五山校址。', '站到牌坊正面，收下一张端正的坐标照。'),
    RUN: rec(85, '铜像从石牌迁到康乐园，路线会结束，坐标还在继续接力。', '从铜像沿中轴线再走一个路口，给今天的路线收尾。'),
    LENS: rec(91, '旧楼换上红墙绿瓦，新旧两个版本正好收进同一张图里。', '找一处新材料和旧校园风格相接的地方。'),
    WIKI: rec(81, '与其散着看，不如把校园里的旧物、标本和故事一次归档。', '若当天开放，只选一个展区完整看完。'),
    BASE: rec(12, '中大从1924年开始整理这座知识仓库，今天也适合把一件事稳稳关掉。', '找个位置完成一个明确的小任务，再离开。')
  },
  DDL: {
    TREE: rec(96, '先沿湖走半圈，让过热的大脑重新连上网。', '只走十分钟，回来继续处理最要紧的那一件。'),
    MAPS: rec(22, '不绕路，先拿下最经典的中大坐标，再回去赶DDL。', '拍下门额就算完成，不给自己加新任务。'),
    RUN: rec(61, '校友为母校留下的“摇篮”，适合拿来当十分钟快走的折返点。', '走到铜像再返回，路线到此为止。'),
    LENS: rec(14, '那口大钟以前管上下课，现在正好替你盯一下时间。', '给自己十分钟，只拍大钟和拱券。'),
    WIKI: rec(16, '只看一个知识点就够了：中国早期钢筋混凝土校园建筑，就在这里。', '找到AD1905，今天的校史阅读立刻结项。'),
    BASE: rec(64, '红墙碧瓦里面装着最现实的补给，先把电量和血条拉回来。', '吃完或坐十分钟，然后只处理最靠近截止线的任务。')
  },
  HOST: {
    TREE: rec(20, '小亭子不用预约，也不用正式开场，坐下自然就能聊起来。', '把“你以前注意过这个蓝瓦亭吗”当作第一句。'),
    MAPS: rec(85, '先在中轴线上集合，剩下的路线交给现场最会张罗的人。', '让每个人选一个接下来想去的方向。'),
    RUN: rec(59, '从1991年起，这里就没少装下比赛、晚会和人群的声浪。', '看看今天有没有活动，再决定要不要叫人加入。'),
    LENS: rec(50, '哥特双塔配中式屋顶，合照还没拍，话题已经有了。', '让同行的人各挑一个最喜欢的屋顶细节。'),
    WIKI: rec(81, '每个人挑一件最想讲的东西，一场临时导览就能开张。', '若当天开放，轮流选一件展品讲一分钟。'),
    BASE: rec(64, '几层楼、几种口味，总有一张桌子能把人凑齐。', '发一句“有人在附近吗”，不用把聚餐策划成项目。')
  },
  SYNC: {
    TREE: rec(96, '不必一直聊天，沿湖慢慢走也算一种对上频道。', '并肩走十分钟，安静也不用急着填满。'),
    MAPS: rec(83, '一起找到这座从老广州迁来的牌坊，冷知识就算成功共享。', '一个人找年份，一个人找石刻名字。'),
    RUN: rec(61, '从湖边走到铜像，距离刚好够两个人把一件小事聊完。', '走到铜像折返，不必临时再加目的地。'),
    LENS: rec(82, '你看屋顶的水果篮，搭子找屋檐下的龙头，各拍各的也很同步。', '各拍一个细节，最后再交换照片。'),
    WIKI: rec(86, '一栋楼装过四种学科，适合两个人各挑一条故事线。', '各自找一个旧学科留下的线索，再交换答案。'),
    BASE: rec(18, '真正稳定的搭子关系，往往从一句“今天吃什么”开始。', '各自提一个想吃的，二选一，不开第三轮会议。')
  },
  TRY: {
    TREE: rec(32, '先别把竹子都叫竹子，这里至少能把校园散步玩成物种副本。', '找到两种不同名字的竹子，再慢慢离开。'),
    MAPS: rec(71, '走到珠江边，收下一枚从五山旧校址复刻而来的校园坐标。', '从牌坊下看一次江景，把这格正式点亮。'),
    RUN: rec(59, '这次不只路过，去看看康乐园的体育副本今天刷了什么。', '绕体育馆走一圈，看到活动就停两分钟。'),
    LENS: rec(14, '五个大拱券加一口老钟，是初次拍康乐园很稳的开场。', '试一次对称构图，再拍一张完全不对称的。'),
    WIKI: rec(81, '先让标本、文物和校史替你随机发一张体验卡。', '若当天开放，不查攻略，先进第一个吸引你的展区。'),
    BASE: rec(64, '校园体验不全在景点里，食堂这枚生活坐标也该认真试一格。', '选一个从没吃过的窗口，只试这一次。')
  },
  PING: {
    TREE: rec(66, '去湖边发一会儿呆，随机事件通常比计划晚几分钟出现。', '找个位置待五分钟，先别拿出手机。'),
    MAPS: rec(98, '一扇不朝西的西门，已经替今天的偶遇写好了开头。', '到门口以后随机选一条没走过的回程。'),
    RUN: rec(38, '绕着老操场走一圈，可能先碰见熟人，也可能先碰见一场球。', '不设配速，看到有意思的事就停。'),
    LENS: rec(50, '光落在红墙和蓝绿瓦上的时候，康乐园很容易自己出片。', '不提前找机位，让第一束好看的光替你决定。'),
    WIKI: rec(54, '看似安静的红楼，背后却接着钟荣光、宋庆龄与孙中山的故事线。', '只看外观，现场挑一个最想回去查的人名。'),
    BASE: rec(93, '本来只想找地方坐坐，最后带走哪本书就交给书架决定。', '从第一眼看到的书架开始，不必先想好要找什么。')
  }
}

export const origins = [
  { id: 'south', label: '南门／第一教学楼', zone: 'south' },
  { id: 'library', label: '图书馆／格兰堂', zone: 'northeast' },
  { id: 'martin', label: '马丁堂／竹种标本园', zone: 'northeast' },
  { id: 'axis', label: '孙中山铜像／怀士堂', zone: 'center' },
  { id: 'westfield', label: '西大操场／学人书境', zone: 'northwest' },
  { id: 'north', label: '北门牌坊／珠江边', zone: 'north' },
  { id: 'songtao', label: '松涛园／松园湖', zone: 'southwest' },
  { id: 'gym', label: '英东体育馆／园西湖', zone: 'southwest' },
  { id: 'canteen', label: '康乐园餐厅／蒲园食堂', zone: 'west' },
  { id: 'westgate', label: '西门／小西门', zone: 'west' }
]

export const todayFields = [
  {
    id: 'time',
    eyebrow: '01 / TIME',
    prompt: '现在是哪一段校园时间？',
    options: [
      { value: 'morning', label: '早上', note: '空气还没完全热起来' },
      { value: 'afternoon', label: '下午', note: '适合认真走一段' },
      { value: 'evening', label: '傍晚', note: '光线开始变软' },
      { value: 'night', label: '晚上', note: '只去开放、好走的地方' }
    ]
  },
  {
    id: 'energy',
    eyebrow: '02 / ENERGY',
    prompt: '今天的电量还剩多少？',
    options: [
      { value: 'low', label: '低电量', note: '能出门已经很不错' },
      { value: 'mid', label: '正常续航', note: '走一会儿没问题' },
      { value: 'high', label: '电量溢出', note: '最好给我一条路线' }
    ]
  },
  {
    id: 'company',
    eyebrow: '03 / COMPANY',
    prompt: '这次怎么出发？',
    options: [
      { value: 'solo', label: '一个人', note: '耳机和我就够了' },
      { value: 'pair', label: '和一个搭子', note: '两个人的频道刚好' },
      { value: 'group', label: '一小群人', note: '需要一个好集合点' }
    ]
  },
  {
    id: 'range',
    eyebrow: '04 / RANGE',
    prompt: '今天愿意走多远？',
    options: [
      { value: 'near', label: '就在附近', note: '大约5–8分钟' },
      { value: 'detour', label: '可以绕一下', note: '大约10–15分钟' },
      { value: 'walk', label: '想认真走走', note: '大约20–30分钟' },
      { value: 'any', label: '今天随便逛', note: '距离不设限' }
    ]
  },
  {
    id: 'experience',
    eyebrow: '05 / MOOD',
    prompt: '现在更想要哪种体验？',
    options: [
      { value: 'chill', label: '找地方坐坐', note: '暂时不赶下一件事' },
      { value: 'photo', label: '拍点好看的', note: '让相册多一张校园' },
      { value: 'history', label: '听一个旧故事', note: '路过不再只是路过' },
      { value: 'move', label: '走起来', note: '用脚给大脑清缓存' },
      { value: 'eat', label: '先补充能量', note: '很多问题可以饭后再说' },
      { value: 'surprise', label: '交给随机事件', note: '没计划也是一种计划' }
    ]
  },
  {
    id: 'origin',
    eyebrow: '06 / START',
    prompt: '你现在大概在哪儿？',
    note: '选个最近的地标，我们从这里出发。',
    options: origins.map(item => ({ value: item.id, label: item.label, note: '在这附近' }))
  }
]

export const fallbackClosers = {
  GROW: '慢慢逛，也算在给校园经验条加点。',
  SIDE: '这条支线值得临时拐进去看看。',
  DONE: '把这一格收下，今天的校园任务就算完成。',
  DDL: '十分钟也够，先让大脑换个场景。',
  HOST: '它自带一个不错的开场话题。',
  SYNC: '不用赶路，和同频的人慢慢看就好。',
  TRY: '课表之外，再给自己加一个新体验。',
  PING: '别查攻略，到了再决定接下来往哪走。'
}

export const zonePoints = {
  south: [3, 5],
  northeast: [5, 2],
  center: [3, 3],
  northwest: [1, 2],
  north: [3, 1],
  southwest: [1, 5],
  west: [0, 4]
}
