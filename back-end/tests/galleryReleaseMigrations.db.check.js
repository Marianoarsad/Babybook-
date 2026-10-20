// Only an explicitly named disposable local database may receive this fixture schema.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),{Client}=require("pg");
const url=new URL(process.env.DATABASE_URL);
assert(["localhost","127.0.0.1","[::1]"].includes(url.hostname)&&/^\/bb_gallery_release_[a-z0-9_]+$/.test(url.pathname));
const client=new Client({connectionString:url.href});
const files=["020_milk_type_periods.sql","021_solid_food_category.sql","022_memory_favorites.sql","023_development_categories.sql"];
async function main(){await client.connect();try{
    await client.query(`CREATE TABLE children(id int PRIMARY KEY);
      INSERT INTO children VALUES(1),(2),(3);
      CREATE TABLE memories(id serial PRIMARY KEY,child_id int,caption text,photo_url text);
      CREATE TABLE milestones(id serial PRIMARY KEY,child_id int,title text,photo_url text);
      CREATE TABLE nutrition_records(id serial PRIMARY KEY,child_id int,notes text);
      CREATE TABLE schema_migrations(filename text PRIMARY KEY);
      CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now();RETURN NEW;END $$;
      INSERT INTO memories(child_id,caption,photo_url) VALUES(1,'Keep original','fixture:photo'),(3,'Third profile','fixture:third');
      INSERT INTO milestones(child_id,title,photo_url) VALUES(2,'Keep milestone','fixture:milestone');
      INSERT INTO nutrition_records(child_id,notes) VALUES(1,'Keep nutrition');`);
    const before={};for(const table of ["memories","milestones","nutrition_records"])before[table]=(await client.query(`SELECT * FROM ${table} ORDER BY id`)).rows;
    for(let run=0;run<2;run++)for(const filename of files){
        if((await client.query("SELECT 1 FROM schema_migrations WHERE filename=$1",[filename])).rowCount)continue;
        await client.query("BEGIN");try{await client.query(fs.readFileSync(path.join(__dirname,"../src/db/migrations",filename),"utf8"));await client.query("INSERT INTO schema_migrations VALUES($1)",[filename]);await client.query("COMMIT");}catch(error){await client.query("ROLLBACK");throw error;}
    }
    for(const table of Object.keys(before)){
        const after=(await client.query(`SELECT * FROM ${table} ORDER BY id`)).rows;
        for(const row of after){delete row.food_category;delete row.is_favorite;delete row.development_category;}
        assert.deepEqual(after,before[table]);
    }
    assert.equal((await client.query("SELECT count(*)::int AS count FROM schema_migrations")).rows[0].count,4);
    assert.equal((await client.query("SELECT relrowsecurity FROM pg_class WHERE oid='milk_type_periods'::regclass")).rows[0].relrowsecurity,true);
    assert.equal((await client.query("SELECT count(*)::int AS count FROM milk_type_periods")).rows[0].count,0);
    console.log("Pending production migrations 020-023 passed: original/third-profile rows preserved, correct bookkeeping, no duplicate application, empty new table and RLS enabled.");
}finally{await client.end();}}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
