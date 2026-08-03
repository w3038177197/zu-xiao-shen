export const subsidyPolicies = [
  {
    city: '杭州',
    policy: '新引进应届大学生租房补贴',
    type: '租房补贴',
    amount: '每户每年1万元，通常最长3年，期满后符合收入条件可继续享受但最长不超过3年',
    condition: '本科及以上应届毕业生来杭工作，在杭无房且未享受公共租赁住房、人才租赁房等住房优惠政策。',
    materials: ['身份证明', '学历证明', '劳动合同或创业证明', '社保缴纳记录', '租赁合同', '无房证明'],
    sourceName: '杭州市亲清在线（官方办理入口）',
    sourceUrl: 'https://qinqing.hangzhou.gov.cn/',
    applyUrl: 'https://qinqing.hangzhou.gov.cn/',
    checkedAt: '2026-06-25',
    status: '官方政策',
    keywords: ['应届', '本科', '硕士', '博士', '杭州', '无房', '社保', '租房'],
  },
  {
    city: '南京',
    policy: '高校毕业生住房租赁补贴',
    type: '租房补贴',
    amount: '博士2000元/月、硕士800元/月、学士600元/月，累计不超过36个月',
    condition: '与南京用人单位签订劳动合同并连续参保，申请时在宁无房，按“无房、学历、社保、租住状态承诺”审核。',
    materials: ['学历证明', '劳动合同', '社保记录', '租住状态承诺', '社保卡金融账户'],
    sourceName: '南京市人力资源和社会保障局',
    sourceUrl: 'https://rsj.nanjing.gov.cn/njsrlzyhshbzj/202510/t20251023_5674922.html',
    applyUrl: 'https://rsj.nanjing.gov.cn/',
    checkedAt: '2026-06-25',
    status: '官方政策',
    keywords: ['南京', '博士', '硕士', '本科', '学士', '社保', '无房', '劳动合同'],
  },
  {
    city: '武汉',
    policy: '高校毕业生租住人才租赁房租金减免',
    type: '人才租赁房',
    amount: '租住人才租赁房按不高于市场租金70%缴纳；博士、硕士有免租上限说明，累计减免期限不超过3年',
    condition: '全日制大专以上学历、毕业6年以内、在汉就业创业并正常缴纳社保、家庭在汉无自有住房。',
    materials: ['毕业证', '学历证明', '身份证', '家庭成员身份证明', '社保记录', '无房核查材料'],
    sourceName: '武汉市人民政府',
    sourceUrl: 'https://www.wuhan.gov.cn/ztzl/23zt/jzwh/zcqd/zf/202308/t20230802_2241617.shtml',
    applyUrl: 'https://www.wuhan.gov.cn/ztzl/ztfw/sqrczf/index.shtml',
    checkedAt: '2026-06-25',
    status: '官方政策',
    keywords: ['武汉', '大专', '本科', '硕士', '博士', '毕业', '社保', '无房'],
  },
  {
    city: '成都',
    policy: '成都青年人才驿站',
    type: '免费过渡住宿',
    amount: '求职应聘青年人才可申请最长30天免费入住，具体站点期限以官网为准',
    condition: '全日制大专及以上学历或在读，求职应聘成都本地企业，按站点要求上传身份证、学历、应聘证明等材料。',
    materials: ['身份证', '学历证书或学信网材料', '来蓉应聘通知或求职证明', '健康与入住承诺', '入住申请信息'],
    sourceName: '成都青年人才驿站官网',
    sourceUrl: 'https://home.cdcyl.org.cn/',
    applyUrl: 'https://home.cdcyl.org.cn/web-sys-inn',
    checkedAt: '2026-06-25',
    status: '官方平台',
    keywords: ['成都', '求职', '应届', '大专', '本科', '硕士', '免费住宿', '青年人才驿站'],
  },
  {
    city: '苏州',
    policy: '人才乐居租房补贴',
    type: '租房补贴',
    amount: '2026版月历显示：博士1500元/月、硕士1000元/月、本科800元/月',
    condition: '新引进全日制应届博士、硕士和本科生，具体申报条件以苏州人才乐居政策和经办部门口径为准。',
    materials: ['身份证明', '学历学位证明', '劳动合同', '社保记录', '租赁材料', '单位申报信息'],
    sourceName: '苏州市人民政府',
    sourceUrl: 'https://www.suzhou.gov.cn/szsrmzf/mszx/202603/f6ed78aaaafc4bc6897e60ae79f81751.shtml',
    applyUrl: 'https://hrss.suzhou.gov.cn/',
    checkedAt: '2026-06-25',
    status: '官方政策',
    keywords: ['苏州', '应届', '博士', '硕士', '本科', '租房补贴', '人才乐居'],
  },
  {
    city: '宁波',
    policy: '青年人才租房补贴',
    type: '租房补贴',
    amount: '每人每年1万元，最长发放3年',
    condition: '35周岁以下全日制应届本科或应届硕士等青年人才，在甬依法缴纳社保且无房。',
    materials: ['身份证明', '学历证明', '社保记录', '无房证明', '租赁合同', '银行卡信息'],
    sourceName: '宁波市企业综合服务平台',
    sourceUrl: 'https://qf.ningbo.gov.cn/qykj/projectDetail/50777',
    applyUrl: 'https://qf.ningbo.gov.cn/qfpt/fwbk/rcfw/',
    checkedAt: '2026-06-25',
    status: '官方政策',
    keywords: ['宁波', '应届', '本科', '硕士', '无房', '社保', '青年人才'],
  },
  {
    city: '青岛',
    policy: '高校毕业生住房补贴',
    type: '住房补贴',
    amount: '本科500元/月、硕士800元/月、博士1200元/月，具体以青岛人才网申报规则为准',
    condition: '高校毕业生在青就业创业，按青岛人才网“高校毕业生住房补贴”模块要求申报。',
    materials: ['身份证明', '学历学位证明', '就业创业证明', '社保记录', '租住或住房情况材料', '银行卡信息'],
    sourceName: '青岛政务网',
    sourceUrl: 'https://www.qingdao.gov.cn/zwgk/xxgk/rlshbz/ywfl/rcfw/202505/t20250526_9552432.shtml',
    applyUrl: 'https://rc.qingdao.gov.cn/',
    checkedAt: '2026-06-25',
    status: '官方政策',
    keywords: ['青岛', '本科', '硕士', '博士', '就业', '创业', '住房补贴'],
  },
  {
    city: '深圳',
    policy: '新引进人才租房和生活补贴',
    type: '历史政策提醒',
    amount: '官方公告说明2021年9月1日及之后新引进人才不再受理发放该补贴',
    condition: '仅对2021年8月31日及之前引进且符合原规定的人才按原规定受理，当前新引进人才需查其他最新人才政策。',
    materials: ['引进审核文件', '学历证明', '深圳户籍材料', '社保记录', '原政策申请材料'],
    sourceName: '深圳市人力资源和社会保障局',
    sourceUrl: 'https://hrss.sz.gov.cn/tzgg/content/post_8811513.html',
    applyUrl: 'https://hrss.sz.gov.cn/',
    checkedAt: '2026-06-25',
    status: '已停止新受理',
    keywords: ['深圳', '新引进', '租房', '生活补贴', '历史政策'],
  },
  {
    city: '厦门',
    policy: '大学生免费住宿保障',
    type: '免费住宿保障',
    amount: '符合条件大学生可申请累计最长不超过12个月免费住宿',
    condition: '符合厦门官方免费住宿保障实施方案的大学生，按平台要求提交申请。',
    materials: ['身份证明', '学历或学生证明', '就业或实习相关材料', '住宿申请信息', '承诺材料'],
    sourceName: '厦门市人民政府',
    sourceUrl: 'https://cloud.xm.gov.cn/165/service/2847982.xhtml',
    applyUrl: 'https://cloud.xm.gov.cn/165/service/2847982.xhtml',
    checkedAt: '2026-06-25',
    status: '官方政策',
    keywords: ['厦门', '大学生', '免费住宿', '毕业', '实习', '就业'],
  },
  {
    city: '广州',
    policy: '高校毕业生创业租金补贴',
    type: '创业租金补贴',
    amount: '高校毕业生创立企业可享每年最高6000元、累计3年的租金补贴',
    condition: '面向符合条件的创业者，不是普通居住租房补贴；需满足初创企业、经营和就业带动等要求。',
    materials: ['营业执照', '租赁合同', '社保记录', '创业者身份证明', '高校毕业生证明', '申请表'],
    sourceName: '广州市人力资源和社会保障局',
    sourceUrl: 'https://rsj.gz.gov.cn/ywzt/jycy/gzdt/content/post_10734650.html',
    applyUrl: 'https://rsj.gz.gov.cn/',
    checkedAt: '2026-06-25',
    status: '官方政策',
    keywords: ['广州', '高校毕业生', '创业', '租金补贴', '就业'],
  },
  {
    city: '北京',
    policy: '青年人才安居补贴线索',
    type: '区级安居补贴',
    amount: '部分区会发布青年人才安居补贴或人才公租房政策，具体金额、区属条件和申报窗口以属地官网为准',
    condition: '通常需要在对应区重点产业单位就业、符合应届或青年人才条件，并满足无房、社保、单位申报等要求。',
    materials: ['身份证明', '学历证明', '劳动合同', '社保记录', '无房或租住证明', '单位申报材料'],
    sourceName: '北京市海淀区人才工作局',
    sourceUrl: 'https://zyk.bjhd.gov.cn/zwdt/zcwj/202602/t20260228_4806584.shtml',
    applyUrl: 'https://zyk.bjhd.gov.cn/',
    checkedAt: '2026-06-27',
    status: '官方线索',
    keywords: ['北京', '海淀', '应届', '青年人才', '安居补贴', '无房', '社保'],
  },
  {
    city: '上海',
    policy: '保租房毕业季与青年安居线索',
    type: '保租房 / 青年安居',
    amount: '上海面向高校毕业生提供保租房房源、青年驿站、人才租房补贴等组合支持，具体房源和补贴以官方专题为准',
    condition: '毕业生、就业青年或符合人才条件人员可按房源项目、区级人才政策和官方小程序要求提交材料。',
    materials: ['身份证明', '毕业证书', '就业或实习证明', '租住申请信息', '社保或人才认定材料'],
    sourceName: '上海市住房和城乡建设管理委员会',
    sourceUrl: 'https://zjw.sh.gov.cn/gzdt/20250428/f5c9d8cdce3540c4abc3f650c037876e.html',
    applyUrl: 'https://zjw.sh.gov.cn/',
    checkedAt: '2026-06-27',
    status: '官方线索',
    keywords: ['上海', '高校毕业生', '保租房', '青年驿站', '人才租房补贴', '就业'],
  },
  {
    city: '天津',
    policy: '人才住房与租房补贴查询入口',
    type: '官方查询入口',
    amount: '天津人才安居、租房补贴和就业补贴政策按区级和部门通知动态发布，需进入官方入口核对最新标准',
    condition: '一般需结合学历、就业单位、社保缴纳、无房情况和属地区域政策进行判断。',
    materials: ['身份证明', '学历证明', '劳动合同', '社保记录', '住房情况材料', '区级申请表'],
    sourceName: '天津市人力资源和社会保障局',
    sourceUrl: 'https://hrss.tj.gov.cn/',
    applyUrl: 'https://hrss.tj.gov.cn/',
    checkedAt: '2026-06-27',
    status: '官方入口',
    keywords: ['天津', '人才', '租房补贴', '住房保障', '就业', '社保'],
  },
  {
    city: '重庆',
    policy: '青年人才安居政策查询入口',
    type: '官方查询入口',
    amount: '重庆人才安居、青年就业和住房保障政策以市级及区县官方页面最新发布为准',
    condition: '通常需要匹配学历层次、就业创业状态、社保缴纳、住房情况和区县人才目录。',
    materials: ['身份证明', '学历证明', '就业创业证明', '社保记录', '住房情况材料', '区县申请材料'],
    sourceName: '重庆市人力资源和社会保障局',
    sourceUrl: 'https://rlsbj.cq.gov.cn/',
    applyUrl: 'https://rlsbj.cq.gov.cn/',
    checkedAt: '2026-06-27',
    status: '官方入口',
    keywords: ['重庆', '青年人才', '安居', '租房', '社保', '就业'],
  },
  {
    city: '西安',
    policy: '青年人才驿站与人才安居查询入口',
    type: '青年人才服务',
    amount: '西安青年人才驿站、人才安居和就业补贴事项需以西安市人社局及属地官方系统最新状态为准',
    condition: '适合先查询求职过渡住宿、人才公寓、就业补贴等入口，再按最新系统要求判断能否申报。',
    materials: ['身份证明', '学历证明', '求职或就业证明', '社保记录', '住宿或租住申请信息'],
    sourceName: '西安市人力资源和社会保障局',
    sourceUrl: 'https://xahrss.xa.gov.cn/',
    applyUrl: 'https://xahrss.xa.gov.cn/',
    checkedAt: '2026-06-27',
    status: '官方入口',
    keywords: ['西安', '青年人才', '人才驿站', '租房', '就业', '住宿'],
  },
  {
    city: '长沙',
    policy: '高校毕业生租房和生活补贴线索',
    type: '租房和生活补贴',
    amount: '博士、硕士、本科等高校毕业生可关注长沙租房和生活补贴政策，具体标准和年限以官方最新口径为准',
    condition: '通常需满足落户长沙、在长工作或创业、按规定缴纳城镇职工社保等条件。',
    materials: ['身份证明', '学历学位证明', '户籍材料', '劳动合同或营业执照', '社保记录', '银行卡信息'],
    sourceName: '湖南政务服务网 / 长沙人才服务',
    sourceUrl: 'https://zwfw-new.hunan.gov.cn/csywtbyhsjweb/cszwdt/pages/talents_serve/policy_detail.html?policyguid=2204f9b5-e6a7-4b9f-a4dd-2255617a01c8&reflecttype=20',
    applyUrl: 'https://zwfw-new.hunan.gov.cn/',
    checkedAt: '2026-06-27',
    status: '官方入口',
    keywords: ['长沙', '高校毕业生', '租房', '生活补贴', '落户', '社保'],
  },
  {
    city: '合肥',
    policy: '人才住房租赁补贴线索',
    type: '人才租房补贴',
    amount: '合肥住房租赁补贴覆盖高层次人才、技能人才和高校毕业生等群体，具体标准以最新人才服务政策为准',
    condition: '通常关注新来肥就业、重点产业单位、社保缴纳、近年参保记录、无房和租赁备案等要求。',
    materials: ['身份证明', '学历或技能证明', '劳动合同', '养老保险记录', '住房租赁材料', '银行卡信息'],
    sourceName: '安徽政务服务网',
    sourceUrl: 'https://www.ahzwfw.gov.cn/',
    applyUrl: 'https://www.ahzwfw.gov.cn/',
    checkedAt: '2026-06-27',
    status: '官方入口',
    keywords: ['合肥', '博士', '硕士', '本科', '租房补贴', '人才', '社保'],
  },
  {
    city: '郑州',
    policy: '青年人才生活补贴政策入口',
    type: '生活补贴',
    amount: '郑州青年人才补贴以“智汇郑州”等官方渠道最新办理规则为准，部分事项可通过郑好办等入口申报',
    condition: '通常需结合学历、年龄、落户或就业状态、养老保险缴纳月份等条件进行审核。',
    materials: ['身份证明', '学历证明', '劳动合同', '社保记录', '银行卡信息', '线上申报信息'],
    sourceName: '郑州市人力资源和社会保障局',
    sourceUrl: 'https://zzrs.zhengzhou.gov.cn/rczc/index.jhtml',
    applyUrl: 'https://zzrs.zhengzhou.gov.cn/',
    checkedAt: '2026-06-27',
    status: '官方政策入口',
    keywords: ['郑州', '青年人才', '生活补贴', '智汇郑州', '社保', '学历'],
  },
  {
    city: '济南',
    policy: '生活和租房补贴申报线索',
    type: '生活和租房补贴',
    amount: '济南人才服务支持政策中包含生活和租房补贴线索，具体类别、金额和期限以一网通办事项为准',
    condition: '通常按人才分类、学历层次、就业单位、社保、住房或保租房租住状态等条件审核。',
    materials: ['身份证明', '学历或人才认定材料', '劳动合同', '社保记录', '租住材料', '申报表'],
    sourceName: '济南市人民政府一网通办',
    sourceUrl: 'https://zwfw.jinan.gov.cn/jpaas-jiq-web-jnywtb/front/transition/ywTransToDetail?areaCode=370104000000&innerCode=08dff2d1-db15-4f5b-9bdd-92333e540816&taskType=GG',
    applyUrl: 'https://zwfw.jinan.gov.cn/',
    checkedAt: '2026-06-27',
    status: '官方事项',
    keywords: ['济南', '人才', '生活补贴', '租房补贴', '博士', '硕士', '保租房'],
  },
  {
    city: '福州',
    policy: '好年华聚福州人才住房保障',
    type: '人才住房保障',
    amount: '福州人才住房保障包括租赁住房、租房补贴、购房补贴等形式，具体资格和补贴按官方平台最新规则办理',
    condition: '通常需在福州相关单位工作、缴纳城镇职工养老保险、符合学历或人才条件并取得资格证。',
    materials: ['身份证明', '学历证明', '劳动合同', '养老保险记录', '人才住房资格材料', '租赁或住房申请材料'],
    sourceName: '福州市人民政府',
    sourceUrl: 'https://www.fuzhou.gov.cn/nrrh/fzsrlzyhshbzj/202309/t20230926_4686573.htm',
    applyUrl: 'https://www.fuzhou.gov.cn/',
    checkedAt: '2026-06-27',
    status: '官方政策',
    keywords: ['福州', '好年华', '人才住房', '租房补贴', '博士', '本科', '养老保险'],
  },
  {
    city: '无锡',
    policy: '青年人才安居政策查询入口',
    type: '官方查询入口',
    amount: '无锡人才安居、租房补贴和人才公寓政策按市区两级动态发布，具体项目以官方入口为准',
    condition: '建议结合学历、就业单位、社保缴纳、人才分类和住房情况到官方页面核对。',
    materials: ['身份证明', '学历证明', '劳动合同', '社保记录', '住房情况材料', '单位申报信息'],
    sourceName: '无锡市人力资源和社会保障局',
    sourceUrl: 'https://hrss.wuxi.gov.cn/',
    applyUrl: 'https://hrss.wuxi.gov.cn/',
    checkedAt: '2026-06-27',
    status: '官方入口',
    keywords: ['无锡', '青年人才', '安居', '租房补贴', '人才公寓', '社保'],
  },
  {
    city: '佛山',
    policy: '人才住房与租房补贴查询入口',
    type: '官方查询入口',
    amount: '佛山人才住房、租房补贴和青年就业补贴政策以市区官方平台最新发布为准',
    condition: '通常需结合学历、就业创业状态、社保缴纳、住房情况和区级人才政策判断。',
    materials: ['身份证明', '学历证明', '劳动合同或创业证明', '社保记录', '住房情况材料', '申请表'],
    sourceName: '佛山市人力资源和社会保障局',
    sourceUrl: 'https://hrss.foshan.gov.cn/',
    applyUrl: 'https://hrss.foshan.gov.cn/',
    checkedAt: '2026-06-27',
    status: '官方入口',
    keywords: ['佛山', '人才住房', '租房补贴', '高校毕业生', '就业', '社保'],
  },
  {
    city: '东莞',
    policy: '人才住房与租房补贴查询入口',
    type: '官方查询入口',
    amount: '东莞人才住房、租房补贴和保障性住房事项按市级及镇街最新通知办理',
    condition: '建议结合学历、就业单位、社保缴纳、人才分类和住房情况到官方入口核对。',
    materials: ['身份证明', '学历证明', '劳动合同', '社保记录', '住房情况材料', '属地申请材料'],
    sourceName: '东莞市人力资源和社会保障局',
    sourceUrl: 'https://dghrss.dg.gov.cn/',
    applyUrl: 'https://dghrss.dg.gov.cn/',
    checkedAt: '2026-07-28',
    status: '官方入口',
    keywords: ['东莞', '人才住房', '租房补贴', '高校毕业生', '就业', '社保'],
  },
  {
    city: '珠海',
    policy: '人才安居与住房补贴查询入口',
    type: '官方查询入口',
    amount: '珠海人才安居、住房补贴和青年就业支持政策以官方最新事项为准',
    condition: '通常需结合学历或人才认定、就业单位、社保缴纳和住房情况判断。',
    materials: ['身份证明', '学历或人才证明', '劳动合同', '社保记录', '住房情况材料', '申请表'],
    sourceName: '珠海市人力资源和社会保障局',
    sourceUrl: 'https://zhrsj.zhuhai.gov.cn/',
    applyUrl: 'https://zhrsj.zhuhai.gov.cn/',
    checkedAt: '2026-07-28',
    status: '官方入口',
    keywords: ['珠海', '人才安居', '住房补贴', '高校毕业生', '就业', '社保'],
  },
  {
    city: '南昌',
    policy: '高校毕业生与人才安居查询入口',
    type: '官方查询入口',
    amount: '南昌高校毕业生生活补贴、人才安居和就业支持事项按官方最新规则办理',
    condition: '建议核对学历、落户或就业状态、社保缴纳、住房情况和申报期限。',
    materials: ['身份证明', '学历证明', '就业或创业证明', '社保记录', '住房情况材料', '银行卡信息'],
    sourceName: '南昌市人力资源和社会保障局',
    sourceUrl: 'https://rsj.nc.gov.cn/',
    applyUrl: 'https://rsj.nc.gov.cn/',
    checkedAt: '2026-07-28',
    status: '官方入口',
    keywords: ['南昌', '高校毕业生', '人才安居', '生活补贴', '就业', '社保'],
  },
  {
    city: '沈阳',
    policy: '高校毕业生住房支持查询入口',
    type: '官方查询入口',
    amount: '沈阳高校毕业生就业、人才公寓和住房支持政策以官方最新发布为准',
    condition: '通常需结合学历、就业创业状态、社保缴纳和住房情况核对资格。',
    materials: ['身份证明', '学历证明', '劳动合同或创业证明', '社保记录', '住房情况材料', '申请表'],
    sourceName: '沈阳市人力资源和社会保障局',
    sourceUrl: 'https://rsj.shenyang.gov.cn/',
    applyUrl: 'https://rsj.shenyang.gov.cn/',
    checkedAt: '2026-07-28',
    status: '官方入口',
    keywords: ['沈阳', '高校毕业生', '人才公寓', '住房支持', '就业', '社保'],
  },
  {
    city: '大连',
    policy: '青年人才住房保障查询入口',
    type: '官方查询入口',
    amount: '大连青年人才住房保障、租房补贴和就业支持事项以官方最新通知为准',
    condition: '建议按学历、年龄、就业单位、社保缴纳和住房情况核对最新办理条件。',
    materials: ['身份证明', '学历证明', '劳动合同', '社保记录', '住房情况材料', '申请表'],
    sourceName: '大连市人力资源和社会保障局',
    sourceUrl: 'https://rsj.dl.gov.cn/',
    applyUrl: 'https://rsj.dl.gov.cn/',
    checkedAt: '2026-07-28',
    status: '官方入口',
    keywords: ['大连', '青年人才', '住房保障', '租房补贴', '就业', '社保'],
  },
  {
    city: '石家庄',
    policy: '高校毕业生安居政策查询入口',
    type: '官方查询入口',
    amount: '石家庄高校毕业生就业补贴、人才绿卡和安居政策按官方最新事项办理',
    condition: '通常需结合学历、人才类别、就业创业、社保缴纳和住房情况判断。',
    materials: ['身份证明', '学历证明', '人才认定材料', '劳动合同', '社保记录', '住房情况材料'],
    sourceName: '石家庄市人力资源和社会保障局',
    sourceUrl: 'https://rsj.sjz.gov.cn/',
    applyUrl: 'https://rsj.sjz.gov.cn/',
    checkedAt: '2026-07-28',
    status: '官方入口',
    keywords: ['石家庄', '高校毕业生', '人才绿卡', '安居', '就业', '社保'],
  },
  {
    city: '太原',
    policy: '高校毕业生人才补贴查询入口',
    type: '官方查询入口',
    amount: '太原高校毕业生生活、租房和人才补贴事项以官方最新办理规则为准',
    condition: '建议核对学历、毕业年限、就业单位、社保缴纳、落户和住房情况。',
    materials: ['身份证明', '学历证明', '劳动合同', '社保记录', '户籍或住房材料', '银行卡信息'],
    sourceName: '太原市人力资源和社会保障局',
    sourceUrl: 'https://rsj.taiyuan.gov.cn/',
    applyUrl: 'https://rsj.taiyuan.gov.cn/',
    checkedAt: '2026-07-28',
    status: '官方入口',
    keywords: ['太原', '高校毕业生', '人才补贴', '租房', '就业', '社保'],
  },
  {
    city: '昆明',
    policy: '青年人才安居与就业政策查询入口',
    type: '官方查询入口',
    amount: '昆明青年人才安居、就业创业和住房保障事项以官方最新发布为准',
    condition: '通常需结合学历、就业创业状态、社保缴纳、人才认定和住房情况判断。',
    materials: ['身份证明', '学历证明', '就业创业证明', '社保记录', '住房情况材料', '申请表'],
    sourceName: '昆明市人力资源和社会保障局',
    sourceUrl: 'https://rsj.km.gov.cn/',
    applyUrl: 'https://rsj.km.gov.cn/',
    checkedAt: '2026-07-28',
    status: '官方入口',
    keywords: ['昆明', '青年人才', '安居', '住房保障', '就业', '社保'],
  },
  {
    city: '南宁',
    policy: '高校毕业生住房支持查询入口',
    type: '官方查询入口',
    amount: '南宁高校毕业生就业、人才公寓和住房支持政策以官方最新通知为准',
    condition: '建议核对学历、就业单位、社保缴纳、人才类别和住房情况。',
    materials: ['身份证明', '学历证明', '劳动合同', '社保记录', '住房情况材料', '申请表'],
    sourceName: '南宁市人力资源和社会保障局',
    sourceUrl: 'https://rsj.nanning.gov.cn/',
    applyUrl: 'https://rsj.nanning.gov.cn/',
    checkedAt: '2026-07-28',
    status: '官方入口',
    keywords: ['南宁', '高校毕业生', '人才公寓', '住房支持', '就业', '社保'],
  },
  {
    city: '海口',
    policy: '人才住房与租房补贴查询入口',
    type: '官方查询入口',
    amount: '海口人才住房、住房租赁补贴和就业支持事项以官方最新办理规则为准',
    condition: '通常需结合人才认定、学历、就业单位、社保缴纳和住房情况判断。',
    materials: ['身份证明', '学历或人才证明', '劳动合同', '社保记录', '住房情况材料', '申请表'],
    sourceName: '海口市人力资源和社会保障局',
    sourceUrl: 'https://rsj.haikou.gov.cn/',
    applyUrl: 'https://rsj.haikou.gov.cn/',
    checkedAt: '2026-07-28',
    status: '官方入口',
    keywords: ['海口', '人才住房', '租房补贴', '高校毕业生', '就业', '社保'],
  },
  {
    city: '贵阳',
    policy: '贵阳贵安高校毕业生人才安居租金补贴线索',
    type: '人才安居租金补贴',
    amount: '官方公开资料显示：毕业三年内在贵阳贵安就业创业、连续租住人才保障性租赁住房的高校毕业生，两年内按年发放租金补贴；第一年博士9600元、硕士4800元、本科及大专2400元，第二年减半。实际申领仍以最新平台规则为准。',
    condition: '毕业三年内在贵阳贵安就业创业，连续租住人才保障性租赁住房；具体房源认定、申领入口、社保和无房等条件以贵阳贵安最新官方办事指南为准。',
    materials: ['身份证明', '学历或毕业证明', '劳动合同或就业创业证明', '社保缴纳记录', '住房情况材料', '属地申请表'],
    sourceName: '贵州省人力资源和社会保障厅',
    sourceUrl: 'https://rst.guizhou.gov.cn/zwgk/zdlyxx/rcdwjs_5750847/202209/t20220901_76312917.html',
    applyUrl: 'https://zwfw.guizhou.gov.cn/',
    checkedAt: '2026-08-03',
    status: '官方政策线索',
    keywords: ['贵阳', '贵阳贵安', '人才安居', '租房补贴', '高校毕业生', '人才保障性租赁住房'],
  },
  {
    city: '哈尔滨',
    policy: '高校毕业生与人才住房保障查询入口',
    type: '官方查询入口',
    amount: '该城市租房补贴、人才公寓、青年驿站或住房保障政策按当地官网最新发布为准；本条用于城市搜索与官网核验入口，不承诺固定金额。',
    condition: '通常需结合学历、毕业年限、就业单位、社保缴纳、无房情况、人才认定和属地区县规则判断，具体以官方办事指南为准。',
    materials: ['身份证明', '学历或毕业证明', '劳动合同或就业创业证明', '社保缴纳记录', '住房情况材料', '属地申请表'],
    sourceName: '哈尔滨市人民政府',
    sourceUrl: 'https://www.harbin.gov.cn/',
    applyUrl: 'https://www.harbin.gov.cn/',
    checkedAt: '2026-08-03',
    status: '官方入口',
    keywords: ['哈尔滨', '高校毕业生', '人才住房', '租房补贴', '就业', '住房保障'],
  },
  {
    city: '长春',
    policy: '青年人才住房与租房支持查询入口',
    type: '官方查询入口',
    amount: '该城市租房补贴、人才公寓、青年驿站或住房保障政策按当地官网最新发布为准；本条用于城市搜索与官网核验入口，不承诺固定金额。',
    condition: '通常需结合学历、毕业年限、就业单位、社保缴纳、无房情况、人才认定和属地区县规则判断，具体以官方办事指南为准。',
    materials: ['身份证明', '学历或毕业证明', '劳动合同或就业创业证明', '社保缴纳记录', '住房情况材料', '属地申请表'],
    sourceName: '长春市人民政府',
    sourceUrl: 'https://www.changchun.gov.cn/',
    applyUrl: 'https://www.changchun.gov.cn/',
    checkedAt: '2026-08-03',
    status: '官方入口',
    keywords: ['长春', '青年人才', '租房补贴', '人才公寓', '高校毕业生', '住房保障'],
  },
  {
    city: '呼和浩特',
    policy: '高校毕业生租房与人才安居查询入口',
    type: '官方查询入口',
    amount: '该城市租房补贴、人才公寓、青年驿站或住房保障政策按当地官网最新发布为准；本条用于城市搜索与官网核验入口，不承诺固定金额。',
    condition: '通常需结合学历、毕业年限、就业单位、社保缴纳、无房情况、人才认定和属地区县规则判断，具体以官方办事指南为准。',
    materials: ['身份证明', '学历或毕业证明', '劳动合同或就业创业证明', '社保缴纳记录', '住房情况材料', '属地申请表'],
    sourceName: '呼和浩特市人民政府',
    sourceUrl: 'https://www.huhhot.gov.cn/',
    applyUrl: 'https://www.huhhot.gov.cn/',
    checkedAt: '2026-08-03',
    status: '官方入口',
    keywords: ['呼和浩特', '高校毕业生', '人才安居', '租房补贴', '就业', '住房保障'],
  },
  {
    city: '兰州',
    policy: '青年人才住房保障与租房补贴查询入口',
    type: '官方查询入口',
    amount: '该城市租房补贴、人才公寓、青年驿站或住房保障政策按当地官网最新发布为准；本条用于城市搜索与官网核验入口，不承诺固定金额。',
    condition: '通常需结合学历、毕业年限、就业单位、社保缴纳、无房情况、人才认定和属地区县规则判断，具体以官方办事指南为准。',
    materials: ['身份证明', '学历或毕业证明', '劳动合同或就业创业证明', '社保缴纳记录', '住房情况材料', '属地申请表'],
    sourceName: '兰州市人民政府',
    sourceUrl: 'https://www.lanzhou.gov.cn/',
    applyUrl: 'https://www.lanzhou.gov.cn/',
    checkedAt: '2026-08-03',
    status: '官方入口',
    keywords: ['兰州', '青年人才', '租房补贴', '人才公寓', '高校毕业生', '住房保障'],
  },
  {
    city: '西宁',
    policy: '高校毕业生住房保障政策查询入口',
    type: '官方查询入口',
    amount: '该城市租房补贴、人才公寓、青年驿站或住房保障政策按当地官网最新发布为准；本条用于城市搜索与官网核验入口，不承诺固定金额。',
    condition: '通常需结合学历、毕业年限、就业单位、社保缴纳、无房情况、人才认定和属地区县规则判断，具体以官方办事指南为准。',
    materials: ['身份证明', '学历或毕业证明', '劳动合同或就业创业证明', '社保缴纳记录', '住房情况材料', '属地申请表'],
    sourceName: '西宁市人民政府',
    sourceUrl: 'https://www.xining.gov.cn/',
    applyUrl: 'https://www.xining.gov.cn/',
    checkedAt: '2026-08-03',
    status: '官方入口',
    keywords: ['西宁', '高校毕业生', '住房保障', '租房补贴', '人才安居', '就业'],
  },
  {
    city: '银川',
    policy: '青年人才住房与就业补贴查询入口',
    type: '官方查询入口',
    amount: '该城市租房补贴、人才公寓、青年驿站或住房保障政策按当地官网最新发布为准；本条用于城市搜索与官网核验入口，不承诺固定金额。',
    condition: '通常需结合学历、毕业年限、就业单位、社保缴纳、无房情况、人才认定和属地区县规则判断，具体以官方办事指南为准。',
    materials: ['身份证明', '学历或毕业证明', '劳动合同或就业创业证明', '社保缴纳记录', '住房情况材料', '属地申请表'],
    sourceName: '银川市人民政府',
    sourceUrl: 'https://www.yinchuan.gov.cn/',
    applyUrl: 'https://www.yinchuan.gov.cn/',
    checkedAt: '2026-08-03',
    status: '官方入口',
    keywords: ['银川', '青年人才', '住房保障', '租房补贴', '高校毕业生', '就业'],
  },
  {
    city: '乌鲁木齐',
    policy: '高校毕业生与人才住房保障查询入口',
    type: '官方查询入口',
    amount: '该城市租房补贴、人才公寓、青年驿站或住房保障政策按当地官网最新发布为准；本条用于城市搜索与官网核验入口，不承诺固定金额。',
    condition: '通常需结合学历、毕业年限、就业单位、社保缴纳、无房情况、人才认定和属地区县规则判断，具体以官方办事指南为准。',
    materials: ['身份证明', '学历或毕业证明', '劳动合同或就业创业证明', '社保缴纳记录', '住房情况材料', '属地申请表'],
    sourceName: '乌鲁木齐市人民政府',
    sourceUrl: 'https://www.urumqi.gov.cn/',
    applyUrl: 'https://www.urumqi.gov.cn/',
    checkedAt: '2026-08-03',
    status: '官方入口',
    keywords: ['乌鲁木齐', '高校毕业生', '人才住房', '租房补贴', '就业', '住房保障'],
  },
  {
    city: '拉萨',
    policy: '高校毕业生就业与住房保障查询入口',
    type: '官方查询入口',
    amount: '该城市租房补贴、人才公寓、青年驿站或住房保障政策按当地官网最新发布为准；本条用于城市搜索与官网核验入口，不承诺固定金额。',
    condition: '通常需结合学历、毕业年限、就业单位、社保缴纳、无房情况、人才认定和属地区县规则判断，具体以官方办事指南为准。',
    materials: ['身份证明', '学历或毕业证明', '劳动合同或就业创业证明', '社保缴纳记录', '住房情况材料', '属地申请表'],
    sourceName: '拉萨市人民政府',
    sourceUrl: 'https://www.lasa.gov.cn/',
    applyUrl: 'https://www.lasa.gov.cn/',
    checkedAt: '2026-08-03',
    status: '官方入口',
    keywords: ['拉萨', '高校毕业生', '就业补贴', '住房保障', '租房', '人才'],
  },
  {
    city: '常州',
    policy: '青年人才租房与生活补贴查询入口',
    type: '官方查询入口',
    amount: '该城市租房补贴、人才公寓、青年驿站或住房保障政策按当地官网最新发布为准；本条用于城市搜索与官网核验入口，不承诺固定金额。',
    condition: '通常需结合学历、毕业年限、就业单位、社保缴纳、无房情况、人才认定和属地区县规则判断，具体以官方办事指南为准。',
    materials: ['身份证明', '学历或毕业证明', '劳动合同或就业创业证明', '社保缴纳记录', '住房情况材料', '属地申请表'],
    sourceName: '常州市人民政府',
    sourceUrl: 'https://www.changzhou.gov.cn/',
    applyUrl: 'https://www.changzhou.gov.cn/',
    checkedAt: '2026-08-03',
    status: '官方入口',
    keywords: ['常州', '青年人才', '租房补贴', '生活补贴', '高校毕业生', '就业'],
  },
  {
    city: '嘉兴',
    policy: '高校毕业生租房与人才安居查询入口',
    type: '官方查询入口',
    amount: '该城市租房补贴、人才公寓、青年驿站或住房保障政策按当地官网最新发布为准；本条用于城市搜索与官网核验入口，不承诺固定金额。',
    condition: '通常需结合学历、毕业年限、就业单位、社保缴纳、无房情况、人才认定和属地区县规则判断，具体以官方办事指南为准。',
    materials: ['身份证明', '学历或毕业证明', '劳动合同或就业创业证明', '社保缴纳记录', '住房情况材料', '属地申请表'],
    sourceName: '嘉兴市人民政府',
    sourceUrl: 'https://www.jiaxing.gov.cn/',
    applyUrl: 'https://www.jiaxing.gov.cn/',
    checkedAt: '2026-08-03',
    status: '官方入口',
    keywords: ['嘉兴', '高校毕业生', '租房补贴', '人才安居', '青年人才', '就业'],
  },
  {
    city: '绍兴',
    policy: '青年人才安居与租房补贴查询入口',
    type: '官方查询入口',
    amount: '该城市租房补贴、人才公寓、青年驿站或住房保障政策按当地官网最新发布为准；本条用于城市搜索与官网核验入口，不承诺固定金额。',
    condition: '通常需结合学历、毕业年限、就业单位、社保缴纳、无房情况、人才认定和属地区县规则判断，具体以官方办事指南为准。',
    materials: ['身份证明', '学历或毕业证明', '劳动合同或就业创业证明', '社保缴纳记录', '住房情况材料', '属地申请表'],
    sourceName: '绍兴市人民政府',
    sourceUrl: 'https://www.sx.gov.cn/',
    applyUrl: 'https://www.sx.gov.cn/',
    checkedAt: '2026-08-03',
    status: '官方入口',
    keywords: ['绍兴', '青年人才', '安居补贴', '租房补贴', '高校毕业生', '就业'],
  },
  {
    city: '温州',
    policy: '高校毕业生租房与人才住房查询入口',
    type: '官方查询入口',
    amount: '该城市租房补贴、人才公寓、青年驿站或住房保障政策按当地官网最新发布为准；本条用于城市搜索与官网核验入口，不承诺固定金额。',
    condition: '通常需结合学历、毕业年限、就业单位、社保缴纳、无房情况、人才认定和属地区县规则判断，具体以官方办事指南为准。',
    materials: ['身份证明', '学历或毕业证明', '劳动合同或就业创业证明', '社保缴纳记录', '住房情况材料', '属地申请表'],
    sourceName: '温州市人民政府',
    sourceUrl: 'https://www.wenzhou.gov.cn/',
    applyUrl: 'https://www.wenzhou.gov.cn/',
    checkedAt: '2026-08-03',
    status: '官方入口',
    keywords: ['温州', '高校毕业生', '租房补贴', '人才住房', '青年人才', '就业'],
  },
  {
    city: '泉州',
    policy: '青年人才住房保障与租房支持查询入口',
    type: '官方查询入口',
    amount: '该城市租房补贴、人才公寓、青年驿站或住房保障政策按当地官网最新发布为准；本条用于城市搜索与官网核验入口，不承诺固定金额。',
    condition: '通常需结合学历、毕业年限、就业单位、社保缴纳、无房情况、人才认定和属地区县规则判断，具体以官方办事指南为准。',
    materials: ['身份证明', '学历或毕业证明', '劳动合同或就业创业证明', '社保缴纳记录', '住房情况材料', '属地申请表'],
    sourceName: '泉州市人民政府',
    sourceUrl: 'https://www.quanzhou.gov.cn/',
    applyUrl: 'https://www.quanzhou.gov.cn/',
    checkedAt: '2026-08-03',
    status: '官方入口',
    keywords: ['泉州', '青年人才', '住房保障', '租房补贴', '高校毕业生', '就业'],
  },
  {
    city: '烟台',
    policy: '青年人才租房补贴查询入口',
    type: '官方查询入口',
    amount: '该城市租房补贴、人才公寓、青年驿站或住房保障政策按当地官网最新发布为准；本条用于城市搜索与官网核验入口，不承诺固定金额。',
    condition: '通常需结合学历、毕业年限、就业单位、社保缴纳、无房情况、人才认定和属地区县规则判断，具体以官方办事指南为准。',
    materials: ['身份证明', '学历或毕业证明', '劳动合同或就业创业证明', '社保缴纳记录', '住房情况材料', '属地申请表'],
    sourceName: '烟台市人民政府',
    sourceUrl: 'https://www.yantai.gov.cn/',
    applyUrl: 'https://www.yantai.gov.cn/',
    checkedAt: '2026-08-03',
    status: '官方入口',
    keywords: ['烟台', '青年人才', '租房补贴', '高校毕业生', '住房保障', '就业'],
  },
  {
    city: '徐州',
    policy: '高校毕业生租房与人才安居查询入口',
    type: '官方查询入口',
    amount: '该城市租房补贴、人才公寓、青年驿站或住房保障政策按当地官网最新发布为准；本条用于城市搜索与官网核验入口，不承诺固定金额。',
    condition: '通常需结合学历、毕业年限、就业单位、社保缴纳、无房情况、人才认定和属地区县规则判断，具体以官方办事指南为准。',
    materials: ['身份证明', '学历或毕业证明', '劳动合同或就业创业证明', '社保缴纳记录', '住房情况材料', '属地申请表'],
    sourceName: '徐州市人民政府',
    sourceUrl: 'https://www.xz.gov.cn/',
    applyUrl: 'https://www.xz.gov.cn/',
    checkedAt: '2026-08-03',
    status: '官方入口',
    keywords: ['徐州', '高校毕业生', '租房补贴', '人才安居', '青年人才', '就业'],
  },
  {
    city: '南通',
    policy: '青年人才住房与租房补贴查询入口',
    type: '官方查询入口',
    amount: '该城市租房补贴、人才公寓、青年驿站或住房保障政策按当地官网最新发布为准；本条用于城市搜索与官网核验入口，不承诺固定金额。',
    condition: '通常需结合学历、毕业年限、就业单位、社保缴纳、无房情况、人才认定和属地区县规则判断，具体以官方办事指南为准。',
    materials: ['身份证明', '学历或毕业证明', '劳动合同或就业创业证明', '社保缴纳记录', '住房情况材料', '属地申请表'],
    sourceName: '南通市人民政府',
    sourceUrl: 'https://www.nantong.gov.cn/',
    applyUrl: 'https://www.nantong.gov.cn/',
    checkedAt: '2026-08-03',
    status: '官方入口',
    keywords: ['南通', '青年人才', '租房补贴', '人才公寓', '高校毕业生', '就业'],
  },
  {
    city: '惠州',
    policy: '青年人才住房保障查询入口',
    type: '官方查询入口',
    amount: '该城市租房补贴、人才公寓、青年驿站或住房保障政策按当地官网最新发布为准；本条用于城市搜索与官网核验入口，不承诺固定金额。',
    condition: '通常需结合学历、毕业年限、就业单位、社保缴纳、无房情况、人才认定和属地区县规则判断，具体以官方办事指南为准。',
    materials: ['身份证明', '学历或毕业证明', '劳动合同或就业创业证明', '社保缴纳记录', '住房情况材料', '属地申请表'],
    sourceName: '惠州市人民政府',
    sourceUrl: 'https://www.huizhou.gov.cn/',
    applyUrl: 'https://www.huizhou.gov.cn/',
    checkedAt: '2026-08-03',
    status: '官方入口',
    keywords: ['惠州', '青年人才', '住房保障', '租房补贴', '高校毕业生', '就业'],
  },
  {
    city: '中山',
    policy: '青年人才安居与租房支持查询入口',
    type: '官方查询入口',
    amount: '该城市租房补贴、人才公寓、青年驿站或住房保障政策按当地官网最新发布为准；本条用于城市搜索与官网核验入口，不承诺固定金额。',
    condition: '通常需结合学历、毕业年限、就业单位、社保缴纳、无房情况、人才认定和属地区县规则判断，具体以官方办事指南为准。',
    materials: ['身份证明', '学历或毕业证明', '劳动合同或就业创业证明', '社保缴纳记录', '住房情况材料', '属地申请表'],
    sourceName: '中山市人民政府',
    sourceUrl: 'https://www.zs.gov.cn/',
    applyUrl: 'https://www.zs.gov.cn/',
    checkedAt: '2026-08-03',
    status: '官方入口',
    keywords: ['中山', '青年人才', '安居', '租房补贴', '高校毕业生', '就业'],
  },
]

