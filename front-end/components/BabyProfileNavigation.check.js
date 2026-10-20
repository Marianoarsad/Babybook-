// Actual root handlers, fictional profiles, no server writes.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),{parse}=require("@babel/parser");
const source=fs.readFileSync(path.join(__dirname,"../App.js"),"utf8"),ast=parse(source,{sourceType:"module",plugins:["jsx"]});
function find(n,test){if(!n||typeof n!=="object")return null;if(test(n))return n;for(const v of Object.values(n))for(const c of Array.isArray(v)?v:[v]){const f=find(c,test);if(f)return f;}}
const handler=name=>{const n=find(ast,n=>n.type==="VariableDeclarator"&&n.id.name===name).init;return source.slice(n.start,n.end);};
const compile=(name,env)=>new Function(...Object.keys(env),`return (${handler(name)})`)(...Object.values(env));
let epoch=1,state,env,calls,saved,resolveRequest,rejectRequest;
function reset(){
 calls=[];saved=[{id:"a",name:"Old",currentWeight:8},{id:"b",name:"Other"}];state={view:"dashboard",restore:null};
 env={currentView:state.view,sessionEpoch:epoch,activeProfile:saved[0],activeBabyId:{current:"a"},homeOffset:{current:507},profileFlow:{current:null},editTarget:{current:null},historyRef:{current:[]},profileSaving:null,
 recordStore:{getEpoch:()=>epoch},scroll:{resetScroll(){}},toast:{error:m=>calls.push(["error",m])},setCurrentView:v=>state.view=typeof v==="function"?v(state.view):v,
 setNavTab(){},setNavPayload(){},setNavKey(){},setBabyProfileTarget:v=>state.target=v,setHomeRestore:v=>state.restore=v,setFormAvatarUri:v=>state.photo=v,setBloodTypeMenuOpen(){},
 setProfileSaving:v=>state.saving=v,setProfiles:fn=>saved=fn(saved),stripDoctorPrefix:s=>s,childToProfile:p=>p,profileFormToChild:p=>p,pickImage:async()=>null,
 api:{updateChild:(id,body)=>{calls.push(["update",id,body]);return new Promise((resolve,reject)=>{resolveRequest=resolve;rejectRequest=reject;});},uploadChildAvatar:async id=>{calls.push(["upload",id]);return {id,name:"Saved",avatarUrl:"/new.jpg"};}}};
 for(const k of handler("openEditModal").matchAll(/\b(setForm\w+)\(/g))env[k[1]]??=()=>{};
 for(const k of handler("handleEditProfile").matchAll(/\b(form\w+)\b/g))env[k[1]]="";
 env.formName="Saved";env.formAvatarUri="";env.changeView=(...a)=>compile("changeView",{...env,currentView:state.view})(...a);env.goBack=()=>compile("goBack",{...env,currentView:state.view})();
}
const dashboard=fs.readFileSync(path.join(__dirname,"Dashboard.js"),"utf8");
const dashboardAst=parse(dashboard,{sourceType:"module",plugins:["jsx"]});
const restoreNode=find(dashboardAst,n=>n.type==="VariableDeclarator"&&n.id.name==="restoreHomeScroll").init;
let restores=0,consumes=0;
const restoreEnv={homeLayout:{current:{viewport:844,content:1208}},dashboardLoading:true,restoredScroll:{current:false},initialScrollOffset:507,homeScrollRef:{current:{scrollTo:({y})=>{assert.equal(y,507);restores++;}}},onScrollRestored:()=>consumes++};
const restore=()=>new Function(...Object.keys(restoreEnv),`return (${dashboard.slice(restoreNode.start,restoreNode.end)})`)(...Object.values(restoreEnv))();
restore();assert.equal(restores,0,"Skeleton must not consume the return position");restoreEnv.dashboardLoading=false;restore();assert.equal(restores,0,"Partial layout must not clamp and consume the offset");restoreEnv.homeLayout.current.content=3622;restore();restore();assert.equal(restores,1);assert.equal(consumes,1);
(async()=>{
 reset();env.changeView("babyProfile",null,{childId:"b"});assert.equal(state.view,"dashboard");
 env.changeView("babyProfile",null,{childId:"a"});assert.equal(state.target.id,"a");assert.equal(state.view,"babyProfile");assert.equal(env.profileFlow.current.offset,507);
 compile("openEditModal",{...env,currentView:state.view})();assert.equal(state.view,"editBabyProfile");assert.equal(env.editTarget.current.id,"a");
 env.goBack();assert.equal(state.view,"babyProfile");assert.equal(state.target.id,"a");env.goBack();assert.equal(state.restore.offset,507);
 reset();env.changeView("babyProfile",null,{childId:"a"});compile("openEditModal",{...env,currentView:state.view})();
 const save=compile("handleEditProfile",env)();assert.equal(calls[0][1],"a");resolveRequest({id:"a",name:"Saved"});await save;
 assert.equal(saved[0].name,"Saved");assert.equal(saved[0].currentWeight,8);assert.equal(saved[1].name,"Other");assert.equal(state.view,"babyProfile");
 for(const change of ["baby","session","cancel","leave"]){
  reset();compile("openEditModal",env)();const pending=compile("handleEditProfile",env)();
  if(change==="baby")env.activeBabyId.current="b";if(change==="session")epoch++;if(change==="cancel")env.goBack();if(change==="leave")env.changeView("health");
  resolveRequest({id:"a",name:"Late"});await pending;assert.equal(saved[0].name,"Old",change+" rejects late local results");
 }
 reset();compile("openEditModal",env)();const failure=compile("handleEditProfile",env)();rejectRequest(new Error("Fixture failure"));await failure;
 assert.equal(state.view,"editBabyProfile");assert(calls.some(c=>c[0]==="error"));assert.equal(saved[0].name,"Old");
 reset();compile("openEditModal",env)();env.formAvatarUri="/fictional-new.jpg";env.api.uploadChildAvatar=async()=>{throw new Error("Fixture photo failure");};
 const photoFailure=compile("handleEditProfile",env)();resolveRequest({id:"a",name:"Saved before photo"});await photoFailure;
 assert.equal(saved[0].name,"Saved before photo","Successful profile update stays synchronized if photo upload fails");assert.equal(state.view,"editBabyProfile");
 console.log("Baby profile navigation checks passed: stable IDs, save/cancel/failure, scroll return, two-baby/session guards, late results.");
})().catch(e=>{console.error(e);process.exitCode=1;});
