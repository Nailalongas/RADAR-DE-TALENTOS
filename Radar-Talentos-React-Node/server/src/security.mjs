import {createHash,timingSafeEqual} from 'node:crypto';
const digest=s=>createHash('sha256').update(s).digest();
export function productionSecurity(env=process.env){
 const production=env.NODE_ENV==='production';const username=env.RADAR_USER,password=env.RADAR_PASSWORD;
 if(production&&(!username||username.includes(':')||!password||password.length<24))throw Error('Produção exige RADAR_USER e RADAR_PASSWORD forte (mínimo 24 caracteres)');
 if((username||password)&&(!username||!password||username.includes(':')||password.length<24))throw Error('Credenciais incompletas ou fracas');
 return username?{username,password}:null;
}
export function authenticate(req,security){if(!security)return true;const value=req.headers.authorization??'';if(!value.startsWith('Basic ')||value.length>4096)return false;return timingSafeEqual(digest(Buffer.from(value.slice(6),'base64')),digest(`${security.username}:${security.password}`));}