export const subsidyCities = [...new Set(subsidyPolicies.map((item) => item.city))]
  .sort((first, second) => first.localeCompare(second, 'zh-CN'))

export function getSubsidyFreshness(checkedAt, now = new Date()) {
  const checked = new Date(`${checkedAt}T00:00:00`)
  if (Number.isNaN(checked.getTime())) return { stale: true, days: null, label: '核对日期缺失' }
  const days = Math.max(0, Math.floor((now.getTime() - checked.getTime()) / 86_400_000))
  return {
    stale: days > 90,
    needsReview: days > 30,
    days,
    label: days > 90 ? `政策内容已 ${days} 天未人工核对` : `政策内容人工核对于 ${checkedAt}`,
  }
}

export function getSubsidyMatchScore(policy, profile) {
  const text = `${policy.city}${profile}`
  const hits = policy.keywords.filter((keyword) => text.includes(keyword)).length
  const base = policy.status === '已停止新受理' ? 35 : 52
  const score = base + hits * 7

  return Math.min(score, policy.status === '已停止新受理' ? 68 : 98)
}

// 结构化补贴匹配：按政策关键词逐项判断满足/待确认/不满足，给出判断依据和缺失条件
// 返回 { status, score, criteria: [{ key, label, status, evidence, missing }] }
const EDUCATION_KEYWORDS = ['博士', '硕士', '本科', '学士', '大专']
const EDUCATION_RANKS = {
  博士: 4,
  硕士: 3,
  研究生: 3,
  本科: 2,
  学士: 2,
  大专: 1,
  专科: 1,
}

