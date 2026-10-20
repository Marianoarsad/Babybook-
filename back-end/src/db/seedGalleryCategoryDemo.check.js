// In-memory owner API only; no login, credentials or network connection.
const assert = require("node:assert/strict");
const { EMAIL, PREFIX, buildGallerySamples, seedGalleryDemo } = require("./seedGalleryCategoryDemo");
const children = [{ id: 1, first_name: "Elias", last_name: "Rivera" }, { id: 2, first_name: "Sofia", last_name: "Rivera" }, { id: 3, first_name: "Other", last_name: "Profile" }];
const original = [1,2,3].flatMap(child => ["memories","milestones"].map(kind => ({ id: child*10+(kind==="memories"?1:2), child_id: child, kind, caption:"Preserve",title:"Preserve",notes:"Original",description:"Original",photo_url:"original:photo",date_recorded:"2029-12-31",is_favorite:true })));
let rows,serial,writes,failAfter,missing,duplicate,loginEmail,requests;
function reset(){rows=structuredClone(original);serial=100;writes=0;failAfter=Infinity;missing=false;duplicate=false;loginEmail=EMAIL;requests=[];}
const response = body => ({ok:true,json:async()=>structuredClone(body)});
async function fakeFetch(url,options){
    requests.push(url);assert.equal(options.redirect,"error");assert(options.signal);
    const pathname=new URL(url).pathname,body=options.body?JSON.parse(options.body):null;
    if(pathname==="/api/auth/login"){assert.equal(body.email,EMAIL);return response({user:{email:loginEmail},token:"fictional"});}
    assert.equal(options.headers.Authorization,"Bearer fictional");
    if(pathname==="/api/auth/me")return response({user:{email:loginEmail}});
    if(pathname==="/api/children")return response(missing?children.slice(1):duplicate?[...children,children[0]]:children);
    const match=/^\/api\/children\/(\d+)\/(memories|milestones)(?:\/(\d+))?$/.exec(pathname);assert(match,pathname);
    const child=Number(match[1]),kind=match[2],id=Number(match[3]);
    assert.notEqual(child,3,"Third profile must never be accessed");
    if(options.method==="GET")return response(rows.filter(row=>row.child_id===child&&row.kind===kind));
    if(writes===failAfter)throw new Error("Simulated interruption");
    writes++;
    if(options.method==="POST"){
        assert(options.headers["X-Operation-Key"]?.startsWith("gallery_v1_"));
        const row={id:serial++,child_id:child,kind,is_favorite:false,...body};rows.push(row);return response(row);
    }
    assert.equal(options.method,"PUT");
    const row=rows.find(row=>row.id===id&&row.child_id===child&&row.kind===kind);assert(row);
    assert(!Object.hasOwn(body,"photo_url"));Object.assign(row,body);return response(row);
}
async function main(){
    const samples=buildGallerySamples("Elias Rivera","2029-12-31");
    assert.equal(samples.length,8);assert.equal(samples[0].fields.date_recorded,"2030-01-01");assert.equal(samples[7].fields.date_recorded,"2030-01-08");
    assert(samples.every(sample=>sample.fields[sample.kind==="memory"?"notes":"description"].startsWith(PREFIX)));
    assert(samples.every(sample=>sample.fields[sample.kind==="memory"?"caption":"title"].startsWith("Demo: ")));
    assert.equal(new Set(samples.map(sample=>sample.kind+sample.fields.development_category)).size,8);
    for(const target of ["local","production"]){
        reset();const options={target,password:"fictional",today:"2026-10-20",fetchImpl:fakeFetch};
        const first=await seedGalleryDemo(options);assert(first.profiles.every(profile=>profile.inserted===8));assert.equal(writes,16);
        assert.deepEqual(rows.slice(0,original.length),original);
        const before=JSON.stringify(rows);writes=0;const retry=await seedGalleryDemo(options);
        assert(retry.profiles.every(profile=>profile.unchanged===8));assert.equal(writes,0);assert.equal(JSON.stringify(rows),before);
        assert(requests.every(url=>new URL(url).origin===(target==="local"?"http://localhost:4000":"https://babybook-xi2w.onrender.com")));
        for(const row of rows.slice(original.length))row.date_recorded="2020-01-01";
        writes=0;const repaired=await seedGalleryDemo(options);assert(repaired.profiles.every(profile=>profile.updated===8));assert.equal(writes,16);
    }
    for(const invalid of ["missing","duplicate","identity"]){
        reset();missing=invalid==="missing";duplicate=invalid==="duplicate";if(invalid==="identity")loginEmail="someone-else@example.com";
        await assert.rejects(seedGalleryDemo({password:"fictional",fetchImpl:fakeFetch}));assert.equal(writes,0);
    }
    reset();failAfter=3;await assert.rejects(seedGalleryDemo({password:"fictional",fetchImpl:fakeFetch}));
    failAfter=Infinity;await seedGalleryDemo({password:"fictional",fetchImpl:fakeFetch});assert.equal(rows.length,original.length+16);
    reset();rows.push({...original[0],id:80,notes:`${PREFIX}memory:social] Duplicate`},{...original[0],id:81,notes:`${PREFIX}memory:social] Duplicate`});
    await assert.rejects(seedGalleryDemo({password:"fictional",fetchImpl:fakeFetch}));assert.equal(writes,0);
    await assert.rejects(seedGalleryDemo({target:"other",password:"fictional",fetchImpl:fakeFetch}));
    await assert.rejects(seedGalleryDemo({fetchImpl:fakeFetch}));
    console.log("Gallery seed checks passed: both targets, four categories/two kinds, first-page dates, account/profile guards, preserved originals, idempotent updates and interrupted-run recovery.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
