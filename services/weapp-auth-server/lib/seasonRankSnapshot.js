'use strict';
const { buildPointsRank } = require('./pointsRank');
function avatar(u) {
  const base=process.env.PUBLIC_ASSET_DOMAIN || (process.env.COS_BUCKET && process.env.COS_REGION ? `https://${process.env.COS_BUCKET}.cos.${process.env.COS_REGION}.myqcloud.com` : '');
  return u.avatarKey && base ? `${base}/${encodeURI(u.avatarKey)}` : (u.avatar || '');
}
function timestamp(value){const number=Number(value);if(Number.isFinite(number)&&number>0)return number;const date=Date.parse(value);return Number.isFinite(date)?date:null;}
function buildSnapshot(users, routes) {
  const checkinRank=users.map(u=>({userId:u.id,username:u.username || '匿名用户',avatar:avatar(u),unlocked:(u.unlockedLocations||[]).length,locking:(u.lockingLocations||[]).length,count:(u.unlockedLocations||[]).length+(u.lockingLocations||[]).length,createdAt:u.createdAt,updatedAt:u.updatedAt})).sort((a,b)=>(b.unlocked-a.unlocked)||(b.locking-a.locking)||a.username.localeCompare(b.username,'zh')).map((u,i)=>({...u,rank:i+1}));
  const routeRank=users.map(u=>{
    const completedRoutes=u.completedRoutes || [];
    const times=completedRoutes.map(id=>{
      const route=routes.find(r=>r.id===id);if(!route?.points?.length)return null;
      const pointTimes=route.points.map(locationId=>{
        const records=(u.checkinRecords||[]).filter(x=>Number(x.locationId)===Number(locationId));
        const known=records.map(x=>timestamp(x.time)).filter(Boolean);return known.length?Math.min(...known):null;
      });return pointTimes.every(Boolean)?Math.max(...pointTimes):null;
    });
    return {userId:u.id,username:u.username || '',completedRoutes,completedRouteCount:completedRoutes.length,rankingCompletedAt:times.length&&times.every(Boolean)?Math.max(...times):null,points:u.points || 0};
  }).sort((a,b)=>(b.completedRouteCount-a.completedRouteCount)||((a.rankingCompletedAt || Infinity)-(b.rankingCompletedAt || Infinity))||a.username.localeCompare(b.username,'zh-CN')||String(a.userId).localeCompare(String(b.userId),'zh-CN',{numeric:true})).map((u,i)=>({...u,rank:i+1}));
  return {pointsRank:buildPointsRank(users,{resolveAvatar:avatar}),checkinRank,routes:routeRank};
}
module.exports={buildSnapshot};