const PROFILE_PHRASES = {
  graduation: {
    satisfied: ['应届毕业生', '应届生', '已毕业', '已经毕业', '毕业生', '应届', '毕业'],
    unsatisfied: ['非应届毕业生', '不是应届毕业生', '非应届生', '不是应届', '非应届', '非毕业生', '未毕业', '尚未毕业', '还没毕业', '没有毕业'],
  },
  social: {
    satisfied: ['从未断缴社保', '社保连续缴纳', '连续缴纳社保', '已缴纳社保', '已经缴纳社保', '已缴社保', '缴纳社保', '缴社保', '社保正常', '社保在缴', '已参保', '参保'],
    unsatisfied: ['没有在本市连续缴纳社保', '未连续缴纳社保', '没有连续缴纳社保', '未缴纳社保', '没有缴纳社保', '未缴社保', '没有缴社保', '无社保', '未参保', '没有参保', '社保还没缴', '社保未缴', '社保没缴', '社保已断缴', '社保断缴', '断缴社保', '社保已停缴', '社保停缴', '停缴社保'],
  },
  noHouse: {
    satisfied: ['名下没有房产', '名下无房产', '没有自有住房', '无自有住房', '没有住房', '没有房', '名下无房', '未购房', '未买房', '无房'],
    unsatisfied: ['名下已有房产', '名下有房产', '名下有房', '已有自有住房', '已有住房', '已购房', '已买房', '买了房', '自有住房', '有住房', '有房'],
  },
  employment: {
    satisfied: ['已经签订劳动合同', '已签订劳动合同', '签订劳动合同', '已签劳动合同', '有劳动合同', '已经就业', '已就业', '正在工作', '已经工作', '已工作', '有工作', '在职', '已签约'],
    unsatisfied: ['劳动合同还没签', '劳动合同尚未签', '劳动合同未签', '没有签劳动合同', '未签劳动合同', '无劳动合同', '尚未就业', '暂未就业', '没有就业', '未就业', '没有工作', '无工作', '失业', '待业'],
  },
  hukou: {
    satisfied: ['已经落户', '已落户', '本市户籍', '本地户籍', '户籍在本市', '落户'],
    unsatisfied: ['户籍不在本市', '非本市户籍', '外地户籍', '尚未落户', '暂未落户', '没有落户', '未落户'],
  },
  business: {
    satisfied: ['已经创业', '已创业', '正在创业', '有营业执照', '已办理营业执照', '初创企业', '创业', '营业执照'],
    unsatisfied: ['没有办理营业执照', '未办理营业执照', '没有营业执照', '无营业执照', '尚未创业', '暂未创业', '没有创业', '未创业'],
  },
}

function collectPhraseMatches(profile, phrases, status) {
  const matches = []
  if (typeof profile !== 'string') return matches
  phrases.forEach((phrase) => {
    let start = profile.indexOf(phrase)
    while (start >= 0) {
      matches.push({ start, end: start + phrase.length, length: phrase.length, status })
      start = profile.indexOf(phrase, start + 1)
    }
  })
  return matches
}

// 同一段中优先采用更具体的长短语；多次陈述时以最后一次明确状态为准。
function resolveProfileStatement(profile, satisfiedPhrases, unsatisfiedPhrases) {
  const matches = [
    ...collectPhraseMatches(profile, satisfiedPhrases, 'satisfied'),
    ...collectPhraseMatches(profile, unsatisfiedPhrases, 'unsatisfied'),
  ]
  const specificMatches = matches.filter((match, index) => !matches.some((other, otherIndex) =>
    otherIndex !== index
    && other.start <= match.start
    && other.end >= match.end
    && other.length > match.length,
  ))
  if (!specificMatches.length) return 'pending'
  specificMatches.sort((first, second) => first.start - second.start || first.length - second.length)
  return specificMatches[specificMatches.length - 1].status
}

function deriveCriterion(policy, profile, key) {
  switch (key) {
    case 'city':
      return {
        key: 'city',
        label: `城市：${policy.city}`,
        status: 'satisfied',
        evidence: `已选择 ${policy.city}`,
        missing: '',
      }
    case 'education': {
      // EDUCATION_KEYWORDS 按从高到低排序，取政策支持的最低学历作为门槛
      const supported = EDUCATION_KEYWORDS.filter((k) => policy.keywords.includes(k))
      if (!supported.length) return null
      const minLevel = supported[supported.length - 1]
      const minimumRank = EDUCATION_RANKS[minLevel]
      const satisfiedPhrases = Object.entries(EDUCATION_RANKS)
        .filter(([, rank]) => rank >= minimumRank)
        .map(([level]) => level)
      if (minimumRank <= EDUCATION_RANKS.本科) satisfiedPhrases.push('本科及以上')
      const educationStatus = resolveProfileStatement(profile, satisfiedPhrases, [
        '未取得本科学历', '没有本科学历', '无本科学历', '非本科',
        '未取得硕士学历', '没有硕士学历', '无硕士学历',
      ])
      return {
        key: 'education',
        label: `学历：${minLevel}及以上`,
        status: educationStatus,
        evidence: educationStatus === 'satisfied' ? '个人情况已说明学历' : '',
        missing: educationStatus === 'satisfied' ? '' : educationStatus === 'unsatisfied'
          ? `已说明未达到${minLevel}及以上学历要求`
          : `请在个人情况中说明学历（${minLevel}及以上）`,
      }
    }
    case 'graduation': {
      if (!policy.keywords.some((k) => ['应届', '毕业', '毕业生'].includes(k))) return null
      const graduationStatus = resolveProfileStatement(profile, PROFILE_PHRASES.graduation.satisfied, PROFILE_PHRASES.graduation.unsatisfied)
      return {
        key: 'graduation',
        label: '应届 / 毕业生身份',
        status: graduationStatus,
        evidence: graduationStatus === 'satisfied' ? '已说明应届或毕业生身份' : '',
        missing: graduationStatus === 'satisfied' ? '' : graduationStatus === 'unsatisfied'
          ? '已说明不属于应届或毕业生身份'
          : '请说明是否为应届或毕业生',
      }
    }
    case 'social': {
      if (!policy.keywords.includes('社保')) return null
      const socialStatus = resolveProfileStatement(profile, PROFILE_PHRASES.social.satisfied, PROFILE_PHRASES.social.unsatisfied)
      return {
        key: 'social',
        label: '社保缴纳',
        status: socialStatus,
        evidence: socialStatus === 'satisfied' ? '已说明社保缴纳情况' : '',
        missing: socialStatus === 'satisfied' ? '' : socialStatus === 'unsatisfied'
          ? '已说明未缴纳社保、社保断缴或停缴，不满足该条件'
          : '请说明社保缴纳情况（已缴 / 未缴 / 月份）',
      }
    }
    case 'noHouse': {
      if (!policy.keywords.includes('无房')) return null
      const noHouseStatus = resolveProfileStatement(profile, PROFILE_PHRASES.noHouse.satisfied, PROFILE_PHRASES.noHouse.unsatisfied)
      return {
        key: 'noHouse',
        label: '本市无房',
        status: noHouseStatus,
        evidence: noHouseStatus === 'satisfied' ? '已说明无房情况' : '',
        missing: noHouseStatus === 'satisfied' ? '' : noHouseStatus === 'unsatisfied'
          ? '已说明有自有住房，不满足无房条件'
          : '请说明在本市是否有自有住房',
      }
    }
    case 'employment': {
      if (!policy.keywords.some((k) => ['劳动合同', '就业'].includes(k))) return null
      const employmentStatus = resolveProfileStatement(profile, PROFILE_PHRASES.employment.satisfied, PROFILE_PHRASES.employment.unsatisfied)
      return {
        key: 'employment',
        label: '已就业 / 签订劳动合同',
        status: employmentStatus,
        evidence: employmentStatus === 'satisfied' ? '已说明就业或合同情况' : '',
        missing: employmentStatus === 'satisfied' ? '' : employmentStatus === 'unsatisfied'
          ? '已说明未就业或未签劳动合同，不满足该条件'
          : '请说明是否已签订劳动合同或就业',
      }
    }
    case 'hukou': {
      if (!policy.keywords.includes('落户')) return null
      const hukouStatus = resolveProfileStatement(profile, PROFILE_PHRASES.hukou.satisfied, PROFILE_PHRASES.hukou.unsatisfied)
      return {
        key: 'hukou',
        label: '落户情况',
        status: hukouStatus,
        evidence: hukouStatus === 'satisfied' ? '已说明落户情况' : '',
        missing: hukouStatus === 'satisfied' ? '' : hukouStatus === 'unsatisfied'
          ? '已说明未落户或非本市户籍，不满足该条件'
          : '请说明是否已落户本市',
      }
    }
    case 'business': {
      if (!policy.keywords.includes('创业')) return null
      const businessStatus = resolveProfileStatement(profile, PROFILE_PHRASES.business.satisfied, PROFILE_PHRASES.business.unsatisfied)
      return {
        key: 'business',
        label: '创业情况',
        status: businessStatus,
        evidence: businessStatus === 'satisfied' ? '已说明创业情况' : '',
        missing: businessStatus === 'satisfied' ? '' : businessStatus === 'unsatisfied'
          ? '已说明未创业或无营业执照，不满足该条件'
          : '请说明是否在本地创业',
      }
    }
    default:
      return null
  }
}

export function evaluateSubsidyMatch(policy, profile) {
  // 已停止新受理的政策直接判定为不满足
  if (policy.status === '已停止新受理') {
    return {
      status: 'unsatisfied',
      score: 35,
      criteria: [{
        key: 'policy-status',
        label: '政策受理状态',
        status: 'unsatisfied',
        evidence: '',
        missing: `${policy.policy}已停止新受理，请查询最新人才政策。`,
      }],
    }
  }

  const orderedKeys = ['city', 'education', 'graduation', 'social', 'noHouse', 'employment', 'hukou', 'business']
  const criteria = orderedKeys
    .map((key) => deriveCriterion(policy, profile, key))
    .filter(Boolean)

  const hasUnsatisfied = criteria.some((c) => c.status === 'unsatisfied')
  const hasPending = criteria.some((c) => c.status === 'pending')
  const status = hasUnsatisfied ? 'unsatisfied' : hasPending ? 'pending' : 'satisfied'

  // 兼容旧评分逻辑：分数仍以关键词命中数为基础
  const text = `${policy.city}${profile}`
  const hits = policy.keywords.filter((keyword) => text.includes(keyword)).length
  const score = Math.min(98, 52 + hits * 7)

  return { status, score, criteria }
}

export const subsidyMatchStatusLabel = (status) => {
  if (status === 'satisfied') return '满足'
  if (status === 'pending') return '待确认'
  return '不满足'
}
